import { db } from "./db"
import type { WebsiteStatusResult } from "./websiteStatus"

/** บันทึกผลเช็คสถานะเว็บ (เขียนทับของเก่าทั้งหมด) คืนค่าเวลาเช็ค ISO */
export async function saveWebsiteStatus(results: WebsiteStatusResult[]): Promise<string> {
  const checkedAt = new Date().toISOString()
  const del = db.prepare("DELETE FROM website_status")
  await del.run()

  const insert = db.prepare(`
    INSERT INTO website_status (site_slug, name, url, load_time_ms, load_status, line_ok, phone_ok, line_reason, phone_reason, error, checked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const r of results) {
    await insert.run(
      r.slug,
      r.name,
      r.url,
      r.loadTimeMs ?? null,
      r.loadStatus,
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
      "SELECT site_slug, name, url, load_time_ms, load_status, line_ok, phone_ok, line_reason, phone_reason, error, checked_at FROM website_status ORDER BY site_slug"
    )
    .all()) as {
    site_slug: string
    name: string
    url: string
    load_time_ms: number | null
    load_status: string
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
