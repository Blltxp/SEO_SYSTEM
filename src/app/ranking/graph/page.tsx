"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import html2canvas from "html2canvas-pro"
import JSZip from "jszip"
import { PageLayout } from "../../../components/PageLayout"
import { Card, CardBody, CardHeader } from "../../../components/ui/Card"
import { Button } from "../../../components/ui/Button"
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

type RankHistoryRow = { recorded_date: string; site_slug: string; rank: number }
type RankRow = { site_slug: string; keyword: string; rank: number; url: string | null }
type Site = { slug: string; name: string }
type LatestResponse = {
  recordedAt: string
  rows: RankRow[]
  previousRecordedAt?: string
  previousRows?: RankRow[]
  availableRecordedDates?: string[]
}

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

const NOT_FOUND = 999
const SITE_COLOR_MAP: Record<string, string> = {
  maidwonderland: "#f0f0f0", // แม่บ้านดีดี - ขาว
  maidsiam: "#ec4899", // แม่บ้านสยาม - ชมพู
  nasaladphrao48: "#22c55e", // นาซ่าลาดพร้าว - เขียว
  ddmaid: "#06b6d4", // แม่บ้านอินเตอร์ - ฟ้า
  ddmaidservice: "#2563eb", // แม่บ้านดีดีเซอร์วิส - น้ำเงิน
  suksawatmaid: "#a855f7" // แม่บ้านสุขสวัสดิ์ - ม่วง
}
const AVERAGE_LINE_COLOR = "#eab308" // เฉลี่ย - เหลือง

function getSiteColor(site: Site): string {
  return SITE_COLOR_MAP[site.slug] ?? "#94a3b8"
}

function getDateRange(range: string, endRecordedAt?: string): { from: string; to: string } {
  let to: Date
  if (endRecordedAt?.trim()) {
    const parsed = new Date(endRecordedAt.trim().replace(" ", "T"))
    to = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  } else {
    to = new Date()
  }
  const from = new Date(to.getTime())
  const match = range.match(/^(\d+)([hdmy])$/)
  if (!match) return { from: "", to: "" }
  const n = parseInt(match[1], 10)
  const unit = match[2]
  if (unit === "h") from.setHours(from.getHours() - n)
  else if (unit === "d") from.setDate(from.getDate() - n)
  else if (unit === "m") from.setMonth(from.getMonth() - n)
  else if (unit === "y") from.setFullYear(from.getFullYear() - n)

  const formatLocalDateTime = (value: Date) => {
    const pad = (num: number) => String(num).padStart(2, "0")
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  }

  return {
    from: formatLocalDateTime(from),
    to: formatLocalDateTime(to)
  }
}

function formatRecordedAt(value: string) {
  if (!value) return "-"
  const d = new Date(value.replace(" ", "T"))
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "full",
    timeStyle: "medium"
  }).format(d)
}

function getCellKey(keyword: string, siteSlug: string) {
  return `${keyword}\t${siteSlug}`
}

function getTrendMeta(currentRank: number, previousRank: number | null) {
  if (previousRank == null) {
    return { icon: "•", label: "ยังไม่มีข้อมูลเทียบ", className: "text-zinc-400", bucket: "neutral" as const }
  }
  if (currentRank >= NOT_FOUND && previousRank >= NOT_FOUND) {
    return { icon: "→", label: "ไม่พบทั้งสองรอบ", className: "text-zinc-400", bucket: "neutral" as const }
  }
  if (currentRank < NOT_FOUND && previousRank >= NOT_FOUND) {
    return { icon: "↑", label: "ดีขึ้นจากไม่พบ", className: "text-emerald-300", bucket: "up" as const }
  }
  if (currentRank >= NOT_FOUND && previousRank < NOT_FOUND) {
    return { icon: "↓", label: "หล่นจากเดิมที่เคยพบ", className: "text-red-300", bucket: "down" as const }
  }
  if (currentRank < previousRank) {
    return { icon: "↑", label: `ดีขึ้น ${previousRank - currentRank} อันดับ`, className: "text-emerald-300", bucket: "up" as const }
  }
  if (currentRank > previousRank) {
    return { icon: "↓", label: `แย่ลง ${currentRank - previousRank} อันดับ`, className: "text-red-300", bucket: "down" as const }
  }
  return { icon: "→", label: "คงเดิม", className: "text-zinc-400", bucket: "neutral" as const }
}

