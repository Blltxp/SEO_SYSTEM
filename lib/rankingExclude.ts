/**
 * กรอง URL ที่ไม่นับเป็นอันดับ organic
 * - ไม่นับ Facebook / โซเชียล
 * - ไม่นับโฆษณา (sponsored) — ฝั่ง API ไม่มี ads; ฝั่ง scrape ต้องกรองที่ block
 * - ไม่นับเว็บจัดอันดับ (รวมถึงหน้ารวมลิสต์)
 * - ไม่นับเว็บข่าว
 * - ไม่นับแอป (Play Store, App Store)
 * - ไม่นับเว็บ/แอพหางาน
 */

function normalizeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return ""
  }
}

/** โดเมน/คำใน host ที่ถือว่าไม่นับ (organic) */
const EXCLUDED_HOST_PARTS: string[] = [
  "facebook.com",
  "fb.com",
  "fb.me",
  "fbcdn.net",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "line.me",
  "play.google.com",
  "apps.apple.com",
  "app.store",
  "indeed.com",
  "jobsdb.com",
  "jobthai.com",
  "jobstreet",
  "jobpub.com",
  "th.jobsdb",
  "thairath.co.th",
  "matichon.co.th",
  "posttoday.co.th",
  "bangkokbiznews.com",
  "komchadluek.net",
  "dailynews.co.th",
  "sanook.com",
  "kapook.com",
  "mgronline.com",
  "prachachat.net",
  "thestandard.co",
  "pantip.com",
  "dek-d.com",
  "variety.mthai.com"
]

/** path ที่มีคำเหล่านี้ถือว่าเป็นหน้ารวม/จัดอันดับ (ไม่นับ) */
const EXCLUDED_PATH_KEYWORDS = [
  "top-10",
  "top10",
  "จัดอันดับ",
  "ranking",
  "best-",
  "รวมที่",
  "list-of"
]

export function isExcludedUrl(url: string): boolean {
  const host = normalizeHost(url)
  if (!host) return true
  for (const part of EXCLUDED_HOST_PARTS) {
    if (host === part || host.endsWith("." + part)) return true
  }
  try {
    const path = new URL(url).pathname.toLowerCase()
    for (const kw of EXCLUDED_PATH_KEYWORDS) {
      if (path.includes(kw)) return true
    }
  } catch {
    // ignore
  }
  return false
}

/**
 * จากรายการ URL ตามลำดับผลค้นหา คืนเฉพาะที่นับเป็น organic แล้วกำหนดอันดับ 1, 2, 3, ...
 */
export function toOrganicOrderedList(urls: string[]): { url: string; organicRank: number }[] {
  const out: { url: string; organicRank: number }[] = []
  let rank = 0
  const seenHosts = new Set<string>()
  for (const url of urls) {
    if (isExcludedUrl(url)) continue
    const host = normalizeHost(url)
    if (!host || seenHosts.has(host)) continue
    seenHosts.add(host)
    rank += 1
    out.push({ url, organicRank: rank })
  }
  return out
}
