import { fetchAllSitesPosts } from "../lib/wordpress"
import { db } from "../lib/db"

async function runAutomation() {

  console.log("Starting SEO scan...\n")

  const data = await fetchAllSitesPosts()

  for (const site in data) {

    const posts = data[site]

    console.log(`\nSite: ${site}`)
    console.log(`Posts found: ${posts.length}`)

    for (const post of posts) {

      const title = post.title.rendered
      const content = post.content.rendered
      const url = post.link

      db.prepare(`
        INSERT OR IGNORE INTO posts
        (title, content, url, source)
        VALUES (?, ?, ?, ?)
      `).run(
        title,
        content,
        url,
        site
      )

    }

  }

  console.log("\nScan complete.")

}

runAutomation()