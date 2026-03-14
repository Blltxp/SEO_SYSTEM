/**
 * ชื่อแสดงและสีของแต่ละเว็บ — ใช้ร่วมกันใน duplicates, website-status, visitors, ranking, graph
 * ตรงกับ db SITE_RECORDS และสีในกราฟเจาะลึก
 */
export const SITE_SLUG_TO_NAME: Record<string, string> = {
  maidwonderland: "แม่บ้านดีดี",
  maidsiam: "แม่บ้านสยาม",
  nasaladphrao48: "นาซ่าลาดพร้าว",
  ddmaid: "แม่บ้านอินเตอร์",
  ddmaidservice: "แม่บ้านดีดีเซอร์วิส",
  suksawatmaid: "แม่บ้านสุขสวัสดิ์"
}

export const SITE_COLOR_MAP: Record<string, string> = {
  maidwonderland: "#f0f0f0",
  maidsiam: "#ec4899",
  nasaladphrao48: "#22c55e",
  ddmaid: "#06b6d4",
  ddmaidservice: "#2563eb",
  suksawatmaid: "#a855f7"
}

const DEFAULT_COLOR = "#94a3b8"

/** คืนชื่อแสดง (ไทย) จาก slug หรือชื่อที่ส่งมา */
export function getSiteDisplayName(source: string): string {
  return SITE_SLUG_TO_NAME[source] ?? source
}

/** คืนสีของเว็บจาก slug หรือชื่อ (สำหรับใช้กับ inline style) */
export function getSiteColor(source: string): string {
  const slug =
    Object.entries(SITE_SLUG_TO_NAME).find(([, name]) => name === source)?.[0] ?? source
  return SITE_COLOR_MAP[slug] ?? DEFAULT_COLOR
}
