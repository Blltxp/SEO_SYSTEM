/**
 * อัปเดตรายการ keyword เป็น 19 คำตามสเปก (รันครั้งเดียวเมื่อเปลี่ยนจากรายการเดิม)
 * รัน: npm run update-keywords
 */
import { db } from "../lib/db"

async function main() {
const KEYWORDS = [
  "หาแม่บ้าน",
  "บริการหาแม่บ้าน",
  "แม่บ้าน",
  "แม่บ้านรายเดือน",
  "หาแม่บ้านรายเดือน",
  "หาแม่บ้านอยู่ประจำ",
  "หาพี่เลี้ยงเด็ก",
  "หาคนดูแลผู้สูงอายุ",
  "จัดหาแม่บ้าน",
  "จัดส่งแม่บ้าน",
  "ศูนย์จัดหาแม่บ้าน",
  "รับจัดหาแม่บ้าน",
  "หาแม่บ้านคนลาว",
  "จัดหาแม่บ้านคนลาว",
  "หาแม่บ้านคนไทย",
  "หาแม่บ้านต่างด้าว",
  "จ้างแม่บ้าน",
  "หาแรงงานต่างด้าว",
  "แม่บ้านมืออาชีพ"
]

await db.prepare(`
  UPDATE keywords
  SET keyword = 'หาแม่บ้านรายเดือน'
  WHERE keyword = 'หาแม่บ้านรายเดือนหา'
    AND NOT EXISTS (
      SELECT 1 FROM keywords WHERE keyword = 'หาแม่บ้านรายเดือน'
    )
`).run()

await db.prepare(`
  UPDATE rank_history
  SET keyword = 'หาแม่บ้านรายเดือน'
  WHERE keyword = 'หาแม่บ้านรายเดือนหา'
`).run()

await db.prepare(`
  DELETE FROM site_keywords
  WHERE keyword_id IN (
    SELECT id FROM keywords WHERE keyword = 'หาแม่บ้านรายเดือนหา'
  )
`).run()

await db.prepare(`
  DELETE FROM keywords
  WHERE keyword = 'หาแม่บ้านรายเดือนหา'
`).run()

const upsert = db.prepare(`
  INSERT INTO keywords (keyword, sort_order)
  VALUES (?, ?)
  ON CONFLICT(keyword) DO UPDATE SET
    sort_order = excluded.sort_order
`)
for (let i = 0; i < KEYWORDS.length; i++) {
  await upsert.run(KEYWORDS[i], i)
}

const placeholders = KEYWORDS.map(() => "?").join(", ")
await db.prepare(`
  DELETE FROM site_keywords
  WHERE keyword_id IN (
    SELECT id FROM keywords WHERE keyword NOT IN (${placeholders})
  )
`).run(...KEYWORDS)

await db.prepare(`
  DELETE FROM keywords
  WHERE keyword NOT IN (${placeholders})
`).run(...KEYWORDS)

console.log("อัปเดต keywords เป็น", KEYWORDS.length, "คำเรียบร้อย")
}

main().catch(console.error)
