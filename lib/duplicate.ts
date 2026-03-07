import { db } from "./db.js"

export function detectTitleDuplicates() {

  const rows = db.prepare(`
    SELECT title, source
    FROM posts
  `).all() as any[]

  const map: Record<string, any[]> = {}

  for (const r of rows) {

    const key = r.title.toLowerCase()

    if (!map[key]) {
      map[key] = []
    }

    map[key].push(r)

  }

  return Object.entries(map)
    .filter(([, pages]) => pages.length > 1)
    .map(([title, pages]) => ({
      title,
      pages
    }))

}