import { db } from "./db"
import { getTitleSuggestions } from "./titleSuggestions"
import { getSites } from "./titleSuggestions"
import { getKeywords } from "./titleSuggestions"

/** อันดับ 1–10 = หน้า 1, 11–20 = หน้า 2, ... */
export function pageFromRank(rank: number): number {
  return Math.ceil(rank / 10) || 1
}

const NOT_FOUND_RANK = 999

/** เว็บที่ไม่มีเนื้อหาเกี่ยวกับคนลาว — ไม่ใช้ keyword คนลาว ในการแนะนำ */
const SITES_EXCLUDE_KONLAO = new Set(["nasaladphrao48", "maidsiam", "suksawatmaid"])

export type DroppedRankRow = {
  site_slug: string
  keyword: string
  previousRank: number
  currentRank: number
  previousPage: number
  currentPage: number
  droppedPages: number
}

/** อันดับล่าสุดต่อ (site_slug, keyword) จาก rank_history */
async function getLatestRankPerPair(): Promise<Map<string, number | null>> {
  const rows = (await db
    .prepare(
      `SELECT site_slug, keyword, rank
       FROM rank_history r1
       WHERE recorded_date = (
         SELECT MAX(recorded_date) FROM rank_history r2
         WHERE r2.site_slug = r1.site_slug AND r2.keyword = r1.keyword
       )`
    )
    .all()) as { site_slug: string; keyword: string; rank: number }[]
  const map = new Map<string, number | null>()
  for (const r of rows) {
    map.set(`${r.site_slug}\t${r.keyword}`, r.rank >= NOT_FOUND_RANK ? null : r.rank)
  }
  return map
}

/** ข้อมูล "หล่น" ต่อ (site_slug, keyword) ถ้ามี 2 ช่วงวันที่เปรียบเทียบและหล่น >= threshold หน้า */
async function getDroppedInfoMap(thresholdPages = 2): Promise<Map<string, DroppedRankRow>> {
  const dates = (await db
    .prepare(
      "SELECT DISTINCT recorded_date FROM rank_history ORDER BY recorded_date DESC LIMIT 2"
    )
    .all()) as { recorded_date: string }[]
  if (dates.length < 2) return new Map()

  const [newerDate, olderDate] = [dates[0].recorded_date, dates[1].recorded_date]
  const rows = (await db
    .prepare(
      `SELECT site_slug, keyword,
        MAX(CASE WHEN recorded_date = ? THEN rank END) AS prev_rank,
        MAX(CASE WHEN recorded_date = ? THEN rank END) AS curr_rank
       FROM rank_history
       WHERE recorded_date IN (?, ?)
       GROUP BY site_slug, keyword
       HAVING MAX(CASE WHEN recorded_date = ? THEN rank END) IS NOT NULL
         AND MAX(CASE WHEN recorded_date = ? THEN rank END) IS NOT NULL
         AND MAX(CASE WHEN recorded_date = ? THEN rank END) > MAX(CASE WHEN recorded_date = ? THEN rank END)`
    )
    .all(olderDate, newerDate, olderDate, newerDate, olderDate, newerDate, newerDate, olderDate)) as {
    site_slug: string
    keyword: string
    prev_rank: number
    curr_rank: number
  }[]

  const out = new Map<string, DroppedRankRow>()
  for (const r of rows) {
    if (r.prev_rank >= NOT_FOUND_RANK || r.curr_rank >= NOT_FOUND_RANK) {
      continue
    }
    const previousPage = pageFromRank(r.prev_rank)
    const currentPage = pageFromRank(r.curr_rank)
    const droppedPages = currentPage - previousPage
    if (droppedPages >= thresholdPages) {
      out.set(`${r.site_slug}\t${r.keyword}`, {
        site_slug: r.site_slug,
        keyword: r.keyword,
        previousRank: r.prev_rank,
        currentRank: r.curr_rank,
        previousPage,
        currentPage,
        droppedPages
      })
    }
  }
  return out
}

