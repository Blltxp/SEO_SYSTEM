import * as cheerio from "cheerio"
import type { Browser, BrowserContext, Page } from "puppeteer"
import { getSiteSlugFromUrl } from "./siteDomains"
import { getSites } from "./titleSuggestions"
import { toOrganicOrderedList } from "./rankingExclude"

/** User-Agent แบบยูสเซอร์ทั่วไป (ไม่เจาะจงว่าเป็นบอต) */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

export type RankResult = {
  site_slug: string
  rank: number
  url: string
}

export class GoogleChallengeError extends Error {
  constructor(message = "Google returned a challenge page") {
    super(message)
    this.name = "GoogleChallengeError"
  }
}

export class GoogleRankFetchError extends Error {
  constructor(message = "Google ranking check failed") {
    super(message)
    this.name = "GoogleRankFetchError"
  }
}

const GOOGLE_BASE = "https://www.google.co.th/"
const RESULTS_PER_PAGE = 10
const DEFAULT_MAX_SEARCH_PAGES = 2
const PAGE_DELAY_MS = 800
const CHALLENGE_POLL_MS = 1500
const CHALLENGE_TIMEOUT_MS = 10 * 60 * 1000

type SearchVariant = "web"

type GoogleRankChallengeContext = {
  keyword: string
  variant: SearchVariant
  start: number
  pageNumber: number
  page: Page
}

type GoogleRankSessionOptions = {
  headless?: boolean
  channel?: "chrome"
  maxPages?: number
  onChallenge?: (context: GoogleRankChallengeContext) => Promise<void>
}

