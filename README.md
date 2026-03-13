# SEO System

ระบบจัดการ SEO สำหรับ 6 เว็บไซต์: ติดตามอันดับ Google (19 keyword), ตรวจบทความซ้ำ และแนะนำหัวข้อบทความ

---

## ✨ Features

### 1. Keyword Ranking Tracker
- **เช็คอันดับ Google** — 19 keyword × 6 เว็บไซต์
- **Dashboard** — ตารางอันดับ, Heatmap, กราฟแนวโน้มย้อนหลัง
- **กราฟเจาะลึก** — เลือก keyword ดูแนวโน้ม 6 เว็บ พร้อมเส้นเฉลี่ย
- **เปรียบเทียบ** — ดีขึ้น/แย่ลง/คงเดิม เทียบกับรอบก่อน
- **รันอัตโนมัติ** — Cron ทุกชั่วโมง + ปุ่มเช็คอันดับมือ

### 2. Article Intelligence System
- **ดึงบทความ** — จาก WordPress API / RSS (6 เว็บ)
- **ตรวจบทความซ้ำ** — หัวข้อซ้ำ, เนื้อหาคล้าย (cosine similarity)
- **หัวข้อบทความแนะนำ** — แนะนำเมื่อเว็บยังไม่อยู่หน้า 1 (ใช้ข้อมูล rank จริง)

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4, Recharts |
| Database | SQLite (default) หรือ PostgreSQL |
| Scraping | Cheerio, Puppeteer |
| Automation | node-cron |

---

## 📁 Project Structure

```
seo-system/
├── lib/                    # Core logic
│   ├── db.ts              # Database (SQLite/PostgreSQL wrapper)
│   ├── ranking.ts         # Rank history CRUD
│   ├── googleRank.ts      # Google search scraping / CSE API
│   ├── rankDrop.ts        # หัวข้อแนะนำเมื่ออันดับหล่น
│   ├── titleSuggestions.ts # Title suggestions
│   ├── duplicate.ts       # บทความซ้ำ
│   ├── wordpress.ts       # WordPress API / RSS fetch
│   └── ...
├── src/
│   ├── app/
│   │   ├── page.tsx       # Redirect → /ranking/graph
│   │   ├── ranking/       # ตารางอันดับ + กราฟ
│   │   ├── article-titles/# หัวข้อบทความแนะนำ
│   │   ├── duplicates/    # รายงานบทความซ้ำ
│   │   └── api/           # API routes
│   └── components/        # Sidebar, PageLayout, Card, Button
├── scripts/
│   ├── scan.ts            # สแกนบทความจาก 6 เว็บ
│   ├── runScheduledJobs.ts# Cron: scan + check ranking
│   ├── checkRanking.ts    # เช็คอันดับ (CSE API)
│   ├── checkRankingLocal.ts # เช็คอันดับแบบ local (Puppeteer)
│   ├── detectDuplicate.ts # ตรวจบทความซ้ำ
│   └── migrateToNeon.ts   # ย้าย DB ไป Neon
├── docs/                  # เอกสารภาษาไทย
└── seo.db                 # SQLite (ถ้าไม่ใช้ PostgreSQL)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- (Optional) PostgreSQL หรือ [Neon](https://neon.tech) สำหรับ database บน cloud

### Installation

```bash
git clone <repo-url>
cd seo-system
npm install
```

### Environment Variables

สร้างไฟล์ `.env` ในโฟลเดอร์ราก:

```env
# Database (เลือกอย่างใดอย่างหนึ่ง)
# ถ้าไม่ตั้ง = ใช้ SQLite (seo.db)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# สำหรับเช็คอันดับจากเซิร์ฟเวอร์ (ไม่ใช่ local)
# โควต้าฟรี 100 ครั้ง/วัน
GOOGLE_CSE_API_KEY=your_api_key
GOOGLE_CSE_CX=your_search_engine_id
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | No | PostgreSQL connection string. ถ้าไม่มีจะใช้ SQLite |
| `GOOGLE_CSE_API_KEY` | สำหรับ production | Google Custom Search API key |
| `GOOGLE_CSE_CX` | สำหรับ production | Search Engine ID |
| `MIGRATE_TARGET_DATABASE_URL` | Migration only | สำหรับ `npm run migrate-to-neon` |

