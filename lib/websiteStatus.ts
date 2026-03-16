import { domainToUnicode } from "node:url"
import type { Page } from "puppeteer"
import { sites } from "./wordpress"

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const PAGE_TIMEOUT_MS = 30_000

function getHomepageUrl(apiUrl: string): string {
  const origin = new URL(apiUrl).origin
  return `${origin}/`
}

/** แปลง URL ให้ hostname เป็น Unicode (เช่น xn--... → โดเมนภาษาไทย) สำหรับแสดงผล */
function toDisplayUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr)
    const unicodeHost = domainToUnicode(u.hostname)
    const port = u.port && u.port !== (u.protocol === "https:" ? "443" : "80") ? `:${u.port}` : ""
    return `${u.protocol}//${unicodeHost}${port}${u.pathname}${u.search}${u.hash}`
  } catch {
    return urlStr
  }
}

export type WebsiteStatusResult = {
  slug: string
  name: string
  url: string
  /** เวลาโหลดเข้าเว็บ (จน DOM พร้อม) มิลลิวินาที */
  loadTimeMs: number | null
  /** สถานะความเร็วโหลดเข้าเว็บ "ปกติ" | "เริ่มช้า" | "ช้า" | "ล้มเหลว" */
  loadStatus: string
  /** เวลาหน้าขาวจนโหลดได้ (First Contentful Paint) มิลลิวินาที */
  fullLoadTimeMs: number | null
  /** สถานะความเร็วโหลดหน้าเว็บ (จนมีเนื้อหาขึ้น) "ปกติ" | "เริ่มช้า" | "ช้า" | "ล้มเหลว" */
  fullLoadStatus: string
  /** ปุ่ม/ลิงก์แอดไลน์ใช้ได้ */
  lineOk: boolean
  /** ปุ่ม/ลิงก์โทรใช้ได้ */
  phoneOk: boolean
  /** เหตุผลเมื่อแอดไลน์ผิดปกติ */
  lineReason?: string
  /** เหตุผลเมื่อปุ่มโทรผิดปกติ */
  phoneReason?: string
  error?: string
}

const REASON_NO_LINE = "ไม่พบปุ่มหรือลิงก์แอดไลน์ที่มองเห็นได้ในหน้า"
const REASON_LINE_NO_VALID_LINK = "พบปุ่มแอดไลน์แต่ลิงก์ไม่ชี้ไปที่ LINE"
const REASON_NO_PHONE = "ไม่พบปุ่มหรือลิงก์โทร (tel:) ที่มองเห็นได้ในหน้า"
const REASON_PHONE_NO_VALID_LINK = "พบปุ่มโทรแต่ไม่มีลิงก์ tel:"
const REASON_PAGE_FAILED = "โหลดหน้าไม่สำเร็จ จึงตรวจสอบปุ่มไม่ได้"

/** รอให้เนื้อหาแบบโหลดทีหลัง (JS) โหลดเสร็จก่อนเช็คปุ่ม */
/** รอให้สคริปต์ในหน้ารันก่อนเช็คปุ่ม (ลดจาก 3500 เพื่อความเร็ว) */
const WAIT_BEFORE_BUTTON_CHECK_MS = 800

/**
 * ตรวจสอบว่าหน้ามีลิงก์ LINE และลิงก์ tel: ที่ชี้ไปถูกที่ (ไม่ใช่แค่มีปุ่ม)
 * - LINE: ต้องมี href ชี้ไปที่ line.me / lin.ee / line.naver จริง
 * - โทร: ต้องมี href เป็น tel: ตามด้วยหมายเลข
 */
