import "dotenv/config"
import Database from "better-sqlite3"
import pg from "pg"

const { Pool } = pg
const DATABASE_URL = process.env.DATABASE_URL
export const isPostgres = !!DATABASE_URL

function toPgParams(sql: string): string {
  let i = 0
  return sql.replace(/\?/g, () => `$${++i}`)
}

/** SQL สำหรับเงื่อนไข date filter (sinceDays) — ใช้ใน duplicate, keyword */
export function getDateFilterFragment(sinceDays: number): string {
  if (isPostgres) {
    return `(COALESCE(published_at::timestamp, created_at::timestamp))::date >= CURRENT_DATE - INTERVAL '${sinceDays} days'`
  }
  return `date(COALESCE(published_at, created_at)) >= date('now', '-${sinceDays} days')`
}

type QueryResult = { changes: number }
type DbLike = {
  exec(sql: string): Promise<void>
  prepare(sql: string): {
    run: (...args: unknown[]) => Promise<QueryResult>
    get: (...args: unknown[]) => Promise<unknown>
    all: (...args: unknown[]) => Promise<unknown[]>
  }
  transaction<T>(fn: (tx: DbLike["prepare"]) => (arg: T) => void | Promise<void>): (arg: T) => Promise<void>
}

let pgPool: InstanceType<typeof Pool> | null = null
let pgSchemaPromise: Promise<void> | null = null

async function ensurePgSchema(): Promise<void> {
  if (!DATABASE_URL) return
  if (pgSchemaPromise) return pgSchemaPromise
  pgSchemaPromise = _ensurePgSchema()
  return pgSchemaPromise
}

