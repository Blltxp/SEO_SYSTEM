export function tokenize(text: string): string[] {

  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\w\sก-๙]/g, "")
    .split(/\s+/)
    .filter(Boolean)

}

export function cosineSimilarity(a: string, b: string): number {

  const tokensA = tokenize(a)
  const tokensB = tokenize(b)

  const freqA: Record<string, number> = {}
  const freqB: Record<string, number> = {}

  tokensA.forEach(t => freqA[t] = (freqA[t] || 0) + 1)
  tokensB.forEach(t => freqB[t] = (freqB[t] || 0) + 1)

  const words = new Set([...Object.keys(freqA), ...Object.keys(freqB)])

  let dot = 0
  let magA = 0
  let magB = 0

  for (const w of words) {

    const aVal = freqA[w] || 0
    const bVal = freqB[w] || 0

    dot += aVal * bVal
    magA += aVal * aVal
    magB += bVal * bVal

  }

  magA = Math.sqrt(magA)
  magB = Math.sqrt(magB)

  if (magA === 0 || magB === 0) return 0

  return dot / (magA * magB)

}