async function checkButtonsInPage(page: Page): Promise<{
  lineOk: boolean
  phoneOk: boolean
  lineReason?: string
  phoneReason?: string
}> {
  return page.evaluate(
    (noLine: string, lineNoValidLink: string, noPhone: string, phoneNoValidLink: string) => {
      function isVisible(el: Element): boolean {
        if (!el) return false
        const style = window.getComputedStyle(el)
        if (style.display === "none" || style.visibility === "hidden") return false
        if (parseFloat(style.opacity) === 0) return false
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) return false
        return true
      }

      function getHref(el: Element): string {
        const a = el as HTMLAnchorElement
        const attr = (a.getAttribute?.("href") ?? a.getAttribute?.("data-href") ?? "").toLowerCase()
        const resolved = (a.href ?? "").toLowerCase()
        return (attr + " " + resolved).trim()
      }

      /** ลิงก์ชี้ไปที่ LINE จริง (มีโดเมน line.me / lin.ee / line.naver) */
      function isValidLineHref(href: string): boolean {
        if (!href || href === "#" || href.startsWith("javascript:")) return false
        const h = href.toLowerCase()
        return ["line.me", "lin.ee", "line.naver", "line-apps", "l.line.me"].some((p) => h.includes(p))
      }

      /** ลิงก์ tel: ตามด้วยหมายเลขโทร */
      function isValidTelHref(href: string): boolean {
        if (!href) return false
        const h = href.trim().toLowerCase()
        if (!h.startsWith("tel:") && !h.includes("tel:")) return false
        const afterTel = h.replace(/^tel:/, "").trim()
        return /\d/.test(afterTel)
      }

      /** ดึง href จาก element เองหรือจาก <a> ภายใน */
      function getEffectiveHref(el: Element): string {
        const direct = getHref(el)
        if (direct) return direct
        const childA = el.querySelector?.("a[href]") as HTMLAnchorElement | null
        if (childA) return getHref(childA)
        return ""
      }

      const linePatterns = ["line.me", "lin.ee", "line.naver", "line-apps", "l.line.me"]
      let lineOk = false
      let foundLineButtonNoLink = false

      const allLinks = document.querySelectorAll("a[href]")
      allLinks.forEach((a) => {
        const href = getHref(a)
        if (isValidLineHref(href) && isVisible(a)) lineOk = true
      })
      if (!lineOk) {
        document.querySelectorAll("[data-href], [href], [data-line-id]").forEach((el) => {
          const href = (el.getAttribute?.("data-href") ?? el.getAttribute?.("href") ?? (el as HTMLAnchorElement).href ?? "").toLowerCase()
          if (isValidLineHref(href) && isVisible(el)) lineOk = true
        })
      }
      if (!lineOk) {
        const anyWithLine = document.querySelectorAll("a[href], [data-href], [href], [data-line-id], [onclick]")
        anyWithLine.forEach((el) => {
          const href = (el.getAttribute?.("href") ?? el.getAttribute?.("data-href") ?? (el as HTMLAnchorElement).href ?? "").toLowerCase()
          const onclick = (el.getAttribute?.("onclick") ?? "").toLowerCase()
          if (isValidLineHref(href) || (onclick && linePatterns.some((p) => onclick.includes(p)))) lineOk = true
        })
      }
      if (!lineOk) {
        const allClickable = document.querySelectorAll("a, button, [role='button'], [onclick], .line-add, [class*='line']")
        allClickable.forEach((el) => {
          const text = (el.textContent ?? el.getAttribute?.("aria-label") ?? el.getAttribute?.("title") ?? "").toLowerCase()
          const isLineLabel = /แอดไลน์|add\s*friend|line\s*@|กดแอดไลน์|line\s*กดแอด/i.test(text)
          if (isLineLabel) {
            const effective = getEffectiveHref(el)
            if (isValidLineHref(effective)) lineOk = true
            else foundLineButtonNoLink = true
          }
        })
      }

      let phoneOk = false
      let foundPhoneButtonNoLink = false

      document.querySelectorAll("a[href]").forEach((a) => {
        const href = (a.getAttribute?.("href") ?? (a as HTMLAnchorElement).href ?? "").trim()
        if (isValidTelHref(href) && isVisible(a)) phoneOk = true
      })
      if (!phoneOk) {
        document.querySelectorAll("[data-phone], [data-tel], [href*='tel']").forEach((el) => {
          const attr = (el.getAttribute?.("href") ?? el.getAttribute?.("data-phone") ?? el.getAttribute?.("data-tel") ?? "").trim()
          if (isValidTelHref(attr) && isVisible(el)) phoneOk = true
        })
      }
      if (!phoneOk) {
        document.querySelectorAll("a, button, [role='button'], [onclick]").forEach((el) => {
          const href = getEffectiveHref(el)
          const text = (el.textContent ?? el.getAttribute?.("aria-label") ?? "").toLowerCase()
          const looksLikePhone = /โทร|call|tel|phone|กดโทร|\d{3}[-\s]?\d{3}[-\s]?\d{4}/.test(text)
          if (looksLikePhone && isValidTelHref(href)) phoneOk = true
          else if (looksLikePhone && (el.querySelector?.('a[href*="tel:"]') || el.closest?.('a[href*="tel:"]'))) phoneOk = true
          else if (looksLikePhone) foundPhoneButtonNoLink = true
        })
      }

      let lineReason: string | undefined
      if (!lineOk) lineReason = foundLineButtonNoLink ? lineNoValidLink : noLine
      let phoneReason: string | undefined
      if (!phoneOk) phoneReason = foundPhoneButtonNoLink ? phoneNoValidLink : noPhone

      return { lineOk, phoneOk, lineReason, phoneReason }
    },
    REASON_NO_LINE,
    REASON_LINE_NO_VALID_LINK,
    REASON_NO_PHONE,
    REASON_PHONE_NO_VALID_LINK
  )
}