async function _ensurePgSchema(): Promise<void> {
  if (!DATABASE_URL) return
  const pool = new Pool({ connectionString: DATABASE_URL })
  pgPool = pool

  const client = await pool.connect()
  try {
    await client.query(`
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

CREATE TABLE IF NOT EXISTS keywords (
  id SERIAL PRIMARY KEY,
  keyword TEXT UNIQUE NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sites (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS site_visitor_stats (
  id SERIAL PRIMARY KEY,
  recorded_date TEXT NOT NULL,
  site_slug TEXT NOT NULL,
  total_visitors INTEGER,
  morning_round INTEGER,
  evening_round INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(recorded_date, site_slug)
);

CREATE TABLE IF NOT EXISTS website_status (
  site_slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  load_time_ms INTEGER,
  load_status TEXT NOT NULL,
  line_ok INTEGER NOT NULL,
  phone_ok INTEGER NOT NULL,
  line_reason TEXT,
  phone_reason TEXT,
  error TEXT,
  checked_at TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_source_wp_post_id
ON posts(source, wp_post_id)
WHERE wp_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rank_history_keyword_recorded_date
ON rank_history(keyword, recorded_date);
`)
    const hasWpPostId = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'posts' AND column_name = 'wp_post_id'
    `)
    if (hasWpPostId.rows.length === 0) {
      await client.query("ALTER TABLE posts ADD COLUMN wp_post_id INTEGER")
    }
    const hasPublishedAt = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'posts' AND column_name = 'published_at'
    `)
    if (hasPublishedAt.rows.length === 0) {
      await client.query("ALTER TABLE posts ADD COLUMN published_at TIMESTAMP")
    }
    const hasSyncedAt = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'posts' AND column_name = 'synced_at'
    `)
    if (hasSyncedAt.rows.length === 0) {
      await client.query("ALTER TABLE posts ADD COLUMN synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    }
    const hasFullLoadTime = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'website_status' AND column_name = 'full_load_time_ms'
    `)
    if (hasFullLoadTime.rows.length === 0) {
      await client.query("ALTER TABLE website_status ADD COLUMN full_load_time_ms INTEGER")
    }
    const hasFullLoadStatus = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'website_status' AND column_name = 'full_load_status'
    `)
    if (hasFullLoadStatus.rows.length === 0) {
      await client.query("ALTER TABLE website_status ADD COLUMN full_load_status TEXT")
    }
  } finally {
    client.release()
  }

  const SITE_RECORDS = [
    { slug: "maidwonderland", name: "แม่บ้านดีดี" },
    { slug: "maidsiam", name: "แม่บ้านสยาม" },
    { slug: "nasaladphrao48", name: "นาซ่าลาดพร้าว" },
    { slug: "ddmaid", name: "แม่บ้านอินเตอร์" },
    { slug: "ddmaidservice", name: "แม่บ้านดีดีเซอร์วิส" },
    { slug: "suksawatmaid", name: "แม่บ้านสุขสวัสดิ์" }
  ]
  for (const site of SITE_RECORDS) {
    await pool.query(
      "INSERT INTO sites (slug, name, sort_order) VALUES ($1, $2, $3) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order",
      [site.slug, site.name, SITE_RECORDS.indexOf(site)]
    )
  }
  for (const site of SITE_RECORDS) {
    await pool.query(`
      UPDATE posts SET source = $1 WHERE source = $2
      AND NOT EXISTS (SELECT 1 FROM posts p2 WHERE p2.title = posts.title AND p2.source = $3)
    `, [site.slug, site.name, site.slug])
  }
  const TRACKER_KEYWORDS = [
    "หาแม่บ้าน", "บริการหาแม่บ้าน", "แม่บ้าน", "แม่บ้านรายเดือน", "หาแม่บ้านรายเดือน",
    "หาแม่บ้านอยู่ประจำ", "หาพี่เลี้ยงเด็ก", "หาคนดูแลผู้สูงอายุ", "จัดหาแม่บ้าน", "จัดส่งแม่บ้าน",
    "ศูนย์จัดหาแม่บ้าน", "รับจัดหาแม่บ้าน", "หาแม่บ้านคนลาว", "จัดหาแม่บ้านคนลาว",
    "หาแม่บ้านคนไทย", "หาแม่บ้านต่างด้าว", "จ้างแม่บ้าน", "หาแรงงานต่างด้าว", "แม่บ้านมืออาชีพ"
  ]
  await pool.query(`
    UPDATE keywords SET keyword = 'หาแม่บ้านรายเดือน' WHERE keyword = 'หาแม่บ้านรายเดือนหา'
    AND NOT EXISTS (SELECT 1 FROM keywords WHERE keyword = 'หาแม่บ้านรายเดือน')
  `)
  await pool.query(`UPDATE rank_history SET keyword = 'หาแม่บ้านรายเดือน' WHERE keyword = 'หาแม่บ้านรายเดือนหา'`)
  await pool.query(`
    DELETE FROM site_keywords WHERE keyword_id IN (SELECT id FROM keywords WHERE keyword = 'หาแม่บ้านรายเดือนหา')
  `)
  await pool.query(`DELETE FROM keywords WHERE keyword = 'หาแม่บ้านรายเดือนหา'`)
  const count = await pool.query("SELECT COUNT(*) as n FROM keywords")
  if (Number(count.rows[0]?.n ?? 0) === 0) {
    for (let i = 0; i < TRACKER_KEYWORDS.length; i++) {
      await pool.query("INSERT INTO keywords (keyword, sort_order) VALUES ($1, $2)", [TRACKER_KEYWORDS[i], i])
    }
  }
}

function createPgDb(): DbLike {
  return {
    async exec(sql: string): Promise<void> {
      await ensurePgSchema()
      if (pgPool) await pgPool.query(sql)
    },
    prepare(sql: string) {
      const pgSql = toPgParams(sql)
      return {
        async run(...args: unknown[]): Promise<QueryResult> {
          await ensurePgSchema()
          if (!pgPool) throw new Error("PostgreSQL pool not initialized")
          const r = await pgPool.query(pgSql, args)
          return { changes: r.rowCount ?? 0 }
        },
        async get(...args: unknown[]): Promise<unknown> {
          await ensurePgSchema()
          if (!pgPool) throw new Error("PostgreSQL pool not initialized")
          const r = await pgPool.query(pgSql, args)
          return r.rows[0]
        },
        async all(...args: unknown[]): Promise<unknown[]> {
          await ensurePgSchema()
          if (!pgPool) throw new Error("PostgreSQL pool not initialized")
          const r = await pgPool.query(pgSql, args)
          return r.rows
        }
      }
    },
    transaction<T>(fn: (tx: DbLike["prepare"]) => (arg: T) => void) {
      return async (arg: T) => {
        await ensurePgSchema()
        if (!pgPool) throw new Error("PostgreSQL pool not initialized")
        const client = await pgPool.connect()
        try {
          await client.query("BEGIN")
          const txPrepare = (sql: string) => {
            const pgSql = toPgParams(sql)
            return {
              async run(...args: unknown[]): Promise<QueryResult> {
                const r = await client.query(pgSql, args)
                return { changes: r.rowCount ?? 0 }
              },
              async get(...args: unknown[]): Promise<unknown> {
                const r = await client.query(pgSql, args)
                return r.rows[0]
              },
              async all(...args: unknown[]): Promise<unknown[]> {
                const r = await client.query(pgSql, args)
                return r.rows
              }
            }
          }
          const saveAll = fn(txPrepare)
          await Promise.resolve(saveAll(arg))
          await client.query("COMMIT")
        } catch (e) {
          await client.query("ROLLBACK")
          throw e
        } finally {
          client.release()
        }
      }
    }
  }
}

function createSqliteDb(): DbLike {
  const sqlite = new Database("seo.db")
  sqlite.pragma("foreign_keys = ON")

  sqlite.exec(`
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

CREATE TABLE IF NOT EXISTS site_visitor_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_date TEXT NOT NULL,
  site_slug TEXT NOT NULL,
  total_visitors INTEGER,
  morning_round INTEGER,
  evening_round INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(recorded_date, site_slug)
);

