import { db } from "./db"
import { getTitleSuggestions } from "./titleSuggestions"
import { getSites } from "./titleSuggestions"
import { getKeywords } from "./titleSuggestions"

/** อันดับ 1–10 = หน้า 1, 11–20 = หน้า 2, ... */
export function pageFromRank(rank: number): number {
  return Math.ceil(rank / 10) || 1
}

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
function getLatestRankPerPair(): Map<string, number> {
  const rows = db
    .prepare(
      `SELECT site_slug, keyword, rank
       FROM rank_history r1
       WHERE recorded_date = (
         SELECT MAX(recorded_date) FROM rank_history r2
         WHERE r2.site_slug = r1.site_slug AND r2.keyword = r1.keyword
       )`
    )
    .all() as { site_slug: string; keyword: string; rank: number }[]
  const map = new Map<string, number>()
  for (const r of rows) {
    map.set(`${r.site_slug}\t${r.keyword}`, r.rank)
  }
  return map
}

/** ข้อมูล "หล่น" ต่อ (site_slug, keyword) ถ้ามี 2 ช่วงวันที่เปรียบเทียบและหล่น >= threshold หน้า */
function getDroppedInfoMap(thresholdPages = 2): Map<string, DroppedRankRow> {
  const dates = db
    .prepare(
      "SELECT DISTINCT recorded_date FROM rank_history ORDER BY recorded_date DESC LIMIT 2"
    )
    .all() as { recorded_date: string }[]
  if (dates.length < 2) return new Map()

  const [newerDate, olderDate] = [dates[0].recorded_date, dates[1].recorded_date]
  const rows = db
    .prepare(
      `SELECT site_slug, keyword,
        MAX(CASE WHEN recorded_date = ? THEN rank END) AS prev_rank,
        MAX(CASE WHEN recorded_date = ? THEN rank END) AS curr_rank
       FROM rank_history
       WHERE recorded_date IN (?, ?)
       GROUP BY site_slug, keyword
       HAVING prev_rank IS NOT NULL AND curr_rank IS NOT NULL AND curr_rank > prev_rank`
    )
    .all(olderDate, newerDate, olderDate, newerDate) as {
    site_slug: string
    keyword: string
    prev_rank: number
    curr_rank: number
  }[]

  const out = new Map<string, DroppedRankRow>()
  for (const r of rows) {
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
export function getDroppedRankPairs(thresholdPages = 2): DroppedRankRow[] {
  return Array.from(getDroppedInfoMap(thresholdPages).values())
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
  maxPerSite: number
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

    if (seenTitles.has(normalizedTitle)) return false
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

      seenTitles.add(item.title.trim().toLowerCase())
      usedKeywords.add(item.focusKeyword)
      usedKeywordIntent.add(`${item.focusKeyword}__${item.intentKey}`)
      usedGlobalIntents.add(item.intentKey)
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
export function getTitleRecommendationsForRankGaps(
  rankThreshold = 20,
  thresholdDroppedPages = 2
): SiteRecommendationSummary[] {
  const sites = getSites()
  const keywords = getKeywords()
  const latestRank = getLatestRankPerPair()
  const droppedMap = getDroppedInfoMap(thresholdDroppedPages)

  const results: SiteRecommendationSummary[] = []
  for (const site of sites) {
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

    if (weakKeywords.length === 0) continue

    weakKeywords.sort((a, b) => scoreWeakKeyword(b) - scoreWeakKeyword(a))

    const suggestionRounds: RankedSuggestedArticle[][] = weakKeywords.map((item) =>
      getTitleSuggestions({
        site: site.slug,
        keyword: item.keyword,
        excludeExisting: true
      }).map((s) => ({
        title: s.title,
        focusKeyword: s.keyword,
        intentKey: getTitleIntentKey(s.title, s.keyword)
      }))
    )

    const maxPerSite = 4
    const suggestedArticles = pickSuggestedArticles(suggestionRounds, maxPerSite)

    results.push({
      site_slug: site.slug,
      weakKeywords,
      suggestedArticles
    })
  }
  return results
}

/** @deprecated ใช้ getTitleRecommendationsForRankGaps แทน */
export function getTitleRecommendationsForNotOnPage1(
  thresholdDroppedPages = 2
): SiteRecommendationSummary[] {
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

export function getTitleRecommendationsForDroppedRank(
  thresholdPages = 2
): DroppedRankRecommendation[] {
  const dropped = getDroppedRankPairs(thresholdPages)
  return dropped.map((d) => {
    const suggestions = getTitleSuggestions({
      site: d.site_slug,
      keyword: d.keyword,
      excludeExisting: true
    })
    return {
      ...d,
      suggestedTitles: suggestions.map((s) => s.title)
    }
  })
}