/** รันการเช็คปุ่มทั้งในหน้าหลักและใน iframe (รวมวิดเจ็ตแชท/ปุ่มที่ฝังใน iframe) */
async function checkButtonsInPageAndFrames(page: Page): Promise<{
  lineOk: boolean
  phoneOk: boolean
  lineReason?: string
  phoneReason?: string
}> {
  const main = await checkButtonsInPage(page)
  let lineOk = main.lineOk
  let phoneOk = main.phoneOk
  let lineReason = main.lineReason
  let phoneReason = main.phoneReason

  const frames = page.frames().filter((f) => f !== page.mainFrame())
  for (const frame of frames) {
    try {
      const sub = await frame.evaluate(
        (noLine: string, lineNoValidLink: string, noPhone: string, phoneNoValidLink: string) => {
          function isVisible(el: Element): boolean {
            if (!el) return false
            const style = window.getComputedStyle(el)
            if (style.display === "none" || style.visibility === "hidden") return false
            if (parseFloat(style.opacity) === 0) return false
            const rect = el.getBoundingClientRect()
            return !(rect.width === 0 && rect.height === 0)
          }
          function getHref(el: Element): string {
            const a = el as HTMLAnchorElement
            const attr = (a.getAttribute?.("href") ?? a.getAttribute?.("data-href") ?? "").toLowerCase()
            const resolved = (a.href ?? "").toLowerCase()
            return (attr + " " + resolved).trim()
          }
          function isValidLineHref(href: string): boolean {
            if (!href || href === "#" || href.startsWith("javascript:")) return false
            const h = href.toLowerCase()
            return ["line.me", "lin.ee", "line.naver", "line-apps", "l.line.me"].some((p) => h.includes(p))
          }
          function isValidTelHref(href: string): boolean {
            if (!href) return false
            const h = href.trim().toLowerCase()
            if (!h.startsWith("tel:") && !h.includes("tel:")) return false
            return /\d/.test(h.replace(/^tel:/, "").trim())
          }
          function getEffectiveHref(el: Element): string {
            const direct = getHref(el)
            if (direct) return direct
            const childA = el.querySelector?.("a[href]") as HTMLAnchorElement | null
            return childA ? getHref(childA) : ""
          }
          const linePatterns = ["line.me", "lin.ee", "line.naver", "line-apps", "l.line.me"]
          let foundLine = false
          document.querySelectorAll("a[href]").forEach((a) => {
            if (isValidLineHref(getHref(a)) && isVisible(a)) foundLine = true
          })
          document.querySelectorAll("[data-href], [href], [data-line-id]").forEach((el) => {
            const href = (el.getAttribute?.("data-href") ?? el.getAttribute?.("href") ?? (el as HTMLAnchorElement).href ?? "").toLowerCase()
            if (isValidLineHref(href) && isVisible(el)) foundLine = true
          })
          if (!foundLine) {
            document.querySelectorAll("a[href], [data-href], [href], [data-line-id]").forEach((el) => {
              if (isValidLineHref(getHref(el))) foundLine = true
            })
          }
          if (!foundLine) {
            document.querySelectorAll("a, button, [role='button'], [onclick]").forEach((el) => {
              const text = (el.textContent ?? el.getAttribute?.("aria-label") ?? "").toLowerCase()
              if (/แอดไลน์|add\s*friend|line\s*@|กดแอดไลน์|line\s*กดแอด/i.test(text) && isValidLineHref(getEffectiveHref(el))) foundLine = true
            })
          }
          let foundPhone = false
          document.querySelectorAll("a[href]").forEach((a) => {
            const href = (a.getAttribute?.("href") ?? (a as HTMLAnchorElement).href ?? "").trim()
            if (isValidTelHref(href) && isVisible(a)) foundPhone = true
          })
          document.querySelectorAll("[data-phone], [data-tel], [href*='tel']").forEach((el) => {
            const attr = (el.getAttribute?.("href") ?? el.getAttribute?.("data-phone") ?? el.getAttribute?.("data-tel") ?? "").trim()
            if (isValidTelHref(attr) && isVisible(el)) foundPhone = true
          })
          return { lineOk: foundLine, phoneOk: foundPhone }
        },
        REASON_NO_LINE,
        REASON_LINE_NO_VALID_LINK,
        REASON_NO_PHONE,
        REASON_PHONE_NO_VALID_LINK
      )
      lineOk = lineOk || sub.lineOk
      phoneOk = phoneOk || sub.phoneOk
    } catch {
      // iframe อาจ cross-origin อ่านไม่ได้ ข้าม
    }
  }

  return {
    lineOk,
    phoneOk,
    lineReason: lineOk ? undefined : lineReason,
    phoneReason: phoneOk ? undefined : phoneReason
  }
}

