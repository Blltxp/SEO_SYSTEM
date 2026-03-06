import { db } from "../lib/db.js";
import { fetchPosts } from "../lib/rssFetch.js";

const sites = [
  "https://example1.com",
  "https://example2.com",
  "https://example3.com",
];

async function run() {
  for (const site of sites) {
    const posts = await fetchPosts(site);

    console.log(`\n=== ${site} ===`);

    for (const p of posts) {
      console.log(p.title);

      db.prepare(`
        INSERT INTO posts (title, content, source)
        VALUES (?, ?, ?)
      `).run(
        p.title,
        p.content ?? "",
        site
      );
    }
  }

  console.log("\n🚀 Scan complete");
}

run();