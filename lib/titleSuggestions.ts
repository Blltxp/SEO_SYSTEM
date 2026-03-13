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
async function getExistingTitles(siteSlug?: string): Promise<{ exact: Set<string>; list: string[] }> {
  let rows: { title: string }[] = []
  if (siteSlug != null) {
    const site = (await db
      .prepare("SELECT slug, name FROM sites WHERE slug = ?")
      .get(siteSlug)) as { slug: string; name: string } | undefined

    rows = (await db
      .prepare("SELECT title FROM posts WHERE source IN (?, ?)")
      .all(siteSlug, site?.name ?? siteSlug)) as { title: string }[]
  } else {
    rows = (await db.prepare("SELECT title FROM posts").all()) as { title: string }[]
  }
  const list = rows.map((r) => (r as { title: string }).title.trim().toLowerCase()).filter(Boolean)
  return { exact: new Set(list), list }
}

/** normalize สำหรับเปรียบเทียบ: ลบช่องว่างซ้ำ ลด case */
function normalizeForCompare(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

/** รูปแบบย่อสำหรับเช็ค substring (ลบช่องว่าง) */
function normalizeCompact(s: string): string {
  return normalizeForCompare(s).replace(/\s/g, "")
}

/** ตรวจว่า title ใกล้เคียงกับรายการที่มีอยู่แล้วหรือไม่ */
function isNearDuplicate(title: string, existingList: string[]): boolean {
  const n = normalizeCompact(title)
  if (n.length < 8) return false

  for (const ex of existingList) {
    const en = normalizeCompact(ex)
    // กรณีหนึ่งเป็น substring ของอีกอัน (เช่น "แม่บ้านราคาเท่าไหร่" กับ "แม่บ้านรายเดือนราคาเท่าไหร่")
    if (n.length >= 10 && en.length >= 10) {
      if (n.includes(en) || en.includes(n)) return true
    }
    // กรณี overlap คำมาก — ใช้การจับคู่คำแบบเท่ากันเท่านั้น (ลด false positive)
    const w1 = normalizeForCompare(title).split(" ").filter(Boolean)
    const w2Set = new Set(normalizeForCompare(ex).split(" ").filter(Boolean))
    if (w1.length >= 3 && w2Set.size >= 3) {
      const overlap = w1.filter((ww) => w2Set.has(ww)).length
      const minLen = Math.min(w1.length, w2Set.size)
      if (overlap >= Math.ceil(minLen * 0.75)) return true
    }
  }
  return false
}

/** กรองหัวข้อที่ซ้ำหรือใกล้เคียงกันภายในชุด suggestions (เก็บอันแรกที่เจอ) */
function dedupeSuggestions(items: TitleSuggestion[]): TitleSuggestion[] {
  const kept: TitleSuggestion[] = []
  const keptCompact = new Set<string>()

  for (const item of items) {
    const nc = normalizeCompact(item.title)
    if (keptCompact.has(nc)) continue
    // เช็คว่า overlap กับที่เก็บไว้แล้วหรือไม่
    let isDup = false
    for (const k of kept) {
      const kn = normalizeCompact(k.title)
      if (nc.length >= 10 && kn.length >= 10 && (nc.includes(kn) || kn.includes(nc))) {
        isDup = true
        break
      }
    }
    if (!isDup) {
      kept.push(item)
      keptCompact.add(nc)
    }
  }
  return kept
}

export async function getSites(): Promise<Site[]> {
  const rows = (await db
    .prepare("SELECT id, slug, name FROM sites ORDER BY sort_order, id")
    .all()) as Site[]
  return rows
}

/** เว็บที่ไม่มีเนื้อหาเกี่ยวกับคนลาว — ไม่แนะนำหัวข้อที่เกี่ยวกับคนลาว */
const SITES_EXCLUDE_KONLAO = new Set(["nasaladphrao48", "maidsiam", "suksawatmaid"])

/** รายการ keyword — ถ้าใส่ siteSlug และเว็บนั้นมี site_keywords จะคืนเฉพาะ keyword ของเว็บ
 * ไม่มี = ใช้ทุก keyword
 */
export async function getKeywords(siteSlug?: string): Promise<string[]> {
  if (siteSlug?.trim()) {
    const withSite = (await db
      .prepare(
        `SELECT k.keyword FROM keywords k
         INNER JOIN site_keywords sk ON sk.keyword_id = k.id
         INNER JOIN sites s ON s.id = sk.site_id
         WHERE s.slug = ?
         ORDER BY k.sort_order, k.id`
      )
      .all(siteSlug)) as { keyword: string }[]
    if (withSite.length > 0) return withSite.map((r) => r.keyword)
  }
  const rows = (await db
    .prepare("SELECT keyword FROM keywords ORDER BY sort_order, id")
    .all()) as { keyword: string }[]
  return rows.map((r) => r.keyword)
}

/**
 * สร้างหัวข้อแนะนำจาก 12 keyword (เทมเพลต SEO ไทย ไม่เสียเงิน)
 * site = แสดงหัวข้อที่เหมาะกับเว็บนี้ (ใช้ keyword ของเว็บ + ซ่อนหัวข้อที่มีในเว็บนี้แล้ว)
 * excludeExisting = ไม่แสดงหัวข้อที่เคยมีแล้ว (ทั้งหมดหรือเฉพาะเว็บตาม site)
 */
export async function getTitleSuggestions(options?: {
  keyword?: string
  excludeExisting?: boolean
  site?: string
  /** เมื่อ true — ไม่กรอง near-duplicate (ใช้เมื่อต้องการ fallback ให้มีหัวข้ออย่างน้อย) */
  relaxNearDuplicate?: boolean
}): Promise<TitleSuggestion[]> {
  let keywords = await getKeywords(options?.site)
  if (options?.keyword?.trim()) {
    const k = options.keyword.trim()
    keywords = keywords.filter((kw) => kw === k)
  }
  // เว็บ นาซ่าลาดพร้าว แม่บ้านสยาม แม่บ้านสุขสวัสดิ์ — ไม่มีเนื้อหาเกี่ยวกับคนลาว
  if (options?.site && SITES_EXCLUDE_KONLAO.has(options.site)) {
    keywords = keywords.filter((kw) => !kw.includes("คนลาว"))
  }
  const suggestions = suggestTitles(keywords)
  const existing = await getExistingTitles(options?.site)

  let result: TitleSuggestion[] = suggestions.map(({ keyword, title }) => ({
    keyword,
    title,
    alreadyUsed: existing.exact.has(title.trim().toLowerCase())
  }))

  // กรองหัวข้อที่ซ้ำหรือใกล้เคียงกับที่มีอยู่แล้ว
  // - excludeExisting: ตัด exact match และ near-duplicate
  // - !excludeExisting: แสดง exact match แต่ยังตัด near-duplicate (ที่ไม่ใช่ exact)
  result = result.filter((s) => {
    if (options?.excludeExisting && s.alreadyUsed) return false
    // หัวข้อที่ตรงกับที่มีอยู่พอดี ไม่ถือว่า near-dup (เพื่อไม่กรองตัวเอง)
    if (s.alreadyUsed) return true
    if (!options?.relaxNearDuplicate && isNearDuplicate(s.title, existing.list)) return false
    return true
  })

  return dedupeSuggestions(result)
}
