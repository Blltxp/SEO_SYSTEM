/**
 * Google Custom Search API เท่านั้น — ไม่มี Puppeteer
 * ใช้สำหรับ production (Vercel) เพื่อไม่โหลด Puppeteer/Chrome
 */
import { getSiteSlugFromUrl } from "./siteDomains"
import { getSites } from "./titleSuggestions"
import { toOrganicOrderedList } from "./rankingExclude"

export type RankResult = {
  site_slug: string
  rank: number
  url: string
}

export class GoogleRankFetchError extends Error {
  constructor(message = "Google ranking check failed") {
    super(message)
    this.name = "GoogleRankFetchError"
  }
}

export function isGoogleCseConfigured(): boolean {
  return !!(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX)
}

async function resultsToOrganicRanks(resultUrls: string[]): Promise<RankResult[]> {
  const ordered = toOrganicOrderedList(resultUrls)
  const sites = await getSites()
  const siteSlugs = sites.map((s) => s.slug)
  const results: RankResult[] = []
  for (const { url, organicRank } of ordered) {
    const slug = getSiteSlugFromUrl(url)
    if (slug && siteSlugs.includes(slug)) {
      results.push({ site_slug: slug, rank: organicRank, url })
    }
  }
  return results
}

/**
 * เช็คอันดับ 1 keyword ผ่าน Google Custom Search JSON API
 * ต้องตั้ง GOOGLE_CSE_API_KEY และ GOOGLE_CSE_CX
 */
export async function checkKeywordRankViaAPI(keyword: string): Promise<RankResult[]> {
  const key = process.env.GOOGLE_CSE_API_KEY
  const cx = process.env.GOOGLE_CSE_CX
  if (!key || !cx) {
    throw new GoogleRankFetchError(
      "ต้องตั้ง GOOGLE_CSE_API_KEY และ GOOGLE_CSE_CX ใน Environment Variables ของ Vercel"
    )
  }

  const fetchPage = async (start: number) => {
    const params = new URLSearchParams({
      key,
      cx,
      q: keyword,
      num: "10",
      start: String(start)
    })
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`)
    if (!res.ok) {
      throw new GoogleRankFetchError(`Google CSE request failed with status ${res.status}`)
    }
    const data = (await res.json()) as {
      items?: Array<{ link: string }>
      error?: { message?: string }
    }
    if (data.error?.message) {
      throw new GoogleRankFetchError(data.error.message)
    }
    return (data.items ?? []).map((i) => i.link)
  }

  const urls = [...(await fetchPage(1)), ...(await fetchPage(11))]
  return await resultsToOrganicRanks(urls)
}
