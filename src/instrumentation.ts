/**
 * รันครั้งเดียวตอนสตาร์ท Node server (dev / start)
 * — sync โพสต์แบบเบื้องหลัง ไม่บล็อกการเปิดพอร์ต
 *
 * POSTS_SYNC_ON_DEV_START=0 ปิดใน development
 * POSTS_SYNC_ON_START=1 เปิดใน production (ค่าเริ่มต้นปิด)
 * POSTS_SYNC_MIN_INTERVAL_MINUTES=0 sync ทุกครั้งที่สตาร์ท (ค่าเริ่มต้น 25 นาที)
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const isDev = process.env.NODE_ENV === "development"
  const offDev = process.env.POSTS_SYNC_ON_DEV_START === "0"
  const onProd = process.env.POSTS_SYNC_ON_START === "1"

  if (isDev) {
    if (offDev) return
  } else if (!onProd) {
    return
  }

  const minRaw = process.env.POSTS_SYNC_MIN_INTERVAL_MINUTES
  const minMinutes =
    minRaw === undefined || minRaw === ""
      ? 25
      : Number.parseInt(minRaw, 10)
  const minIntervalMs =
    Number.isFinite(minMinutes) && minMinutes >= 0 ? minMinutes * 60_000 : 25 * 60_000

  void (async () => {
    try {
      const { syncPostsFromWordPress, shouldSkipPostsSyncByAge } = await import("@/lib/syncPosts")
      const skip = await shouldSkipPostsSyncByAge(minIntervalMs)
      if (skip) {
        console.log(
          "[posts-sync] ข้าม — เพิ่ง sync ไปเมื่อไม่นาน (ตั้ง POSTS_SYNC_MIN_INTERVAL_MINUTES=0 เพื่อบังคับทุกครั้ง)"
        )
        return
      }
      await syncPostsFromWordPress({ context: isDev ? "dev-start" : "start" })
    } catch (e) {
      console.error("[posts-sync] ล้มเหลว:", e)
    }
  })()
}
