"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { PageLayout } from "../../../components/PageLayout"
import { Card, CardBody } from "../../../components/ui/Card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"

const RANGE_OPTIONS = [
  { value: "24h", label: "24 ชม." },
  { value: "3d", label: "3 วัน" },
  { value: "7d", label: "1 อาทิตย์" },
  { value: "14d", label: "2 อาทิตย์" },
  { value: "21d", label: "3 อาทิตย์" },
  { value: "30d", label: "1 เดือน" },
  { value: "90d", label: "3 เดือน" },
  { value: "180d", label: "6 เดือน" },
  { value: "365d", label: "1 ปี" }
]

function getDateRange(range: string): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  const match = range.match(/^(\d+)([hdmy])$/)
  if (!match) return { from: "", to: "" }
  const n = parseInt(match[1], 10)
  const unit = match[2]
  if (unit === "h") from.setHours(from.getHours() - n)
  else if (unit === "d") from.setDate(from.getDate() - n)
  else if (unit === "m") from.setMonth(from.getMonth() - n)
  else if (unit === "y") from.setFullYear(from.getFullYear() - n)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10)
  }
}

const NOT_FOUND = 999
const SITE_COLORS = ["#16a34a", "#2563eb", "#dc2626", "#ca8a04", "#9333ea", "#0891b2"]

export default function RankingGraphPage() {
  const [keywords, setKeywords] = useState<string[]>([])
  const [keyword, setKeyword] = useState("")
  const [range, setRange] = useState("7d")
  const [data, setData] = useState<{ recorded_date: string; site_slug: string; rank: number }[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGraph = useCallback(async () => {
    if (!keyword) return
    const { from, to } = getDateRange(range)
    const res = await fetch(
      `/api/ranking/graph?keyword=${encodeURIComponent(keyword)}&fromDate=${from}&toDate=${to}`
    )
    if (!res.ok) return setData([])
    const rows = await res.json()
    setData(rows)
  }, [keyword, range])

  useEffect(() => {
    fetch("/api/keywords")
      .then((r) => (r.ok ? r.json() : []))
      .then((kws) => {
        setKeywords(kws)
        if (kws.length && !keyword) setKeyword(kws[0])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (keyword) {
      setLoading(true)
      fetchGraph().finally(() => setLoading(false))
    }
  }, [keyword, range, fetchGraph])

  const chartData = (() => {
    const byDate = new Map<string, Record<string, number | string>>()
    const sites = [...new Set(data.map((d) => d.site_slug))]
    for (const d of data) {
      const key = d.recorded_date.slice(0, 16).replace("T", " ")
      if (!byDate.has(key)) {
        const obj: Record<string, number | string> = { name: key }
        for (const s of sites) obj[s] = NOT_FOUND
        byDate.set(key, obj)
      }
      const obj = byDate.get(key)!
      obj[d.site_slug] = d.rank >= NOT_FOUND ? NOT_FOUND : d.rank
    }
    return Array.from(byDate.values()).sort(
      (a, b) => String(a.name).localeCompare(String(b.name))
    )
  })()

  const sites = [...new Set(data.map((d) => d.site_slug))]

  if (loading && !chartData.length) {
    return (
      <PageLayout title="กราฟเปรียบเทียบ 6 เว็บ" description="เลือก keyword และช่วงเวลาย้อนหลัง">
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          กำลังโหลด…
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="กราฟเปรียบเทียบ 6 เว็บ"
      description="เลือก keyword และช่วงเวลาย้อนหลัง (อันดับต่ำกว่า = ดีขึ้น)"
      maxWidth="xl"
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Keyword:</span>
          <select
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {keywords.map((kw) => (
              <option key={kw} value={kw}>{kw}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">ย้อนหลัง:</span>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <Link
          href="/ranking"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-400"
        >
          ← กลับตารางอันดับ
        </Link>
      </div>

      <Card>
        <CardBody>
        {chartData.length === 0 ? (
          <p className="py-12 text-center text-zinc-500 dark:text-zinc-400">ไม่มีข้อมูลในช่วงนี้</p>
        ) : (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis
                  reversed
                  domain={[1, NOT_FOUND]}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => (v >= NOT_FOUND ? "-" : String(v))}
                />
                <Tooltip
                  formatter={(v: number) => (v >= NOT_FOUND ? "-" : `#${v}`)}
                  labelFormatter={(l) => l}
                />
                <Legend />
                {sites.map((site, i) => (
                  <Line
                    key={site}
                    type="monotone"
                    dataKey={site}
                    stroke={SITE_COLORS[i % SITE_COLORS.length]}
                    dot={false}
                    connectNulls
                    name={site}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        </CardBody>
      </Card>
    </PageLayout>
  )
}