/**
 * ดึงคู่ (site, keyword) ที่อันดับหล่นอย่างน้อย thresholdPages หน้า
 * เปรียบเทียบระหว่าง 2 ช่วงวันที่ล่าสุดใน rank_history (จาก Keyword Rank Tracker)
 */
export async function getDroppedRankPairs(thresholdPages = 2): Promise<DroppedRankRow[]> {
  return Array.from((await getDroppedInfoMap(thresholdPages)).values())
}

export type WeakKeywordRecommendation = {
  keyword: string
  /** อันดับล่าสุด (null = ยังไม่มีข้อมูลจาก Tracker) */
  currentRank: number | null
  /** ถ้าอันดับหล่น 2+ หน้าจะมีข้อมูล */
  droppedInfo?: DroppedRankRow
}

export type SuggestedArticle = {
  title: string
  focusKeyword: string
}

export type SiteRecommendationSummary = {
  site_slug: string
  weakKeywords: WeakKeywordRecommendation[]
  suggestedArticles: SuggestedArticle[]
}

type RankedSuggestedArticle = SuggestedArticle & {
  intentKey: string
}

const INTENT_BUCKETS: string[][] = [
  ["definition", "guide"],
  ["tips", "usage"],
  ["price", "compare", "best-choice"],
  ["beginner-faq"]
]

function scoreWeakKeyword(item: WeakKeywordRecommendation): number {
  const base = item.currentRank == null ? 1000 : item.currentRank
  const droppedBonus = (item.droppedInfo?.droppedPages ?? 0) * 100
  return base + droppedBonus
}

/** แยก template ของหัวข้อ (ส่วนที่เหมือนกันเมื่อเปลี่ยน keyword) สำหรับใช้กรองซ้ำข้ามเว็บ */
function getTitleTemplate(title: string, keyword: string): string {
  const removed = title.replace(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "")
  return removed.trim().toLowerCase().replace(/\s+/g, " ")
}

function getTitleIntentKey(title: string, keyword: string): string {
  const normalized = title.replace(keyword, "").trim()

  if (normalized.includes("ราคา")) return "price"
  if (normalized.includes("ดีที่สุด") || normalized.includes("ที่ไหนดี") || normalized.includes("แนะนำ")) return "best-choice"
  if (normalized.includes("คืออะไร")) return "definition"
  if (normalized.includes("คู่มือ") || normalized.includes("ขั้นตอน") || normalized.includes("เตรียมตัว")) return "guide"
  if (normalized.includes("เทคนิค") || normalized.includes("เคล็ดลับ")) return "tips"
  if (normalized.includes("ข้อดีข้อเสีย") || normalized.includes("เปรียบเทียบ") || normalized.includes("ต่างจากแบบอื่น")) return "compare"
  if (normalized.includes("เมื่อไหร่ควรใช้") || normalized.includes("ทำไมต้องใช้") || normalized.includes("ใช้ทำอะไรได้บ้าง")) return "usage"
  if (normalized.includes("สำหรับมือใหม่") || normalized.includes("คำถามที่พบบ่อย")) return "beginner-faq"

  return normalized.toLowerCase()
}

