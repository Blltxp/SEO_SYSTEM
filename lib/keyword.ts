import { db } from "./db.js"

export function detectKeywordCannibalization() {

  const rows = db.prepare(`
    SELECT title, source
    FROM posts
  `).all() as any[]

  const map: Record<string, any[]> = {}

  for (const r of rows) {

    const keyword = r.title.toLowerCase()

    if (!map[keyword]) {
      map[keyword] = []
    }

    map[keyword].push(r)

  }

  return Object.entries(map)
    .filter(([, pages]) => pages.length > 1)
    .map(([keyword, pages]) => ({
      keyword,
      pages
    }))

}