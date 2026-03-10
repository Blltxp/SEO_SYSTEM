import Link from "next/link"

const LINKS = [
  { href: "/article-titles", label: "หัวข้อบทความแนะนำ", desc: "19 keyword · แนะนำเมื่อยังไม่อยู่หน้า 1" },
  { href: "/duplicates", label: "รายงานบทความซ้ำ", desc: "หัวข้อซ้ำ + เนื้อหาคล้าย · กรองช่วงเวลา" },
  { href: "/cannibalization", label: "Keyword Cannibalization", desc: "keyword ซ้ำหลายเว็บ" },
  { href: "/ranking", label: "Keyword Ranking Tracker", desc: "อันดับ Google 19 keyword × 6 เว็บ + กราฟ" },
]

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
            SEO System
          </h1>
          <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
            ระบบบทความ (Article Intelligence) + Keyword Ranking Tracker — ควบคุม 6 เว็บ, 19 keyword
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {LINKS.map(({ href, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
            >
              <span className="font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-100 dark:group-hover:text-zinc-200">
                {label}
              </span>
              <span className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{desc}</span>
            </Link>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="font-semibold text-amber-900 dark:text-amber-200">สคริปต์และ Cron</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-amber-800 dark:text-amber-300">
            <li><code className="rounded bg-amber-200/60 px-1.5 py-0.5 dark:bg-amber-900/50">npm run scan</code> — ดึงบทความจาก 6 เว็บ (WP API)</li>
            <li><code className="rounded bg-amber-200/60 px-1.5 py-0.5 dark:bg-amber-900/50">npm run detect</code> — ตรวจหัวข้อ/เนื้อหาคล้าย</li>
            <li><code className="rounded bg-amber-200/60 px-1.5 py-0.5 dark:bg-amber-900/50">npm run cannibal</code> — ตรวจ Keyword Cannibalization</li>
            <li><code className="rounded bg-amber-200/60 px-1.5 py-0.5 dark:bg-amber-900/50">npm run schedule</code> — cron: สแกนบทความ 10:00, เช็คอันดับทุกชั่วโมง</li>
            <li><code className="rounded bg-amber-200/60 px-1.5 py-0.5 dark:bg-amber-900/50">npm run check-ranking</code> — เช็คอันดับ 19 keyword × 6 เว็บ</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
