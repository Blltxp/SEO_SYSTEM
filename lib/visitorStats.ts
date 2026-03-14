import type { Page } from "puppeteer"
import { sites } from "./wordpress"

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const PAGE_TIMEOUT_MS = 25_000
const WAIT_AFTER_LOAD_MS = 3000

export type SiteVisitorSnapshot = {
  slug: string
  total: number
  today: number
}

/** ดึง URL หน้าแรกของแต่ละ site จาก api */
function getHomepageUrl(apiUrl: string): string {
  const origin = new URL(apiUrl).origin
  return `${origin}/`
}

const LOG_PREFIX = "[visitorStats]"

/** แยกตัวเลข — รองรับทั้งภาษาไทยและภาษาอังกฤษ (ปลั๊กอิน PVC แสดงตาม locale) */
function parsePvcStats(text: string): { total: number; today: number } {
  let total = 0
  let today = 0
  // ภาษาไทย: เยี่ยมชมทั้งหมด 143887 คน / เยี่ยมชมวันนี้ 361 คน
  const totalMatchTh = text.match(/เยี่ยมชมทั้งหมด\s*([\d,]+)\s*คน/)
  if (totalMatchTh) total = parseInt(totalMatchTh[1].replace(/,/g, ""), 10) || 0
  const todayMatchTh = text.match(/เยี่ยมชมวันนี้\s*([\d,]+)\s*คน/)
  if (todayMatchTh) today = parseInt(todayMatchTh[1].replace(/,/g, ""), 10) || 0
  // ภาษาอังกฤษ: 504980 total views / 12 views today
  if (!total) {
    const totalMatchEn = text.match(/([\d,]+)\s*total\s*views?/i)
    if (totalMatchEn) total = parseInt(totalMatchEn[1].replace(/,/g, ""), 10) || 0
  }
  if (!today) {
    const todayMatchEn = text.match(/([\d,]+)\s*views?\s*today/i)
    if (todayMatchEn) today = parseInt(todayMatchEn[1].replace(/,/g, ""), 10) || 0
  }
  return { total, today }
}

/** ข้อความที่แสดงว่ายังโหลดไม่เสร็จ (AJAX) */
function isStillLoading(rawText: string): boolean {
  return (
    !rawText ||
    rawText.includes("ajax-loader") ||
    rawText.includes("<img") ||
    /^\s*loading\s*$/i.test(rawText.trim())
  )
}

/** อ่านข้อความจาก element (ลองทั้ง textContent และ innerText เผื่อโครงสร้างต่างกัน) */
async function getStatsText(page: Page, selector: string): Promise<string> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return ""
    const text = el.textContent?.trim() ?? ""
    if (text) return text
    return (el.innerText ?? "").trim()
  }, selector)
}

/** ดึงข้อความจาก element ที่มี class pvc_stats (Post Views Counter) */
async function getPvcStatsFromPage(
  page: Page,
  slug: string,
  url: string
): Promise<{ total: number; today: number; rawText: string; selectorFound: boolean }> {
  const selector = ".pvc_stats, [id^='pvc_stats']"
  const selectorFound = await page.waitForSelector(selector, { timeout: 15_000 }).then(() => true).catch(() => false)
  if (!selectorFound) {
    console.warn(`${LOG_PREFIX} ${slug} (${url}): ไม่พบ element .pvc_stats หรือ [id^='pvc_stats'] ใน 15 วินาที`)
  }
  await new Promise((r) => setTimeout(r, 1500))
  let rawText = await getStatsText(page, selector)
  // รอ AJAX โหลดจนได้ตัวเลขจริง — สูงสุด 20 วินาที (ตรวจทุก 2 วินาที)
  const maxWaitMs = 20_000
  const intervalMs = 2_000
  let elapsed = 0
  while (elapsed < maxWaitMs) {
    const { total, today } = parsePvcStats(rawText)
    if (total > 0 || today > 0) break
    if (elapsed > 0 && !isStillLoading(rawText)) break
    await new Promise((r) => setTimeout(r, intervalMs))
    elapsed += intervalMs
    rawText = await getStatsText(page, selector)
  }
  const { total, today } = parsePvcStats(rawText)
  if (!selectorFound || (!total && !today)) {
    console.log(
      `${LOG_PREFIX} ${slug} (${url}): selectorFound=${selectorFound} rawText=${JSON.stringify(rawText.slice(0, 200))} → total=${total} today=${today}`
    )
  }
  return { total, today, rawText, selectorFound }
}

/** เข้าหน้าเว็บหนึ่ง site แล้วดึงสถิติ PVC */
export async function scrapeSiteVisitorStats(
  page: Page,
  homepageUrl: string,
  slug: string
): Promise<SiteVisitorSnapshot> {
  try {
    console.log(`${LOG_PREFIX} เข้า: ${slug} → ${homepageUrl}`)
    await page.goto(homepageUrl, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT_MS
    })
    await new Promise((r) => setTimeout(r, WAIT_AFTER_LOAD_MS))
    const { total, today } = await getPvcStatsFromPage(page, slug, homepageUrl)
    console.log(`${LOG_PREFIX} ผล ${slug}: ยอดรวม=${total} วันนี้=${today}`)
    return { slug, total, today }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`${LOG_PREFIX} ล้มเหลว ${slug} (${homepageUrl}):`, msg)
    return { slug, total: 0, today: 0 }
  }
}

/** ดึงสถิติทุก site ด้วย Puppeteer (ต้องส่ง page ที่เตรียมแล้วจาก caller) */
export async function fetchAllSitesVisitorStats(page: Page): Promise<SiteVisitorSnapshot[]> {
  const results: SiteVisitorSnapshot[] = []
  console.log(`${LOG_PREFIX} เริ่มเช็ค ${sites.length} เว็บ`)
  for (let i = 0; i < sites.length; i++) {
    const site = sites[i]
    const url = getHomepageUrl(site.api)
    const snapshot = await scrapeSiteVisitorStats(page, url, site.slug)
    results.push(snapshot)
    if (snapshot.total === 0 && snapshot.today === 0) {
      console.warn(`${LOG_PREFIX} เว็บที่ ${i + 1}/${sites.length} (${site.slug}) ไม่มีข้อมูลยอด — ตรวจสอบ log ด้านบน`)
    }
    await new Promise((r) => setTimeout(r, 800))
  }
  const withData = results.filter((r) => r.total > 0 || r.today > 0).length
  console.log(`${LOG_PREFIX} เสร็จ: ${withData}/${sites.length} เว็บมียอด (รายการ: ${results.map((r) => `${r.slug}=${r.total}/${r.today}`).join(", ")})`)
  return results
}

/** สร้าง browser + page สำหรับรันเช็ค (ให้ API route ใช้) */
export async function runVisitorCheck(
  round: "morning" | "evening"
): Promise<{ ok: boolean; results: SiteVisitorSnapshot[]; error?: string }> {
  const puppeteer = await import("puppeteer").catch(() => null)
  if (!puppeteer) {
    return { ok: false, results: [], error: "Puppeteer is not available" }
  }
  const browser = await puppeteer.default.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--lang=th-TH"
    ]
  })
  try {
    const page = await browser.newPage()
    await page.setUserAgent(USER_AGENT)
    const results = await fetchAllSitesVisitorStats(page)
    await browser.close()
    return { ok: true, results }
  } catch (err) {
    await browser.close().catch(() => {})
    const message = err instanceof Error ? err.message : "Unknown error"
    return { ok: false, results: [], error: message }
  }
}
