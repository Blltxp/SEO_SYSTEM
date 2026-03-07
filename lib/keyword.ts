import { db } from "./db"

export type KeywordConflict = {
  keyword: string
  count: number
  sources: string[]
}

function extractKeyword(title: string): string {

  const words = title
    .toLowerCase()
    .replace(/[^\w\sก-๙]/g, "")
    .split(/\s+/)

  return words.slice(0, 3).join(" ")

}

export function detectKeywordCannibalization(): KeywordConflict[] {

  const posts = db.prepare(`
    SELECT title, source
    FROM posts
  `).all() as any[]

  const map: Record<string, Set<string>> = {}

  for (const post of posts) {

    const keyword = extractKeyword(post.title)

    if (!map[keyword]) {
      map[keyword] = new Set()
    }

    map[keyword].add(post.source)

  }

  const conflicts: KeywordConflict[] = []

  for (const keyword in map) {

    const sources = Array.from(map[keyword])

    if (sources.length > 1) {

      conflicts.push({
        keyword,
        count: sources.length,
        sources
      })

    }

  }

  return conflicts
}