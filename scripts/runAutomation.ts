import { db } from "../lib/db.js"
import { fetchPosts } from "../lib/rssFetch.js"

const sites = [
  "https://example1.com",
  "https://example2.com"
]

async function run() {

  console.log("Starting SEO scan...\n")

  for (const site of sites) {

    console.log(`Scanning site: ${site}`)

    const posts = await fetchPosts(site)

    console.log(`Total posts: ${posts.length}`)

    for (const p of posts) {

      db.prepare(`
        INSERT INTO posts (title, content, source)
        VALUES (?, ?, ?)
      `).run(
        p.title,
        p.content,
        site
      )

    }

  }

  console.log("\nScan complete")

}

run()