function pickSuggestedArticles(
  suggestionRounds: RankedSuggestedArticle[][],
  maxPerSite: number,
  excludeAcrossSites?: { titles: Set<string>; templates: Set<string> },
  skipTemplateExclusion = false
): SuggestedArticle[] {
  const allSuggestions = suggestionRounds.flat()
  const picked: RankedSuggestedArticle[] = []
  const seenTitles = new Set<string>()
  const usedKeywords = new Set<string>()
  const usedKeywordIntent = new Set<string>()
  const usedGlobalIntents = new Set<string>()

  const canUse = (
    item: RankedSuggestedArticle,
    options: { allowRepeatedKeyword: boolean; allowRepeatedGlobalIntent: boolean }
  ) => {
    const normalizedTitle = item.title.trim().toLowerCase()
    const keywordIntentKey = `${item.focusKeyword}__${item.intentKey}`
    const templateKey = getTitleTemplate(item.title, item.focusKeyword)

    if (seenTitles.has(normalizedTitle)) return false
    if (excludeAcrossSites?.titles.has(normalizedTitle)) return false
    if (!skipTemplateExclusion && excludeAcrossSites?.templates.has(templateKey)) return false
    if (!options.allowRepeatedKeyword && usedKeywords.has(item.focusKeyword)) return false
    if (usedKeywordIntent.has(keywordIntentKey)) return false
    if (!options.allowRepeatedGlobalIntent && usedGlobalIntents.has(item.intentKey)) return false

    return true
  }

  const pickOne = (
    candidates: RankedSuggestedArticle[],
    options: { allowRepeatedKeyword: boolean; allowRepeatedGlobalIntent: boolean }
  ) => {
    for (const item of candidates) {
      if (!canUse(item, options)) continue

      const normalizedTitle = item.title.trim().toLowerCase()
      const templateKey = getTitleTemplate(item.title, item.focusKeyword)
      seenTitles.add(normalizedTitle)
      usedKeywords.add(item.focusKeyword)
      usedKeywordIntent.add(`${item.focusKeyword}__${item.intentKey}`)
      usedGlobalIntents.add(item.intentKey)
      if (excludeAcrossSites) {
        excludeAcrossSites.titles.add(normalizedTitle)
        excludeAcrossSites.templates.add(templateKey)
      }
      picked.push(item)
      return true
    }
    return false
  }

  for (const bucket of INTENT_BUCKETS) {
    if (picked.length >= maxPerSite) break
    const candidates = allSuggestions.filter((item) => bucket.includes(item.intentKey))
    pickOne(candidates, { allowRepeatedKeyword: false, allowRepeatedGlobalIntent: false })
  }

  if (picked.length < maxPerSite) {
    pickOne(allSuggestions, { allowRepeatedKeyword: false, allowRepeatedGlobalIntent: false })
  }
  while (picked.length < maxPerSite && pickOne(allSuggestions, { allowRepeatedKeyword: true, allowRepeatedGlobalIntent: false })) {
    // keep filling with different intents before relaxing further
  }
  while (picked.length < maxPerSite && pickOne(allSuggestions, { allowRepeatedKeyword: true, allowRepeatedGlobalIntent: true })) {
    // final fallback when options are limited
  }

  return picked.slice(0, maxPerSite).map(({ title, focusKeyword }) => ({ title, focusKeyword }))
}

/**
 * แนะนำหัวข้อสำหรับทุก (เว็บ, keyword) ที่อันดับเกิน rankThreshold หรือยังไม่มีข้อมูล
 * - อันดับ > rankThreshold → แนะนำ
 * - ยังไม่มีข้อมูลอันดับ (ไม่มีใน rank_history) → แนะนำ
 * - ถ้าอันดับหล่น 2+ หน้าจะมี droppedInfo ให้แสดงเสริม
 */
