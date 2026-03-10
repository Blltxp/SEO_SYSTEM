/**
 * Cron jobs อยู่ใน scripts/runScheduledJobs.ts
 * รัน: npm run schedule
 * - ทุกวัน 10:00 — สแกนบทความจาก 6 เว็บ (runAutomation)
 * - ทุกชั่วโมง — เช็คอันดับ 19 keyword × 6 เว็บ (runRankCheck)
 */

export const ARTICLE_SCAN_CRON = "0 10 * * *"
export const RANK_CHECK_CRON = "0 * * * *"
