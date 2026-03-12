/**
 * ย้ายข้อมูลจาก PostgreSQL ปัจจุบัน (DATABASE_URL) ไป Neon (MIGRATE_TARGET_DATABASE_URL)
 * รัน: npm run migrate-to-neon
 * ต้องตั้ง DATABASE_URL และ MIGRATE_TARGET_DATABASE_URL ใน .env
 */
import "dotenv/config"
import pg from "pg"

const { Pool } = pg

const SOURCE_URL = process.env.DATABASE_URL
const TARGET_URL = process.env.MIGRATE_TARGET_DATABASE_URL

if (!SOURCE_URL?.startsWith("postgresql")) {
  console.error("กรุณาตั้ง DATABASE_URL ใน .env ชี้ไปยัง PostgreSQL ต้นทาง")
  process.exit(1)
}
if (!TARGET_URL?.startsWith("postgresql")) {
  console.error("กรุณาตั้ง MIGRATE_TARGET_DATABASE_URL ใน .env ชี้ไปยัง Neon (ปลายทาง)")
  process.exit(1)
}

const sourcePool = new Pool({ connectionString: SOURCE_URL })
const targetPool = new Pool({ connectionString: TARGET_URL })

async function ensureTargetTables(client: pg.PoolClient) {
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
  const targetClient = await targetPool.connect()
  try {
    console.log("สร้างตารางบน Neon (ถ้ายังไม่มี)...")
    await ensureTargetTables(targetClient)

    const tables = [
      {
        name: "sites",
        cols: ["id", "slug", "name", "sort_order"],
        seq: "sites",
      },
      {
        name: "keywords",
        cols: ["id", "keyword", "sort_order"],
        seq: "keywords",
      },
      {
        name: "site_keywords",
        cols: ["site_id", "keyword_id"],
        seq: null,
      },
      {
        name: "posts",
        cols: ["id", "wp_post_id", "title", "content", "url", "keyword", "source", "published_at", "synced_at", "created_at"],
        seq: "posts",
      },
      {
        name: "rank_history",
        cols: ["id", "recorded_date", "site_slug", "keyword", "rank", "url", "created_at"],
        seq: "rank_history",
      },
      {
        name: "app_locks",
        cols: ["lock_key", "locked_at"],
        seq: null,
      },
    ] as const

    for (const t of tables) {
      console.log(`ย้าย ${t.name}...`)
      const res = await sourcePool.query(`SELECT ${t.cols.join(", ")} FROM ${t.name}`)
      const rows = res.rows
      const placeholders = t.cols.map((_, i) => `$${i + 1}`).join(", ")
      const conflict = t.name === "sites" ? "ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order"
        : t.name === "keywords" ? "ON CONFLICT (keyword) DO UPDATE SET sort_order = EXCLUDED.sort_order"
        : t.name === "site_keywords" ? "ON CONFLICT (site_id, keyword_id) DO NOTHING"
        : t.name === "posts" ? `ON CONFLICT (title, source) DO UPDATE SET wp_post_id = COALESCE(posts.wp_post_id, EXCLUDED.wp_post_id), content = EXCLUDED.content, url = EXCLUDED.url, published_at = EXCLUDED.published_at, synced_at = EXCLUDED.synced_at`
        : t.name === "rank_history" ? "ON CONFLICT (recorded_date, site_slug, keyword) DO UPDATE SET rank = EXCLUDED.rank, url = EXCLUDED.url"
        : "ON CONFLICT (lock_key) DO UPDATE SET locked_at = EXCLUDED.locked_at"

      for (const row of rows) {
        const vals = t.cols.map((c) => (row as Record<string, unknown>)[c])
        await targetClient.query(
          `INSERT INTO ${t.name} (${t.cols.join(", ")}) VALUES (${placeholders}) ${conflict}`,
          vals
        )
      }
      if (t.seq && rows.length > 0) {
        await targetClient.query(
          `SELECT setval(pg_get_serial_sequence('${t.name}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${t.name}))`
        )
      }
      console.log(`  → ${rows.length} แถว`)
    }

    console.log("\n✓ ย้ายข้อมูลจาก PostgreSQL ไป Neon เสร็จแล้ว")
    console.log("  แก้ .env: เปลี่ยน DATABASE_URL เป็น MIGRATE_TARGET_DATABASE_URL แล้วลบ MIGRATE_TARGET_DATABASE_URL")
  } finally {
    targetClient.release()
    await sourcePool.end()
    await targetPool.end()
  }
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