### Run Development

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) — จะ redirect ไปแดชบอร์ด ranking

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run scan` | สแกนบทความจาก 6 เว็บ |
| `npm run schedule` | รัน cron jobs (scan + check ranking) |
| `npm run detect` | ตรวจบทความซ้ำ |
| `npm run check-ranking` | เช็คอันดับ (CSE API — ใช้บนเซิร์ฟเวอร์) |
| `npm run check-ranking-local` | เช็คอันดับแบบ local (Puppeteer) |
| `npm run update-keywords` | อัปเดต keywords ใน DB |
| `npm run migrate-sqlite-to-pg` | ย้ายข้อมูลจาก SQLite → PostgreSQL |
| `npm run migrate-to-neon` | ย้ายข้อมูลไป Neon Cloud |
| `npm run cleanup-rank-history` | ลบ rank_history ที่เก่ากว่า 1 ปี |

---

## 📐 Architecture & Diagrams

### System Overview

```mermaid
flowchart TB
    subgraph Input["แหล่งข้อมูล"]
        WP[WordPress API 6 เว็บ]
        Google[Google Search]
    end

    subgraph Automation["ระบบอัตโนมัติ"]
        Scan[สแกนบทความ 10:00]
        Rank[เช็คอันดับ ทุกชม.]
        Cleanup[ลบ rank_history > 1 ปี]
    end

    subgraph Data["ฐานข้อมูล"]
        Posts[(posts)]
        RankHistory[(rank_history)]
    end

    subgraph Dashboard["Dashboard"]
        R1[ranking]
        R2[ranking graph]
        A[article-titles]
        D[duplicates]
        M[ranking manage]
    end

    WP --> Scan --> Posts
    Google --> Rank --> RankHistory
    Posts --> A
    Posts --> D
    RankHistory --> R1
    RankHistory --> R2
    RankHistory --> A
```

### Flow Charts & ER Diagram

| Document | Description |
|----------|-------------|
| **[docs/FLOWCHART.md](./docs/FLOWCHART.md)** | Flow charts: Article Scan, Ranking Check, Duplicate Detection, Cron Schedule |
| **[docs/ER-DIAGRAM.md](./docs/ER-DIAGRAM.md)** | Entity-Relationship Diagram สำหรับ database |

### Database ER Diagram

```mermaid
erDiagram
    sites ||--o{ site_keywords : "has"
    keywords ||--o{ site_keywords : "assigned"
    sites ||--o{ posts : "source"
    sites ||--o{ rank_history : "site_slug"
    keywords ||--o{ rank_history : "keyword"

    sites { int id PK text slug UK text name int sort_order }
    keywords { int id PK text keyword UK int sort_order }
    site_keywords { int site_id PK,FK int keyword_id PK,FK }
    posts { int id PK text title text content text source timestamp published_at }
    rank_history { int id PK text recorded_date text site_slug text keyword int rank text url }
```

---

## 🗄 Database Schema

### Tables
- **posts** — บทความจาก 6 เว็บ (title, content, url, source, keyword)
- **keywords** — 19 keyword หลัก
- **sites** — 6 เว็บไซต์
- **site_keywords** — ผูก keyword กับ site
- **rank_history** — บันทึกอันดับ (recorded_date, site_slug, keyword, rank, url)

### Sites (6 เว็บ)
แม่บ้านดีดี · แม่บ้านสยาม · นาซ่าลาดพร้าว · แม่บ้านอินเตอร์ · แม่บ้านดีดีเซอร์วิส · แม่บ้านสุขสวัสดิ์

---

## 📖 Documentation

| File | Description |
|------|-------------|
| [PROJECT.md](./PROJECT.md) | ภาพรวมระบบภาษาไทย |
| [docs/FLOWCHART.md](./docs/FLOWCHART.md) | Flow charts ระบบทั้งหมด |
| [docs/ER-DIAGRAM.md](./docs/ER-DIAGRAM.md) | ER Diagram ฐานข้อมูล |
| [docs/KEYWORD_RANKING_TRACKER_SPEC.md](./docs/KEYWORD_RANKING_TRACKER_SPEC.md) | สเปก Keyword Ranking Tracker |
| [docs/ตั้งค่า-Ranking-ฟรี.md](./docs/ตั้งค่า-Ranking-ฟรี.md) | ตั้งค่า Google CSE ฟรี |
| [docs/ให้คนอื่นใช้-Ranking.md](./docs/ให้คนอื่นใช้-Ranking.md) | ให้ทีมอื่นใช้ปุ่มเช็คอันดับได้ |
| [CLOUD_SETUP.md](./CLOUD_SETUP.md) | ตั้งค่า Neon (PostgreSQL Cloud) |
| [REMOTE_DATABASE_SETUP.md](./REMOTE_DATABASE_SETUP.md) | ตั้งค่า PostgreSQL บนเซิร์ฟเวอร์ |

---

## 🌐 Deployment

- **Vercel** — แนะนำสำหรับ Next.js, ตั้ง `DATABASE_URL` + `GOOGLE_CSE_*` ใน Environment Variables
- **Neon** — ใช้ DB Cloud ฟรี ไม่ต้อง VPN ([CLOUD_SETUP.md](./CLOUD_SETUP.md))

---

## 📄 License

Private project
