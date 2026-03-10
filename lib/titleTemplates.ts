/**
 * เทมเพลตหัวข้อบทความสำหรับ SEO ภาษาไทย (ไม่ใช้ API เสียเงิน)
 * รูปแบบที่คนค้นหาบ่อยและดึงคะแนน SEO ได้ดี
 */

export const TITLE_TEMPLATES: string[] = [
  "วิธีเลือก{keyword}ให้เหมาะกับงบประมาณและลักษณะงาน",
  "{keyword} ดีที่สุด ดูยังไงและควรเลือกแบบไหน",
  "{keyword} คืออะไร เหมาะกับใครและช่วยเรื่องอะไรได้บ้าง",
  "คู่มือ{keyword}ตั้งแต่เริ่มต้นจนพร้อมใช้งานจริง",
  "เทคนิค{keyword}ให้ได้คนตรงงานและลดปัญหาจุกจิก",
  "ราคา{keyword}อัปเดตล่าสุด พร้อมปัจจัยที่ควรรู้ก่อนจ้าง",
  "{keyword} ราคาเท่าไหร่ และมีค่าใช้จ่ายอะไรบ้าง",
  "{keyword} ที่ไหนดี เลือกแบบไหนให้คุ้มและปลอดภัย",
  "ข้อดีข้อเสียของ{keyword}ก่อนตัดสินใจใช้บริการ",
  "เปรียบเทียบ{keyword}แต่ละแบบ แบบไหนเหมาะกับบ้านคุณ",
  "เมื่อไหร่ควรใช้{keyword}และเคสไหนคุ้มที่สุด",
  "ทำไมต้องใช้{keyword}ในแต่ละสถานการณ์ของครอบครัว",
  "เคล็ดลับ{keyword}ให้ได้ผลลัพธ์ดีและคุ้มค่า",
  "{keyword} สำหรับมือใหม่ ต้องรู้อะไรก่อนเริ่ม",
  "คำถามที่พบบ่อยเกี่ยวกับ{keyword}ที่คนหาข้อมูลต้องรู้",
  "{keyword} ต่างจากแบบอื่นอย่างไร เลือกแบบไหนเหมาะกว่า",
  "ขั้นตอน{keyword}ตั้งแต่เริ่มหาจนได้คนที่ใช่",
  "เตรียมตัวก่อนใช้{keyword}ให้พร้อมก่อนตัดสินใจ",
  "{keyword} ใช้ทำอะไรได้บ้าง และเหมาะกับใครบ้าง",
  "แนะนำ{keyword}พร้อมวิธีเลือกให้ตอบโจทย์ที่สุด",
]

export function applyTemplate(template: string, keyword: string): string {
  return template.replace(/\{keyword\}/g, keyword)
}

export function suggestTitles(keywords: string[]): { keyword: string; title: string }[] {
  const out: { keyword: string; title: string }[] = []
  for (const kw of keywords) {
    for (const t of TITLE_TEMPLATES) {
      out.push({ keyword: kw, title: applyTemplate(t, kw) })
    }
  }
  return out
}
