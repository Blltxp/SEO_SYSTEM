import { fetchAllSitesPosts } from "./wordpress"
import { db } from "./db"

export type SyncPostsOptions = {
  /** สำหรับ log */
  context?: string
}

/** ถ้าเพิ่ง sync ไปเมื่อไม่นาน (ดูจาก MAX(synced_at)) ให้ข้าม — ลดการยิง API ตอนรีสตาร์ท dev ถี่ๆ */
export async function shouldSkipPostsSyncByAge(minIntervalMs: number): Promise<boolean> {
  if (minIntervalMs <= 0) return false
  const row = (await db.prepare("SELECT MAX(synced_at) AS t FROM posts").get()) as { t: string | null } | undefined
  const raw = row?.t
  if (raw == null || raw === "") return false
  const last = new Date(raw).getTime()
  if (Number.isNaN(last)) return false
  return Date.now() - last < minIntervalMs
}

/** ดึงโพสต์จาก WordPress ทุกเว็บแล้วอัปเดตตาราง posts (เดียวกับ npm run scan) */
export async function syncPostsFromWordPress(options: SyncPostsOptions = {}): Promise<void> {
  const tag = options.context ? `[posts-sync:${options.context}]` : "[posts-sync]"
  console.log(`${tag} เริ่มดึงโพสต์จาก WordPress...`)

  const data = await fetchAllSitesPosts()

  for (const siteSlug in data) {
    const siteData = data[siteSlug]
    const posts = siteData.posts

    console.log(`${tag} ${siteData.name} (${siteSlug}): ${posts.length} โพสต์`)

    const updateExisting = db.prepare(`
      UPDATE posts
      SET
        title = ?,
        content = ?,
        url = ?,
        published_at = ?,
        synced_at = CURRENT_TIMESTAMP
      WHERE source = ? AND wp_post_id = ?
    `)
    const insertPost = db.prepare(`
      INSERT INTO posts
      (wp_post_id, title, content, url, source, published_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(title, source) DO UPDATE SET
        wp_post_id = COALESCE(posts.wp_post_id, excluded.wp_post_id),
        content = excluded.content,
        url = excluded.url,
        published_at = excluded.published_at,
        synced_at = CURRENT_TIMESTAMP
    `)

    for (const post of posts) {
      const updated = await updateExisting.run(
        post.title.rendered,
        post.content.rendered,
        post.link,
        post.date,
        siteSlug,
        post.id
      )

      if (updated.changes === 0) {
        await insertPost.run(
          post.id,
          post.title.rendered,
          post.content.rendered,
          post.link,
          siteSlug,
          post.date
        )
      }
    }

    /**
     * ลบแถวที่มี wp_post_id แต่ไม่โผล่ใน API อีกแล้ว (ถูกลบ/ย้ายสถานะจน REST ไม่คืน)
     * ไม่รันเมื่อ API คืน 0 โพสต์ — กันความผิดพลาด/เพจว่างแล้วล้างทั้งเว็บ
     * แถวที่ wp_post_id เป็น NULL (ข้อมูลเก่า) ไม่แตะ
     */
    if (posts.length > 0) {
      const apiIds = new Set(posts.map((p) => p.id))
      const localRows = (await db
        .prepare("SELECT wp_post_id FROM posts WHERE source = ? AND wp_post_id IS NOT NULL")
        .all(siteSlug)) as { wp_post_id: number }[]
      const staleIds = localRows.map((r) => r.wp_post_id).filter((id) => !apiIds.has(id))
      const chunkSize = 200
      for (let i = 0; i < staleIds.length; i += chunkSize) {
        const part = staleIds.slice(i, i + chunkSize)
        const placeholders = part.map(() => "?").join(", ")
        await db
          .prepare(`DELETE FROM posts WHERE source = ? AND wp_post_id IN (${placeholders})`)
          .run(siteSlug, ...part)
      }
      if (staleIds.length > 0) {
        console.log(`${tag} ลบโพสต์ที่ไม่อยู่ใน WordPress แล้ว (${siteSlug}): ${staleIds.length} แถว`)
      }
    }
  }

  console.log(`${tag} เสร็จแล้ว`)
}
