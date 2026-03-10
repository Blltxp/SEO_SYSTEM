/**
 * ทดสอบเช็คอันดับ 1 keyword แล้วแสดงจำนวน URL ที่ได้ + ตัวอย่าง (ใช้ debug ตอน ranking not found ทุกอัน)
 * รัน: npx tsx scripts/debugRank.ts [keyword]
 * ระบบจะใช้ Puppeteer ยิง Google แบบอัตโนมัติ
 */
import "dotenv/config"
import {
  checkKeywordRank,
  extractSearchResultUrls,
  fetchGoogleWithPuppeteer,
  GoogleChallengeError,
  isGoogleCseConfigured
} from "../lib/googleRank"
import { getSiteSlugFromUrl } from "../lib/siteDomains"

const keyword = process.argv[2] || "หาแม่บ้าน"
async function main() {
  console.log("Keyword:", keyword)
  if (isGoogleCseConfigured()) console.log("(ใช้ Google Custom Search API)")
  const results = await checkKeywordRank(keyword)
  console.log("จำนวนเว็บเราในผลค้นหา:", results.length)
  if (results.length > 0) {
    results.forEach((r) => {
      const host = (() => {
        try {
          return new URL(r.url).hostname
        } catch {
          return r.url
        }
      })()
      console.log(`  อันดับ organic #${r.rank} (หน้า ${Math.ceil(r.rank / 10)}): ${r.site_slug} — ${host}`)
    })
  } else {
    console.log("ลอง Puppeteer…")
    const html = await fetchGoogleWithPuppeteer(keyword)
    console.log("Puppeteer HTML length:", html.length)
    const urls = extractSearchResultUrls(html)
    console.log("จำนวน URL ที่ extract ได้จาก Puppeteer:", urls.length)
    urls.slice(0, 15).forEach((u, i) => {
      const slug = getSiteSlugFromUrl(u)
      console.log(`  ${i + 1}. ${slug || "(อื่น)"} - ${u.slice(0, 65)}${u.length > 65 ? "…" : ""}`)
    })
    if (urls.length === 0) {
      console.log("\nถ้ายังได้ 0 แนะนำตั้ง GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX ใน .env (โควต้าฟรี 100/วัน)")
    }
  }
}
main().catch((e) => {
  if (e instanceof GoogleChallengeError) {
    console.error("Google ส่งหน้า challenge/captcha กลับมา ทำให้ debug รอบนี้ใช้ไม่ได้")
    process.exit(2)
  }
  console.error(e)
  process.exit(1)
})
