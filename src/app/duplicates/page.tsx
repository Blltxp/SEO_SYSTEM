"use client"

import { useEffect, useState } from "react"
import { PageLayout } from "../../components/PageLayout"
import { Card, CardBody, CardHeader } from "../../components/ui/Card"
import type { DuplicateTitle, ContentDuplicate } from "@/lib/duplicate"
import { getSiteDisplayName, getSiteColor } from "@/lib/siteColors"

type DuplicatesData = {
  titleDuplicates: DuplicateTitle[]
  contentDuplicates: ContentDuplicate[]
}

const DAY_OPTIONS = [
  { value: "", label: "ทั้งหมด" },
  { value: "7", label: "7 วันที่ผ่านมา" },
  { value: "14", label: "14 วันที่ผ่านมา (รอบนี้)" },
  { value: "30", label: "30 วันที่ผ่านมา" }
]

export default function DuplicatesPage() {
  const [data, setData] = useState<DuplicatesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState("14")

  useEffect(() => {
    setLoading(true)
    const url = days ? `/api/duplicates?days=${days}` : "/api/duplicates"
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
      <PageLayout title="รายงานบทความซ้ำ" description="หัวข้อซ้ำ + เนื้อหาคล้าย">
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          กำลังโหลด…
        </div>
      </PageLayout>
    )
  }
  if (error) {
    return (
      <PageLayout title="รายงานบทความซ้ำ">
        <p className="rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</p>
      </PageLayout>
    )
  }
  if (!data) return null

  const { titleDuplicates, contentDuplicates } = data

  return (
    <PageLayout
      title="รายงานบทความซ้ำ"
      description="ในแต่ละรอบที่ลง: ไม่ให้ซ้ำกัน · ซ้ำกับบทความของอีก 5 เว็บที่ลงไปแล้ว 2–3 เดือนได้"
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader title="หัวข้อซ้ำ (Title Duplicates)" subtitle="ชื่อบทความเดียวกันมากกว่า 1 เว็บ" />
          <CardBody className="flex-1 min-h-0 overflow-auto">
            {titleDuplicates.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-400">ไม่พบหัวข้อซ้ำ</p>
            ) : (
              <ul className="space-y-4">
                {titleDuplicates.map((item, i) => (
                  <li key={`${item.title}-${i}`} className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-700">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
                    <p className="mt-1 text-sm text-zinc-500">จำนวน {item.count} เว็บ</p>
                    <ul className="mt-2 list-inside list-disc text-sm text-zinc-600 dark:text-zinc-300">
                      {item.sources.map((src, j) => (
                        <li key={j}>
                          <span
                            className="inline-block rounded px-1.5 py-0.5 font-medium"
                            style={{ backgroundColor: `${getSiteColor(src)}22`, color: getSiteColor(src) }}
                          >
                            {getSiteDisplayName(src)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="เนื้อหาคล้ายกัน (Content Similarity ≥ 80%)" subtitle="จากโพสต์ล่าสุด 500 รายการ" />
          <CardBody className="flex-1 min-h-0 overflow-auto">
            {contentDuplicates.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-400">ไม่พบคู่บทความที่เนื้อหาคล้ายกัน</p>
            ) : (
              <ul className="space-y-4">
                {contentDuplicates.map((item, i) => (
                  <li key={i} className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-700">
                    <p className="text-sm text-zinc-500">ความคล้าย {(item.score * 100).toFixed(0)}%</p>
                    <p className="mt-1 text-zinc-900 dark:text-zinc-100">
                      <span
                        className="inline-block rounded px-1.5 py-0.5 font-medium"
                        style={{ backgroundColor: `${getSiteColor(item.siteA)}22`, color: getSiteColor(item.siteA) }}
                      >
                        {getSiteDisplayName(item.siteA)}
                      </span>
                      : {item.titleA}
                    </p>
                    <p className="mt-1 text-zinc-900 dark:text-zinc-100">
                      <span
                        className="inline-block rounded px-1.5 py-0.5 font-medium"
                        style={{ backgroundColor: `${getSiteColor(item.siteB)}22`, color: getSiteColor(item.siteB) }}
                      >
                        {getSiteDisplayName(item.siteB)}
                      </span>
                      : {item.titleB}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </PageLayout>
  )
}
