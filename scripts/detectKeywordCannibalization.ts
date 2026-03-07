import { detectKeywordCannibalization } from "../lib/keyword.js"

const conflicts = detectKeywordCannibalization()

console.log(`Found ${conflicts.length} keyword conflicts\n`)

for (const c of conflicts) {

  console.log("Keyword:", c.keyword)

  for (const p of c.pages) {
    console.log(" -", p.source)
  }

  console.log("")

}