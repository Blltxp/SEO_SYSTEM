import Database from "better-sqlite3"

export const db = new Database("seo.db")
db.pragma("foreign_keys = ON")

db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wp_post_id INTEGER,
  title TEXT,
  content TEXT,
  url TEXT,
  keyword TEXT,
  source TEXT,
  published_at DATETIME,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(title, source)
);

CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT UNIQUE NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_keywords (
  site_id INTEGER NOT NULL,
  keyword_id INTEGER NOT NULL,
  PRIMARY KEY (site_id, keyword_id),
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (keyword_id) REFERENCES keywords(id)
);

CREATE TABLE IF NOT EXISTS rank_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_date TEXT NOT NULL,
  site_slug TEXT NOT NULL,
  keyword TEXT NOT NULL,
  rank INTEGER NOT NULL,
  url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(recorded_date, site_slug, keyword)
);

CREATE TABLE IF NOT EXISTS app_locks (
  lock_key TEXT PRIMARY KEY,
  locked_at TEXT NOT NULL
);
`)

function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!columns.some((item) => item.name === column)) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
        throw error
      }
    }
  }
}

ensureColumn("posts", "wp_post_id", "INTEGER")
ensureColumn("posts", "published_at", "DATETIME")
ensureColumn("posts", "synced_at", "DATETIME")

db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_source_wp_post_id
ON posts(source, wp_post_id)
WHERE wp_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rank_history_keyword_recorded_date
ON rank_history(keyword, recorded_date);
`)

const SITE_RECORDS = [
  { slug: "maidwonderland", name: "แม่บ้านดีดี" },
  { slug: "maidsiam", name: "แม่บ้านสยาม" },
  { slug: "nasaladphrao48", name: "นาซ่าลาดพร้าว" },
  { slug: "ddmaid", name: "แม่บ้านอินเตอร์" },
  { slug: "ddmaidservice", name: "แม่บ้านดีดีเซอร์วิส" },
  { slug: "suksawatmaid", name: "แม่บ้านสุขสวัสดิ์" }
]

const upsertSite = db.prepare(`
  INSERT INTO sites (slug, name, sort_order)
  VALUES (?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET
    name = excluded.name,
    sort_order = excluded.sort_order
`)
SITE_RECORDS.forEach((site, index) => upsertSite.run(site.slug, site.name, index))

const migratePostSource = db.prepare(`
  UPDATE posts
  SET source = ?
  WHERE source = ?
    AND NOT EXISTS (
      SELECT 1
      FROM posts p2
      WHERE p2.title = posts.title
        AND p2.source = ?
    )
`)
for (const site of SITE_RECORDS) {
  migratePostSource.run(site.slug, site.name, site.slug)
}

// Seed 19 keywords ครั้งแรก (รายการตามสเปก — keyword 「หาแรงงานต่างด้าว」เป้าหมายคือไม่ให้เจอเว็บเรา)
const TRACKER_KEYWORDS = [
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

db.prepare(`
  UPDATE keywords
  SET keyword = 'หาแม่บ้านรายเดือน'
  WHERE keyword = 'หาแม่บ้านรายเดือนหา'
    AND NOT EXISTS (
      SELECT 1 FROM keywords WHERE keyword = 'หาแม่บ้านรายเดือน'
    )
`).run()

db.prepare(`
  UPDATE rank_history
  SET keyword = 'หาแม่บ้านรายเดือน'
  WHERE keyword = 'หาแม่บ้านรายเดือนหา'
`).run()

db.prepare(`
  DELETE FROM site_keywords
  WHERE keyword_id IN (
    SELECT id FROM keywords WHERE keyword = 'หาแม่บ้านรายเดือนหา'
  )
`).run()

db.prepare(`
  DELETE FROM keywords
  WHERE keyword = 'หาแม่บ้านรายเดือนหา'
`).run()

const count = db.prepare("SELECT COUNT(*) as n FROM keywords").get() as { n: number }
if (count.n === 0) {
  const insert = db.prepare("INSERT INTO keywords (keyword, sort_order) VALUES (?, ?)")
  TRACKER_KEYWORDS.forEach((kw, i) => insert.run(kw, i))
}
