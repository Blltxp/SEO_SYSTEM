"use client"

import { useEffect, useState } from "react"
import { PageLayout } from "../../components/PageLayout"
import { Card, CardBody, CardHeader } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import type { KeywordConflict } from "@/lib/keyword"

const DAY_OPTIONS = [
  { value: "", label: "ทั้งหมด" },
  { value: "7", label: "7 วันที่ผ่านมา" },
  { value: "14", label: "14 วันที่ผ่านมา (รอบนี้)" },
  { value: "30", label: "30 วันที่ผ่านมา" }
]

export default function CannibalPage() {
  const [data, setData] = useState<KeywordConflict[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState("14")

  useEffect(() => {
    setLoading(true)
    const url = days ? `/api/cannibalization?days=${days}` : "/api/cannibalization"
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ")
        return res.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [days])

  if (loading) {
    return (
      <PageLayout title="Keyword Cannibalization" description="คีย์เวิร์ดที่ซ้ำกันหลายแหล่ง">
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          กำลังโหลด…
        </div>
      </PageLayout>
    )
  }
  if (error) {
    return (
      <PageLayout title="Keyword Cannibalization">
        <p className="rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</p>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Keyword Cannibalization"
      description="คีย์เวิร์ดที่ซ้ำกันหลายแหล่ง (จาก 3 คำแรกของหัวข้อ) · เน้นดูรอบนี้ไม่ให้ซ้ำ"
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">แสดงเฉพาะบทความที่ลงภายใน:</span>
        <select
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {DAY_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader title="ความขัดแย้งของคีย์เวิร์ด" subtitle={data.length === 0 ? "ไม่พบรายการ" : `${data.length} รายการ`} />
        <CardBody>
          {data.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400">ไม่พบความขัดแย้งของคีย์เวิร์ด</p>
          ) : (
            <ul className="space-y-4">
              {data.map((item, i) => (
                <li key={`${item.keyword}-${i}`} className="flex flex-col gap-2 rounded-lg border border-zinc-100 p-4 dark:border-zinc-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.keyword}</span>
                    <Badge variant="warning">{item.count} แหล่ง</Badge>
                  </div>
                  <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-300">
                    {item.sources.map((src, j) => (
                      <li key={j}>{src}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </PageLayout>
  )
}