export async function getTitleRecommendationsForRankGaps(
  rankThreshold = 20,
  thresholdDroppedPages = 2
): Promise<SiteRecommendationSummary[]> {
  const sites = await getSites()
  const latestRank = await getLatestRankPerPair()
  const droppedMap = await getDroppedInfoMap(thresholdDroppedPages)

  const results: SiteRecommendationSummary[] = []
  const usedAcrossSites = { titles: new Set<string>(), templates: new Set<string>() }

  // ให้กลุ่ม B (นาซ่า แม่บ้านสยาม แม่บ้านสุขสวัสดิ์) ประมวลผลก่อน — เลือกเทมเพลตก่อนเว็บอื่น เพื่อให้ได้หัวข้อที่ไม่ซ้ำ
  const siteOrder = [...sites].sort((a, b) => {
    const aFirst = SITES_EXCLUDE_KONLAO.has(a.slug) ? 1 : 0
    const bFirst = SITES_EXCLUDE_KONLAO.has(b.slug) ? 1 : 0
    return bFirst - aFirst
  })

  for (const site of siteOrder) {
    const keywords = await getKeywords(site.slug)
    const weakKeywords: WeakKeywordRecommendation[] = []

    for (const keyword of keywords) {
      const key = `${site.slug}\t${keyword}`
      const rank = latestRank.get(key) ?? null
      const withinThreshold = rank !== null && rank <= rankThreshold
      if (withinThreshold) continue

      weakKeywords.push({
        keyword,
        currentRank: rank,
        droppedInfo: droppedMap.get(key)
      })
    }

    // เว็บ นาซ่า แม่บ้านสยาม แม่บ้านสุขสวัสดิ์ — ไม่ใช้ keyword คนลาว (จะได้มีหัวข้อจาก keyword อื่น)
    let filteredWeak =
      SITES_EXCLUDE_KONLAO.has(site.slug)
        ? weakKeywords.filter((w) => !w.keyword.includes("คนลาว"))
        : weakKeywords

    // ทุกเว็บต้องมีหัวข้อเสมอ — ถ้า weak ว่าง (ทุก keyword อยู่ Top 20) ใช้อันดับ 11–20 เป็น fallback
    if (filteredWeak.length === 0) {
      const fallbackKeywords: WeakKeywordRecommendation[] = []
      for (const keyword of keywords) {
        if (SITES_EXCLUDE_KONLAO.has(site.slug) && keyword.includes("คนลาว")) continue
        const key = `${site.slug}\t${keyword}`
        const rank = latestRank.get(key) ?? null
        if (rank !== null && rank >= 11 && rank <= 20) {
          fallbackKeywords.push({
            keyword,
            currentRank: rank,
            droppedInfo: droppedMap.get(key)
          })
        }
      }
      filteredWeak = fallbackKeywords
    }
    if (filteredWeak.length === 0) continue

    filteredWeak.sort((a, b) => scoreWeakKeyword(b) - scoreWeakKeyword(a))

    let suggestionRounds: RankedSuggestedArticle[][] = await Promise.all(
      filteredWeak.map(async (item) =>
        (await getTitleSuggestions({
          site: site.slug,
          keyword: item.keyword,
          excludeExisting: true
        })).map((s) => ({
        title: s.title,
        focusKeyword: s.keyword,
        intentKey: getTitleIntentKey(s.title, s.keyword)
      }))
      )
    )

    const maxPerSite = 4
    let suggestedArticles = pickSuggestedArticles(suggestionRounds, maxPerSite, usedAcrossSites)
    if (suggestedArticles.length === 0 && suggestionRounds.flat().length > 0) {
      suggestedArticles = pickSuggestedArticles(suggestionRounds, maxPerSite, usedAcrossSites, true)
    }
    results.push({
      site_slug: site.slug,
      weakKeywords: filteredWeak,
      suggestedArticles
    })
  }
  return results
}

/** @deprecated ใช้ getTitleRecommendationsForRankGaps แทน */
export async function getTitleRecommendationsForNotOnPage1(
  thresholdDroppedPages = 2
): Promise<SiteRecommendationSummary[]> {
  return getTitleRecommendationsForRankGaps(10, thresholdDroppedPages)
}

/** @deprecated ใช้ getTitleRecommendationsForNotOnPage1 แทน — เก็บไว้เพื่อ backward compatibility */
export type DroppedRankRecommendation = {
  site_slug: string
  keyword: string
  previousRank: number
  currentRank: number
  previousPage: number
  currentPage: number
  droppedPages: number
  suggestedTitles: string[]
}

export async function getTitleRecommendationsForDroppedRank(
  thresholdPages = 2
): Promise<DroppedRankRecommendation[]> {
  const dropped = await getDroppedRankPairs(thresholdPages)
  return Promise.all(
    dropped.map(async (d) => {
      const suggestions = await getTitleSuggestions({
        site: d.site_slug,
        keyword: d.keyword,
        excludeExisting: true
      })
      return {
        ...d,
        suggestedTitles: suggestions.map((s) => s.title)
      }
    })
  )
}
