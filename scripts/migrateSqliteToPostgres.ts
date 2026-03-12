/**
 * ย้ายข้อมูลจาก SQLite (seo.db) ไป PostgreSQL
 * รัน: npm run migrate-sqlite-to-pg
 * ต้องตั้ง DATABASE_URL ใน .env ก่อน
 */
import "dotenv/config"
import Database from "better-sqlite3"
import pg from "pg"

const { Pool } = pg

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL?.startsWith("postgresql")) {
  console.error("กรุณาตั้ง DATABASE_URL ใน .env ชี้ไปยัง PostgreSQL ก่อน")
  process.exit(1)
}

const sqlite = new Database("seo.db")
const pgPool = new Pool({ connectionString: DATABASE_URL })

async function ensurePgTables(client: pg.PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS sites (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS keywords (
      id SERIAL PRIMARY KEY,
      keyword TEXT UNIQUE NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS site_keywords (
      site_id INTEGER NOT NULL,
      keyword_id INTEGER NOT NULL,
      PRIMARY KEY (site_id, keyword_id),
      FOREIGN KEY (site_id) REFERENCES sites(id),
      FOREIGN KEY (keyword_id) REFERENCES keywords(id)
    );
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      wp_post_id INTEGER,
      title TEXT,
      content TEXT,
      url TEXT,
      keyword TEXT,
      source TEXT,
      published_at TIMESTAMP,
      synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(title, source)
    );
    CREATE TABLE IF NOT EXISTS rank_history (
      id SERIAL PRIMARY KEY,
      recorded_date TEXT NOT NULL,
      site_slug TEXT NOT NULL,
      keyword TEXT NOT NULL,
      rank INTEGER NOT NULL,
      url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(recorded_date, site_slug, keyword)
    );
    CREATE TABLE IF NOT EXISTS app_locks (
      lock_key TEXT PRIMARY KEY,
      locked_at TEXT NOT NULL
    );
  `)
}

async function migrate() {
  const client = await pgPool.connect()
  try {
    console.log("สร้างตาราง PostgreSQL (ถ้ายังไม่มี)...")
    await ensurePgTables(client)

    console.log("ย้าย sites...")
    const sites = sqlite.prepare("SELECT id, slug, name, sort_order FROM sites").all() as {
      id: number
      slug: string
      name: string
      sort_order: number
    }[]
    for (const row of sites) {
      await client.query(
        `INSERT INTO sites (id, slug, name, sort_order) VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order`,
        [row.id, row.slug, row.name, row.sort_order]
      )
    }
    await client.query("SELECT setval(pg_get_serial_sequence('sites', 'id'), (SELECT COALESCE(MAX(id), 1) FROM sites))")

    console.log("ย้าย keywords...")
    const keywords = sqlite.prepare("SELECT id, keyword, sort_order FROM keywords").all() as {
      id: number
      keyword: string
      sort_order: number
    }[]
    for (const row of keywords) {
      await client.query(
        `INSERT INTO keywords (id, keyword, sort_order) VALUES ($1, $2, $3)
         ON CONFLICT (keyword) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
        [row.id, row.keyword, row.sort_order]
      )
    }
    await client.query("SELECT setval(pg_get_serial_sequence('keywords', 'id'), (SELECT COALESCE(MAX(id), 1) FROM keywords))")

    console.log("ย้าย site_keywords...")
    const siteKeywords = sqlite.prepare("SELECT site_id, keyword_id FROM site_keywords").all() as {
      site_id: number
      keyword_id: number
    }[]
    for (const row of siteKeywords) {
      await client.query(
        `INSERT INTO site_keywords (site_id, keyword_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [row.site_id, row.keyword_id]
      )
    }

    console.log("ย้าย posts...")
    const posts = sqlite.prepare(
      "SELECT id, wp_post_id, title, content, url, keyword, source, published_at, synced_at, created_at FROM posts"
    ).all() as {
      id: number
      wp_post_id: number | null
      title: string
      content: string | null
      url: string | null
      keyword: string | null
      source: string
      published_at: string | null
      synced_at: string | null
      created_at: string | null
    }[]
    for (const row of posts) {
      await client.query(
        `INSERT INTO posts (id, wp_post_id, title, content, url, keyword, source, published_at, synced_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (title, source) DO UPDATE SET
           wp_post_id = COALESCE(posts.wp_post_id, EXCLUDED.wp_post_id),
           content = EXCLUDED.content, url = EXCLUDED.url,
           published_at = EXCLUDED.published_at, synced_at = EXCLUDED.synced_at`,
        [
          row.id,
          row.wp_post_id,
          row.title,
          row.content,
          row.url,
          row.keyword,
          row.source,
          row.published_at,
          row.synced_at,
          row.created_at
        ]
      )
    }
    await client.query("SELECT setval(pg_get_serial_sequence('posts', 'id'), (SELECT COALESCE(MAX(id), 1) FROM posts))")

    console.log("ย้าย rank_history...")
    const rankHistory = sqlite.prepare(
      "SELECT id, recorded_date, site_slug, keyword, rank, url, created_at FROM rank_history"
    ).all() as {
      id: number
      recorded_date: string
      site_slug: string
      keyword: string
      rank: number
      url: string | null
      created_at: string | null
    }[]
    for (const row of rankHistory) {
      await client.query(
        `INSERT INTO rank_history (id, recorded_date, site_slug, keyword, rank, url, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (recorded_date, site_slug, keyword) DO UPDATE SET rank = EXCLUDED.rank, url = EXCLUDED.url`,
        [row.id, row.recorded_date, row.site_slug, row.keyword, row.rank, row.url, row.created_at]
      )
    }
    await client.query(
      "SELECT setval(pg_get_serial_sequence('rank_history', 'id'), (SELECT COALESCE(MAX(id), 1) FROM rank_history))"
    )

    console.log("ย้าย app_locks...")
    const appLocks = sqlite.prepare("SELECT lock_key, locked_at FROM app_locks").all() as {
      lock_key: string
      locked_at: string
    }[]
    for (const row of appLocks) {
      await client.query(
        `INSERT INTO app_locks (lock_key, locked_at) VALUES ($1, $2) ON CONFLICT (lock_key) DO UPDATE SET locked_at = EXCLUDED.locked_at`,
        [row.lock_key, row.locked_at]
      )
    }

    console.log("\n✓ ย้ายข้อมูลจาก SQLite ไป PostgreSQL เสร็จแล้ว")
    console.log(`  - sites: ${sites.length}`)
    console.log(`  - keywords: ${keywords.length}`)
    console.log(`  - site_keywords: ${siteKeywords.length}`)
    console.log(`  - posts: ${posts.length}`)
    console.log(`  - rank_history: ${rankHistory.length}`)
    console.log(`  - app_locks: ${appLocks.length}`)
  } finally {
    client.release()
    sqlite.close()
    await pgPool.end()
  }
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
