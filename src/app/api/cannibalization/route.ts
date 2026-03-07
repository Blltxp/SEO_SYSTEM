import { NextResponse } from "next/server"
import { db } from "@/lib/db"

type PostRow = {
  title: string
  source: string
}

export async function GET() {

  const rows = db.prepare(`
    SELECT title, source
    FROM posts
  `).all() as PostRow[]

  const map: Record<string, any[]> = {}

  for (const r of rows) {

    const key = r.title.toLowerCase()

    if (!map[key]) {
      map[key] = []
    }

    map[key].push(r)

  }

  const result = Object.entries(map)
    .filter(([, pages]) => pages.length > 1)
    .map(([keyword, pages]) => ({
      keyword,
      pages
    }))

  return NextResponse.json(result)
}