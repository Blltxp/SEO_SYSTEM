import { db, isPostgres } from "./db"
import { checkKeywordRank } from "./googleRank"
import { getKeywords } from "./titleSuggestions"
import { getSites } from "./titleSuggestions"

const NOT_FOUND_RANK = 999
const RANK_CHECK_LOCK_TTL_MS = 30 * 60 * 1000
const DEFAULT_DELAY_BETWEEN_KEYWORDS_MS = 4000
type PersistedRankRow = {
  site_slug: string
  keyword: string
  rank: number
  url: string | null
}

export type ManualRankEntryInput = {
  site_slug: string
  keyword: string
  input: string
}

type LatestRankResponse = {
  recordedAt: string
  rows: { site_slug: string; keyword: string; rank: number; url: string | null }[]
}

export async function getRanksByRecordedAt(recordedAt?: string): Promise<LatestRankResponse> {
  const normalizedRecordedAt = recordedAt?.trim() ?? ""
  if (!normalizedRecordedAt) {
    return { recordedAt: "", rows: [] }
  }

  const rows = (await db
    .prepare(
      `SELECT site_slug, keyword, rank, url FROM rank_history WHERE recorded_date = ? ORDER BY keyword, site_slug`
    )
    .all(normalizedRecordedAt)) as { site_slug: string; keyword: string; rank: number; url: string | null }[]

  return { recordedAt: rows.length > 0 ? normalizedRecordedAt : "", rows }
}

export async function getAvailableRecordedDates(limit = 100): Promise<string[]> {
  const rows = (await db
    .prepare(
      `SELECT recorded_date
       FROM rank_history
       GROUP BY recorded_date
       ORDER BY recorded_date DESC
       LIMIT ?`
    )
    .all(limit)) as { recorded_date: string }[]
  return rows.map((row) => row.recorded_date)
}

export type RecordedDateWithCount = { recorded_date: string; row_count: number }

/** รายการ recorded_date พร้อมจำนวนแถว — ใช้ในหน้าการจัดการข้อมูล (ลบข้อมูลซ้ำซ้อน) */
export async function getRecordedDatesWithCounts(limit = 300): Promise<RecordedDateWithCount[]> {
  const rows = (await db
    .prepare(
      `SELECT recorded_date, COUNT(*) as row_count
       FROM rank_history
       GROUP BY recorded_date
       ORDER BY recorded_date DESC
       LIMIT ?`
    )
    .all(limit)) as { recorded_date: string; row_count: number }[]
  return rows.map((r) => ({ recorded_date: r.recorded_date, row_count: Number(r.row_count) }))
}

/** ลบ rank_history ตาม recorded_date ที่ระบุ — คืนจำนวนแถวที่ลบ */
export async function deleteRankHistoryByRecordedDates(recordedDates: string[]): Promise<number> {
  const filtered = recordedDates.filter((s) => s?.trim()).map((s) => s.trim())
  if (filtered.length === 0) return 0
  const placeholders = filtered.map(() => "?").join(", ")
  const sql = `DELETE FROM rank_history WHERE recorded_date IN (${placeholders})`
  const result = await db.prepare(sql).run(...filtered)
  return result.changes
}

