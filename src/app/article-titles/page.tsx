"use client"

import { useState } from "react"
import { PageLayout } from "../../components/PageLayout"
import { Card, CardBody, CardHeader } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Search, AlertTriangle, CheckCircle, RefreshCw, ExternalLink } from "lucide-react"
import { getSiteColor } from "@/lib/siteColors"

type TitleMatch = {
  title: string
  source: string
  siteLabel: string
  similarityPercent: number
  url?: string | null
}

/**
 * ตามที่กำหนด: 60–69% เขียว, 70–84% เหลือง, 85–100% แดง
 * ใช้สีตรง ๆ + พื้นจาง/ขอบ เพื่อไม่ให้กลืนกับธีมมืด (amber ของ Tailwind จะออกโทนส้ม)
 */
function similarityPercentClass(percent: number): string {
  if (percent >= 85) {
    return "inline-block rounded px-1.5 py-0.5 font-semibold text-[#fecaca] bg-red-950/55 ring-1 ring-red-500/55"
  }
  if (percent >= 70) {
    return "inline-block rounded px-1.5 py-0.5 font-semibold text-[#fef08a] bg-yellow-950/50 ring-1 ring-yellow-400/50"
  }
  return "inline-block rounded px-1.5 py-0.5 font-semibold text-[#86efac] bg-green-950/50 ring-1 ring-green-500/50"
}

export default function ArticleTitlesPage() {
  const [inputTitle, setInputTitle] = useState("")
  const [loading, setLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasSimilar, setHasSimilar] = useState<boolean | null>(null)
  const [matches, setMatches] = useState<TitleMatch[]>([])

  const handleSearch = async () => {
    const title = inputTitle.trim()
    if (!title) {
      setError("กรุณากรอกหัวข้อบทความ")
      return
    }

    setLoading(true)
    setError(null)
    setHasSimilar(null)
    setMatches([])

    try {
      const res = await fetch(`/api/title-check?title=${encodeURIComponent(title)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "ตรวจสอบไม่สำเร็จ")
      setHasSimilar(data.hasSimilar ?? false)
      setMatches(data.matches ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด")
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch()
  }

  const busy = loading || syncLoading

  const handleSyncPosts = async () => {
    setSyncLoading(true)
    setSyncMessage(null)
    setError(null)
    try {
      const res = await fetch("/api/posts/sync", { method: "POST" })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "ซิงค์ไม่สำเร็จ")
      setSyncMessage({
        kind: "ok",
        text: "ดึงโพสต์จาก 6 เว็บแล้ว — ลองกดค้นหาอีกครั้งเพื่อเทียบหัวข้อล่าสุด"
      })
    } catch (e) {
      setSyncMessage({
        kind: "err",
        text: e instanceof Error ? e.message : "เกิดข้อผิดพลาด"
      })
    } finally {
      setSyncLoading(false)
    }
  }

  return (
    <PageLayout
      title="เช็คหัวข้อบทความ"
      description="เทียบกับหัวข้อใน 6 เว็บ — แบ่งคำไทยอัตโนมัติ + ช่วงข้อความซ้ำยาว + ความหมายใกล้เคียง เกณฑ์คล้าย 60%"
      maxWidth="lg"
      titleAlign="center"
    >
      <Card className="border-amber-500/20 bg-gradient-to-br from-[#1c1710] to-[#0c0c0c]">
        <CardHeader
          title="ตรวจสอบชื่อหัวข้อบทความว่ามีซ้ำกับที่มีในระบบหรือไม่"
          subtitle="เปรียบเทียบความคล้ายคลึงกับหัวข้อที่มีใน 6 เว็บ (แม่บ้านดีดี, แม่บ้านดีดีเซอร์วิส, แม่บ้านอินเตอร์, นาซ่าลาดพร้าว, แม่บ้านสยาม, แม่บ้านสุขสวัสดิ์)"
          align="center"
        />
        <CardBody>
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-700/60 bg-zinc-950/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-400">
              พึ่งลงบทความใหม่? ดึงหัวข้อล่าสุดจาก WordPress เข้าระบบก่อนเช็ค
            </p>
            <Button
              variant="secondary"
              onClick={handleSyncPosts}
              loading={syncLoading}
              disabled={busy && !syncLoading}
              className="shrink-0 gap-2 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              ดึงโพสต์ล่าสุด
            </Button>
          </div>
          {syncMessage && (
            <p
              className={`mb-4 rounded-lg px-4 py-2 text-sm ${
                syncMessage.kind === "ok"
                  ? "bg-emerald-900/25 text-emerald-200"
                  : "bg-red-900/20 text-red-300"
              }`}
            >
              {syncMessage.text}
            </p>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <input
              type="text"
              value={inputTitle}
              onChange={(e) => setInputTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="กรอกหัวข้อบทความที่คิดขึ้นมา..."
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
              disabled={busy}
            />
            <Button
              onClick={handleSearch}
              loading={loading}
              disabled={busy && !loading}
              className="shrink-0 gap-2 cursor-pointer"
            >
              <Search className="h-4 w-4" />
              ค้นหา
            </Button>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-900/20 px-4 py-2 text-sm text-red-300">{error}</p>
          )}

          {!loading && hasSimilar !== null && (
            <div className="mt-6">
              {hasSimilar ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-center gap-2 text-amber-200">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span className="font-semibold">มีหัวข้อบทความนี้แล้ว</span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-300">
                    หัวข้อที่คุณกรอกคล้ายกับที่มีในระบบเกิน 60% — พิจารณาใช้หัวข้ออื่นเพื่อป้องกันการซ้ำ
                  </p>
                  <ul className="mt-4 space-y-2">
                    {matches.map((m, i) => (
                      <li
                        key={`${m.title}-${m.source}-${i}`}
                        className="rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-4 py-3"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-zinc-100">{m.title}</p>
                            <p className="mt-1 text-xs text-zinc-500">
                              <span className="font-medium" style={{ color: getSiteColor(m.source) }}>
                                {m.siteLabel}
                              </span>
                              <span> · ความคล้าย </span>
                              <span className={similarityPercentClass(m.similarityPercent)}>
                                {m.similarityPercent}%
                              </span>
                            </p>
                          </div>
                          {m.url ? (
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-amber-500/45 hover:bg-zinc-900 hover:text-amber-100"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              ดู
                            </a>
                          ) : (
                            <span className="shrink-0 text-xs text-zinc-600">ไม่มีลิงก์ในระบบ</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <p className="font-medium text-emerald-200">ยังไม่มีหัวข้อคล้ายในระบบ</p>
                    <p className="text-sm text-zinc-400">หัวข้อนี้ไม่คล้ายกับที่มีใน 6 เว็บเกิน 60% — สามารถใช้ได้</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </PageLayout>
  )
}
