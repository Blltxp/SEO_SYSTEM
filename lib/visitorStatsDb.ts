import { db } from "./db"
import type { SiteVisitorSnapshot } from "./visitorStats"

/** วันที่วันนี้ (Bangkok) รูปแบบ YYYY-MM-DD */
export function getTodayRecordedDate(): string {
  const now = new Date()
  const thai = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }))
  const y = thai.getFullYear()
  const m = String(thai.getMonth() + 1).padStart(2, "0")
  const d = String(thai.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export type VisitorStatsRow = {
  site_slug: string
  site_name: string
  total_visitors: number | null
  morning_round: number | null
  evening_round: number | null
  /** ทั้งหมด = รอบเช้า + รอบเย็น (แบบ B) */
  total_today: number
}

/** ดึงรายการวันที่ที่มีข้อมูล visitor stats */
export async function getAvailableVisitorDates(): Promise<string[]> {
  const rows = (await db
    .prepare(
      "SELECT DISTINCT recorded_date FROM site_visitor_stats ORDER BY recorded_date DESC LIMIT 60"
    )
    .all()) as { recorded_date: string }[]
  return rows.map((r) => r.recorded_date)
}

/** ดึงสถิติผู้เข้าชมตามวันที่ (รวมชื่อเว็บจาก sites) */
export async function getVisitorStatsByDate(
  recordedDate: string
): Promise<{ date: string; rows: VisitorStatsRow[] }> {
  const rows = (await db
    .prepare(
      `SELECT v.recorded_date, v.site_slug, s.name AS site_name,
              v.total_visitors, v.morning_round, v.evening_round
       FROM site_visitor_stats v
       LEFT JOIN sites s ON s.slug = v.site_slug
       WHERE v.recorded_date = ?
       ORDER BY s.sort_order, s.id`
    )
    .all(recordedDate)) as {
    recorded_date: string
    site_slug: string
    site_name: string | null
    total_visitors: number | null
    morning_round: number | null
    evening_round: number | null
  }[]

  const visitorRows: VisitorStatsRow[] = rows.map((r) => {
    const morning = r.morning_round ?? 0
    const evening = r.evening_round ?? 0
    const totalToday = evening != null && evening > 0 ? morning + evening : morning
    return {
      site_slug: r.site_slug,
      site_name: r.site_name ?? r.site_slug,
      total_visitors: r.total_visitors,
      morning_round: r.morning_round,
      evening_round: r.evening_round,
      total_today: totalToday
    }
  })

  return { date: recordedDate, rows: visitorRows }
}

const nowIso = () => new Date().toISOString().slice(0, 19).replace("T", " ")

/** บันทึกผลจากบอทรอบเช้า: ใส่ยอดรวม + รอบเช้า */
export async function saveMorningRound(
  recordedDate: string,
  results: SiteVisitorSnapshot[]
): Promise<number> {
  const updatedAt = nowIso()
  const stmt = await db.prepare(`
    INSERT INTO site_visitor_stats (recorded_date, site_slug, total_visitors, morning_round, evening_round, updated_at)
    VALUES (?, ?, ?, ?, NULL, ?)
    ON CONFLICT(recorded_date, site_slug) DO UPDATE SET
      total_visitors = excluded.total_visitors,
      morning_round = excluded.morning_round,
      evening_round = NULL,
      updated_at = excluded.updated_at
  `)
  let count = 0
  for (const r of results) {
    await stmt.run(recordedDate, r.slug, r.total, r.today, updatedAt)
    count++
  }
  return count
}

/** บันทึกผลจากบอทรอบเย็น: อัปเดตยอดรวม + คำนวณรอบเย็น = วันนี้ - รอบเช้า */
export async function saveEveningRound(
  recordedDate: string,
  results: SiteVisitorSnapshot[]
): Promise<number> {
  const getRow = await db.prepare(
    "SELECT morning_round FROM site_visitor_stats WHERE recorded_date = ? AND site_slug = ?"
  )
  const updatedAt = nowIso()
  const upsert = await db.prepare(`
    INSERT INTO site_visitor_stats (recorded_date, site_slug, total_visitors, morning_round, evening_round, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(recorded_date, site_slug) DO UPDATE SET
      total_visitors = excluded.total_visitors,
      evening_round = excluded.evening_round,
      updated_at = excluded.updated_at
  `)
  let count = 0
  for (const r of results) {
    const existing = (await getRow.get(recordedDate, r.slug)) as { morning_round: number | null } | undefined
    const morning = existing?.morning_round ?? 0
    const eveningRound = Math.max(0, r.today - morning)
    await upsert.run(recordedDate, r.slug, r.total, morning, eveningRound, updatedAt)
    count++
  }
  return count
}

export type ManualVisitorEntry = {
  site_slug: string
  total_visitors?: number | null
  morning_round?: number | null
  evening_round?: number | null
}

/** บันทึกค่าที่กรอกมือ (สำหรับเว็บที่บอทดึงไม่ได้ เช่น นาซ่า แม่บ้านดีดีเซอร์วิส) — merge กับค่าที่มีอยู่ */
export async function saveManualVisitorEntries(
  recordedDate: string,
  entries: ManualVisitorEntry[]
): Promise<number> {
  const getRow = await db.prepare(
    "SELECT total_visitors, morning_round, evening_round FROM site_visitor_stats WHERE recorded_date = ? AND site_slug = ?"
  )
  const upsert = await db.prepare(`
    INSERT INTO site_visitor_stats (recorded_date, site_slug, total_visitors, morning_round, evening_round, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(recorded_date, site_slug) DO UPDATE SET
      total_visitors = excluded.total_visitors,
      morning_round = excluded.morning_round,
      evening_round = excluded.evening_round,
      updated_at = excluded.updated_at
  `)
  const updatedAt = nowIso()
  let count = 0
  for (const entry of entries) {
    const existing = (await getRow.get(recordedDate, entry.site_slug)) as
      | { total_visitors: number | null; morning_round: number | null; evening_round: number | null }
      | undefined
    const total = entry.total_visitors !== undefined ? entry.total_visitors : (existing?.total_visitors ?? null)
    const morning = entry.morning_round !== undefined ? entry.morning_round : (existing?.morning_round ?? null)
    const evening = entry.evening_round !== undefined ? entry.evening_round : (existing?.evening_round ?? null)
    await upsert.run(recordedDate, entry.site_slug, total, morning, evening, updatedAt)
    count++
  }
  return count
}
