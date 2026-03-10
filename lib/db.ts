import Database from "better-sqlite3";

export const db = new Database("seo.db");

db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  content TEXT,
  url TEXT,
  keyword TEXT,
  source TEXT,
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
`);

const siteSlugs = [
  "maidwonderland",
  "maidsiam",
  "nasaladphrao48",
  "ddmaid",
  "ddmaidservice",
  "suksawatmaid"
];
const siteCount = db.prepare("SELECT COUNT(*) as n FROM sites").get() as { n: number };
if (siteCount.n === 0) {
  const insertSite = db.prepare("INSERT INTO sites (slug, name, sort_order) VALUES (?, ?, ?)");
  siteSlugs.forEach((slug, i) => insertSite.run(slug, slug, i));
}

// Seed 19 keywords ครั้งแรก (รายการตามสเปก — keyword 「หาแรงงานต่างด้าว」เป้าหมายคือไม่ให้เจอเว็บเรา)
const TRACKER_KEYWORDS = [
  "หาแม่บ้าน",
  "บริการหาแม่บ้าน",
  "แม่บ้าน",
  "แม่บ้านรายเดือน",
  "หาแม่บ้านรายเดือนหา",
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
];
const count = db.prepare("SELECT COUNT(*) as n FROM keywords").get() as { n: number };
if (count.n === 0) {
  const insert = db.prepare("INSERT INTO keywords (keyword, sort_order) VALUES (?, ?)");
  TRACKER_KEYWORDS.forEach((kw, i) => insert.run(kw, i));
}

// ข้อมูลตัวอย่าง rank_history (เมื่อมี Keyword Rank Tracker จริงจะถูกเขียนจากระบบ)
const rankCount = db.prepare("SELECT COUNT(*) as n FROM rank_history").get() as { n: number };
if (rankCount.n === 0) {
  const insertRank = db.prepare(
    "INSERT OR IGNORE INTO rank_history (recorded_date, site_slug, keyword, rank, url) VALUES (?, ?, ?, ?, ?)"
  );
  const lastWeek = "2026-02-28";
  const thisWeek = "2026-03-07";
  insertRank.run(lastWeek, "maidsiam", "แม่บ้านรายวัน", 5, "/maid-daily");
  insertRank.run(thisWeek, "maidsiam", "แม่บ้านรายวัน", 25, "/maid-daily");
  insertRank.run(lastWeek, "ddmaid", "แม่บ้านรายเดือน", 8, "/maid-monthly");
  insertRank.run(thisWeek, "ddmaid", "แม่บ้านรายเดือน", 28, "/maid-monthly");
}