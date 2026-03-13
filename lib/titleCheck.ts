import { db } from "./db"

const SITE_LABELS: Record<string, string> = {
  maidwonderland: "แม่บ้านดีดี",
  ddmaidservice: "แม่บ้านดีดีเซอร์วิส",
  ddmaid: "แม่บ้านอินเตอร์",
  nasaladphrao48: "นาซ่าลาดพร้าว",
  maidsiam: "แม่บ้านสยาม",
  suksawatmaid: "แม่บ้านสุขสวัสดิ์"
}

/** แปลงเป็นคำเพื่อเปรียบเทียบ */
function toWords(s: string): string[] {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
}

/** คำนวณความคล้ายคลึง (overlap/min) — ≥60% ถือว่าซ้ำ */
export function calcSimilarity(a: string, b: string): number {
  const w1 = toWords(a)
  const w2 = toWords(b)
  if (w1.length === 0 || w2.length === 0) return 0
  const set2 = new Set(w2)
  const overlap = w1.filter((w) => set2.has(w)).length
  const minLen = Math.min(w1.length, w2.length)
  return Math.round((overlap / minLen) * 100)
}

export type TitleMatch = {
  title: string
  source: string
  siteLabel: string
  similarityPercent: number
}

/** เทียบหัวข้อกับที่มีใน 6 เว็บ — คืนรายการที่คล้าย ≥ thresholdPercent */
export async function checkTitleSimilarity(
  inputTitle: string,
  thresholdPercent = 60
): Promise<{ matches: TitleMatch[]; hasSimilar: boolean }> {
  const trimmed = inputTitle?.trim() ?? ""
  if (!trimmed) {
    return { matches: [], hasSimilar: false }
  }

  const rows = (await db
    .prepare("SELECT title, source FROM posts WHERE title IS NOT NULL AND TRIM(title) != ''")
    .all()) as { title: string; source: string }[]

  const matches: TitleMatch[] = []
  for (const row of rows) {
    const sim = calcSimilarity(trimmed, row.title)
    if (sim >= thresholdPercent) {
      matches.push({
        title: row.title,
        source: row.source,
        siteLabel: SITE_LABELS[row.source] ?? row.source,
        similarityPercent: sim
      })
    }
  }

  // เรียงจากคล้ายที่สุด
  matches.sort((a, b) => b.similarityPercent - a.similarityPercent)

  return {
    matches,
    hasSimilar: matches.length > 0
  }
}
