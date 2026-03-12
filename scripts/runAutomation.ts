import { fetchAllSitesPosts } from "../lib/wordpress"
import { db } from "../lib/db"

export async function runAutomation() {
  console.log("Starting SEO scan...\n")

  const data = await fetchAllSitesPosts()

  for (const siteSlug in data) {
    const siteData = data[siteSlug]
    const posts = siteData.posts

    console.log(`\nSite: ${siteData.name} (${siteSlug})`)
    console.log(`Posts found: ${posts.length}`)

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
  }

  console.log("\nScan complete.")
}