/** รอ ms มิลลิวินาที */
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** เวลาท้องถิ่นแบบ 24 ชม. (YYYY-MM-DD HH:mm:ss) = ตรงกับตอนกดปุ่ม/รันเช็ค */
function nowLocal24(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function parseRecordedAt(value: string): number | null {
  const parsed = new Date(value.replace(" ", "T"))
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
}

async function acquireAppLock(lockKey: string): Promise<boolean> {
  const current = (await db
    .prepare("SELECT locked_at FROM app_locks WHERE lock_key = ?")
    .get(lockKey)) as { locked_at: string } | undefined

  if (current) {
    const lockedAt = parseRecordedAt(current.locked_at)
    if (lockedAt != null && Date.now() - lockedAt > RANK_CHECK_LOCK_TTL_MS) {
      await releaseAppLock(lockKey)
    }
  }

  const insertSql = isPostgres
    ? `INSERT INTO app_locks (lock_key, locked_at) VALUES ($1, $2) ON CONFLICT (lock_key) DO NOTHING`
    : `INSERT OR IGNORE INTO app_locks (lock_key, locked_at) VALUES (?, ?)`
  const result = await db.prepare(insertSql).run(lockKey, nowLocal24())
  return result.changes > 0
}

async function releaseAppLock(lockKey: string): Promise<void> {
  await db.prepare("DELETE FROM app_locks WHERE lock_key = ?").run(lockKey)
}

async function isAppLockActive(lockKey: string): Promise<boolean> {
  const row = (await db
    .prepare("SELECT lock_key FROM app_locks WHERE lock_key = ?")
    .get(lockKey)) as { lock_key: string } | undefined
  return !!row
}

async function getExistingRankRow(
  recordedAt: string,
  siteSlug: string,
  keyword: string
): Promise<PersistedRankRow | null> {
  const row = (await db
    .prepare(
      `SELECT site_slug, keyword, rank, url
       FROM rank_history
       WHERE recorded_date = ? AND site_slug = ? AND keyword = ?`
    )
    .get(recordedAt, siteSlug, keyword)) as PersistedRankRow | undefined
  return row ?? null
}

async function saveRankRows(recordedAt: string, rows: PersistedRankRow[]): Promise<void> {
  const insertSql = isPostgres
    ? `INSERT INTO rank_history (recorded_date, site_slug, keyword, rank, url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (recorded_date, site_slug, keyword) DO UPDATE SET rank = EXCLUDED.rank, url = EXCLUDED.url`
    : `INSERT OR REPLACE INTO rank_history (recorded_date, site_slug, keyword, rank, url)
       VALUES (?, ?, ?, ?, ?)`
  const saveAll = db.transaction((tx) => {
    const insert = tx(insertSql)
    return async (inputRows: PersistedRankRow[]) => {
      for (const row of inputRows) {
        await insert.run(recordedAt, row.site_slug, row.keyword, row.rank, row.url)
      }
    }
  })
  await saveAll(rows)
}

function parseManualRankInput(input: string): number {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error("กรุณากรอกค่าอันดับหรือใส่ -")
  }

  if (trimmed === "-") {
    return NOT_FOUND_RANK
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/)
  if (slashMatch) {
    const position = Number(slashMatch[1])
    const page = Number(slashMatch[2])
    if (position < 1 || position > 10) {
      throw new Error("รูปแบบอันดับต้องเป็นตำแหน่ง 1-10 ต่อหน้า เช่น 1/8")
    }
    if (page < 1 || page > 10) {
      throw new Error("เลขหน้าต้องอยู่ระหว่าง 1-10")
    }
    return (page - 1) * 10 + position
  }

  const numericRank = Number(trimmed.replace(/^#/, ""))
  if (Number.isInteger(numericRank) && numericRank >= 1 && numericRank <= 100) {
    return numericRank
  }

  throw new Error("กรอกได้เฉพาะรูปแบบ 1/8, 71 หรือ -")
}

/**
 * รันเช็คอันดับทั้ง 19 keyword แล้วบันทึกลง rank_history
 * recorded_date = เวลาท้องถิ่น 24 ชม. ตอนเริ่มรัน (ตรงกับตอนกดปุ่ม)
 */
export async function runRankCheck(options?: {
  delayBetweenKeywordsMs?: number
  onProgress?: (keyword: string, index: number, total: number) => void
  checkKeywordRankFn?: (keyword: string) => Promise<{ site_slug: string; rank: number; url: string }[]>
}): Promise<{ recordedAt: string; counts: { found: number; notFound: number } }> {
  if (!(await acquireAppLock("rank_check"))) {
    throw new Error("มีการเช็คอันดับอีกรอบกำลังทำงานอยู่ กรุณารอสักครู่แล้วลองใหม่")
  }

  const keywords = await getKeywords()
  const sites = await getSites()
  const delayMs = options?.delayBetweenKeywordsMs ?? DEFAULT_DELAY_BETWEEN_KEYWORDS_MS
  const recordedAt = nowLocal24()

  let found = 0
  let notFound = 0
  const pendingRows: PersistedRankRow[] = []

  try {
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i]
      options?.onProgress?.(keyword, i + 1, keywords.length)

      const results = await (options?.checkKeywordRankFn ?? checkKeywordRank)(keyword)

      for (const site of sites) {
        const r = results.find((x) => x.site_slug === site.slug)
        if (r) {
          pendingRows.push({
            site_slug: site.slug,
            keyword,
            rank: r.rank,
            url: r.url ?? null
          })
          found++
        } else {
          pendingRows.push({
            site_slug: site.slug,
            keyword,
            rank: NOT_FOUND_RANK,
            url: null
          })
          notFound++
        }
      }

      if (i < keywords.length - 1) await delay(delayMs)
    }

    await saveRankRows(recordedAt, pendingRows)
    return { recordedAt, counts: { found, notFound } }
  } finally {
    await releaseAppLock("rank_check")
  }
}

