import OpenAI from "openai"

const EMBED_BATCH = 96
const MAX_EMBED_CHARS = 8000

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const d = Math.sqrt(na) * Math.sqrt(nb)
  return d === 0 ? 0 : dot / d
}

function clipForEmbedding(s: string): string {
  const t = s.trim()
  if (t.length <= MAX_EMBED_CHARS) return t
  return t.slice(0, MAX_EMBED_CHARS)
}

/**
 * คำนวณ cosine similarity (0–1) ระหว่างหัวข้อที่พิมพ์กับแต่ละหัวข้อในรายการ (ไม่ซ้ำ string)
 * ใช้ OpenAI embeddings — จับความหมายใกล้เคียงแม้ใช้คำต่างกัน
 */
export async function semanticTitleSimilarityMap(
  inputTitle: string,
  distinctTitles: string[],
  model: string
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey || distinctTitles.length === 0) return result

  const openai = new OpenAI({ apiKey })
  const clippedInput = clipForEmbedding(inputTitle)
  const clippedDistinct = distinctTitles.map(clipForEmbedding)

  const inputEmbedding = (
    await openai.embeddings.create({
      model,
      input: clippedInput
    })
  ).data[0]?.embedding
  if (!inputEmbedding) return result

  for (let i = 0; i < clippedDistinct.length; i += EMBED_BATCH) {
    const chunk = clippedDistinct.slice(i, i + EMBED_BATCH)
    const res = await openai.embeddings.create({
      model,
      input: chunk
    })
    const ordered = res.data.slice().sort((x, y) => x.index - y.index)
    for (let j = 0; j < ordered.length; j++) {
      const emb = ordered[j]?.embedding
      const orig = distinctTitles[i + j]
      if (emb && orig) {
        result.set(orig, cosineSimilarity(inputEmbedding, emb))
      }
    }
  }

  return result
}
