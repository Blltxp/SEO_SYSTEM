import { db } from "./db"
import { normalizeTitleText } from "./titleNormalize"
import { semanticTitleSimilarityMap } from "./titleSemantic"

const SITE_LABELS: Record<string, string> = {
  maidwonderland: "แม่บ้านดีดี",
  ddmaidservice: "แม่บ้านดีดีเซอร์วิส",
  ddmaid: "แม่บ้านอินเตอร์",
  nasaladphrao48: "นาซ่าลาดพร้าว",
  maidsiam: "แม่บ้านสยาม",
  suksawatmaid: "แม่บ้านสุขสวัสดิ์"
}

/** แบ่งคำ — ภาษาไทยใช้ Intl.Segmenter ไม่เช่นนั้นคำติดกันจะไม่ไปทับกับหัวข้อที่เว้นวรรคคนละแบบ */
function toWords(s: string): string[] {
  const spaced = s.trim().toLowerCase().replace(/\s+/g, " ")
  try {
    const seg = new Intl.Segmenter("th", { granularity: "word" })
    const out: string[] = []
    for (const { segment, isWordLike } of seg.segment(spaced)) {
      if (!isWordLike) continue
      const t = segment.replace(/[^\p{L}\p{N}]/gu, "")
      if (t) out.push(t)
    }
    if (out.length > 0) return out
  } catch {
    /* runtime ไม่รองรับ Segmenter */
  }
  return spaced.split(" ").filter(Boolean)
}

/** ความยาวช่วงข้อความซ้ำติดกันที่สุด (ใช้หลังตัดช่องว่าง) — จับกลางประโยคเช่น "คนดูแลผู้สูงอายุ" เมื่อหัวข้อยาวคนละรูปแบบ */
function longestCommonSubstringLength(a: string, b: string): number {
  const n = a.length
  const m = b.length
  let best = 0
  const dp = new Array(m + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    for (let j = m; j >= 1; j--) {
      if (a[i - 1] === b[j - 1]) {
        dp[j] = dp[j - 1] + 1
        if (dp[j] > best) best = dp[j]
      } else {
        dp[j] = 0
      }
    }
  }
  return best
}

/**
 * คำนวณความคล้ายคลึง (หลัง normalize) — ผสมทับคำ (overlap/min) กับคะแนนจาก LCS
 * ใช้รากที่สองกับส่วนที่สั้นกว่า เพื่อไม่ให้หัวข้อไทยที่ว่าเรื่องเดียวกันแต่ตั้งคนละประโยคต่ำกว่า 60% โดยไม่จำเป็น
 */
export function calcSimilarity(a: string, b: string): number {
  const a1 = normalizeTitleText(a)
  const b1 = normalizeTitleText(b)
  if (a1 === b1) return 100
  const w1 = toWords(a1)
  const w2 = toWords(b1)
  if (w1.length === 0 || w2.length === 0) return 0
  const set2 = new Set(w2)
  const overlap = w1.filter((w) => set2.has(w)).length
  const minWordLen = Math.min(w1.length, w2.length)
  const wordSim = Math.round((overlap / minWordLen) * 100)

  const compactA = a1.replace(/\s+/g, "")
  const compactB = b1.replace(/\s+/g, "")
  const shortChars = Math.min(compactA.length, compactB.length) || 1
  const lcs = longestCommonSubstringLength(compactA, compactB)
  const lcsSim = Math.min(100, Math.round(100 * Math.sqrt(lcs / shortChars)))

  return Math.max(wordSim, lcsSim)
}

export type TitleMatch = {
  title: string
  source: string
  siteLabel: string
  similarityPercent: number
  /** ลิงก์บทความจาก WordPress sync — อาจว่างถ้าข้อมูลเก่า */
  url: string | null
}

function parseSemanticThreshold(): number {
  const raw = process.env.TITLE_SEMANTIC_THRESHOLD?.trim()
  const n = raw ? Number.parseFloat(raw) : Number.NaN
  if (Number.isFinite(n) && n > 0 && n <= 1) return n
  return 0.78
}

/**
 * ตัดผลที่เป็นหัวข้อสั้นมากใน DB แต่คะแนนสูงจากคำทับ — เช่น "ดูแลผู้สูงอายุ" กับหัวข้อยาว
 * ไม่กระทบกรณีหัวข้อ DB ยาวพอ หรือยาวใกล้เคียงกับที่พิมพ์
 */
function isNoiseShortDbTitle(inputNorm: string, dbTitleNorm: string): boolean {
  const inC = inputNorm.replace(/\s+/g, "")
  const dbC = dbTitleNorm.replace(/\s+/g, "")
  if (dbC.length === 0) return true
  if (dbC.length >= inC.length * 0.72) return false
  if (dbC.length <= 20) return true
  if (dbC.length < 26 && dbC.length < inC.length * 0.36) return true
  return false
}

/** เทียบหัวข้อกับที่มีใน 6 เว็บ — คล้ายคำ (≥ thresholdPercent) หรือคล้ายความหมาย (embedding cosine ≥ TITLE_SEMANTIC_THRESHOLD เมื่อมี OPENAI_API_KEY) */
export async function checkTitleSimilarity(
  inputTitle: string,
  thresholdPercent = 60
): Promise<{ matches: TitleMatch[]; hasSimilar: boolean }> {
  const trimmed = inputTitle?.trim() ?? ""
  if (!trimmed) {
    return { matches: [], hasSimilar: false }
  }

  const rows = (await db
    .prepare("SELECT title, source, url FROM posts WHERE title IS NOT NULL AND TRIM(title) != ''")
    .all()) as { title: string; source: string; url: string | null }[]

  const semanticThreshold = parseSemanticThreshold()
  const embedModel = process.env.TITLE_EMBEDDING_MODEL?.trim() || "text-embedding-3-small"
  let semanticByTitle = new Map<string, number>()
  if (process.env.OPENAI_API_KEY?.trim()) {
    const distinct = [...new Set(rows.map((r) => normalizeTitleText(r.title)))]
    try {
      semanticByTitle = await semanticTitleSimilarityMap(
        normalizeTitleText(trimmed),
        distinct,
        embedModel
      )
    } catch (e) {
      console.error("[titleCheck] semantic embedding failed, using word overlap only:", e)
    }
  }

  const matches: TitleMatch[] = []
  for (const row of rows) {
    const wordSim = calcSimilarity(trimmed, row.title)
    const sem = semanticByTitle.get(normalizeTitleText(row.title)) ?? 0
    const semPercent = Math.round(sem * 100)
    const score = Math.max(wordSim, semPercent)
    const byMeaning = sem >= semanticThreshold
    const byWords = wordSim >= thresholdPercent
    if (byWords || byMeaning) {
      const u = row.url != null && String(row.url).trim() !== "" ? String(row.url).trim() : null
      matches.push({
        title: row.title,
        source: row.source,
        siteLabel: SITE_LABELS[row.source] ?? row.source,
        similarityPercent: score,
        url: u
      })
    }
  }

  const inputNorm = normalizeTitleText(trimmed)
  const filtered = matches.filter((m) => !isNoiseShortDbTitle(inputNorm, normalizeTitleText(m.title)))

  filtered.sort((a, b) => b.similarityPercent - a.similarityPercent)

  return {
    matches: filtered,
    hasSimilar: filtered.length > 0
  }
}
