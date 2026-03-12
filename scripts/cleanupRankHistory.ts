/**
 * ลบ rank_history ที่เก่ากว่า 1 ปี (ใช้เองหรือเรียกจาก cron)
 * รัน: npm run cleanup-rank-history
 */
import "dotenv/config"
import { cleanupOldRankHistory } from "../lib/ranking"

async function main() {
  const deleted = await cleanupOldRankHistory(1)
  console.log("Deleted rows:", deleted)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