function getTrendCellClass(currentRank: number, previousRank: number | null) {
  const meta = getTrendMeta(currentRank, previousRank)
  if (currentRank >= NOT_FOUND) return "bg-zinc-900/60"
  if (meta.bucket === "up") return "bg-emerald-950/25"
  if (meta.bucket === "down") return "bg-rose-950/25"
  return "bg-zinc-900/50"
}

function formatRankText(rank: number) {
  return rank >= NOT_FOUND ? "-" : `#${rank}`
}

const Y_AXIS_TICKS = [1, 10, 20, 50, 100, NOT_FOUND] as const

function formatYAxisTick(value: number): string {
  if (value >= NOT_FOUND) return "ไม่พบ"
  if (value === 1) return "1"
  if (value === 10) return "Top 10"
  if (value === 20) return "Top 20"
  if (value === 50) return "Top 50"
  if (value === 100) return "Top 100"
  return String(value)
}

/** แปลง rank เป็นสเกล 0-5 ที่แต่ละช่วงห่างกัน 20% ของความสูงกราฟ (1→5, Top10→4, Top20→3, Top50→2, Top100→1, ไม่พบ→0) */
function rankToUniformScale(rank: number): number {
  if (rank >= NOT_FOUND) return 0
  if (rank <= 1) return 5
  if (rank <= 10) return 5 - ((rank - 1) / 9) * 1
  if (rank <= 20) return 4 - ((rank - 10) / 10) * 1
  if (rank <= 50) return 3 - ((rank - 20) / 30) * 1
  if (rank <= 100) return 2 - ((rank - 50) / 50) * 1
  return 1 - ((rank - 100) / 899) * 1
}

const UNIFORM_SCALE_TICKS = [0, 1, 2, 3, 4, 5] as const
const UNIFORM_SCALE_LABELS = ["ไม่พบ", "Top 100", "Top 50", "Top 20", "Top 10", "1"] as const

function formatUniformScaleTick(value: number): string {
  const i = Math.round(value)
  return UNIFORM_SCALE_LABELS[Math.max(0, Math.min(i, 5))] ?? "—"
}

function formatUniformScaleForTooltip(value: number): string {
  const i = Math.round(value)
  return UNIFORM_SCALE_LABELS[Math.max(0, Math.min(i, 5))] ?? "-"
}

