import "dotenv/config"
import { runRankCheck } from "../lib/ranking"
import { GoogleChallengeError } from "../lib/googleRank"

runRankCheck({
  delayBetweenKeywordsMs: 2000,
  onProgress: (keyword, i, total) => {
    console.log(`[${i}/${total}] เช็ค keyword: ${keyword}`)
  }
})
  .then(({ recordedAt, counts }) => {
    console.log("\nบันทึกแล้ว recorded_at:", recordedAt)
    console.log("พบเว็บเรา:", counts.found, "รายการ | ไม่พบ:", counts.notFound, "รายการ")
  })
  .catch((err) => {
    if (err instanceof GoogleChallengeError) {
      console.error("Google ส่งหน้า challenge/captcha กลับมา จึงยกเลิกรอบนี้และไม่เขียนทับข้อมูลเดิม")
      process.exit(2)
    }
    console.error(err)
    process.exit(1)
  })
