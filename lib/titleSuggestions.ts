import { db } from "./db"
import { suggestTitles } from "./titleTemplates"

export type TitleSuggestion = {
  keyword: string
  title: string
  alreadyUsed: boolean
}

export type Site = {
  id: number
  slug: string
  name: string
}

/** หัวข้อที่มีแล้ว (ทั้งหมด หรือเฉพาะเว็บที่ระบุ) */
function getExistingTitles(siteSlug?: string): Set<string> {
  const query =
    siteSlug != null
      ? "SELECT title FROM posts WHERE source = ?"
      : "SELECT title FROM posts"
  const rows = (
    siteSlug != null
      ? db.prepare(query).all(siteSlug)
      : db.prepare(query).all()
  ) as { title: string }[]
  return new Set(rows.map((r) => r.title.trim().toLowerCase()))
}

export function getSites(): Site[] {
  const rows = db
    .prepare("SELECT id, slug, name FROM sites ORDER BY sort_order, id")
    .all() as Site[]
  return rows
}

/**
 * รายการ keyword — ถ้าใส่ siteSlug และเว็บนั้นมี site_keywords จะคืนเฉพาะ keyword ของเว็บ
 * ไม่มี = ใช้ทุก keyword
 */
export function getKeywords(siteSlug?: string): string[] {
  if (siteSlug?.trim()) {
    const withSite = db
      .prepare(
        `SELECT k.keyword FROM keywords k
         INNER JOIN site_keywords sk ON sk.keyword_id = k.id
         INNER JOIN sites s ON s.id = sk.site_id
         WHERE s.slug = ?
         ORDER BY k.sort_order, k.id`
      )
      .all(siteSlug) as { keyword: string }[]
    if (withSite.length > 0) return withSite.map((r) => r.keyword)
  }
  const rows = db
    .prepare("SELECT keyword FROM keywords ORDER BY sort_order, id")
    .all() as { keyword: string }[]
  return rows.map((r) => r.keyword)
}

/**
 * สร้างหัวข้อแนะนำจาก 12 keyword (เทมเพลต SEO ไทย ไม่เสียเงิน)
 * site = แสดงหัวข้อที่เหมาะกับเว็บนี้ (ใช้ keyword ของเว็บ + ซ่อนหัวข้อที่มีในเว็บนี้แล้ว)
 * excludeExisting = ไม่แสดงหัวข้อที่เคยมีแล้ว (ทั้งหมดหรือเฉพาะเว็บตาม site)
 */
export function getTitleSuggestions(options?: {
  keyword?: string
  excludeExisting?: boolean
  site?: string
}): TitleSuggestion[] {
  let keywords = getKeywords(options?.site)
  if (options?.keyword?.trim()) {
    const k = options.keyword.trim()
    keywords = keywords.filter((kw) => kw.includes(k) || k.includes(kw))
  }
  const suggestions = suggestTitles(keywords)
  const existing =
    options?.excludeExisting ? getExistingTitles(options?.site) : null

  let result: TitleSuggestion[] = suggestions.map(({ keyword, title }) => ({
    keyword,
    title,
    alreadyUsed: existing ? existing.has(title.trim().toLowerCase()) : false
  }))
  if (options?.excludeExisting) {
    result = result.filter((s) => !s.alreadyUsed)
  }
  return result
}
