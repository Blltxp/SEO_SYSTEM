"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toPng } from "html-to-image"
import { PageLayout } from "../../components/PageLayout"
import { Card, CardBody, CardHeader } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"

const KEYWORD_AVOID_VISIBILITY = "หาแรงงานต่างด้าว"

type RankRow = { site_slug: string; keyword: string; rank: number; url: string | null }
type LatestResponse = {
  recordedAt: string
  rows: RankRow[]
  previousRecordedAt?: string
  previousRows?: RankRow[]
}
type TableMode = "daily" | "executive"

export default function RankingPage() {
  const [recordedAt, setRecordedAt] = useState("")
  const [rows, setRows] = useState<RankRow[]>([])
  const [previousRecordedAt, setPreviousRecordedAt] = useState("")
  const [previousRows, setPreviousRows] = useState<RankRow[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [sites, setSites] = useState<{ slug: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [editingManual, setEditingManual] = useState(false)
  const [savingManual, setSavingManual] = useState(false)
  const [exportingImage, setExportingImage] = useState(false)
  const [savingFile, setSavingFile] = useState(false)
  const [tableMode, setTableMode] = useState<TableMode>("executive")
  const [manualDrafts, setManualDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const exportRef = useRef<HTMLDivElement | null>(null)

  const fetchLatest = useCallback(async () => {
    const [latestRes, kwRes, sitesRes] = await Promise.all([
      fetch("/api/ranking/latest"),
      fetch("/api/keywords"),
      fetch("/api/sites")
    ])
    const latest: LatestResponse = latestRes.ok
      ? await latestRes.json()
      : { recordedAt: "", rows: [], previousRecordedAt: "", previousRows: [] }
    const kw = kwRes.ok ? await kwRes.json() : []
    const st = sitesRes.ok ? await sitesRes.json() : []
    setRecordedAt(latest.recordedAt || "")
    setRows(latest.rows || [])
    setPreviousRecordedAt(latest.previousRecordedAt || "")
    setPreviousRows(latest.previousRows || [])
    setKeywords(kw)
    setSites(st)
  }, [])

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
    setError(null)
    const hiddenElements = Array.from(exportRef.current.querySelectorAll<HTMLElement>('[data-export-hide="true"]'))
    try {
      hiddenElements.forEach((el) => {
        el.dataset.previousDisplay = el.style.display
        el.style.display = "none"
      })
      const dataUrl = await toPng(exportRef.current, {
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
      setExportingImage(false)
    }
  }

  const handleSaveFile = () => {
    if (!exportRef.current) return
    setSavingFile(true)
    setError(null)
    try {
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
      body { font-family: Arial, sans-serif; background: #0b0b0b; color: #f3f4f6; margin: 24px; }
      h1, h2, h3 { color: #f6d06b; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #3f3f46; padding: 8px; vertical-align: top; }
      th { background: #111111; color: #f6d06b; }
      .text-emerald-300, .text-emerald-400\\/80 { color: #86efac !important; }
      .text-amber-200, .text-amber-300\\/80, .text-amber-100 { color: #fde68a !important; }
      .text-orange-300, .text-orange-400\\/80 { color: #fdba74 !important; }
      .text-rose-300, .text-rose-400\\/80 { color: #fda4af !important; }
      .text-zinc-400, .text-zinc-500, .text-zinc-300, .text-zinc-100 { color: #e4e4e7 !important; }
      .bg-zinc-950\\/90, .bg-zinc-950\\/85, .bg-zinc-900\\/80, .bg-zinc-900\\/70, .bg-black\\/40 { background: transparent !important; }
      .border, .shadow-sm, .shadow-\\[0_12px_40px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\] { box-shadow: none !important; }
      input, button, a[href^="/"], a[href^="javascript"] { display: none !important; }
      [data-export-hide="true"] { display: none !important; }
      @media print { body { margin: 0; } }
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
        tableClass: "w-full table-fixed text-left text-[9px] leading-none",
        keywordWidth: "w-[112px]",
        keywordCell: "px-1.5 py-1",
        headCell: "px-1 py-1.5",
        siteWidth: "w-[76px]",
        siteLabelWidth: "max-w-[68px]",
        bodyCell: "px-1 py-1 align-top",
        inputWidth: "w-12"
      }
    : {
        label: "โหมดใช้งานทุกวัน",
        compact: false,
        tableClass: "w-full table-fixed text-left text-[11px] leading-tight sm:text-xs",
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
      <PageLayout title="Keyword Ranking Tracker" description="อันดับ Google 19 keyword × 6 เว็บ">
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
    >
      <div className="mb-4 flex flex-wrap items-center gap-2" data-export-hide="true">
        <span className="text-sm text-zinc-400">รูปแบบตาราง:</span>
        <Button
          size="sm"
          variant={tableMode === "daily" ? "primary" : "secondary"}
          onClick={() => setTableMode("daily")}
        >
          ใช้งานทุกวัน
        </Button>
        <Button
          size="sm"
          variant={tableMode === "executive" ? "primary" : "secondary"}
          onClick={() => setTableMode("executive")}
        >
          รายงานผู้บริหาร
        </Button>
        <span className="text-xs text-zinc-500">
          {tableLayout.compact ? "สรุปเต็มจอ เน้นดูครบทุก keyword" : "อ่านง่าย รายละเอียดครบกว่า"}
        </span>
      </div>
      <div ref={exportRef}>
        <Card className="mb-6">
        <CardHeader
          title="ตารางอันดับล่าสุด (SEO Rank)"
          subtitle={
            recordedAt
              ? `ข้อมูลล่าสุด: ${formatRecordedAt(recordedAt)}${previousRecordedAt ? ` | รอบก่อนหน้า: ${formatRecordedAt(previousRecordedAt)}` : ""} | ${tableLayout.label}`
              : undefined
          }
          action={
            <div className="flex flex-wrap items-center gap-2" data-export-hide="true">
              <Button onClick={handleCheck} loading={checking} disabled={checking || savingManual}>
                เช็คอันดับตอนนี้
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingManual((prev) => !prev)
                  setManualDrafts({})
                  setError(null)
                }}
                disabled={checking || savingManual}
              >
                {editingManual ? "ยกเลิกแก้ไข" : "กรอกแมนนวล"}
              </Button>
              {editingManual && (
                <Button variant="secondary" onClick={handleCopyPrevious} disabled={checking || savingManual}>
                  คัดลอกจากรอบก่อน
                </Button>
              )}
              {editingManual && (
                <Button onClick={handleManualSave} loading={savingManual} disabled={checking || savingManual}>
                  บันทึกแมนนวล
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={handleExportImage}
                loading={exportingImage}
                disabled={checking || savingManual || editingManual}
              >
                บันทึกเป็นรูป
              </Button>
              <Button
                variant="secondary"
                onClick={handleSaveFile}
                loading={savingFile}
                disabled={checking || savingManual || editingManual}
              >
                Save เป็นไฟล์
              </Button>
            </div>
          }
        />
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
            <div className="overflow-x-auto">
              <table className={tableLayout.tableClass}>
                <thead>
                  <tr className="border-b border-amber-500/10">
                    <th className={`sticky left-0 z-10 ${tableLayout.keywordWidth} bg-zinc-950/95 font-medium text-amber-100 ${tableLayout.headCell}`}>
                      Keyword
                    </th>
                    {sites.map((s) => (
                      <th
                        key={s.slug}
                        className={`${tableLayout.siteWidth} bg-zinc-950/90 text-center font-medium text-amber-100 ${tableLayout.headCell}`}
                      >
                        <div
                          className={`mx-auto flex min-h-[2rem] ${tableLayout.siteLabelWidth} items-center justify-center break-words text-center ${tableLayout.compact ? "leading-[1.05]" : "whitespace-normal leading-tight"}`}
                        >
                          {s.name}
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
              <div className={`flex items-center justify-center gap-2 border-t border-amber-500/10 text-zinc-400 ${tableLayout.compact ? "py-2 text-xs" : "py-4"}`}>
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
            <div className="overflow-x-auto">
              <table className={tableLayout.tableClass}>
                <thead>
                  <tr className="border-b border-amber-500/10">
                    <th className={`sticky left-0 z-10 ${tableLayout.keywordWidth} bg-zinc-950/95 font-medium text-amber-100 ${tableLayout.headCell}`}>
                      Keyword
                    </th>
                    {sites.map((s) => (
                      <th
                        key={s.slug}
                        className={`${tableLayout.siteWidth} bg-zinc-950/90 text-center font-medium text-amber-100 ${tableLayout.headCell}`}
                      >
                        <div
                          className={`mx-auto flex min-h-[2rem] ${tableLayout.siteLabelWidth} items-center justify-center break-words text-center ${tableLayout.compact ? "leading-[1.05]" : "whitespace-normal leading-tight"}`}
                        >
                          {s.name}
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
                          className={tableLayout.compact ? "line-clamp-2 break-words leading-[1.05]" : "whitespace-normal break-words leading-tight"}
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
                                      <span className={`text-[9px] font-medium ${trend.className}`} title={trend.label}>
                                        {trend.icon}
                                      </span>
                                    ) : null
                                  ) : (
                                    <>
                                      {rank > 10 && <span className="text-xs text-zinc-500">อันดับรวม #{rank}</span>}
                                      {trend && (
                                        <span className={`mt-1 text-[10px] font-medium ${trend.className}`} title={trend.label}>
                                          {trend.icon} {trend.label}
                                        </span>
                                      )}
                                      {r?.url && (
                                        <a
                                          href={r.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="mt-1 text-xs text-sky-400 hover:underline"
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
                                    <span className={`${tableLayout.compact ? "text-[9px]" : "mt-1 text-[10px]"} font-medium ${trend.className}`} title={trend.label}>
                                      {tableLayout.compact ? trend.icon : `${trend.icon} ${trend.label}`}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {!tableLayout.compact && <div className="text-xs text-zinc-500 text-center">{v.label}</div>}
                            {editingManual && (
                              <input
                                value={draftValue}
                                onChange={(e) => handleManualDraftChange(kw, s.slug, e.target.value)}
                                placeholder={displayManualFormat(rank)}
                                className={`mx-auto mt-1 block ${tableLayout.inputWidth} rounded-md border border-zinc-700 bg-black/40 px-1.5 py-0.5 text-center text-[10px] text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none`}
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
          <div className="border-t border-amber-500/10 px-5 py-3 text-xs text-zinc-400">
            ตารางนี้นับเฉพาะผลค้นหาเว็บแบบ SEO Rank บน Google Web Search และตัดโฆษณา, local pack และลิงก์ย่อยของโดเมนเดียวกันออกแล้ว
            โหมดเช็คหลักถูกลดเหลือสูงสุดหน้า 2 (Top 20) เพื่อลดการเจอ captcha และให้ใช้งานจริงได้ง่ายขึ้น
            ถ้าข้อมูลบางช่องไม่ตรงกับที่เช็คมือ ให้กดปุ่ม <code className="rounded bg-black/40 px-1 text-amber-200">กรอกแมนนวล</code> แล้วกรอกแบบ
            <code className="rounded bg-black/40 px-1 text-amber-200"> 1/8 </code> หรือ <code className="rounded bg-black/40 px-1 text-amber-200">-</code> ก่อนกดบันทึก
            สีในตารางไล่ตามหน้า และแต่ละช่องจะมีลูกศรเทียบกับรอบก่อนหน้า: <span className="text-emerald-300">↑ ดีขึ้น</span> / <span className="text-red-300">↓ แย่ลง</span>
          </div>
        )}
        </Card>

      </div>

      <Link
        href="/ranking/graph"
        className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-zinc-200 shadow-sm transition hover:border-amber-500/40 hover:text-amber-100"
      >
        ดูกราฟเปรียบเทียบ 6 เว็บ →
      </Link>
    </PageLayout>
  )
}
