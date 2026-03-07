import { detectTitleDuplicates } from "../lib/duplicate.js"

const dups = detectTitleDuplicates()

console.log(`Found ${dups.length} duplicate titles\n`)

for (const d of dups) {

  console.log("Title:", d.title)

  for (const p of d.pages) {
    console.log(" -", p.source)
  }

  console.log("")

}