/**
 * เช็คหนึ่งเว็บ: ความเร็วโหลด + ปุ่มแอดไลน์ + ปุ่มโทร
 */
export async function checkOneSiteStatus(
  page: Page,
  slug: string,
  name: string,
  homepageUrl: string
): Promise<WebsiteStatusResult> {
  const result: WebsiteStatusResult = {
    slug,
    name,
    url: toDisplayUrl(homepageUrl),
    loadTimeMs: null,
    loadStatus: "ล้มเหลว",
    fullLoadTimeMs: null,
    fullLoadStatus: "ล้มเหลว",
    lineOk: false,
    phoneOk: false
  }

  try {
    await page.goto(homepageUrl, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT_MS
    })
    await new Promise((r) => setTimeout(r, WAIT_BEFORE_BUTTON_CHECK_MS))
    const buttons = await checkButtonsInPageAndFrames(page)
    result.lineOk = buttons.lineOk
    result.phoneOk = buttons.phoneOk
    result.lineReason = !buttons.lineOk ? (buttons.lineReason ?? REASON_NO_LINE) : undefined
    result.phoneReason = !buttons.phoneOk ? (buttons.phoneReason ?? REASON_NO_PHONE) : undefined
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    result.lineReason = REASON_PAGE_FAILED
    result.phoneReason = REASON_PAGE_FAILED
  }

  return result
}

const PARALLEL_PAGES = 3
const DELAY_BETWEEN_SITES_MS = 200

/**
 * เช็คทุก site ในระบบ (รันหลายเว็บพร้อมกันเพื่อความเร็ว)
 */
export async function checkAllSitesStatus(pages: Page[]): Promise<WebsiteStatusResult[]> {
  const results: WebsiteStatusResult[] = new Array(sites.length)
  const roundSize = Math.min(PARALLEL_PAGES, sites.length)

  for (let i = 0; i < sites.length; i += roundSize) {
    const batch = sites.slice(i, i + roundSize)
    const batchResults = await Promise.all(
      batch.map((site, j) => {
        const page = pages[j % pages.length]
        const url = getHomepageUrl(site.api)
        return checkOneSiteStatus(page, site.slug, site.name, url)
      })
    )
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j]
    }
    if (i + roundSize < sites.length) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_SITES_MS))
    }
  }
  return results
}

/**
 * เปิด browser แล้วรันเช็คทุกเว็บ (ให้ API เรียกใช้)
 */
export async function runWebsiteStatusCheck(): Promise<{
  ok: boolean
  results: WebsiteStatusResult[]
  error?: string
}> {
  const puppeteer = await import("puppeteer").catch(() => null)
  if (!puppeteer) {
    return { ok: false, results: [], error: "Puppeteer is not available" }
  }

  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-sync",
    "--metrics-recording-only",
    "--no-first-run",
    "--lang=th-TH"
  ]
  // ใช้ Chrome ที่ติดตั้งบนเครื่องถ้ามี (ตัวเลขความเร็วมักใกล้การเปิดจริงมากกว่า Chromium)
  let browser: Awaited<ReturnType<typeof puppeteer.default.launch>>
  try {
    browser = await puppeteer.default.launch({ headless: true, channel: "chrome", args })
  } catch {
    browser = await puppeteer.default.launch({ headless: true, args })
  }

  try {
    const pages = await Promise.all(
      Array.from({ length: PARALLEL_PAGES }, () => browser.newPage())
    )
    for (const page of pages) {
      await page.setUserAgent(USER_AGENT)
    }

    const results = await checkAllSitesStatus(pages)
    await Promise.all(pages.map((p) => p.close().catch(() => {})))
    await browser.close()
    return { ok: true, results }
  } catch (err) {
    await browser.close().catch(() => {})
    const message = err instanceof Error ? err.message : "Unknown error"
    return { ok: false, results: [], error: message }
  }
}
