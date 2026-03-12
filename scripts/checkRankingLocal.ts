import "dotenv/config"
import { runRankCheck } from "../lib/ranking"
import { createGoogleRankSession, GoogleChallengeError, waitForGoogleChallengeResolved } from "../lib/googleRank"

async function main() {
  const session = await createGoogleRankSession({
    headless: false,
    channel: "chrome",
    maxPages: 2,
    onChallenge: async ({ keyword, variant, pageNumber, page }) => {
      await page.bringToFront().catch(() => {})
      console.log("")
      console.log(`[Challenge] Google ขอให้ยืนยันตัวตนระหว่างเช็ค keyword: ${keyword} (${variant}, หน้า ${pageNumber})`)
      console.log("Chrome ถูกเปิดไว้แล้ว ให้แก้ challenge/captcha ในหน้าต่างนั้น ระบบจะรอต่อเองอัตโนมัติ")
      await waitForGoogleChallengeResolved(page)
    }
  })

  try {
    const { recordedAt, counts } = await runRankCheck({
      delayBetweenKeywordsMs: 4000,
      checkKeywordRankFn: session.checkKeywordRank,
      onProgress: (keyword, i, total) => {
        console.log(`[${i}/${total}] เช็ค keyword: ${keyword}`)
      }
    })
    console.log("\nบันทึกแล้ว recorded_at:", recordedAt)
    console.log("พบเว็บเรา:", counts.found, "รายการ | ไม่พบ:", counts.notFound, "รายการ")
  } finally {
    await session.close()
  }
}

main().catch((err) => {
  if (err instanceof GoogleChallengeError) {
    console.error("ยังติดหน้า challenge/captcha อยู่ จึงยกเลิกการบันทึกเพื่อไม่ให้ทับข้อมูลเดิม")
    process.exit(2)
  }
  console.error(err)
  process.exit(1)
})
