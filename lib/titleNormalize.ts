/** ถอด entity แบบที่ WordPress มักใส่ใน title.rendered (เช่น &#8220;) ให้ตรงกับข้อความที่ก็อปจากหน้าเว็บ */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ldquo: "\u201C",
  rdquo: "\u201D",
  lsquo: "\u2018",
  rsquo: "\u2019",
  hellip: "\u2026",
  ndash: "\u2013",
  mdash: "\u2014"
}

function decodeHtmlEntitiesOnce(s: string): string {
  let t = s.replace(/&#(\d+);/g, (_, d) => {
    const n = Number.parseInt(d, 10)
    return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : _
  })
  t = t.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
    const n = Number.parseInt(h, 16)
    return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : _
  })
  t = t.replace(/&([a-z]+);/gi, (full, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? full)
  return t
}

export function decodeHtmlEntities(s: string): string {
  let t = s
  for (let i = 0; i < 8; i++) {
    const next = decodeHtmlEntitiesOnce(t)
    if (next === t) break
    t = next
  }
  return t
}

/** จัดรูปแบบก่อนเทียบหัวข้อ — ลดเคสก็อปจากเว็บไม่ตรงกับที่เก็บใน DB */
export function normalizeTitleText(s: string): string {
  let t = decodeHtmlEntities(s.trim())
  t = t.replace(/\uFFFC/g, "")
  t = t.replace(/[\u200B-\u200D\uFEFF]/g, "")
  t = t.normalize("NFC")
  t = t.replace(/\s+/g, " ")
  return t.trim()
}
