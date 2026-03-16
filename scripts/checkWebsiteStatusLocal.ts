/**
 * รันเช็คสถานะเว็บ (ความเร็ว + ปุ่มแอดไลน์/โทร) บนเครื่องนี้ แล้วส่งผลไปบันทึกที่แอป
 * ใช้เมื่อต้องการความเร็วและความคล้ายการเปิดเว็บจริง (รันบนเครื่องตัวเอง)
 *
 * วิธีใช้:
 *   SITE_URL=http://localhost:3000 npx tsx scripts/checkWebsiteStatusLocal.ts
 *   หรือ (ถ้าแอปโฮสต์ที่อื่น) SITE_URL=https://your-app.vercel.app npx tsx scripts/checkWebsiteStatusLocal.ts
 *   หรือส่ง URL ผ่านอาร์กิวเมนต์: npx tsx scripts/checkWebsiteStatusLocal.ts --url http://localhost:3000
 */
import "dotenv/config"
import { runWebsiteStatusCheck } from "../lib/websiteStatus"

function getSiteUrl(): string {
  const arg = process.argv.find((a) => a.startsWith("--url="))
  if (arg) return arg.slice("--url=".length).replace(/\/$/, "")
  const env = process.env.SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  if (env) {
    const base = env.startsWith("http") ? env : `https://${env}`
    return base.replace(/\/$/, "")
  }
  return "http://localhost:3000"
}

async function main() {
  const baseUrl = getSiteUrl()
  console.log("รันเช็คสถานะเว็บบนเครื่องนี้…")
  const { ok, results, error } = await runWebsiteStatusCheck()

  if (!ok) {
    console.error("เช็คไม่สำเร็จ:", error ?? "Unknown error")
    process.exit(1)
  }

  console.log(`ได้ผล ${results.length} เว็บ — กำลังส่งไปที่ ${baseUrl}/api/website-status/submit`)
  const res = await fetch(`${baseUrl}/api/website-status/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ results })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    console.error("ส่งผลไม่สำเร็จ:", data.error ?? res.statusText)
    process.exit(1)
  }
  console.log("บันทึกแล้ว — checkedAt:", data.checkedAt)
  console.log("รีเฟรชหน้า \"สถานะเว็บไซต์\" ในแอปเพื่อดูผลล่าสุด")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
