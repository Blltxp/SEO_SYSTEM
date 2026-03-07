import { db } from "./db"
import { cosineSimilarity } from "./similarity"

export type DuplicateTitle = {
  title: string
  count: number
  sources: string[]
}

export function detectTitleDuplicates(): DuplicateTitle[] {

  const rows = db.prepare(`
    SELECT title, COUNT(*) as count
    FROM posts
    GROUP BY title
    HAVING count > 1
  `).all() as any[]

  const duplicates: DuplicateTitle[] = []

  for (const row of rows) {

    const sources = db.prepare(`
      SELECT source
      FROM posts
      WHERE title = ?
    `).all(row.title) as any[]

    duplicates.push({
      title: row.title,
      count: row.count,
      sources: sources.map(s => s.source)
    })

  }

  return duplicates
}

export function detectContentDuplicates(threshold = 0.8) {

  const posts = db.prepare(`
    SELECT id, title, content, source
    FROM posts
  `).all() as any[]

  const duplicates: any[] = []

  for (let i = 0; i < posts.length; i++) {

    for (let j = i + 1; j < posts.length; j++) {

      const sim = cosineSimilarity(
        posts[i].content,
        posts[j].content
      )

      if (sim >= threshold) {

        duplicates.push({
          titleA: posts[i].title,
          siteA: posts[i].source,
          titleB: posts[j].title,
          siteB: posts[j].source,
          score: sim
        })

      }

    }

  }

  return duplicates
}