export default function RankingGraphPage() {
  const [keywords, setKeywords] = useState<string[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [keyword, setKeyword] = useState("")
  const [range, setRange] = useState("7d")
  const [data, setData] = useState<RankHistoryRow[]>([])
  const [recordedAt, setRecordedAt] = useState("")
  const [viewRecordedAt, setViewRecordedAt] = useState("")
  const [graphEndDate, setGraphEndDate] = useState("")
  const [compareRecordedAt, setCompareRecordedAt] = useState("")
  const [previousRecordedAt, setPreviousRecordedAt] = useState("")
  const [latestRows, setLatestRows] = useState<RankRow[]>([])
  const [previousRows, setPreviousRows] = useState<RankRow[]>([])
  const [availableRecordedDates, setAvailableRecordedDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTrend, setLoadingTrend] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportingImage, setExportingImage] = useState(false)
  const [savingFile, setSavingFile] = useState(false)
  const [imageExportLayout, setImageExportLayout] = useState(false)
  const exportRef = useRef<HTMLDivElement | null>(null)

  const fetchTrendSnapshot = useCallback(async () => {
    const params = new URLSearchParams()
    if (viewRecordedAt) params.set("recordedAt", viewRecordedAt)
    if (compareRecordedAt) params.set("compareTo", compareRecordedAt)
    const latestUrl = `/api/ranking/latest?${params.toString()}`

    const [latestRes, keywordRes, siteRes] = await Promise.all([
      fetch(latestUrl),
      fetch("/api/keywords"),
      fetch("/api/sites")
    ])

    if (!latestRes.ok) throw new Error("โหลดข้อมูลแนวโน้มไม่สำเร็จ")
    if (!keywordRes.ok) throw new Error("โหลดรายการ keyword ไม่สำเร็จ")
    if (!siteRes.ok) throw new Error("โหลดรายชื่อเว็บไม่สำเร็จ")

    const latest: LatestResponse = await latestRes.json()
    const nextKeywords = await keywordRes.json()
    const nextSites = await siteRes.json()

    setRecordedAt(latest.recordedAt || "")
    setPreviousRecordedAt(latest.previousRecordedAt || "")
    setLatestRows(latest.rows || [])
    setPreviousRows(latest.previousRows || [])
    setAvailableRecordedDates(latest.availableRecordedDates || [])
    setKeywords(nextKeywords)
    setSites(nextSites)
    if (!keyword && nextKeywords.length > 0) {
      setKeyword(nextKeywords[0])
    }
  }, [viewRecordedAt, compareRecordedAt, keyword])

  const fetchGraph = useCallback(async () => {
    if (!keyword) return
    const { from, to } = getDateRange(range, graphEndDate || undefined)
    const res = await fetch(
      `/api/ranking/graph?keyword=${encodeURIComponent(keyword)}&fromDate=${encodeURIComponent(from)}&toDate=${encodeURIComponent(to)}`
    )
    if (!res.ok) throw new Error("โหลดกราฟไม่สำเร็จ")
    const rows = await res.json()
    setData(rows)
  }, [keyword, range, graphEndDate])

  useEffect(() => {
    setLoadingTrend(true)
    fetchTrendSnapshot()
      .catch((e) => setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด"))
      .finally(() => {
        setLoading(false)
        setLoadingTrend(false)
      })
  }, [fetchTrendSnapshot])

  useEffect(() => {
    if (!keyword) return
    setLoading(true)
    fetchGraph()
      .catch((e) => setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด"))
      .finally(() => setLoading(false))
  }, [keyword, range, graphEndDate, fetchGraph])

  const latestRankMap = useMemo(() => {
    const map = new Map<string, RankRow>()
    for (const row of latestRows) {
      map.set(getCellKey(row.keyword, row.site_slug), row)
    }
    return map
  }, [latestRows])

  const previousRankMap = useMemo(() => {
    const map = new Map<string, RankRow>()
    for (const row of previousRows) {
      map.set(getCellKey(row.keyword, row.site_slug), row)
    }
    return map
  }, [previousRows])

  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>()
    const siteSlugs = sites.map((site) => site.slug)
    for (const row of data) {
      const key = row.recorded_date
      if (!byDate.has(key)) {
        const obj: Record<string, number | string> = { name: key }
        for (const slug of siteSlugs) obj[slug] = NOT_FOUND
        byDate.set(key, obj)
      }
      const obj = byDate.get(key)!
      obj[row.site_slug] = row.rank >= NOT_FOUND ? NOT_FOUND : row.rank
    }
    return Array.from(byDate.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)))
  }, [data, sites])

  const chartDataForGraph = useMemo(() => {
    return chartData.map((row) => {
      const out: Record<string, number | string> = { name: row.name }
      let sum = 0
      let count = 0
      for (const site of sites) {
        const v = row[site.slug]
        const rank = typeof v === "number" ? v : Number(v) || NOT_FOUND
        const scale = rankToUniformScale(rank)
        out[site.slug] = scale
        sum += scale
        count += 1
      }
      out.average = count > 0 ? sum / count : 0
      return out
    })
  }, [chartData, sites])

  const xAxisTicks = useMemo(() => {
    const n = chartDataForGraph.length
    if (n <= 7) return undefined
    const names: string[] = []
    for (let i = 0; i < 7; i++) {
      const idx = Math.round((i / 6) * (n - 1))
      const name = chartDataForGraph[idx]?.name
      if (typeof name === "string") names.push(name)
    }
    return names
  }, [chartDataForGraph])

  const summaryCards = useMemo(() => {
    return sites.map((site) => {
      let up = 0
      let down = 0
      let same = 0
      let notFound = 0

      for (const kw of keywords) {
        const currentRank = latestRankMap.get(getCellKey(kw, site.slug))?.rank ?? NOT_FOUND
        const previousRank = previousRankMap.get(getCellKey(kw, site.slug))?.rank ?? null
        const trend = getTrendMeta(currentRank, previousRank)

        if (currentRank >= NOT_FOUND) notFound += 1
        if (trend.bucket === "up") up += 1
        else if (trend.bucket === "down") down += 1
        else same += 1
      }

      return { ...site, up, down, same, notFound }
    })
  }, [keywords, latestRankMap, previousRankMap, sites])

  const averageRankBySite = useMemo(() => {
    const map = new Map<string, number>()
    for (const site of sites) {
      let sum = 0
      let count = keywords.length
      for (const kw of keywords) {
        const rank = latestRankMap.get(getCellKey(kw, site.slug))?.rank ?? NOT_FOUND
        sum += rank
      }
      map.set(site.slug, count > 0 ? sum / count : NOT_FOUND)
    }
    return map
  }, [keywords, latestRankMap, sites])

  const handleExportImage = async () => {
    if (!exportRef.current) return
    setExportingImage(true)
    setImageExportLayout(true)
    setError(null)

    const hiddenElements = Array.from(exportRef.current.querySelectorAll<HTMLElement>('[data-export-hide="true"]'))
    let exportStage: HTMLDivElement | null = null

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      // รอให้ React re-render ด้วย LineChart แบบ fixed dimensions ก่อน clone (ไม่ใช่ ResponsiveContainer)
      await new Promise<void>((resolve) => setTimeout(resolve, 150))

      hiddenElements.forEach((el) => {
        el.dataset.previousDisplay = el.style.display
        el.style.display = "none"
      })

      const exportClone = exportRef.current.cloneNode(true) as HTMLDivElement
      exportClone.style.margin = "0"
      exportClone.style.width = "fit-content"
      exportClone.style.maxWidth = "none"
      exportClone.style.display = "inline-block"

      exportStage = document.createElement("div")
      exportStage.style.position = "fixed"
      exportStage.style.top = "0"
      exportStage.style.left = "0"
      exportStage.style.opacity = "0"
      exportStage.style.zIndex = "-1"
      exportStage.style.padding = "24px"
      exportStage.style.background = "#0b0b0b"
      exportStage.style.display = "inline-block"
      exportStage.style.width = "max-content"
      exportStage.style.pointerEvents = "none"
      exportStage.appendChild(exportClone)
      document.body.appendChild(exportStage)

      const sectionNames = ["summary", "heatmap", "detail-chart"] as const
      const zip = new JSZip()
      const baseName = `ranking-trend-report-${(recordedAt || "latest").replace(/[: ]/g, "-")}`

      // summary + heatmap: capture จาก element บนจอ (ไม่ใช่ clone) เพราะ table/grid ใน clone นอก viewport เป็นรูปดำ
      // detail-chart: capture จาก clone ที่มี LineChart fixed dimensions (SVG render ได้ใน clone)
      for (const sectionName of sectionNames) {
        const el =
          sectionName === "detail-chart"
            ? exportClone.querySelector<HTMLElement>(`[data-export-section="${sectionName}"]`)
            : exportRef.current?.querySelector<HTMLElement>(`[data-export-section="${sectionName}"]`)
        if (!el) continue
        const canvas = await html2canvas(el, { backgroundColor: "#0b0b0b", scale: 2 })
        const dataUrl = canvas.toDataURL("image/png")
        zip.file(`${baseName}-${sectionName}.png`, dataUrl.split(",")[1], { base64: true })
      }

      const zipBlob = await zip.generateAsync({ type: "blob" })
      const blobUrl = URL.createObjectURL(zipBlob)
      const link = document.createElement("a")
      link.download = `${baseName}.zip`
      link.href = blobUrl
      link.click()
      URL.revokeObjectURL(blobUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกเป็นรูปไม่สำเร็จ")
    } finally {
      hiddenElements.forEach((el) => {
        el.style.display = el.dataset.previousDisplay ?? ""
        delete el.dataset.previousDisplay
      })
      exportStage?.remove()
      setImageExportLayout(false)
      setExportingImage(false)
    }
  }

  const handleSaveFile = async () => {
    if (!exportRef.current) return
    setSavingFile(true)
    setImageExportLayout(true)
    setError(null)
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

      const reportHtml = exportRef.current.innerHTML
      const printWindow = window.open("", "_blank", "width=1500,height=950")
      if (!printWindow) {
        throw new Error("เบราว์เซอร์บล็อกหน้าต่างสำหรับ save file / print")
      }

      printWindow.document.write(`<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <title>Ranking Trend Report</title>
    <style>
      @page { size: A4 landscape; margin: 24mm; }
      * { box-sizing: border-box; }
      body {
        font-family: "Segoe UI", Tahoma, Arial, sans-serif;
        background: #ffffff;
        color: #111827;
        margin: 0;
        padding: 10mm 14mm;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
      }
      body > div { width: 100% !important; max-width: 100% !important; display: flex !important; flex-direction: column !important; align-items: center !important; }
      [data-chart-wrapper] { display: flex !important; justify-content: center !important; width: 100% !important; }
      [data-chart-wrapper] > div { margin: 0 auto !important; display: block !important; }
      [data-chart-wrapper] .recharts-responsive-container { margin: 0 auto !important; display: block !important; }
      [data-chart-wrapper] .recharts-wrapper { margin: 0 auto !important; left: 50% !important; transform: translateX(-50%) !important; }
      h1, h2, h3 { color: #111827; margin: 0; }
      .rounded-2xl, .rounded-xl, .rounded-lg { border-radius: 10px !important; }
      .report-page {
        page-break-after: always;
        break-after: page;
        margin-bottom: 10mm !important;
      }
      .report-page:last-child {
        page-break-after: auto;
        break-after: auto;
        margin-bottom: 0 !important;
      }
      .shadow-\\[0_12px_40px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\], .shadow-sm { box-shadow: none !important; }
      .backdrop-blur { backdrop-filter: none !important; }
      .bg-zinc-950\\/85, .bg-zinc-950\\/90, .bg-zinc-950\\/95, .bg-zinc-900\\/80, .bg-zinc-900\\/70, .bg-black\\/40 {
        background: transparent !important;
      }
      .border-amber-500\\/15, .border-amber-500\\/10, .border-amber-500\\/20, .border-zinc-700 {
        border-color: #d1d5db !important;
      }
      .text-amber-50, .text-amber-100, .text-amber-200, .text-zinc-100, .text-zinc-200, .text-zinc-300, .text-zinc-400, .text-zinc-500, .text-zinc-600 {
        color: #111827 !important;
      }
      .text-emerald-300, .text-emerald-400\\/80 { color: #047857 !important; }
      .text-red-300, .text-rose-300, .text-rose-400\\/80 { color: #b91c1c !important; }
      .text-orange-300, .text-orange-400\\/80 { color: #c2410c !important; }
      .text-sky-400 { color: #1d4ed8 !important; }
      .mx-auto, .mx-auto.w-fit { margin-left: auto !important; margin-right: auto !important; }
      .w-fit { width: fit-content !important; }
      .max-w-3xl, .max-w-6xl { max-width: none !important; }
      .overflow-x-auto, .overflow-visible { overflow: visible !important; }
      .sticky { position: static !important; }
      .grid { display: grid !important; }
      .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .lg\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
      .gap-3 { gap: 12px !important; }
      .gap-4 { gap: 16px !important; }
      .bg-emerald-950\\/25, .bg-emerald-950\\/30 { background: #dff7ea !important; }
      .bg-rose-950\\/25 { background: #ffd6d6 !important; }
      .bg-zinc-900\\/50, .bg-zinc-900\\/60 { background: #f3f4f6 !important; }
      .bg-amber-500\\/10, .bg-amber-400\\/15 { background: #fff7ed !important; }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
        line-height: 1.3;
      }
      th, td {
        border: 1px solid #d1d5db;
        padding: 6px 8px;
        text-align: center;
        vertical-align: middle;
      }
      th:first-child, td:first-child { text-align: left; }
      th {
        background: #f3f4f6 !important;
        font-weight: 700;
      }
      td > div {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }
      td:first-child > div { align-items: flex-start; }
      .font-semibold, .font-medium { font-weight: 700 !important; }
      [data-export-section="heatmap"] { page-break-inside: avoid !important; max-width: 100% !important; overflow: hidden !important; box-sizing: border-box !important; transform: scale(0.90); transform-origin: center top !important; }
      [data-export-section="heatmap"] table { font-size: 16px !important; line-height: 1.3 !important; table-layout: fixed !important; width: 100% !important; max-width: 100% !important; }
      [data-export-section="heatmap"] th, [data-export-section="heatmap"] td { padding: 8px 4px !important; min-height: 2.2em !important; overflow: hidden !important; word-break: break-word !important; }
      [data-export-section="heatmap"] [data-heatmap-cell] { flex-direction: row !important; flex-wrap: nowrap !important; gap: 2px !important; display: flex !important; min-height: 1.5em !important; align-items: center !important; justify-content: center !important; }
      [data-export-section="heatmap"] [data-heatmap-cell] span { white-space: nowrap !important; }
      [data-export-section="detail-chart"] { display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; width: 100% !important; min-height: 50vh !important; margin-left: auto !important; margin-right: auto !important; }
      [data-export-section="detail-chart"] > div { width: 100% !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; }
      [data-export-section="detail-chart"] .mx-auto { margin-left: auto !important; margin-right: auto !important; display: block !important; }
      input, button, a[href^="/"], a[href^="javascript"], [data-export-hide="true"] { display: none !important; }
      body { display: flex !important; flex-direction: column !important; align-items: center !important; width: 100% !important; }
      body > div { width: 100% !important; max-width: 100% !important; display: flex !important; flex-direction: column !important; align-items: center !important; }
      [data-chart-wrapper] { display: flex !important; justify-content: center !important; width: 100% !important; }
      [data-chart-wrapper] > div { margin: 0 auto !important; display: block !important; }
      [data-chart-wrapper] .recharts-responsive-container { margin: 0 auto !important; display: block !important; }
      [data-chart-wrapper] .recharts-wrapper { margin: 0 auto !important; left: 50% !important; transform: translateX(-50%) !important; }
      .print-center-wrapper { width: 100% !important; display: flex !important; flex-direction: column !important; align-items: center !important; }
      @media print {
        body { margin: 0 !important; display: flex !important; flex-direction: column !important; align-items: center !important; }
        .print-center-wrapper { width: 100% !important; display: flex !important; flex-direction: column !important; align-items: center !important; }
      }
    </style>
  </head>
  <body><div class="print-center-wrapper" style="width:100%;display:flex;flex-direction:column;align-items:center">${reportHtml}</div></body>
</html>`)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    } catch (e) {
      setError(e instanceof Error ? e.message : "save เป็นไฟล์ไม่สำเร็จ")
    } finally {
      setImageExportLayout(false)
      setSavingFile(false)
    }
  }

  if (loadingTrend && !latestRows.length) {
    return (
      <PageLayout title="แดชบอร์ด SEO" description="โหลดข้อมูล…" titleAlign="center">
        <div className="flex items-center justify-center gap-2 text-zinc-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          กำลังโหลด…
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="แดชบอร์ด SEO"
      description="ภาพรวมแนวโน้ม 6 เว็บ · Heatmap ทุก keyword · กราฟเจาะลึก"
      maxWidth="full"
      titleAlign="center"
    >
      <div className="mb-6 flex flex-wrap items-center justify-center gap-3" data-export-hide="true">
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <span>ดูข้อมูลวันที่:</span>
          <select
            value={viewRecordedAt}
            onChange={(e) => setViewRecordedAt(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-200"
          >
            <option value="">ล่าสุด</option>
            {availableRecordedDates.map((value) => (
              <option key={value} value={value}>
                {formatRecordedAt(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <span>เทียบกับ:</span>
          <select
            value={compareRecordedAt}
            onChange={(e) => setCompareRecordedAt(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-200"
          >
            <option value="">รอบก่อนหน้าอัตโนมัติ</option>
            {availableRecordedDates.filter((v) => v !== recordedAt).map((value) => (
              <option key={value} value={value}>
                {formatRecordedAt(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <span>Keyword:</span>
          <select
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-200"
          >
            {keywords.map((kw) => (
              <option key={kw} value={kw}>{kw}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <span>ย้อนหลัง:</span>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-200"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <span>ข้อมูลถึงวันที่:</span>
          <select
            value={graphEndDate}
            onChange={(e) => setGraphEndDate(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-200"
          >
            <option value="">วันนี้</option>
            {availableRecordedDates.map((value) => (
              <option key={value} value={value}>
                {formatRecordedAt(value)}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" onClick={handleExportImage} loading={exportingImage}>
          บันทึกเป็นรูป
        </Button>
        <Button variant="secondary" onClick={handleSaveFile} loading={savingFile}>
          Save เป็นไฟล์
        </Button>
        <Link
          href="/ranking"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-amber-500/40 hover:text-amber-100"
        >
          ตารางอันดับแบบเต็ม →
        </Link>
      </div>

      <div ref={exportRef} className={imageExportLayout ? "mx-auto w-fit" : ""}>
        {/* แนวโน้ม SEO Rank + กราฟ อยู่คู่กัน */}
        <div
          className={`mb-6 grid gap-6 ${imageExportLayout ? "" : "lg:grid-cols-2"}`}
          data-export-section="summary"
        >
          <Card className={`report-page ${imageExportLayout ? "mx-auto w-fit" : ""}`}>
            <CardHeader
              title="ภาพรวมแนวโน้ม SEO Rank"
              subtitle={
                recordedAt
                  ? `ข้อมูลล่าสุด: ${formatRecordedAt(recordedAt)}${previousRecordedAt ? ` | รอบเปรียบเทียบ: ${formatRecordedAt(previousRecordedAt)}` : ""}`
                  : undefined
              }
              align={imageExportLayout ? "center" : "left"}
            />
            <CardBody>
              {error && (
                <div className="mb-4 rounded-lg bg-red-900/20 p-4 text-red-300">
                  {error}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                {summaryCards.map((site) => (
                  <div key={site.slug} className="rounded-xl border border-amber-500/15 bg-zinc-950/70 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-amber-100">{site.name}</h3>
                      <span className="text-xs text-zinc-400">{keywords.length} keyword</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg bg-emerald-950/30 px-3 py-2 text-emerald-300">ดีขึ้น {site.up}</div>
                      <div className="rounded-lg bg-rose-950/25 px-3 py-2 text-red-300">แย่ลง {site.down}</div>
                      <div className="rounded-lg bg-zinc-900/60 px-3 py-2 text-zinc-300">คงเดิม {site.same}</div>
                      <div className="rounded-lg bg-zinc-900/60 px-3 py-2 text-zinc-300">ไม่พบ {site.notFound}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card className={`report-page ${imageExportLayout ? "mx-auto w-fit" : ""}`} data-export-section="detail-chart">
            <CardHeader
              title="กราฟเจาะลึกตาม Keyword"
              subtitle={keyword ? `แนวโน้มย้อนหลังของ keyword: ${keyword} · แกน Y: อันดับ 1 (บน) = ดีที่สุด, 999 (ล่าง) = ไม่พบ` : "เลือก keyword เพื่อดูกราฟย้อนหลัง"}
              align={imageExportLayout ? "center" : "left"}
            />
            <CardBody className={chartData.length > 0 ? "pb-0" : undefined}>
              {loading && !chartData.length ? (
                <div className="flex min-h-[320px] items-center justify-center gap-2 py-12 text-zinc-500">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                  กำลังโหลดกราฟ…
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex min-h-[320px] items-center justify-center py-12">
                  <p className="text-center text-zinc-500 dark:text-zinc-400">ไม่มีข้อมูลในช่วงนี้</p>
                </div>
              ) : (
                <div className="flex h-[460px] w-full flex-col" data-chart-wrapper>
                  <div className="min-h-0 flex-1">
                    {imageExportLayout ? (
                      <LineChart
                        width={980}
                        height={400}
                        data={chartDataForGraph}
                        margin={{ top: 8, right: 24, left: 8, bottom: 36 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                        <XAxis
                          dataKey="name"
                          ticks={xAxisTicks}
                          tick={{ fontSize: 10, fill: "#d4d4d8" }}
                          tickFormatter={(value) => formatRecordedAt(String(value))}
                          height={40}
                        />
                        <YAxis
                          domain={[0, 5]}
                          tick={{ fontSize: 10, fill: "#d4d4d8" }}
                          tickFormatter={(v) => formatUniformScaleTick(Number(v))}
                          ticks={[...UNIFORM_SCALE_TICKS]}
                        />
                        <Tooltip
                          formatter={(value) => {
                            const v = typeof value === "number" ? value : 0
                            return formatUniformScaleForTooltip(v)
                          }}
                          labelFormatter={(value) => formatRecordedAt(String(value))}
                          contentStyle={{
                            backgroundColor: "#111111",
                            borderColor: "rgba(245, 158, 11, 0.2)",
                            borderRadius: 12,
                            color: "#f4f4f5"
                          }}
                        />
                        {sites.map((site, index) => (
                          <Line
                            key={site.slug}
                            type="monotone"
                            dataKey={site.slug}
                            stroke={getSiteColor(site)}
                            strokeWidth={2.5}
                            dot={{ r: 2 }}
                            activeDot={{ r: 4 }}
                            connectNulls
                            name={site.name}
                          />
                        ))}
                        <Line
                          type="monotone"
                          dataKey="average"
                          stroke={AVERAGE_LINE_COLOR}
                          strokeWidth={2.5}
                          strokeDasharray="6 4"
                          dot={{ r: 2 }}
                          activeDot={{ r: 4 }}
                          connectNulls
                          name="เฉลี่ย"
                        />
                    </LineChart>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartDataForGraph} margin={{ top: 8, right: 24, left: 8, bottom: 56 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                        <XAxis
                          dataKey="name"
                          ticks={xAxisTicks}
                          tick={{ fontSize: 10, fill: "#d4d4d8" }}
                          tickFormatter={(value) => formatRecordedAt(String(value))}
                          height={44}
                        />
                        <YAxis
                          domain={[0, 5]}
                          tick={{ fontSize: 10, fill: "#d4d4d8" }}
                          tickFormatter={(v) => formatUniformScaleTick(Number(v))}
                          ticks={[...UNIFORM_SCALE_TICKS]}
                          width={48}
                        />
                        <Tooltip
                          formatter={(value) => {
                            const v = typeof value === "number" ? value : 0
                            return formatUniformScaleForTooltip(v)
                          }}
                          labelFormatter={(value) => formatRecordedAt(String(value))}
                          contentStyle={{
                            backgroundColor: "#111111",
                            borderColor: "rgba(245, 158, 11, 0.2)",
                            borderRadius: 12,
                            color: "#f4f4f5"
                          }}
                        />
                        {sites.map((site, index) => (
                          <Line
                            key={site.slug}
                            type="monotone"
                            dataKey={site.slug}
                            stroke={getSiteColor(site)}
                            strokeWidth={2.5}
                            dot={{ r: 2 }}
                            activeDot={{ r: 4 }}
                            connectNulls
                            name={site.name}
                          />
                        ))}
                        <Line
                          type="monotone"
                          dataKey="average"
                          stroke={AVERAGE_LINE_COLOR}
                          strokeWidth={2.5}
                          strokeDasharray="6 4"
                          dot={{ r: 2 }}
                          activeDot={{ r: 4 }}
                          connectNulls
                          name="เฉลี่ย"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="shrink-0 border-t border-zinc-700/80 px-2 pt-2.5 pb-2 flex flex-wrap justify-center gap-x-6 gap-y-1.5" data-export-hide="true">
                  {sites.map((site, index) => (
                    <span key={site.slug} className="inline-flex items-center gap-2 text-xs text-zinc-400">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getSiteColor(site) }} />
                      {site.name}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0 border-2 border-dashed border-zinc-500" style={{ backgroundColor: AVERAGE_LINE_COLOR }} />
                    เฉลี่ย
                  </span>
                </div>
              </div>
              )}
            </CardBody>
          </Card>
        </div>

        <Card className={`mb-6 report-page ${imageExportLayout ? "mx-auto w-fit" : ""}`} data-export-section="heatmap">
          <CardHeader
            title="Heatmap แนวโน้มทุก Keyword × 6 เว็บ"
            subtitle="ดูภาพรวมทุก keyword ในจอเดียว: สีเขียว = ดีขึ้น, สีแดง = แย่ลง, สีเทา = คงเดิมหรือไม่พบ"
            align={imageExportLayout ? "center" : "left"}
          />
          <CardBody className="p-0">
            <div className={imageExportLayout ? "overflow-visible" : "overflow-x-auto"}>
              <table className="w-full table-fixed text-left text-[10px] leading-tight sm:text-xs">
                <thead>
                  <tr className="border-b border-amber-500/10">
                    <th className="sticky left-0 z-10 w-[180px] bg-zinc-950/95 px-3 py-2.5 font-medium text-amber-100">
                      Keyword
                    </th>
                    {sites.map((site) => (
                      <th key={site.slug} className="w-[120px] bg-zinc-950/90 px-2 py-2.5 text-center font-medium text-amber-100">
                        <div className="mx-auto max-w-[100px] break-words leading-tight">{site.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw) => (
                    <tr key={kw} className="border-b border-amber-500/5">
                      <td className="sticky left-0 z-10 bg-zinc-950/95 px-3 py-2 font-medium text-zinc-100">
                        {kw}
                      </td>
                      {sites.map((site) => {
                        const currentRank = latestRankMap.get(getCellKey(kw, site.slug))?.rank ?? NOT_FOUND
                        const previousRank = previousRankMap.get(getCellKey(kw, site.slug))?.rank ?? null
                        const trend = getTrendMeta(currentRank, previousRank)
                        return (
                          <td key={site.slug} className={`px-2 py-2 align-middle text-center ${getTrendCellClass(currentRank, previousRank)}`}>
                            <div className="flex flex-row flex-wrap items-center justify-center gap-1 leading-tight" data-heatmap-cell>
                              <span className="inline-flex items-center gap-0.5 font-semibold text-zinc-100 whitespace-nowrap">
                                {formatRankText(currentRank)}
                                <span className={`font-semibold ${trend.className}`} title={trend.label}>
                                  {trend.icon}
                                </span>
                              </span>
                              {previousRank != null && (
                                <span className="text-[12px] text-zinc-400 whitespace-nowrap">
                                  จาก {formatRankText(previousRank)}
                                </span>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-amber-500/20 bg-zinc-900/50">
                    <td className="sticky left-0 z-10 bg-zinc-950/95 px-3 py-2 font-medium text-amber-100">
                      เฉลี่ย
                    </td>
                    {sites.map((site) => {
                      const avg = averageRankBySite.get(site.slug) ?? NOT_FOUND
                      const avgRounded = Math.round(avg)
                      return (
                        <td key={site.slug} className="px-2 py-2 align-middle text-center">
                          <span className="font-semibold text-zinc-100">
                            {avgRounded >= NOT_FOUND ? "-" : `#${avgRounded}`}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </PageLayout>
  )
}
