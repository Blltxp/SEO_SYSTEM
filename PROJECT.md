# ภาพรวมระบบ SEO System

ระบบมี **2 ระบบหลัก**

---

## 1️⃣ Article Intelligence System (ระบบบทความ)

ใช้ควบคุมบทความทั้งหมดของ **6 เว็บ**

### หน้าที่
| หน้าที่ | สถานะ | รายละเอียด |
|--------|--------|------------|
| ดึงบทความจาก 6 เว็บ | ✅ | WP API (WordPress) — รองรับ RSS ได้ถ้าเว็บไหนไม่มี WP |
| เก็บบทความในฐานข้อมูล | ✅ | ตาราง `posts` (title, content, url, source) |
| ตรวจบทความซ้ำ (หัวข้อซ้ำ) | ✅ | หัวข้อเดียวกันมากกว่า 1 เว็บ |
| ตรวจ keyword ซ้ำ | ✅ | Keyword Cannibalization (3 คำแรกของหัวข้อซ้ำกันหลายเว็บ) |
| ตรวจ content similarity | ✅ | ความคล้ายเนื้อหา (cosine similarity ≥ 80%) |
| แจ้งเตือน SEO Cannibalization | ✅ | หน้า Dashboard + API |
| **ช่วยคิดหัวข้อบทความ (SEO)** | ✅ | จาก 19 keyword เดียวกับ Tracker, เทมเพลตไทย **ไม่เสียเงิน** |

### นโยบายการซ้ำ (จากผู้รับผิดชอบเขียนบทความ)
- **ในแต่ละรอบที่ลง:** ไม่ให้บทความซ้ำกัน (หัวข้อ/เนื้อหาคล้ายในรอบเดียวกันต้องหลีกเลี่ยง)
- **ข้ามเว็บและเวลา:** ซ้ำกับบทความของอีก 5 เว็บที่ลงไปแล้ว 2–3 เดือน **ได้** (ไม่ถือเป็นปัญหา)

ระบบจึงเน้น **รายงานซ้ำใน "รอบนี้"** โดยมีตัวกรองช่วงเวลา (7 / 14 / 30 วัน หรือทั้งหมด) — ค่าเริ่มต้น 14 วัน = ดูเฉพาะบทความที่ลงในรอบล่าสุด

### ผลลัพธ์ให้ทีมเขียนบทความ
- **ในรอบนี้มีอะไรซ้ำกันบ้าง** → ตั้งตัวกรองเป็น 7 หรือ 14 วัน แล้วดูรายงานหัวข้อซ้ำ + เนื้อหาคล้าย + Keyword Cannibalization
- **หัวข้อนี้มีแล้วไหม / เว็บไหนเขียนไปแล้ว** → แสดงในตารางแต่ละรายการ (sources)
- **ต้องการดูย้อนหลัง** → เลือก 30 วัน หรือ "ทั้งหมด"

### ช่องทางที่ใช้
- **Dashboard (เว็บ):** หัวข้อบทความแนะนำ, รายงานบทความซ้ำ, Keyword Cannibalization
- **CLI:** `npm run scan` | `npm run detect` | `npm run cannibal`
- **Cron (กำหนดไว้):** สแกนบทความใหม่ตามเวลา (เช่น 10:00)

---

## 2️⃣ Keyword Ranking Tracker ✅

ระบบเช็คอันดับ Google ของ keyword สำคัญ (**19 keyword** — ดูรายการใน docs/KEYWORD_RANKING_TRACKER_SPEC.md)

### ฟีเจอร์ที่ทำแล้ว
- เช็คอันดับ **ต่อ keyword ต่อเว็บทั้ง 6 เว็บ** — ตารางแสดงอันดับ + ลิงก์
- เช็ค **19 keyword พร้อมกัน** (scrape Google) บันทึกลง rank_history
- **กรณีพิเศษ:** keyword 「หาแรงงานต่างด้าว」 — แสดง "ไม่พบ (ดี)" / "พบเว็บเรา — ควรตรวจสอบ"
- **รันอัตโนมัติ:** ทุกชั่วโมง (cron) + **ปุ่มเช็คอันดับตอนนี้**
- **Dashboard:** ตารางอันดับ, Visibility (Top 10 / Top 50 / Not Found), อันดับไม่พบแสดง "-"
- **กราฟเปรียบเทียบ 6 เว็บ** ต่อ keyword — ย้อนหลัง 24 ชม. / 3 วัน / 1–3 อาทิตย์ / 1–6 เดือน / 1 ปี
- **เปรียบเทียบย้อนหลัง:** ดูได้จากกราฟ (ยังไม่มีคอลัมน์ "ขึ้น/ลงกี่อันดับ" ในตาราง)

### ฐานข้อมูล
- ตาราง **keywords** (19 คำ), **sites** (6 เว็บ), **rank_history** (recorded_date, site_slug, keyword, rank, url)

---

## โครงสร้างโปรเจค

```
seo-system
├── database (SQLite: seo.db)
│   ├── posts          ✅ บทความจาก 6 เว็บ
│   ├── keywords       ✅ 19 keyword (หัวข้อแนะนำ + Tracker)
│   └── rank_history   ✅ อันดับต่อ (วันที่, เว็บ, keyword)
├── automation
│   ├── scan articles  ✅ scripts/runAutomation.ts
│   ├── detect duplicate ✅ lib/duplicate.ts + scripts/detectDuplicate.ts
│   ├── check ranking  ✅ lib/googleRank.ts + lib/ranking.ts + scripts/checkRanking.ts
│   └── scheduler      ✅ cron: สแกนบทความ 10:00, เช็คอันดับทุกชั่วโมง
└── dashboard
    ├── หน้าแรก        ✅ ลิงก์ไปทุกรายงาน
    ├── article-titles ✅ หัวข้อบทความแนะนำ (19 keyword, แนะนำเมื่อยังไม่อยู่หน้า 1)
    ├── duplicate report ✅ หัวข้อซ้ำ + เนื้อหาคล้าย
    ├── cannibalization ✅ Keyword Cannibalization
    └── ranking        ✅ ตารางอันดับ + กราฟย้อนหลัง
```

---

## เครื่องมือที่ใช้

- **Next.js** — เว็บ + API
- **Node.js** — สคริปต์ + cron
- **ฐานข้อมูล** — SQLite (เริ่มต้น) หรือ PostgreSQL/Neon (ดู CLOUD_SETUP.md)
- **node-cron** — ตั้งเวลา scan
- (RSS Parser — ใช้เมื่อมีเว็บที่ดึงแบบ RSS)
