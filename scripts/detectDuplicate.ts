import { detectTitleDuplicates } from "../lib/duplicate"
import { detectContentDuplicates } from "../lib/duplicate"

async function run() {

  console.log("Checking title duplicates...\n")

  const titleDup = await detectTitleDuplicates()

  console.log("Title duplicates:", titleDup.length)

  console.log("\nChecking content similarity...\n")

  const contentDup = await detectContentDuplicates(0.8)

  if (contentDup.length === 0) {

    console.log("No content duplicates found.")
    return

  }

  console.log(`Found ${contentDup.length} similar articles\n`)

  for (const d of contentDup.slice(0, 10)) {

    console.log("Similarity:", d.score.toFixed(2))
    console.log(d.siteA, ":", d.titleA)
    console.log(d.siteB, ":", d.titleB)
    console.log("---------------------------")

  }

}

run()