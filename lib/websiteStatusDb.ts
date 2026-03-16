import { db } from "./db"
import type { WebsiteStatusResult } from "./websiteStatus"

/** บันทึกผลเช็คสถานะเว็บ — ความเร็ว (load_time/full_load) ใช้ของเดิมถ้ามี ไม่ทับด้วย null */
export async function saveWebsiteStatus(results: WebsiteStatusResult[]): Promise<string> {
  const checkedAt = new Date().toISOString()
  const existing = await getLatestWebsiteStatus()
  const bySlug = new Map(existing.results.map((row) => [row.slug, row]))

  const del = db.prepare("DELETE FROM website_status")
  await del.run()

  const insert = db.prepare(`
    INSERT INTO website_status (site_slug, name, url, load_time_ms, load_status, full_load_time_ms, full_load_status, line_ok, phone_ok, line_reason, phone_reason, error, checked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const r of results) {
    const prev = bySlug.get(r.slug)
    const loadTimeMs = r.loadTimeMs ?? prev?.loadTimeMs ?? null
    const loadStatus = r.loadStatus || prev?.loadStatus || ""
    const fullLoadTimeMs = r.fullLoadTimeMs ?? prev?.fullLoadTimeMs ?? null
    const fullLoadStatus = r.fullLoadStatus || prev?.fullLoadStatus || ""

    await insert.run(
      r.slug,
      r.name,
      r.url,
      loadTimeMs,
      loadStatus,
      fullLoadTimeMs,
      fullLoadStatus,
      r.lineOk ? 1 : 0,
      r.phoneOk ? 1 : 0,
      r.lineReason ?? null,
      r.phoneReason ?? null,
      r.error ?? null,
      checkedAt
    )
  }

  return checkedAt
}

/** ดึงผลเช็คสถานะเว็บล่าสุด (และเวลาเช็ค) */
export async function getLatestWebsiteStatus(): Promise<{
  results: WebsiteStatusResult[]
  checkedAt: string | null
}> {
  const rows = (await db
    .prepare(
      "SELECT site_slug, name, url, load_time_ms, load_status, full_load_time_ms, full_load_status, line_ok, phone_ok, line_reason, phone_reason, error, checked_at FROM website_status ORDER BY site_slug"
    )
    .all()) as {
    site_slug: string
    name: string
    url: string
    load_time_ms: number | null
    load_status: string
    full_load_time_ms: number | null
    full_load_status: string
    line_ok: number
    phone_ok: number
    line_reason: string | null
    phone_reason: string | null
    error: string | null
    checked_at: string
  }[]

  if (rows.length === 0) {
    return { results: [], checkedAt: null }
  }

  const results: WebsiteStatusResult[] = rows.map((r) => ({
    slug: r.site_slug,
    name: r.name,
    url: r.url,
    loadTimeMs: r.load_time_ms,
    loadStatus: r.load_status,
    fullLoadTimeMs: r.full_load_time_ms ?? null,
    fullLoadStatus: r.full_load_status ?? "ล้มเหลว",
    lineOk: !!r.line_ok,
    phoneOk: !!r.phone_ok,
    lineReason: r.line_reason ?? undefined,
    phoneReason: r.phone_reason ?? undefined,
    error: r.error ?? undefined
  }))

  return {
    results,
    checkedAt: rows[0].checked_at
  }
}

function speedToStatus(ms: number | null): string {
  if (ms == null) return ""
  if (ms <= 1000) return "ปกติ"
  if (ms <= 1500) return "เริ่มช้า"
  return "ช้า"
}

/** อัปเดตความเร็วที่กรอกเอง (วิ) ไม่แตะ line_ok, phone_ok */
export async function updateWebsiteStatusSpeed(updates: { slug: string; speedSec: number | null }[]): Promise<void> {
  const updateStmt = db.prepare(`
    UPDATE website_status SET full_load_time_ms = ?, full_load_status = ?, load_time_ms = ?, load_status = ?
    WHERE site_slug = ?
  `)
  for (const u of updates) {
    const ms = u.speedSec != null ? Math.round(u.speedSec * 1000) : null
    const status = speedToStatus(ms)
    await updateStmt.run(ms, status, ms, status, u.slug)
  }
}
