import { db } from "./db"
import { checkKeywordRank } from "./googleRank"
import { getKeywords } from "./titleSuggestions"
import { getSites } from "./titleSuggestions"

const NOT_FOUND_RANK = 999
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

function saveRankRows(recordedAt: string, rows: PersistedRankRow[]) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO rank_history (recorded_date, site_slug, keyword, rank, url)
    VALUES (?, ?, ?, ?, ?)
  `)
  const saveAll = db.transaction((inputRows: PersistedRankRow[]) => {
    for (const row of inputRows) {
      insert.run(recordedAt, row.site_slug, row.keyword, row.rank, row.url)
    }
  })
  saveAll(rows)
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
  const keywords = getKeywords()
  const sites = getSites()
  const delayMs = options?.delayBetweenKeywordsMs ?? 2000
  const recordedAt = nowLocal24()

  let found = 0
  let notFound = 0
  const pendingRows: PersistedRankRow[] = []

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

  saveRankRows(recordedAt, pendingRows)

  return { recordedAt, counts: { found, notFound } }
}

export function getLatestRecordedAt(): string {
  const latest = db
    .prepare(`SELECT MAX(recorded_date) as recorded_date FROM rank_history`)
    .get() as { recorded_date: string } | undefined
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
  const sites = getSites()
  const recordedAt = options?.recordedAt?.trim() || getLatestRecordedAt() || nowLocal24()
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

  saveRankRows(recordedAt, rows)
  return { recordedAt, rows, counts: { found, notFound } }
}

export function saveManualRankEntries(
  recordedAt: string,
  entries: ManualRankEntryInput[]
): PersistedRankRow[] {
  const normalizedRecordedAt = recordedAt.trim() || getLatestRecordedAt()
  if (!normalizedRecordedAt) {
    throw new Error("ยังไม่มีรอบข้อมูลล่าสุดสำหรับบันทึกแมนนวล")
  }

  const allowedSites = new Set(getSites().map((site) => site.slug))
  const allowedKeywords = new Set(getKeywords())

  const rows = entries.map((entry) => {
    const siteSlug = entry.site_slug.trim()
    const keyword = entry.keyword.trim()
    if (!allowedSites.has(siteSlug)) {
      throw new Error(`ไม่พบเว็บ ${siteSlug}`)
    }
    if (!allowedKeywords.has(keyword)) {
      throw new Error(`ไม่พบ keyword ${keyword}`)
    }

    return {
      site_slug: siteSlug,
      keyword,
      rank: parseManualRankInput(entry.input),
      url: null
    }
  })

  saveRankRows(normalizedRecordedAt, rows)
  return rows
}

/** ดึงข้อมูลอันดับล่าสุด (แต่ละ recorded_date ล่าสุดต่อ (site_slug, keyword)) */
export function getLatestRanks(): {
  recordedAt: string
  rows: { site_slug: string; keyword: string; rank: number; url: string | null }[]
} {
  const latest = db
    .prepare(
      `SELECT MAX(recorded_date) as recorded_date FROM rank_history`
    )
    .get() as { recorded_date: string } | undefined
  if (!latest?.recorded_date) {
    return { recordedAt: "", rows: [] }
  }
  const rows = db
    .prepare(
      `SELECT site_slug, keyword, rank, url FROM rank_history WHERE recorded_date = ? ORDER BY keyword, site_slug`
    )
    .all(latest.recorded_date) as { site_slug: string; keyword: string; rank: number; url: string | null }[]
  return { recordedAt: latest.recorded_date, rows }
}

export function getPreviousRanks(referenceRecordedAt?: string): LatestRankResponse {
  const latestRecordedAt = referenceRecordedAt?.trim() || getLatestRecordedAt()
  if (!latestRecordedAt) {
    return { recordedAt: "", rows: [] }
  }

  const previous = db
    .prepare(
      `SELECT recorded_date
       FROM rank_history
       WHERE recorded_date < ?
       GROUP BY recorded_date
       ORDER BY recorded_date DESC
       LIMIT 1`
    )
    .get(latestRecordedAt) as { recorded_date: string } | undefined

  if (!previous?.recorded_date) {
    return { recordedAt: "", rows: [] }
  }

  const rows = db
    .prepare(
      `SELECT site_slug, keyword, rank, url FROM rank_history WHERE recorded_date = ? ORDER BY keyword, site_slug`
    )
    .all(previous.recorded_date) as { site_slug: string; keyword: string; rank: number; url: string | null }[]

  return { recordedAt: previous.recorded_date, rows }
}

/** ดึง rank_history ตาม keyword และช่วงเวลา (สำหรับกราฟ) — fromDate/toDate เป็น YYYY-MM-DD */
export function getRankHistoryForGraph(
  keyword: string,
  fromDate: string,
  toDate: string
): { recorded_date: string; site_slug: string; rank: number }[] {
  const rows = db
    .prepare(
      `SELECT recorded_date, site_slug, rank FROM rank_history
       WHERE keyword = ? AND date(recorded_date) >= date(?) AND date(recorded_date) <= date(?)
       ORDER BY recorded_date, site_slug`
    )
    .all(keyword, fromDate, toDate) as {
    recorded_date: string
    site_slug: string
    rank: number
  }[]
  return rows
}
