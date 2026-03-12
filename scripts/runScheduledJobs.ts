import cron from "node-cron"
import { runAutomation } from "./runAutomation"
import { runRankCheck, cleanupOldRankHistory } from "../lib/ranking"

// ทุกวัน 10:00 น. — สแกนบทความจาก 6 เว็บ
cron.schedule("0 10 * * *", async () => {
  console.log("[Cron] Running article scan at 10:00...")
  try {
    await runAutomation()
    console.log("[Cron] Article scan done.")
  } catch (e) {
    console.error("[Cron] Article scan failed:", e)
  }
})

// ทุกชั่วโมง — เช็คอันดับ 19 keyword × 6 เว็บ
cron.schedule("0 * * * *", async () => {
  console.log("[Cron] Running rank check...")
  try {
    const { recordedAt, counts } = await runRankCheck({ delayBetweenKeywordsMs: 4000 })
    console.log("[Cron] Rank check done.", recordedAt, counts)
  } catch (e) {
    console.error("[Cron] Rank check failed:", e)
  }
})

// ทุกอาทิตย์ วันอาทิตย์ 03:00 — ลบ rank_history ที่เก่ากว่า 1 ปี
cron.schedule("0 3 * * 0", async () => {
  console.log("[Cron] Running rank_history cleanup (>1 year)...")
  try {
    const deleted = await cleanupOldRankHistory(1)
    console.log("[Cron] Cleanup done. Deleted rows:", deleted)
  } catch (e) {
    console.error("[Cron] Cleanup failed:", e)
  }
})

console.log("Scheduler running. Article scan: daily at 10:00. Rank check: every hour. Cleanup: weekly Sun 03:00.")
console.log("Press Ctrl+C to stop.")