CREATE TABLE IF NOT EXISTS website_status (
  site_slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  load_time_ms INTEGER,
  load_status TEXT NOT NULL,
  line_ok INTEGER NOT NULL,
  phone_ok INTEGER NOT NULL,
  line_reason TEXT,
  phone_reason TEXT,
  error TEXT,
  checked_at TEXT NOT NULL
);
`)

  function ensureColumn(table: string, column: string, definition: string) {
    const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    if (!columns.some((item) => item.name === column)) {
      try {
        sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
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
  ensureColumn("website_status", "full_load_time_ms", "INTEGER")
  ensureColumn("website_status", "full_load_status", "TEXT")

  sqlite.exec(`
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

  const upsertSite = sqlite.prepare(`
    INSERT INTO sites (slug, name, sort_order)
    VALUES (?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET name = excluded.name, sort_order = excluded.sort_order
  `)
  SITE_RECORDS.forEach((site, index) => upsertSite.run(site.slug, site.name, index))

  const migratePostSource = sqlite.prepare(`
    UPDATE posts SET source = ? WHERE source = ?
    AND NOT EXISTS (SELECT 1 FROM posts p2 WHERE p2.title = posts.title AND p2.source = ?)
  `)
  for (const site of SITE_RECORDS) {
    migratePostSource.run(site.slug, site.name, site.slug)
  }

  const TRACKER_KEYWORDS = [
    "หาแม่บ้าน", "บริการหาแม่บ้าน", "แม่บ้าน", "แม่บ้านรายเดือน", "หาแม่บ้านรายเดือน",
    "หาแม่บ้านอยู่ประจำ", "หาพี่เลี้ยงเด็ก", "หาคนดูแลผู้สูงอายุ", "จัดหาแม่บ้าน", "จัดส่งแม่บ้าน",
    "ศูนย์จัดหาแม่บ้าน", "รับจัดหาแม่บ้าน", "หาแม่บ้านคนลาว", "จัดหาแม่บ้านคนลาว",
    "หาแม่บ้านคนไทย", "หาแม่บ้านต่างด้าว", "จ้างแม่บ้าน", "หาแรงงานต่างด้าว", "แม่บ้านมืออาชีพ"
  ]

  sqlite.prepare(`
    UPDATE keywords SET keyword = 'หาแม่บ้านรายเดือน' WHERE keyword = 'หาแม่บ้านรายเดือนหา'
    AND NOT EXISTS (SELECT 1 FROM keywords WHERE keyword = 'หาแม่บ้านรายเดือน')
  `).run()

  sqlite.prepare(`UPDATE rank_history SET keyword = 'หาแม่บ้านรายเดือน' WHERE keyword = 'หาแม่บ้านรายเดือนหา'`).run()

  sqlite.prepare(`
    DELETE FROM site_keywords WHERE keyword_id IN (SELECT id FROM keywords WHERE keyword = 'หาแม่บ้านรายเดือนหา')
  `).run()

  sqlite.prepare(`DELETE FROM keywords WHERE keyword = 'หาแม่บ้านรายเดือนหา'`).run()

  const count = sqlite.prepare("SELECT COUNT(*) as n FROM keywords").get() as { n: number }
  if (count.n === 0) {
    const insert = sqlite.prepare("INSERT INTO keywords (keyword, sort_order) VALUES (?, ?)")
    TRACKER_KEYWORDS.forEach((kw, i) => insert.run(kw, i))
  }

  return {
    async exec(sql: string): Promise<void> {
      sqlite.exec(sql)
    },
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql)
      return {
        async run(...args: unknown[]): Promise<QueryResult> {
          const r = stmt.run(...args) as { changes: number }
          return { changes: r.changes }
        },
        async get(...args: unknown[]): Promise<unknown> {
          return stmt.get(...args)
        },
        async all(...args: unknown[]): Promise<unknown[]> {
          return stmt.all(...args) as unknown[]
        }
      }
    },
    transaction<T>(fn: (tx: DbLike["prepare"]) => (arg: T) => void) {
      const saveAll = fn(
        (sql: string) => {
          const stmt = sqlite.prepare(sql)
          return {
            async run(...args: unknown[]): Promise<QueryResult> {
              const r = stmt.run(...args) as { changes: number }
              return { changes: r.changes }
            },
            async get(...args: unknown[]): Promise<unknown> {
              return stmt.get(...args)
            },
            async all(...args: unknown[]): Promise<unknown[]> {
              return stmt.all(...args) as unknown[]
            }
          }
        }
      )
      return async (arg: T) => {
        const trans = sqlite.transaction(() => {
          const innerPrepare = (s: string) => sqlite.prepare(s)
          const tx = {
            prepare(s: string) {
              const st = sqlite.prepare(s)
              return {
                run: (...a: unknown[]) => Promise.resolve({ changes: (st.run(...a) as { changes: number }).changes }),
                get: (...a: unknown[]) => Promise.resolve(st.get(...a)),
                all: (...a: unknown[]) => Promise.resolve(st.all(...a) as unknown[])
              }
            }
          }
          const innerSave = fn(tx.prepare.bind(tx))
          innerSave(arg)
        })
        trans()
      }
    }
  }
}

const _db: DbLike = isPostgres ? createPgDb() : createSqliteDb()

export const db = {
  exec: (sql: string) => _db.exec(sql),
  prepare: (sql: string) => _db.prepare(sql),
  transaction: <T>(fn: (tx: DbLike["prepare"]) => (arg: T) => void) => _db.transaction(fn)
}
