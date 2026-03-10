/**
 * mapping site_slug -> domain(s) สำหรับจับคู่ URL ในผลค้นหา Google
 * ต้องตรงกับ 6 เว็บในระบบ (เดียวกับ wordpress)
 */
export const SITE_DOMAINS: Record<string, string[]> = {
  maidwonderland: ["maidwonderland.com"],
  maidsiam: ["maidsiam.com", "maidsiam.co.th"],
  nasaladphrao48: ["nasaladphrao48.com"],
  ddmaid: ["ddmaid.com"],
  ddmaidservice: ["แม่บ้านดีดีเซอร์วิส.com", "xn--c3crase5bt6a1a1a4c5ahb9nh4jta1e.com"],
  suksawatmaid: ["แม่บ้านสุขสวัสดิ์.com", "xn--22c0bnd8a1btbb3ef6a8b3hsera6d.com"]
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFC")
}

export function getSiteSlugFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = norm(u.hostname.replace(/^www\./, ""))
    for (const [slug, domains] of Object.entries(SITE_DOMAINS)) {
      if (domains.some((d) => host === norm(d) || host.endsWith("." + norm(d)))) return slug
    }
    // fallback: host ลงท้ายด้วย .slug หรือ .slug + domain (เช่น xxx.maidsiam.com)
    for (const slug of Object.keys(SITE_DOMAINS)) {
      if (host === slug || host.endsWith("." + slug) || host === `${slug}.com` || host.endsWith(`.${slug}.com`)) return slug
    }
    // fallback: ชื่อใน host (รวมโดเมนไทย/punycode)
    if (host.includes("maidsiam")) return "maidsiam"
    if (host.includes("maidwonderland")) return "maidwonderland"
    if (host.includes("nasaladphrao48")) return "nasaladphrao48"
    if (host.includes("xn--c3crase5bt6a1a1a4c5ahb9nh4jta1e") || host.includes("แม่บ้านดีดีเซอร์วิส")) return "ddmaidservice"
    if (host.includes("xn--22c0bnd8a1btbb3ef6a8b3hsera6d") || host.includes("แม่บ้านสุขสวัสดิ์")) return "suksawatmaid"
    if (host.includes("ddmaid")) return "ddmaid"
  } catch {
    // ignore invalid URL
  }
  return null
}
