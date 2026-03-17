"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toPng } from "html-to-image"
import { PageLayout } from "../../components/PageLayout"
import { Card, CardBody, CardHeader } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { getSiteDisplayName, getSiteColor } from "@/lib/siteColors"

type VisitorStatsRow = {
  site_slug: string
  site_name: string
  total_visitors: number | null
  morning_round: number | null
  evening_round: number | null
  total_today: number
}

type Site = { id: number; slug: string; name: string }

export default function VisitorsPage() {
  const [date, setDate] = useState("")
  const [rows, setRows] = useState<VisitorStatsRow[]>([])
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingMorning, setCheckingMorning] = useState(false)
  const [checkingEvening, setCheckingEvening] = useState(false)
  const [editingManual, setEditingManual] = useState(false)
  const [savingManual, setSavingManual] = useState(false)
  const [manualDrafts, setManualDrafts] = useState<Record<string, { total: string; morning: string; evening: string }>>({})
  const [exportingImage, setExportingImage] = useState(false)
  const [imageExportLayout, setImageExportLayout] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tableExportRef = useRef<HTMLDivElement | null>(null)

  const fetchData = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const viewDate = date || today
    const [statsRes, sitesRes] = await Promise.all([
      fetch(`/api/visitors/stats?date=${encodeURIComponent(viewDate)}`),
      fetch("/api/sites")
    ])
    if (!statsRes.ok) throw new Error("โหลดสถิติไม่สำเร็จ")
    if (!sitesRes.ok) throw new Error("โหลดรายชื่อเว็บไม่สำเร็จ")

    const statsData = await statsRes.json()
    const sitesList: Site[] = await sitesRes.json()

    setRows(statsData.rows || [])
    setAvailableDates(statsData.availableDates || [])
    setSites(sitesList)
  }, [date])

  useEffect(() => {
    setLoading(true)
    fetchData().catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [fetchData])

  const handleCheck = async (round: "morning" | "evening") => {
    if (round === "morning" && hasMorningChecked) return
    setError(null)
    if (round === "morning") setCheckingMorning(true)
    else setCheckingEvening(true)
    try {
      const res = await fetch("/api/visitors/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "เช็คไม่สำเร็จ")
      }
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด")
    } finally {
      if (round === "morning") setCheckingMorning(false)
      else setCheckingEvening(false)
    }
  }

  const handleManualChange = (siteSlug: string, field: "total" | "morning" | "evening", value: string) => {
    setManualDrafts((prev) => ({
      ...prev,
      [siteSlug]: {
        ...prev[siteSlug],
        total: prev[siteSlug]?.total ?? "",
        morning: prev[siteSlug]?.morning ?? "",
        evening: prev[siteSlug]?.evening ?? "",
        [field]: value
      }
    }))
  }

  const handleManualSave = async () => {
    const today = new Date().toISOString().slice(0, 10)
    const viewDate = date || today
    const entries = Object.entries(manualDrafts)
      .map(([site_slug, d]) => {
        const obj: { site_slug: string; total_visitors?: number; morning_round?: number; evening_round?: number } = { site_slug }
        if (d.total.trim()) obj.total_visitors = parseInt(d.total.replace(/,/g, ""), 10)
        if (d.morning.trim()) obj.morning_round = parseInt(d.morning.replace(/,/g, ""), 10)
        if (d.evening.trim()) obj.evening_round = parseInt(d.evening.replace(/,/g, ""), 10)
        if (obj.total_visitors == null && obj.morning_round == null && obj.evening_round == null) return null
        return obj
      })
      .filter((e): e is NonNullable<typeof e> => e != null)
    if (entries.length === 0) {
      setError("ยังไม่มีช่องที่กรอก")
      return
    }
    setSavingManual(true)
    setError(null)
    try {
      const res = await fetch("/api/visitors/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordedDate: viewDate, entries })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ")
      setManualDrafts({})
      setEditingManual(false)
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด")
    } finally {
      setSavingManual(false)
    }
  }

  const handleExportImage = async () => {
    if (!tableExportRef.current) return
    setExportingImage(true)
    setImageExportLayout(true)
    setError(null)
    const tableWrap = tableExportRef.current
    const hiddenElements = Array.from(tableWrap.querySelectorAll<HTMLElement>('[data-export-hide="true"]'))
    const table = tableWrap.querySelector<HTMLElement>("table")

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

      hiddenElements.forEach((el) => {
        el.dataset.previousDisplay = el.style.display
        el.style.display = "none"
      })
      tableWrap.style.overflow = "visible"
      tableWrap.style.display = "inline-block"
      tableWrap.style.width = "fit-content"
      tableWrap.style.minWidth = "0"
      if (table) {
        table.style.width = "800px"
        table.style.minWidth = "800px"
        table.style.maxWidth = "800px"
      }

      await new Promise<void>((r) => setTimeout(r, 80))

      const dataUrl = await toPng(tableWrap, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0b0b0b"
      })
      const link = document.createElement("a")
      link.download = `visitors-${displayDate.replace(/-/g, "")}.png`
      link.href = dataUrl
      link.click()
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกเป็นรูปไม่สำเร็จ")
    } finally {
      tableWrap.style.overflow = ""
      tableWrap.style.display = ""
      tableWrap.style.width = ""
      tableWrap.style.minWidth = ""
      if (table) {
        table.style.width = ""
        table.style.minWidth = ""
        table.style.maxWidth = ""
      }
      hiddenElements.forEach((el) => {
        el.style.display = el.dataset.previousDisplay ?? ""
        delete el.dataset.previousDisplay
      })
      setImageExportLayout(false)
      setExportingImage(false)
    }
  }

  const formatDisplayDate = (d: string) => {
    if (!d) return "-"
    const [y, m, day] = d.split("-").map(Number)
    const buddhaYear = y + 543
    return `${day}/${m}/${buddhaYear}`
  }

  const tableRows = sites.map((site) => {
    const row = rows.find((r) => r.site_slug === site.slug)
    return {
      site_slug: site.slug,
      site_name: site.name,
      total_visitors: row?.total_visitors ?? null,
      morning_round: row?.morning_round ?? null,
      evening_round: row?.evening_round ?? null,
      total_today: row?.total_today ?? 0
    }
  })

  const displayDate = date || new Date().toISOString().slice(0, 10)

  /** มีการเช็ครอบเช้าไปแล้วสำหรับวันที่แสดงอยู่ → ไม่ให้กดรอบเช้าซ้ำ */
  const hasMorningChecked = rows.some((r) => r.morning_round != null)

  if (loading) {
    return (
      <PageLayout title="จำนวนคนเข้าชมเว็บไซต์" description="สถานะเว็บไซต์ประจำวัน">
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          กำลังโหลด…
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="จำนวนคนเข้าชมเว็บไซต์" description="เช็คสถานะเว็บไซต์ประจำวัน" maxWidth="full">
      <Card>
        <CardHeader
          title="ประจำวันที่"
          subtitle={`${formatDisplayDate(displayDate)}`}
          action={
            <div className="flex flex-wrap items-center gap-2" data-export-hide="true">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <span>วันที่:</span>
                <select
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-200"
                  disabled={checkingMorning || checkingEvening || editingManual}
                >
                  <option value="">วันนี้</option>
                  {availableDates.map((d) => (
                    <option key={d} value={d}>
                      {formatDisplayDate(d)}
                    </option>
                  ))}
                </select>
              </label>
              <Button className="cursor-pointer"
                onClick={() => handleCheck("morning")}
                loading={checkingMorning}
                disabled={checkingMorning || checkingEvening || editingManual || hasMorningChecked}
                title={hasMorningChecked ? "เช็ครอบเช้าไปแล้ว ไม่สามารถกดซ้ำได้" : undefined}
              >
                เช็คจำนวนรอบเช้า
              </Button>
              <Button
                variant="secondary"
                className="cursor-pointer"
                onClick={() => handleCheck("evening")}
                loading={checkingEvening}
                disabled={checkingMorning || checkingEvening || editingManual}
              >
                เช็คจำนวนรอบเย็น
              </Button>
              <Button className="cursor-pointer"
                variant="secondary"
                onClick={() => {
                  setEditingManual((prev) => !prev)
                  setManualDrafts({})
                  setError(null)
                }}
                disabled={checkingMorning || checkingEvening}
              >
                {editingManual ? "ยกเลิกแก้ไข" : "แก้ไขด้วยตัวเอง"}
              </Button>
              {editingManual && (
                <Button
                  className="cursor-pointer"
                  onClick={handleManualSave}
                  loading={savingManual}
                  disabled={checkingMorning || checkingEvening || savingManual}
                >
                  บันทึก
                </Button>
              )}
              <Button
                variant="secondary"
                className="cursor-pointer"
                onClick={handleExportImage}
                loading={exportingImage}
                disabled={checkingMorning || checkingEvening || editingManual}
              >
                บันทึกรูป
              </Button>
            </div>
          }
        />
        <CardBody className="p-0">
          {error && (
            <div className="mx-5 mb-4 rounded-lg bg-red-900/20 p-4 text-red-300" data-export-hide="true">
              {error}
            </div>
          )}
          {editingManual && (
            <div className="mx-5 mb-4 rounded-lg border border-amber-500/20 bg-zinc-900/70 p-4 text-sm text-zinc-300" data-export-hide="true">
              กรอกยอดสำหรับเว็บที่บอทดึงไม่ได้ (เช่น นาซ่า แม่บ้านดีดีเซอร์วิส) แล้วกด บันทึก
            </div>
          )}
          <div ref={tableExportRef} className="overflow-x-auto">
            <table className="w-full min-w-[600px] table-fixed border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="px-4 py-3 font-semibold text-amber-100">เว็บไซต์</th>
                  <th colSpan={4} className="border-l border-zinc-700 px-2 py-2 text-center font-semibold text-amber-100">
                    จำนวนคนเข้าชมผู้เข้าชมเว็บไซต์
                  </th>
                </tr>
                <tr className="border-b border-zinc-700/80">
                  <th className="px-4 py-2 font-medium text-zinc-400" />
                  <th className="w-[100px] border-l border-zinc-700/60 px-2 py-2 text-center font-medium text-zinc-400">
                    ยอดรวม
                  </th>
                  <th className="w-[90px] border-l border-zinc-700/60 px-2 py-2 text-center font-medium text-zinc-400">
                    รอบเช้า
                  </th>
                  <th className="w-[90px] border-l border-zinc-700/60 px-2 py-2 text-center font-medium text-zinc-400">
                    รอบเย็น
                  </th>
                  <th className="w-[90px] border-l border-zinc-700/60 px-2 py-2 text-center font-medium text-zinc-400">
                    ทั้งหมด
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => {
                  const draft = manualDrafts[row.site_slug]
                  return (
                    <tr key={row.site_slug} className="border-b border-zinc-800/80 hover:bg-zinc-900/50">
                      <td className="px-4 py-2.5 font-medium text-zinc-200">
                        <span
                          className="inline-block rounded px-1.5 py-0.5"
                          style={{
                            backgroundColor: `${getSiteColor(row.site_slug)}22`,
                            color: getSiteColor(row.site_slug)
                          }}
                        >
                          {getSiteDisplayName(row.site_name || row.site_slug)}
                        </span>
                      </td>
                      <td className="border-l border-zinc-700/60 px-2 py-2.5 text-center text-zinc-300">
                        {editingManual ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder={row.total_visitors != null ? String(row.total_visitors) : "—"}
                            value={draft?.total ?? ""}
                            onChange={(e) => handleManualChange(row.site_slug, "total", e.target.value)}
                            className="w-full rounded border border-zinc-600 bg-zinc-900/80 px-2 py-1 text-center text-zinc-200 placeholder:text-zinc-500"
                          />
                        ) : (
                          row.total_visitors != null ? row.total_visitors.toLocaleString("th-TH") : "—"
                        )}
                      </td>
                      <td className="border-l border-zinc-700/60 px-2 py-2.5 text-center text-zinc-300">
                        {editingManual ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder={row.morning_round != null ? String(row.morning_round) : "—"}
                            value={draft?.morning ?? ""}
                            onChange={(e) => handleManualChange(row.site_slug, "morning", e.target.value)}
                            className="w-full rounded border border-zinc-600 bg-zinc-900/80 px-2 py-1 text-center text-zinc-200 placeholder:text-zinc-500"
                          />
                        ) : (
                          row.morning_round != null ? row.morning_round.toLocaleString("th-TH") : "—"
                        )}
                      </td>
                      <td className="border-l border-zinc-700/60 px-2 py-2.5 text-center text-zinc-300">
                        {editingManual ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder={row.evening_round != null ? String(row.evening_round) : "—"}
                            value={draft?.evening ?? ""}
                            onChange={(e) => handleManualChange(row.site_slug, "evening", e.target.value)}
                            className="w-full rounded border border-zinc-600 bg-zinc-900/80 px-2 py-1 text-center text-zinc-200 placeholder:text-zinc-500"
                          />
                        ) : (
                          row.evening_round != null ? row.evening_round.toLocaleString("th-TH") : "—"
                        )}
                      </td>
                      <td className="border-l border-zinc-700/60 px-2 py-2.5 text-center font-medium text-amber-200/90">
                        {row.total_today > 0 ? row.total_today.toLocaleString("th-TH") : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </PageLayout>
  )
}