export async function getLatestRecordedAt(): Promise<string> {
  const latest = (await db
    .prepare(`SELECT MAX(recorded_date) as recorded_date FROM rank_history`)
    .get()) as { recorded_date: string } | undefined
  return latest?.recorded_date ?? ""
}

export async function runKeywordRankCheck(
  keyword: string,
  options?: {
    recordedAt?: string
    checkKeywordRankFn?: (keyword: string) => Promise<{ site_slug: string; rank: number; url: string }[]>
  }
): Promise<{
  recordedAt: string
  rows: PersistedRankRow[]
  counts: { found: number; notFound: number }
}> {
  const sites = await getSites()
  const recordedAt = options?.recordedAt?.trim() || (await getLatestRecordedAt()) || nowLocal24()
  const results = await (options?.checkKeywordRankFn ?? checkKeywordRank)(keyword)

  let found = 0
  let notFound = 0
  const rows: PersistedRankRow[] = sites.map((site) => {
    const matched = results.find((x) => x.site_slug === site.slug)
    if (matched) {
      found += 1
      return {
        site_slug: site.slug,
        keyword,
        rank: matched.rank,
        url: matched.url ?? null
      }
    }
    notFound += 1
    return {
      site_slug: site.slug,
      keyword,
      rank: NOT_FOUND_RANK,
      url: null
    }
  })

  await saveRankRows(recordedAt, rows)
  return { recordedAt, rows, counts: { found, notFound } }
}

export async function saveManualRankEntries(
  recordedAt: string,
  entries: ManualRankEntryInput[]
): Promise<PersistedRankRow[]> {
  if (await isAppLockActive("rank_check")) {
    throw new Error("กำลังมีการเช็คอันดับอยู่ กรุณารอให้จบรอบก่อนแล้วค่อยบันทึกแมนนวล")
  }

  const latest = await getLatestRecordedAt()
  const normalizedRecordedAt = recordedAt.trim() || latest
  if (!normalizedRecordedAt) {
    throw new Error("ยังไม่มีรอบข้อมูลล่าสุดสำหรับบันทึกแมนนวล")
  }
  if (normalizedRecordedAt !== latest) {
    throw new Error("ข้อมูลที่กำลังแก้ไม่ใช่รอบล่าสุดแล้ว กรุณารีเฟรชหน้าเพื่อดึงข้อมูลล่าสุดก่อนบันทึก")
  }

  const allowedSites = new Set((await getSites()).map((site) => site.slug))
  const allowedKeywords = new Set(await getKeywords())

  const rows: PersistedRankRow[] = []
  for (const entry of entries) {
    const siteSlug = entry.site_slug.trim()
    const keyword = entry.keyword.trim()
    if (!allowedSites.has(siteSlug)) {
      throw new Error(`ไม่พบเว็บ ${siteSlug}`)
    }
    if (!allowedKeywords.has(keyword)) {
      throw new Error(`ไม่พบ keyword ${keyword}`)
    }

    rows.push({
      site_slug: siteSlug,
      keyword,
      rank: parseManualRankInput(entry.input),
      url: (await getExistingRankRow(normalizedRecordedAt, siteSlug, keyword))?.url ?? null
    })
  }

  await saveRankRows(normalizedRecordedAt, rows)
  return rows
}

