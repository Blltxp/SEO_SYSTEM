"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toPng } from "html-to-image"
import { PageLayout } from "../../components/PageLayout"
import { Card, CardBody, CardHeader } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { getSiteDisplayName, getSiteColor } from "@/lib/siteColors"

const KEYWORD_AVOID_VISIBILITY = "หาแรงงานต่างด้าว"

type RankRow = { site_slug: string; keyword: string; rank: number; url: string | null }
type LatestResponse = {
  recordedAt: string
  rows: RankRow[]
  previousRecordedAt?: string
  previousRows?: RankRow[]
  availableRecordedDates?: string[]
}
type TableMode = "daily" | "executive"

export default function RankingPage() {
  const [recordedAt, setRecordedAt] = useState("")
  const [rows, setRows] = useState<RankRow[]>([])
  const [previousRecordedAt, setPreviousRecordedAt] = useState("")
  const [previousRows, setPreviousRows] = useState<RankRow[]>([])
  const [availableRecordedDates, setAvailableRecordedDates] = useState<string[]>([])
  const [viewRecordedAt, setViewRecordedAt] = useState("")
  const [compareRecordedAt, setCompareRecordedAt] = useState("")
  const [keywords, setKeywords] = useState<string[]>([])
  const [sites, setSites] = useState<{ slug: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [editingManual, setEditingManual] = useState(false)
  const [savingManual, setSavingManual] = useState(false)
  const [exportingImage, setExportingImage] = useState(false)
  const [savingFile, setSavingFile] = useState(false)
  const [imageExportLayout, setImageExportLayout] = useState(false)
  const [tableMode, setTableMode] = useState<TableMode>("executive")
  const [manualDrafts, setManualDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const exportRef = useRef<HTMLDivElement | null>(null)

  const fetchLatest = useCallback(async () => {
    const params = new URLSearchParams()
    if (viewRecordedAt) params.set("recordedAt", viewRecordedAt)
    if (compareRecordedAt) params.set("compareTo", compareRecordedAt)
    const latestUrl = `/api/ranking/latest?${params.toString()}`

    const [latestRes, kwRes, sitesRes] = await Promise.all([
      fetch(latestUrl),
      fetch("/api/keywords"),
      fetch("/api/sites")
    ])
    if (!latestRes.ok) throw new Error("โหลดข้อมูลอันดับล่าสุดไม่สำเร็จ")
    if (!kwRes.ok) throw new Error("โหลดรายการ keyword ไม่สำเร็จ")
    if (!sitesRes.ok) throw new Error("โหลดรายชื่อเว็บไม่สำเร็จ")

    const latest: LatestResponse = await latestRes.json()
    const kw = await kwRes.json()
    const st = await sitesRes.json()
    setRecordedAt(latest.recordedAt || "")
    setRows(latest.rows || [])
    setPreviousRecordedAt(latest.previousRecordedAt || "")
    setPreviousRows(latest.previousRows || [])
    setAvailableRecordedDates(latest.availableRecordedDates || [])
    setKeywords(kw)
    setSites(st)
  }, [viewRecordedAt, compareRecordedAt])

  useEffect(() => {
    setLoading(true)
    fetchLatest()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [fetchLatest])

  const handleCheck = async () => {
    setChecking(true)
    setError(null)
    try {
      const res = await fetch("/api/ranking/check", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "เช็คไม่สำเร็จ")
      setManualDrafts({})
      setEditingManual(false)
      await fetchLatest()
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด")
    } finally {
      setChecking(false)
    }
  }

  const getCellKey = (keyword: string, siteSlug: string) => `${keyword}\t${siteSlug}`
  const previousRankMap = useMemo(() => {
    const map = new Map<string, RankRow>()
    for (const row of previousRows) {
      map.set(getCellKey(row.keyword, row.site_slug), row)
    }
    return map
  }, [previousRows])

  const handleManualDraftChange = (keyword: string, siteSlug: string, value: string) => {
    const key = getCellKey(keyword, siteSlug)
    setManualDrafts((prev) => ({
      ...prev,
      [key]: value
    }))
  }

  const handleManualSave = async () => {
    const entries = Object.entries(manualDrafts)
      .map(([key, input]) => {
        const [keyword, site_slug] = key.split("\t")
        return { keyword, site_slug, input: input.trim() }
      })
      .filter((entry) => entry.input.length > 0)

    if (entries.length === 0) {
      setError("ยังไม่มีช่องที่กรอกแมนนวล")
      return
    }

    setSavingManual(true)
    setError(null)
    try {
      const res = await fetch("/api/ranking/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordedAt, entries })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ")
      setManualDrafts({})
      setEditingManual(false)
      await fetchLatest()
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด")
    } finally {
      setSavingManual(false)
    }
  }

  const handleCopyPrevious = () => {
    if (!previousRecordedAt || previousRows.length === 0) {
      setError("ยังไม่มีรอบก่อนหน้าให้คัดลอก")
      return
    }

    const nextDrafts: Record<string, string> = {}
    for (const keyword of keywords) {
      for (const site of sites) {
        const currentRank = getRank(keyword, site.slug)?.rank ?? NOT_FOUND
        if (currentRank <= 20 && currentRank < NOT_FOUND) continue
        const previous = previousRankMap.get(getCellKey(keyword, site.slug))
        if (!previous) continue
        nextDrafts[getCellKey(keyword, site.slug)] = displayManualFormat(previous.rank)
      }
    }

    setManualDrafts(nextDrafts)
    setError(null)
  }

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
      hiddenElements.forEach((el) => {
        el.dataset.previousDisplay = el.style.display
        el.style.display = "none"
      })

      // วัดขนาดจาก element จริงบนจอ (โหมด daily ถ้าไม่กำหนดความสูง รูปจะออกมาเป็นเส้นแนวนอน)
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      const rect = exportRef.current.getBoundingClientRect()
      const sourceW = Math.ceil(rect.width)
      const sourceH = Math.ceil(rect.height)

      const exportClone = exportRef.current.cloneNode(true) as HTMLDivElement
      exportClone.style.margin = "0"
      exportClone.style.width = "fit-content"
      exportClone.style.maxWidth = "none"
      exportClone.style.display = "inline-block"
      if (sourceW > 0 && sourceH > 0) {
        exportClone.style.width = `${sourceW}px`
        exportClone.style.height = `${sourceH}px`
        exportClone.style.minHeight = `${sourceH}px`
        exportClone.style.overflow = "hidden"
      }

      exportStage = document.createElement("div")
      exportStage.style.position = "fixed"
      exportStage.style.left = "-10000px"
      exportStage.style.top = "0"
      exportStage.style.padding = "24px"
      exportStage.style.background = "#0b0b0b"
      exportStage.style.display = "inline-block"
      exportStage.style.width = "max-content"
      exportStage.style.pointerEvents = "none"
      exportStage.appendChild(exportClone)
      document.body.appendChild(exportStage)

      const dataUrl = await toPng(exportClone, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0b0b0b"
      })
      const link = document.createElement("a")
      link.download = `ranking-report-${(recordedAt || "latest").replace(/[: ]/g, "-")}.png`
      link.href = dataUrl
      link.click()
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
      const printWindow = window.open("", "_blank", "width=1400,height=900")
      if (!printWindow) {
        throw new Error("เบราว์เซอร์บล็อกหน้าต่างสำหรับ save file / print")
      }
      printWindow.document.write(`<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <title>Ranking Report</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body {
        font-family: "Segoe UI", Tahoma, Arial, sans-serif;
        background: #ffffff;
        color: #111827;
        margin: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      h1, h2, h3 {
        color: #111827;
        margin: 0;
      }
      .rounded-2xl {
        border-radius: 12px !important;
      }
      .backdrop-blur {
        backdrop-filter: none !important;
      }
      .shadow-\\[0_12px_40px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\],
      .shadow-sm {
        box-shadow: none !important;
      }
      .mb-6, .mb-4 {
        margin-bottom: 0 !important;
      }
      .border-amber-500\\/15,
      .border-amber-500\\/10,
      .border-amber-500\\/20,
      .border-zinc-700 {
        border-color: #d1d5db !important;
      }
      .bg-zinc-950\\/85,
      .bg-zinc-950\\/90,
      .bg-zinc-950\\/95,
      .bg-zinc-900\\/80,
      .bg-zinc-900\\/70,
      .bg-black\\/40 {
        background: transparent !important;
      }
      .text-amber-100,
      .text-amber-200,
      .text-amber-300\\/80,
      .text-amber-50,
      .text-zinc-100,
      .text-zinc-200,
      .text-zinc-300,
      .text-zinc-400,
      .text-zinc-500,
      .text-zinc-600 {
        color: #111827 !important;
      }
      .text-emerald-300,
      .text-emerald-400\\/80 { color: #047857 !important; }
      .text-red-300,
      .text-rose-300,
      .text-rose-400\\/80 { color: #b91c1c !important; }
      .text-orange-300,
      .text-orange-400\\/80 { color: #c2410c !important; }
      .text-sky-400 { color: #1d4ed8 !important; }
      .hover\\:underline:hover { text-decoration: none !important; }
      .mx-auto.w-fit,
      .mx-auto {
        margin-left: auto !important;
        margin-right: auto !important;
      }
      .w-fit { width: fit-content !important; }
      .max-w-3xl { max-width: none !important; }
      .rounded-lg {
        border-radius: 8px !important;
      }
      table {
        width: auto !important;
        min-width: 100% !important;
        border-collapse: collapse;
        font-size: 13px;
        line-height: 1.35;
      }
      th, td {
        border: 1px solid #d1d5db;
        padding: 6px 8px;
        vertical-align: middle;
        text-align: center;
      }
      th {
        background: #f3f4f6 !important;
        color: #111827 !important;
        font-weight: 700;
      }
      td {
        background: #ffffff !important;
      }
      th:first-child,
      td:first-child {
        text-align: left;
      }
      .bg-emerald-950\\/35, .bg-emerald-950\\/30 {
        background: #dff7ea !important;
      }
      .bg-amber-950\\/30, .bg-amber-950\\/20 {
        background: #fff2cc !important;
      }
      .bg-orange-950\\/25 {
        background: #ffe4c7 !important;
      }
      .bg-rose-950\\/25 {
        background: #ffd6d6 !important;
      }
      .bg-zinc-900\\/60 {
        background: #f3f4f6 !important;
      }
      .font-medium {
        font-weight: 700 !important;
      }
      .text-emerald-300,
      .text-emerald-400\\/80 {
        color: #047857 !important;
      }
      .text-amber-100,
      .text-amber-200,
      .text-amber-300\\/80 {
        color: #92400e !important;
      }
      .text-orange-200,
      .text-orange-300,
      .text-orange-300\\/80,
      .text-orange-400\\/80 {
        color: #c2410c !important;
      }
      .text-rose-200,
      .text-rose-300,
      .text-rose-300\\/80,
      .text-rose-400\\/80,
      .text-red-300 {
        color: #b91c1c !important;
      }
      .text-zinc-400,
      .text-zinc-500 {
        color: #374151 !important;
      }
      .text-zinc-300,
      .text-zinc-100 {
        color: #111827 !important;
      }
      td .text-xs,
      td .text-\\[10px\\],
      td .text-\\[9px\\],
      td .text-\\[8px\\] {
        font-size: 12px !important;
        line-height: 1.25 !important;
      }
      td .text-emerald-300,
      td .text-red-300,
      td .text-zinc-400 {
        font-size: 13px !important;
        font-weight: 800 !important;
      }
      td .text-sky-400 {
        color: #1d4ed8 !important;
      }
      td span,
      td a {
        vertical-align: middle;
      }
      td > div {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }
      td:first-child > div {
        align-items: flex-start;
      }
      .sticky {
        position: static !important;
      }
      .overflow-x-auto,
      .overflow-visible {
        overflow: visible !important;
      }
      .line-clamp-2 {
        display: block !important;
        -webkit-line-clamp: unset !important;
        -webkit-box-orient: unset !important;
        overflow: visible !important;
      }
      input, button, a[href^="/"], a[href^="javascript"] { display: none !important; }
      [data-export-hide="true"] { display: none !important; }
      a {
        color: #1d4ed8 !important;
        text-decoration: none !important;
      }
      @media print {
        body { margin: 0; }
      }
    </style>
  </head>
  <body>${reportHtml}</body>
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

  const getRank = (keyword: string, siteSlug: string) => {
    const r = rows.find((x) => x.keyword === keyword && x.site_slug === siteSlug)
    return r ?? null
  }

  const rankToPage = (rank: number) => (rank < 999 ? Math.ceil(rank / 10) : null)
  const rankToPagePosition = (rank: number) => (rank < 999 ? ((rank - 1) % 10) + 1 : null)
  const NOT_FOUND = 999

  const formatRecordedAt = (value: string) => {
    if (!value) return "-"
    const d = new Date(value.replace(" ", "T"))
    if (Number.isNaN(d.getTime())) return value
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "full",
      timeStyle: "medium"
    }).format(d)
  }

  const displayManualFormat = (rank: number) => {
    if (rank >= NOT_FOUND) return "-"
    const page = rankToPage(rank)
    const position = rankToPagePosition(rank)
    if (page == null || position == null) return "-"
    return `${position}/${page}`
  }

  const visibility = (rank: number, keyword: string): { label: string; color: string; subColor: string; cellClass: string } => {
    if (keyword === KEYWORD_AVOID_VISIBILITY) {
      if (rank >= NOT_FOUND) {
        return {
          label: "ไม่พบ (ดี)",
          color: "text-emerald-300",
          subColor: "text-emerald-400/80",
          cellClass: "bg-emerald-950/30"
        }
      }
      return {
        label: "พบเว็บเรา — ควรตรวจสอบ",
        color: "text-amber-200",
        subColor: "text-amber-300/80",
        cellClass: "bg-amber-950/20"
      }
    }
    if (rank >= NOT_FOUND) {
      return {
        label: "ไม่พบ",
        color: "text-zinc-400",
        subColor: "text-zinc-500",
        cellClass: "bg-zinc-900/60"
      }
    }
    const page = rankToPage(rank) ?? 1
    if (page === 1) return { label: "Top 10", color: "text-emerald-200", subColor: "text-emerald-300/80", cellClass: "bg-emerald-950/35" }
    if (page === 2) return { label: "Top 20", color: "text-amber-100", subColor: "text-amber-300/80", cellClass: "bg-amber-950/30" }
    if (page <= 5) return { label: "Top 50", color: "text-orange-200", subColor: "text-orange-300/80", cellClass: "bg-orange-950/25" }
    if (page <= 10) return { label: "Top 100", color: "text-rose-200", subColor: "text-rose-300/80", cellClass: "bg-rose-950/25" }
    return { label: "เกิน Top 100", color: "text-zinc-300", subColor: "text-zinc-500", cellClass: "bg-zinc-900/60" }
  }

  const getTrend = (keyword: string, siteSlug: string, currentRank: number) => {
    const previous = previousRankMap.get(getCellKey(keyword, siteSlug))
    const previousRank = previous?.rank ?? null

    if (previousRank == null) return null
    if (currentRank >= NOT_FOUND && previousRank >= NOT_FOUND) return null
    if (currentRank < NOT_FOUND && previousRank >= NOT_FOUND) {
      return { icon: "↑", label: "ดีขึ้นจากไม่พบ", className: "text-emerald-300" }
    }
    if (currentRank >= NOT_FOUND && previousRank < NOT_FOUND) {
      return { icon: "↓", label: "หล่นจากเดิมที่เคยพบ", className: "text-red-300" }
    }
    if (currentRank < previousRank) {
      return { icon: "↑", label: `ดีขึ้น ${previousRank - currentRank} อันดับ`, className: "text-emerald-300" }
    }
    if (currentRank > previousRank) {
      return { icon: "↓", label: `แย่ลง ${currentRank - previousRank} อันดับ`, className: "text-red-300" }
    }
    return { icon: "→", label: "คงเดิม", className: "text-zinc-400" }
  }

  const tableLayout = tableMode === "executive"
    ? {
        label: "โหมดรายงานผู้บริหาร",
        compact: true,
        wrapperClass: "overflow-x-auto",
        tableClass: "mx-auto table-fixed text-left text-xs leading-snug sm:text-sm",
        keywordWidth: "w-[152px]",
        keywordCell: "px-2 py-1.5",
        headCell: "px-1.5 py-2",
        siteWidth: "w-[98px]",
        siteLabelWidth: "max-w-[90px]",
        bodyCell: "px-1 py-1.5 align-top",
        inputWidth: "w-14"
      }
    : {
        label: "โหมดใช้งานทุกวัน",
        compact: false,
        wrapperClass: "overflow-x-auto",
        tableClass: "w-full table-fixed text-left text-xs leading-snug sm:text-sm",
        keywordWidth: "w-[150px]",
        keywordCell: "px-3 py-2",
        headCell: "px-3 py-2.5",
        siteWidth: "w-[110px]",
        siteLabelWidth: "max-w-[96px]",
        bodyCell: "px-2 py-2 align-top",
        inputWidth: "w-16"
      }

  if (loading) {
    return (
      <PageLayout title="Keyword Ranking Tracker" description="อันดับ Google 19 keyword × 6 เว็บ" titleAlign="center">
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          กำลังโหลด…
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Keyword Ranking Tracker"
      maxWidth="full"
      titleAlign="center"
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2" data-export-hide="true">
        <span className="text-sm text-zinc-400">รูปแบบตาราง</span>
        <div className="flex items-center gap-2">
          <Button className="cursor-pointer"
            size="sm"
            variant={tableMode === "daily" ? "primary" : "secondary"}
            onClick={() => setTableMode("daily")}
          >
            ใช้งานทุกวัน
          </Button>
          <Button className="cursor-pointer"
            size="sm"
            variant={tableMode === "executive" ? "primary" : "secondary"}
            onClick={() => setTableMode("executive")}
          >
            รายงานผู้บริหาร
          </Button>
        </div>
        <span className="text-xs text-zinc-500">
          {tableLayout.compact ? "สรุปเต็มจอ เน้นดูครบทุก keyword" : "อ่านง่าย รายละเอียดครบกว่า"}
        </span>
      </div>
      <div ref={exportRef} className={imageExportLayout ? "mx-auto w-fit" : ""}>
        <Card className={`mb-6 ${imageExportLayout ? "mx-auto w-fit" : ""}`}>
        <CardHeader
          title="ตารางอันดับล่าสุด (SEO Rank)"
          subtitle={
            recordedAt
              ? `ข้อมูลล่าสุด: ${formatRecordedAt(recordedAt)}${previousRecordedAt ? ` | รอบเปรียบเทียบ: ${formatRecordedAt(previousRecordedAt)}` : ""}${imageExportLayout ? "" : ` | ${tableLayout.label}`}`
              : undefined
          }
          align={imageExportLayout ? "center" : "left"}
        />
        <div className="border-b border-amber-500/10 px-5 py-4" data-export-hide="true">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-zinc-400">ดูข้อมูลวันที่</span>
                <select
                  value={viewRecordedAt}
                  onChange={(e) => setViewRecordedAt(e.target.value)}
                  className="min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-200"
                  disabled={checking || savingManual || exportingImage || savingFile}
                >
                  <option value="">ล่าสุด</option>
                  {availableRecordedDates.map((value) => (
                    <option key={value} value={value}>
                      {formatRecordedAt(value)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-zinc-400">เทียบกับ</span>
                <select
                  value={compareRecordedAt}
                  onChange={(e) => setCompareRecordedAt(e.target.value)}
                  className="min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-200"
                  disabled={checking || savingManual || exportingImage || savingFile}
                >
                  <option value="">รอบก่อนหน้าอัตโนมัติ</option>
                  {availableRecordedDates.filter((v) => v !== recordedAt).map((value) => (
                    <option key={value} value={value}>
                      {formatRecordedAt(value)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button className="cursor-pointer" onClick={handleCheck} loading={checking} disabled={checking || savingManual}>
                เช็คอันดับตอนนี้
              </Button>
              <Button
                className="cursor-pointer"
                variant="secondary"
                onClick={() => {
                  setEditingManual((prev) => !prev)
                  setManualDrafts({})
                  setError(null)
                }}
                disabled={checking || savingManual}
              >
                {editingManual ? "ยกเลิกแก้ไข" : "แก้ไขด้วยตัวเอง"}
              </Button>
              {editingManual && (
                <Button className="cursor-pointer" variant="secondary" onClick={handleCopyPrevious} disabled={checking || savingManual}>
                  คัดลอกจากรอบก่อน
                </Button>
              )}
              {editingManual && (
                <Button className="cursor-pointer" onClick={handleManualSave} loading={savingManual} disabled={checking || savingManual}>
                  บันทึกแมนนวล
                </Button>
              )}
              <span className="mx-2 h-4 w-px shrink-0 bg-zinc-600" aria-hidden />
              <Button className="cursor-pointer"
                variant="secondary"
                onClick={handleExportImage}
                loading={exportingImage}
                disabled={checking || savingManual || editingManual}
              >
                บันทึกรูป
              </Button>
              <Button className="cursor-pointer"
                variant="secondary"
                onClick={handleSaveFile}
                loading={savingFile}
                disabled={checking || savingManual || editingManual}
              >
                พิมพ์
              </Button>
            </div>
          </div>
        </div>
        <CardBody className="p-0">
          {error && (
            <div className="mx-5 mb-4 rounded-lg bg-red-900/20 p-4 text-red-300">
              {error}
            </div>
          )}
          {editingManual && (
            <div className={`mx-5 mb-4 rounded-lg border border-amber-500/20 bg-zinc-900/70 text-zinc-300 ${tableLayout.compact ? "p-2 text-xs" : "p-4 text-sm"}`}>
              กรอกแบบ <code className="rounded bg-black/40 px-1.5 py-0.5 text-amber-200">1/8</code> = อันดับที่ 1 หน้า 8,
              กรอก <code className="rounded bg-black/40 px-1.5 py-0.5 text-amber-200">-</code> = ไม่พบ,
              หรือกรอกอันดับรวมตรงๆ เช่น <code className="rounded bg-black/40 px-1.5 py-0.5 text-amber-200">71</code> ก็ได้
            </div>
          )}
          {checking ? (
            <div className={imageExportLayout ? `overflow-visible ${!tableLayout.compact ? "min-w-[900px]" : ""}` : tableLayout.wrapperClass}>
              <table className={tableLayout.tableClass}>
                <thead>
                  <tr className="border-b border-amber-500/10">
                    <th className={`sticky left-0 z-10 ${tableLayout.keywordWidth} bg-zinc-950/95 font-medium text-amber-100 ${tableLayout.headCell}`}>
                      Keyword
                    </th>
                    {sites.map((s) => (
                      <th
                        key={s.slug}
                        className={`${tableLayout.siteWidth} text-center font-medium text-amber-100 ${tableLayout.headCell}`}
                        style={{ backgroundColor: `${getSiteColor(s.slug)}99` }}
                      >
                        <div
                          className={`mx-auto flex ${tableLayout.compact ? "min-h-[2rem]" : "min-h-[2rem]"} ${tableLayout.siteLabelWidth} items-center justify-center break-words text-center ${tableLayout.compact ? "leading-[1.15]" : "whitespace-normal leading-tight"}`}
                        >
                          {getSiteDisplayName(s.name || s.slug)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((_, i) => (
                    <tr key={i} className="border-b border-amber-500/5">
                      <td className={`sticky left-0 z-10 bg-zinc-950/95 ${tableLayout.keywordCell}`}>
                        <span className="inline-block h-4 w-24 animate-pulse rounded bg-zinc-700" />
                      </td>
                      {sites.map((s) => (
                        <td key={s.slug} className={tableLayout.bodyCell}>
                          <span className="inline-block h-4 w-16 animate-pulse rounded bg-zinc-700" />
                          <span className="mt-1 block h-3 w-12 animate-pulse rounded bg-zinc-800" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={`flex items-center justify-center gap-2 border-t border-amber-500/10 text-zinc-400 ${tableLayout.compact ? "py-2 text-xs sm:text-sm" : "py-4 text-sm"}`}>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" />
                กำลังเช็คอันดับ 19 keyword สูงสุดถึงหน้า 2 (Top 20)… ถ้า Google ขอ captcha ระบบจะเปิด Chrome ให้แก้แล้วรอต่ออัตโนมัติ
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-zinc-500 dark:text-zinc-400">
              ยังไม่มีข้อมูลอันดับ — กดปุ่ม 「เช็คอันดับตอนนี้」 หรือรัน{" "}
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 dark:bg-zinc-700">npm run check-ranking</code>
            </div>
          ) : (
            <div className={imageExportLayout ? `overflow-visible ${!tableLayout.compact ? "min-w-[900px]" : ""}` : tableLayout.wrapperClass}>
              <table className={tableLayout.tableClass}>
                <thead>
                  <tr className="border-b border-amber-500/10">
                    <th className={`sticky left-0 z-10 ${tableLayout.keywordWidth} bg-zinc-950/95 font-medium text-amber-100 ${tableLayout.headCell}`}>
                      Keyword
                    </th>
                    {sites.map((s) => (
                      <th
                        key={s.slug}
                        className={`${tableLayout.siteWidth} text-center font-medium text-amber-100 ${tableLayout.headCell}`}
                        style={{ backgroundColor: `${getSiteColor(s.slug)}99` }}
                      >
                        <div
                          className={`mx-auto flex ${tableLayout.compact ? "min-h-[2rem]" : "min-h-[2rem]"} ${tableLayout.siteLabelWidth} items-center justify-center break-words text-center ${tableLayout.compact ? "leading-[1.15]" : "whitespace-normal leading-tight"}`}
                        >
                          {getSiteDisplayName(s.name || s.slug)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw) => (
                    <tr key={kw} className="border-b border-amber-500/5">
                      <td className={`sticky left-0 z-10 bg-zinc-950/95 font-medium text-zinc-100 ${tableLayout.keywordCell}`}>
                        <div
                          className={tableLayout.compact ? "line-clamp-2 break-words leading-[1.12]" : "whitespace-normal break-words leading-tight"}
                          title={kw}
                        >
                          {kw}
                        </div>
                      </td>
                      {sites.map((s) => {
                        const r = getRank(kw, s.slug)
                        const rank = r?.rank ?? NOT_FOUND
                        const v = visibility(rank, kw)
                        const trend = getTrend(kw, s.slug, rank)
                        const page = rankToPage(rank)
                        const position = rankToPagePosition(rank)
                        const draftKey = getCellKey(kw, s.slug)
                        const draftValue = manualDrafts[draftKey] ?? ""
                        return (
                          <td key={s.slug} className={`${tableLayout.bodyCell} text-center ${v.cellClass}`}>
                            <div className={v.color}>
                              {rank < NOT_FOUND ? (
                                <div className={tableLayout.compact ? "flex items-center justify-center gap-1" : "flex flex-col items-center text-center"}>
                                  <span title="อันดับในหน้าปัจจุบัน + หมายเลขหน้า" className="font-medium">
                                    #{position}
                                    <span className={tableLayout.compact ? `ml-1 ${v.subColor}` : ` ${v.subColor}`}>(น.{page})</span>
                                  </span>
                                  {tableLayout.compact ? (
                                    trend ? (
                                      <span className={`text-xs font-semibold sm:text-sm ${trend.className}`} title={trend.label}>
                                        {trend.icon}
                                      </span>
                                    ) : null
                                  ) : (
                                    <>
                                      {rank > 10 && <span className="text-sm text-zinc-500">อันดับรวม #{rank}</span>}
                                      {trend && (
                                        <span className={`mt-1 text-xs font-semibold sm:text-sm ${trend.className}`} title={trend.label}>
                                          {trend.icon} {trend.label}
                                        </span>
                                      )}
                                      {r?.url && (
                                        <a
                                          href={r.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="mt-1 text-sm text-sky-400 hover:underline"
                                          title={r.url}
                                        >
                                          ลิงก์
                                        </a>
                                      )}
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className={tableLayout.compact ? "flex items-center justify-center gap-1" : "flex flex-col items-center text-center"}>
                                  <span>-</span>
                                  {trend && (
                                    <span className={`${tableLayout.compact ? "text-xs sm:text-sm" : "mt-1 text-xs sm:text-sm"} font-semibold ${trend.className}`} title={trend.label}>
                                      {tableLayout.compact ? trend.icon : `${trend.icon} ${trend.label}`}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {!tableLayout.compact && <div className="text-sm text-zinc-500 text-center">{v.label}</div>}
                            {editingManual && (
                              <input
                                value={draftValue}
                                onChange={(e) => handleManualDraftChange(kw, s.slug, e.target.value)}
                                placeholder={displayManualFormat(rank)}
                                className={`mx-auto mt-1 block ${tableLayout.inputWidth} rounded-md border border-zinc-700 bg-black/40 px-2 py-1 text-center text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none`}
                              />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
        {rows.length > 0 && !checking && !tableLayout.compact && (
          <div className="border-t border-amber-500/10 px-5 py-3 text-sm text-zinc-400">
            ตารางนี้นับเฉพาะผลค้นหาเว็บแบบ SEO Rank บน Google Web Search และตัดโฆษณา, local pack และลิงก์ย่อยของโดเมนเดียวกันออกแล้ว
            โหมดเช็คหลักถูกลดเหลือสูงสุดหน้า 2 (Top 20) เพื่อลดการเจอ captcha และให้ใช้งานจริงได้ง่ายขึ้น
            ถ้าข้อมูลบางช่องไม่ตรงกับที่เช็คมือ ให้กดปุ่ม <code className="rounded bg-black/40 px-1 text-amber-200">กรอกแมนนวล</code> แล้วกรอกแบบ
            <code className="rounded bg-black/40 px-1 text-amber-200"> 1/8 </code> หรือ <code className="rounded bg-black/40 px-1 text-amber-200">-</code> ก่อนกดบันทึก
            สีในตารางไล่ตามหน้า และแต่ละช่องจะมีลูกศรเทียบกับรอบก่อนหน้า: <span className="text-emerald-300">↑ ดีขึ้น</span> / <span className="text-red-300">↓ แย่ลง</span>
          </div>
        )}
        </Card>
      </div>
    </PageLayout>
  )
}
