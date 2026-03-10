import cron from "node-cron"
import { runAutomation } from "./runAutomation"
import { runRankCheck } from "../lib/ranking"

// ทุกวัน 10:00 น. — สแกนบทความจาก 6 เว็บ
cron.schedule("0 10 * * *", async () => {
  console.log("[Cron] Running article scan at 10:00...")
  await runAutomation()
  console.log("[Cron] Article scan done.")
})

// ทุกชั่วโมง — เช็คอันดับ 19 keyword × 6 เว็บ
cron.schedule("0 * * * *", async () => {
  console.log("[Cron] Running rank check...")
  try {
    const { recordedAt, counts } = await runRankCheck({ delayBetweenKeywordsMs: 2000 })
    console.log("[Cron] Rank check done.", recordedAt, counts)
  } catch (e) {
    console.error("[Cron] Rank check failed:", e)
  }
})

console.log("Scheduler running. Article scan: daily at 10:00. Rank check: every hour.")
console.log("Press Ctrl+C to stop.")
