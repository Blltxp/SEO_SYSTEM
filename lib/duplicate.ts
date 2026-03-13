import { db, getDateFilterFragment } from "./db"
import { cosineSimilarity } from "./similarity"

export type DuplicateTitle = {
  title: string
  count: number
  sources: string[]
}

/** ถ้า sinceDays กำหนด = ดูเฉพาะบทความที่ลงภายใน N วันที่ผ่านมา (ใช้ดู "รอบนี้ไม่ให้ซ้ำ") */
export async function detectTitleDuplicates(sinceDays?: number): Promise<DuplicateTitle[]> {
  const where =
    sinceDays != null
      ? `WHERE ${getDateFilterFragment(sinceDays)}`
      : ""
  const rows = (await db
    .prepare(
      `SELECT title, COUNT(*) as count FROM posts ${where}
       GROUP BY title HAVING COUNT(*) > 1`
    )
    .all()) as { title: string; count: number }[]

  const whereTitle = sinceDays != null
    ? `AND ${getDateFilterFragment(sinceDays)}`
    : ""

  const duplicates: DuplicateTitle[] = []

  for (const row of rows) {
    const sources = (await db
      .prepare(`SELECT source FROM posts WHERE title = ? ${whereTitle}`)
      .all(row.title)) as { source: string }[]

    duplicates.push({
      title: row.title,
      count: row.count,
      sources: sources.map((s) => s.source)
    })
  }

  return duplicates
}

export type ContentDuplicate = {
  titleA: string
  siteA: string
  titleB: string
  siteB: string
  score: number
}

/** sinceDays = ดูเฉพาะบทความที่ลงภายใน N วันที่ผ่านมา (รอบนี้) */
export async function detectContentDuplicates(
  threshold = 0.8,
  limitPosts = 500,
  sinceDays?: number
): Promise<ContentDuplicate[]> {
  const where =
    sinceDays != null
      ? `WHERE ${getDateFilterFragment(sinceDays)}`
      : ""
  const posts = (await db
    .prepare(
      `SELECT id, title, content, source FROM posts ${where}
       ORDER BY id DESC LIMIT ?`
    )
    .all(limitPosts)) as { id: number; title: string; content: string; source: string }[]

  const duplicates: ContentDuplicate[] = []

  for (let i = 0; i < posts.length; i++) {
    for (let j = i + 1; j < posts.length; j++) {
      const sim = cosineSimilarity(posts[i].content, posts[j].content)
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