function buildGoogleSearchUrl(keyword: string, variant: SearchVariant = "web", start = 0): string {
  const params = new URLSearchParams({
    q: keyword,
    num: String(RESULTS_PER_PAGE),
    hl: "th",
    gl: "th",
    pws: "0"
  })
  if (start > 0) params.set("start", String(start))
  params.set("udm", "14")
  return `${GOOGLE_BASE}search?${params.toString()}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** แปลงลิงก์จาก Google เป็น URL จริง - รองรับทั้ง absolute (http...) และ relative (/url?q=...) */
function resolveGoogleUrl(href: string): string | null {
  if (!href || typeof href !== "string") return null
  try {
    const u = new URL(href, GOOGLE_BASE)
    if (u.hostname.includes("google.") && u.pathname === "/url") {
      const q = u.searchParams.get("q") || u.searchParams.get("url")
      if (q) return q
    }
    if (href.startsWith("http")) return href
    return null
  } catch {
    return null
  }
}

function isGoogleAdHref(value: string | undefined): boolean {
  if (!value) return false
  return /google\.com\/aclk/i.test(value) || /[?&]adurl=/i.test(value) || /googleadservices/i.test(value)
}

/**
 * ดึงลิงก์ผลค้นหาจาก HTML ของ Google (organic results)
 * ลองหลาย selector เพราะ Google เปลี่ยนโครงบ่อย และอาจส่ง HTML คนละแบบให้บอต
 * export สำหรับ debug
 */
export function extractSearchResultUrls(html: string): string[] {
  const $ = cheerio.load(html)
  const urls: string[] = []
  const seen = new Set<string>()

  function addUrl(href: string) {
    if (!href || href.includes("google.") || href.includes("webcache") || href.includes("accounts.google")) return
    const resolved = resolveGoogleUrl(href) || href
    try {
      const u = new URL(resolved)
      if (u.hostname.includes("google.")) return
    } catch {
      return
    }
    if (!seen.has(resolved)) {
      seen.add(resolved)
      urls.push(resolved)
    }
  }

  function isLikelyAdAnchor(el: unknown): boolean {
    const $a = $(el as any)
    return (
      isGoogleAdHref($a.attr("data-rw")) ||
      isGoogleAdHref($a.attr("data-pcu")) ||
      isGoogleAdHref($a.attr("ping")) ||
      isGoogleAdHref($a.attr("href"))
    )
  }

  // 0) พยายามหยิบ "ลิงก์หลักของผลค้นหา" ก่อน โดยดูจาก anchor ที่มี h3
  // วิธีนี้ช่วยตัดลิงก์ย่อย (sitelinks) และปุ่ม "เว็บไซต์" ใน local pack ออกไป
  $("a").each((_, el) => {
    const $a = $(el)
    if ($a.find("h3").length === 0) return
    if (isLikelyAdAnchor(el)) return
    const href = $a.attr("href")
    if (href) addUrl(href)
  })

  // 1) fallback: div.g เฉพาะ block ที่ไม่ใช่โฆษณา แล้วหยิบ anchor หลักตัวแรก
  if (urls.length === 0) {
    $("div.g").each((_, el) => {
      const $el = $(el)
      if (/Ad|Sponsored|โฆษณา/i.test($el.text())) return
      const mainAnchor = $el
        .find("a")
        .filter((__, a) => $(a).find("h3").length > 0 && !isLikelyAdAnchor(a))
        .first()
      const href = mainAnchor.attr("href")
      if (href) addUrl(href)
    })
  }

  // 2) ลิงก์แบบ relative /url?q=... (เมื่อยังหา block หลักไม่ได้)
  if (urls.length === 0) {
    $("a[href*='/url?']").each((_, a) => {
      if (isLikelyAdAnchor(a)) return
      const href = $(a).attr("href")
      if (href) {
        const resolved = resolveGoogleUrl(href)
        if (resolved) addUrl(resolved)
      }
    })
  }

  // 3) div.g > ลิงก์ตรง (เมื่อยังไม่มีจาก step 0 — ไม่ดึงจาก block โฆษณา)
  if (urls.length === 0) {
    $("div.g a[href^='http']").each((_, a) => {
      if (isLikelyAdAnchor(a)) return
      const href = $(a).attr("href")
      if (href) addUrl(href)
    })
  }

  // 4) #search / #main / #rso > ลิงก์ external
  if (urls.length === 0) {
    $("#search a[href^='http'], #main a[href^='http'], div#rso a[href^='http']").each((_, a) => {
      if (isLikelyAdAnchor(a)) return
      const href = $(a).attr("href")
      if (href) addUrl(href)
    })
  }

  // 5) fallback: ทุก a ที่ href ขึ้นต้นด้วย http
  if (urls.length === 0) {
    $("a[href^='http']").each((_, a) => {
      if (isLikelyAdAnchor(a)) return
      const href = $(a).attr("href")
      if (href) addUrl(href)
    })
  }

  return urls
}

/** คำนวณอันดับ organic (กรองโฆษณา/Facebook/ข่าว/แอป/เว็บหางาน/เว็บจัดอันดับ) แล้วจับคู่เว็บเรา */
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

function mergeRankResults(...lists: RankResult[][]): RankResult[] {
  const bestBySite = new Map<string, RankResult>()
  for (const list of lists) {
    for (const row of list) {
      const current = bestBySite.get(row.site_slug)
      if (!current || row.rank < current.rank) {
        bestBySite.set(row.site_slug, row)
      }
    }
  }
  return Array.from(bestBySite.values()).sort((a, b) => a.rank - b.rank || a.site_slug.localeCompare(b.site_slug))
}

async function hasFoundAllTrackedSites(results: RankResult[]): Promise<boolean> {
  const sites = await getSites()
  const trackedSiteCount = sites.length
  const foundSites = new Set(results.map((item) => item.site_slug))
  return foundSites.size >= trackedSiteCount
}

/**
 * ดึง HTML จาก Google ด้วย Puppeteer แบบ "ยูสเซอร์ทั่วไป"
 * โปรไฟล์เป็น temp ของ Puppeteer อยู่แล้ว = ไม่มี cookies/ประวัติของคุณ (ไม่ personalize)
 * export สำหรับ debug
 */
async function prepareRankPage(page: Page): Promise<void> {
  await page.setUserAgent(USER_AGENT)
  await page.setViewport({ width: 1366, height: 768 })
  await page.setExtraHTTPHeaders({ "Accept-Language": "th-TH,th;q=0.9,en;q=0.8" })
}

async function fetchGoogleSearchHtml(page: Page, keyword: string, variant: SearchVariant, start = 0): Promise<string> {
  const url = buildGoogleSearchUrl(keyword, variant, start)
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 })
  await page.waitForSelector("div#search, div#rso, div.g", { timeout: 8000 }).catch(() => {})
  return page.content()
}

function isGoogleChallengeHtml(html: string): boolean {
  if (!html) return false
  return (
    html.includes('id="captcha-form"') ||
    html.includes("g-recaptcha") ||
    html.includes("recaptcha") ||
    html.includes("โปรดเปิดใช้ JavaScript ในเว็บเบราว์เซอร์เพื่อดำเนินการต่อ") ||
    html.includes("unusual traffic")
  )
}

function isTransientNavigationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes("execution context was destroyed") ||
    message.includes("cannot find context with specified id") ||
    message.includes("navigation") ||
    message.includes("frame was detached")
  )
}

async function getPageHtmlWithRetry(page: Page, retries = 10): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await page.content()
    } catch (error) {
      if (!isTransientNavigationError(error) || attempt === retries - 1) {
        throw error
      }
      await delay(500)
    }
  }
  return ""
}

export async function waitForGoogleChallengeResolved(
  page: Page,
  options?: { timeoutMs?: number; pollMs?: number }
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? CHALLENGE_TIMEOUT_MS
  const pollMs = options?.pollMs ?? CHALLENGE_POLL_MS
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const html = await getPageHtmlWithRetry(page)
    if (!isGoogleChallengeHtml(html)) {
      return
    }
    await delay(pollMs)
  }

  throw new GoogleChallengeError("Google challenge is still active after waiting")
}

export async function fetchGoogleWithPuppeteer(
  keyword: string,
  options?: { variant?: SearchVariant; start?: number }
): Promise<string> {
  const session = await createGoogleRankSession()
  try {
    const result = await session.fetchHtml(keyword, options?.variant ?? "web", options?.start ?? 0)
    return result.html
  } finally {
    await session.close()
  }
}

async function createBrowserForRanking(options?: GoogleRankSessionOptions): Promise<{
  browser: Browser
  context: BrowserContext
  page: Page
}> {
  const puppeteer = await import("puppeteer").catch(() => null)
  if (!puppeteer) throw new Error("Puppeteer is not available")
  const browser = await puppeteer.default.launch({
    channel: options?.channel,
    headless: options?.headless ?? true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--lang=th-TH"
    ]
  })
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await prepareRankPage(page)
  return { browser, context, page }
}

export async function createGoogleRankSession(options?: GoogleRankSessionOptions): Promise<{
  fetchHtml: (keyword: string, variant?: SearchVariant, start?: number) => Promise<{ html: string; challenged: boolean }>
  checkKeywordRank: (keyword: string) => Promise<RankResult[]>
  close: () => Promise<void>
}> {
  const { browser, page } = await createBrowserForRanking(options)

  async function fetchHtml(
    keyword: string,
    variant: SearchVariant = "web",
    start = 0
  ): Promise<{ html: string; challenged: boolean }> {
    let html = await fetchGoogleSearchHtml(page, keyword, variant, start)
    if (isGoogleChallengeHtml(html)) {
      if (!options?.onChallenge) {
        throw new GoogleChallengeError()
      }
      await options.onChallenge({
        keyword,
        variant,
        start,
        pageNumber: Math.floor(start / RESULTS_PER_PAGE) + 1,
        page
      })
      html = await getPageHtmlWithRetry(page)
      if (isGoogleChallengeHtml(html)) {
        throw new GoogleChallengeError("Google challenge is still active after manual step")
      }
      return { html, challenged: true }
    }
    return { html, challenged: false }
  }

  async function collectRankResultsAcrossPages(keyword: string, variant: SearchVariant): Promise<{
    results: RankResult[]
    challenged: boolean
    firstPageEmpty: boolean
  }> {
    const allUrls: string[] = []
    let challenged = false
    let firstPageEmpty = false
    const maxPages = Math.max(1, options?.maxPages ?? DEFAULT_MAX_SEARCH_PAGES)

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
      const start = pageIndex * RESULTS_PER_PAGE
      const pageResult = await fetchHtml(keyword, variant, start)
      challenged ||= pageResult.challenged

      const urls = extractSearchResultUrls(pageResult.html)
      if (urls.length === 0) {
        if (pageIndex === 0) {
          firstPageEmpty = true
          break
        }
        break
      }

      allUrls.push(...urls)

      if (pageIndex === 0) {
        const currentResults = await resultsToOrganicRanks(allUrls)
        if (await hasFoundAllTrackedSites(currentResults)) {
          break
        }
      }

      if (pageIndex < maxPages - 1) {
        await delay(PAGE_DELAY_MS)
      }
    }

    return {
      results: await resultsToOrganicRanks(allUrls),
      challenged,
      firstPageEmpty
    }
  }

  async function checkKeywordRankInSession(keyword: string): Promise<RankResult[]> {
    const web = await collectRankResultsAcrossPages(keyword, "web")
    if (web.firstPageEmpty && !web.challenged) {
      throw new GoogleRankFetchError(`Google returned no parsable results for keyword "${keyword}"`)
    }
    return web.results
  }

  return {
    fetchHtml,
    checkKeywordRank: checkKeywordRankInSession,
    close: async () => {
      await browser.close()
    }
  }
}

/**
 * เช็คอันดับ 1 keyword ใน Google
 * - ถ้ามี GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX จะใช้ Custom Search API
 * - ไม่เช่นนั้นใช้ Puppeteer ยิง Google Web Search อย่างเดียว
 * อันดับที่คืนนับเฉพาะ organic (ไม่นับโฆษณา, Facebook, ข่าว, แอป, เว็บหางาน, เว็บจัดอันดับ)
 */
export async function checkKeywordRank(keyword: string): Promise<RankResult[]> {
  if (isGoogleCseConfigured()) {
    return checkKeywordRankViaAPI(keyword)
  }
  const session = await createGoogleRankSession()
  try {
    return await session.checkKeywordRank(keyword)
  } finally {
    await session.close()
  }
}

/** ใช้ Google Custom Search JSON API แทน scrape (เมื่อตั้งค่า env แล้ว) — โควต้าฟรี 100 query/วัน */
export function isGoogleCseConfigured(): boolean {
  return !!(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX)
}

/**
 * เช็คอันดับ 1 keyword ผ่าน Custom Search JSON API
 * ต้องตั้ง GOOGLE_CSE_API_KEY และ GOOGLE_CSE_CX (Search Engine ID)
 */
export async function checkKeywordRankViaAPI(keyword: string): Promise<RankResult[]> {
  const key = process.env.GOOGLE_CSE_API_KEY
  const cx = process.env.GOOGLE_CSE_CX
  if (!key || !cx) {
    throw new GoogleRankFetchError("Google CSE is not configured")
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

  const urls = [
    ...(await fetchPage(1)),
    ...(await fetchPage(11))
  ]
  return await resultsToOrganicRanks(urls)
}

/** keyword ที่เป้าหมายคือ "ไม่ให้เจอเว็บเรา" (เพื่อภาพลักษณ์) */
export const KEYWORD_AVOID_VISIBILITY = "หาแรงงานต่างด้าว"
