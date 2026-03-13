"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV = [
  { href: "/", label: "หน้าแรก" },
  { href: "/article-titles", label: "หัวข้อบทความ" },
  { href: "/duplicates", label: "รายงานซ้ำ" },
  { href: "/ranking", label: "Ranking" },
]

export function AppHeader() {
  const path = usePathname()
  return (
    <header className="sticky top-0 z-10 border-b border-amber-500/15 bg-black/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-amber-100"
        >
          <span className="text-lg tracking-wide text-amber-300">SEO</span>
          <span className="hidden text-zinc-400 sm:inline">System</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1">
          {NAV.map(({ href, label }) => {
            const active = path === href || (href !== "/" && path.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-amber-400/15 text-amber-200 shadow-[0_0_0_1px_rgba(251,191,36,0.16)]"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-amber-100"
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