/** ดึงข้อมูลอันดับล่าสุด (แต่ละ recorded_date ล่าสุดต่อ (site_slug, keyword)) */
export async function getLatestRanks(): Promise<{
  recordedAt: string
  rows: { site_slug: string; keyword: string; rank: number; url: string | null }[]
}> {
  const latest = (await db
    .prepare(`SELECT MAX(recorded_date) as recorded_date FROM rank_history`)
    .get()) as { recorded_date: string } | undefined
  if (!latest?.recorded_date) {
    return { recordedAt: "", rows: [] }
  }
  return getRanksByRecordedAt(latest.recorded_date)
}

export async function getPreviousRanks(referenceRecordedAt?: string): Promise<LatestRankResponse> {
  const latestRecordedAt = referenceRecordedAt?.trim() || (await getLatestRecordedAt())
  if (!latestRecordedAt) {
    return { recordedAt: "", rows: [] }
  }

  const previous = (await db
    .prepare(
      `SELECT recorded_date
       FROM rank_history
       WHERE recorded_date < ?
       GROUP BY recorded_date
       ORDER BY recorded_date DESC
       LIMIT 1`
    )
    .get(latestRecordedAt)) as { recorded_date: string } | undefined

  if (!previous?.recorded_date) {
    return { recordedAt: "", rows: [] }
  }

  return getRanksByRecordedAt(previous.recorded_date)
}

/** ดึง rank_history ตาม keyword และช่วงเวลา (สำหรับกราฟ) — from/to เป็น local datetime string */
export async function getRankHistoryForGraph(
  keyword: string,
  fromRecordedAt: string,
  toRecordedAt: string
): Promise<{ recorded_date: string; site_slug: string; rank: number }[]> {
  const rows = (await db
    .prepare(
      `SELECT recorded_date, site_slug, rank FROM rank_history
       WHERE keyword = ? AND recorded_date >= ? AND recorded_date <= ?
       ORDER BY recorded_date, site_slug`
    )
    .all(keyword, fromRecordedAt, toRecordedAt)) as {
    recorded_date: string
    site_slug: string
    rank: number
  }[]
  return rows
}

/** ดึงค่าเฉลี่ยอันดับ (เฉพาะที่พบ, rank < 999) ต่อ recorded_date, site_slug — ตรงกับแถวเฉลี่ยใน heatmap */
export async function getRankHistoryAverageForGraph(
  fromRecordedAt: string,
  toRecordedAt: string
): Promise<{ recorded_date: string; site_slug: string; rank: number }[]> {
  const rows = (await db
    .prepare(
      `SELECT recorded_date, site_slug, AVG(rank) as rank FROM rank_history
       WHERE recorded_date >= ? AND recorded_date <= ? AND rank < ?
       GROUP BY recorded_date, site_slug
       ORDER BY recorded_date, site_slug`
    )
    .all(fromRecordedAt, toRecordedAt, NOT_FOUND_RANK)) as {
    recorded_date: string
    site_slug: string
    rank: number
  }[]
  return rows.map((r) => ({ ...r, rank: Number(r.rank) }))
}

/** ลบ rank_history ที่เก่ากว่า retentionYears ปี — ใช้เพื่อประหยัดพื้นที่บน Cloud */
export async function cleanupOldRankHistory(retentionYears = 1): Promise<number> {
  const sql = isPostgres
    ? `DELETE FROM rank_history WHERE (recorded_date::timestamp)::date < CURRENT_DATE - INTERVAL '${retentionYears} year'`
    : `DELETE FROM rank_history WHERE date(recorded_date) < date('now', '-${retentionYears} years')`
  const result = await db.prepare(sql).run()
  return result.changes
}
