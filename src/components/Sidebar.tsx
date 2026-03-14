"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, FileText, Copy, Table2, Trash2, Users } from "lucide-react"

const NAV_ITEMS = [
  { href: "/ranking/graph", label: "แดชบอร์ด", icon: LayoutDashboard },
  { href: "/ranking", label: "ตาราง Ranking", icon: Table2 },
  { href: "/visitors", label: "จำนวนคนเข้าชม", icon: Users },
  { href: "/article-titles", label: "หัวข้อบทความ", icon: FileText },
  { href: "/duplicates", label: "รายงานซ้ำ", icon: Copy },
  { href: "/ranking/manage", label: "จัดการข้อมูล Ranking", icon: Trash2 },
]

export function Sidebar() {
  const path = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-zinc-800/80 bg-zinc-950/95 shadow-[4px_0_24px_rgba(0,0,0,0.4)] backdrop-blur-xl">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-800/80 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg shadow-amber-500/25">
          <span className="text-sm font-bold">S</span>
        </div>
        <span className="font-semibold tracking-tight text-amber-100">SEO System</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            path === href ||
            (href === "/ranking" ? path === "/ranking" : href !== "/ranking/graph" && path.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-amber-500/15 text-amber-200 shadow-[0_0_0_1px_rgba(251,191,36,0.2)]"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${isActive ? "text-amber-400" : "text-zinc-500"}`}
                strokeWidth={2}
              />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="shrink-0 border-t border-zinc-800/80 px-4 py-3">
        <p className="text-xs text-zinc-500">6 เว็บ · 19 keyword</p>
      </div>
    </aside>
  )
}
