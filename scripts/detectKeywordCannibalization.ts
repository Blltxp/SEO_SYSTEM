import { detectKeywordCannibalization } from "../lib/keyword"

async function run() {

  console.log("Checking keyword cannibalization...\n")

  const conflicts = await detectKeywordCannibalization()

  if (conflicts.length === 0) {

    console.log("No keyword conflicts found.")
    return

  }

  console.log(`Found ${conflicts.length} keyword conflicts\n`)

  for (const c of conflicts.slice(0, 10)) {

    console.log("Keyword:", c.keyword)
    console.log("Sites:", c.sources.join(", "))
    console.log("-----------------------")

  }

}

run()