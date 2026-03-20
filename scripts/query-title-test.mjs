import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// ใช้ sqlite3 ผ่าน child_process ถ้าไม่มี better-sqlite3 ที่รันได้
import { spawnSync } from "node:child_process"

const dbPath = join(__dirname, "..", "seo.db")
const needle = process.argv[2] || "สูงอายุ"
const qCount = "SELECT COUNT(*) FROM posts;"
const qNeedle = `SELECT title, source FROM posts WHERE title LIKE '%${needle}%' LIMIT 25;`
for (const q of [qCount, qNeedle]) {
  const r = spawnSync("sqlite3", [dbPath, q], { encoding: "utf8" })
  console.log("query:", q.slice(0, 60), "...")
  console.log("exit", r.status, "out len", (r.stdout || "").length)
  console.log(r.stdout || r.stderr || "(empty)")
}
