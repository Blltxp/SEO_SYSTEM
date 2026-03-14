"use client"

import { useState } from "react"
import { PageLayout } from "../../components/PageLayout"
import { Card, CardBody, CardHeader } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Search, AlertTriangle, CheckCircle } from "lucide-react"

type TitleMatch = {
  title: string
  source: string
  siteLabel: string
  similarityPercent: number
}

export default function ArticleTitlesPage() {
  const [inputTitle, setInputTitle] = useState("")
  const [loading, setLoading] = useState(false)
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

  return (
    <PageLayout
      title="เช็คหัวข้อบทความ"
      description="กรอกหัวข้อที่คิดไว้ แล้วกดค้นหาเพื่อเทียบกับที่มีใน 6 เว็บ — ถ้าคล้ายเกิน 60% จะแจ้งว่ามีแล้ว"
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <input
              type="text"
              value={inputTitle}
              onChange={(e) => setInputTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="กรอกหัวข้อบทความที่คิดขึ้นมา..."
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
              disabled={loading}
            />
            <Button
              onClick={handleSearch}
              loading={loading}
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
                        <p className="font-medium text-zinc-100">{m.title}</p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {m.siteLabel} · ความคล้าย {m.similarityPercent}%
                        </p>
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
