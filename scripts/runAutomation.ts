import { fetchAllSitesPosts } from "../lib/wordpress"

async function runAutomation() {
  console.log("Starting SEO scan...\n")

  const data = await fetchAllSitesPosts()

  for (const site in data) {
    const posts = data[site]

    console.log(`\nSite: ${site}`)
    console.log(`Posts found: ${posts.length}`)

    posts.slice(0, 3).forEach((post) => {
      console.log("-", post.title.rendered)
    })
  }

  console.log("\nScan complete.")
}

runAutomation()