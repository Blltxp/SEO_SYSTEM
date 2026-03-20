import { syncPostsFromWordPress } from "../lib/syncPosts"

export async function runAutomation() {
  console.log("Starting SEO scan...\n")
  await syncPostsFromWordPress({ context: "scan-cli" })
}
