/**
 * อัปเดตรายการ keyword เป็น 19 คำตามสเปก (รันครั้งเดียวเมื่อเปลี่ยนจากรายการเดิม)
 * รัน: npm run update-keywords
 */
import { db } from "../lib/db"

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

db.exec("DELETE FROM site_keywords")
db.exec("DELETE FROM keywords")
const insert = db.prepare("INSERT INTO keywords (keyword, sort_order) VALUES (?, ?)")
KEYWORDS.forEach((kw, i) => insert.run(kw, i))
console.log("อัปเดต keywords เป็น", KEYWORDS.length, "คำเรียบร้อย")
