"use client"

import { useEffect, useRef, useState } from "react"
import { toPng } from "html-to-image"
import { PageLayout } from "../../components/PageLayout"
import { Card, CardBody, CardHeader } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { getSiteDisplayName, getSiteColor } from "@/lib/siteColors"

export type WebsiteStatusRow = {
  slug: string
  name: string
  url: string
  loadTimeMs: number | null
  loadStatus: string
  lineOk: boolean
  phoneOk: boolean
  lineReason?: string
  phoneReason?: string
  error?: string
}

function formatStatusDate(): string {
  const d = new Date()
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const yy = String((d.getFullYear() + 543) % 100).padStart(2, "0")
  return `${day}/${month}/${yy}`
}

/** แปลง checkedAt (ISO) เป็นข้อความภาษาไทย */
function formatCheckedAt(iso: string): string {
  try {
    const d = new Date(iso)
    const day = String(d.getDate()).padStart(2, "0")
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const yy = String((d.getFullYear() + 543) % 100).padStart(2, "0")
    const h = String(d.getHours()).padStart(2, "0")
    const m = String(d.getMinutes()).padStart(2, "0")
    return `${day}/${month}/${yy} ${h}:${m}`
  } catch {
    return iso
  }
}

function loadTimeDisplay(row: WebsiteStatusRow): { text: string; isOk: boolean } {
  if (row.loadStatus === "ล้มเหลว") {
    return { text: "ล้มเหลว", isOk: false }
  }
  if (row.loadStatus === "ช้า") {
    const sec = row.loadTimeMs != null ? (row.loadTimeMs / 1000).toFixed(1) : "?"
    return { text: `ช้า ${sec} วิ`, isOk: false }
  }
  const sec = row.loadTimeMs != null ? Math.round(row.loadTimeMs / 1000) : 0
  return { text: `ปกติ ${sec} วิ`, isOk: true }
}

export default function WebsiteStatusPage() {
  const [results, setResults] = useState<WebsiteStatusRow[]>([])
  const [checking, setChecking] = useState(false)
  const [loadingLatest, setLoadingLatest] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** เวลาเช็คล่าสุด (ISO string จาก API) */
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null)
  const [exportingImage, setExportingImage] = useState(false)
  const [imageExportLayout, setImageExportLayout] = useState(false)
  const exportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingLatest(true)
    fetch("/api/website-status/latest")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.results?.length) {
          setResults(data.results)
          setLastCheckedAt(data.checkedAt ?? null)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingLatest(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleCheck = async () => {
    setError(null)
    setChecking(true)
    try {
      const res = await fetch("/api/website-status/check", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "เช็คไม่สำเร็จ")
      }
      setResults(data.results ?? [])
      setLastCheckedAt(data.checkedAt ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด")
    } finally {
      setChecking(false)
    }
  }

  const handleExportImage = async () => {
    if (!exportRef.current) return
    setExportingImage(true)
    setImageExportLayout(true)
    setError(null)
    const hiddenElements = Array.from(
      exportRef.current.querySelectorAll<HTMLElement>('[data-export-hide="true"]')
    )
    const overflowEls = Array.from(
      exportRef.current.querySelectorAll<HTMLElement>(".overflow-x-auto")
    )

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

      hiddenElements.forEach((el) => {
        el.dataset.previousDisplay = el.style.display
        el.style.display = "none"
      })
      overflowEls.forEach((el) => {
        el.style.overflow = "visible"
        const table = el.querySelector<HTMLElement>("table")
        if (table) table.style.minWidth = "1100px"
      })

      await new Promise<void>((r) => setTimeout(r, 80))

      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0b0b0b"
      })
      const link = document.createElement("a")
      const fileDate = lastCheckedAt ? formatCheckedAt(lastCheckedAt).replace(/\D/g, "").slice(0, 12) : formatStatusDate().replace(/\//g, "")
      link.download = `website-status-${fileDate}.png`
      link.href = dataUrl
      link.click()
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกเป็นรูปไม่สำเร็จ")
    } finally {
      overflowEls.forEach((el) => {
        el.style.overflow = ""
        const table = el.querySelector<HTMLElement>("table")
        if (table) table.style.minWidth = ""
      })
      hiddenElements.forEach((el) => {
        el.style.display = el.dataset.previousDisplay ?? ""
        delete el.dataset.previousDisplay
      })
      setImageExportLayout(false)
      setExportingImage(false)
    }
  }

  const displayDate = lastCheckedAt ? formatCheckedAt(lastCheckedAt) : formatStatusDate()

  return (
    <PageLayout
      title="สถานะเว็บไซต์"
      description="ความเร็วโหลดหน้าเว็บ และสถานะปุ่มแอดไลน์ / ปุ่มโทร"
      maxWidth="full"
    >
      <div ref={exportRef} className={imageExportLayout ? "mx-auto min-w-[1200px] w-full max-w-6xl" : ""}>
      <Card>
        <CardHeader
          title={`สถานะเว็บไซต์ ${displayDate}`}
          subtitle={lastCheckedAt ? `เช็คล่าสุดเมื่อ ${displayDate}` : "กดปุ่มเช็คใหม่เพื่อตรวจสอบ"}
          action={
            <div className="flex flex-wrap items-center gap-2" data-export-hide="true">
              <Button onClick={handleCheck} loading={checking} disabled={checking}>
                เช็คสถานะปุ่มและความเร็วเว็บไซต์
              </Button>
              <Button
                variant="secondary"
                onClick={handleExportImage}
                loading={exportingImage}
                disabled={checking || results.length === 0}
              >
                บันทึกเป็นรูป
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
          {loadingLatest && results.length === 0 && (
            <div className="flex items-center justify-center gap-2 px-5 py-8 text-zinc-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-amber-500" />
              กำลังโหลดข้อมูลล่าสุด…
            </div>
          )}
          {!loadingLatest && results.length === 0 && !checking && (
            <div className="px-5 py-8 text-center text-zinc-500">
              ยังไม่มีข้อมูล — กดปุ่ม &quot;เช็คใหม่&quot; เพื่อตรวจสอบความเร็วและปุ่มแอดไลน์/โทรของทุกเว็บ
            </div>
          )}
          {checking && (
            <div className="flex items-center justify-center gap-2 px-5 py-8 text-zinc-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-amber-500" />
              กำลังเช็คสถานะ…
            </div>
          )}
          {results.length > 0 && !checking && (
            <div className="overflow-x-auto">
              <table className={`w-full text-left text-sm ${imageExportLayout ? "min-w-[1100px]" : "min-w-[640px]"}`}>
                <thead>
                  <tr className="border-b border-zinc-700/80 bg-zinc-900/50">
                    <th className="px-5 py-3 font-medium text-zinc-300">เว็บไซต์</th>
                    <th className="px-5 py-3 font-medium text-zinc-300">ความเร็วในการโหลดหน้าเว็บ</th>
                    <th className="px-5 py-3 font-medium text-zinc-300">สถานะปุ่ม แอดไลน์</th>
                    <th className="px-5 py-3 font-medium text-zinc-300">สถานะปุ่ม โทร</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => {
                    const load = loadTimeDisplay(row)
                    return (
                      <tr key={row.slug} className="border-b border-zinc-800/80 hover:bg-zinc-800/30">
                        <td className="px-5 py-3">
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-400 hover:underline"
                          >
                            {row.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                          </a>
                          {(row.name || row.slug) && (
                            <span className="ml-2 text-zinc-500">
                              (
                              <span
                                className="inline-block rounded px-1.5 py-0.5 font-medium"
                                style={{
                                  backgroundColor: `${getSiteColor(row.slug)}22`,
                                  color: getSiteColor(row.slug)
                                }}
                              >
                                {getSiteDisplayName(row.name || row.slug)}
                              </span>
                              )
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className={load.isOk ? "text-emerald-400" : "text-amber-500"}>
                            ความเร็ว = {load.text}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={row.lineOk ? "text-emerald-400" : "text-red-400"}>
                            กดแอดไลน์ = {row.lineOk ? "ปกติ" : "ผิดปกติ"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={row.phoneOk ? "text-emerald-400" : "text-red-400"}>
                            กดโทร = {row.phoneOk ? "ปกติ" : "ผิดปกติ"}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {results.length > 0 && !checking && (() => {
            const abnormal = results.filter((r) => !r.lineOk || !r.phoneOk)
            if (abnormal.length === 0) return null
            return (
              <div className="border-t border-zinc-800/80 px-5 py-4">
                <h3 className="mb-3 text-sm font-medium text-zinc-400">รายละเอียดสถานะปุ่มที่ผิดปกติ</h3>
                <ul className="space-y-2 text-sm">
                  {abnormal.map((row) => {
                    const parts: string[] = []
                    if (!row.lineOk) {
                      parts.push(row.lineReason ? `แอดไลน์: ${row.lineReason}` : "แอดไลน์: ผิดปกติ (ไม่พบปุ่มหรือลิงก์แอดไลน์)")
                    }
                    if (!row.phoneOk) {
                      parts.push(row.phoneReason ? `โทร: ${row.phoneReason}` : "โทร: ผิดปกติ (ไม่พบปุ่มหรือลิงก์โทร)")
                    }
                    return (
                      <li key={row.slug} className="flex flex-wrap gap-x-2 gap-y-1 text-zinc-300">
                        <span
                          className="inline-block rounded px-1.5 py-0.5 font-medium"
                          style={{
                            backgroundColor: `${getSiteColor(row.slug)}22`,
                            color: getSiteColor(row.slug)
                          }}
                        >
                          {getSiteDisplayName(row.name || row.slug)}
                        </span>
                        <span className="text-zinc-500">—</span>
                        <span>{parts.join(" · ")}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })()}
        </CardBody>
      </Card>
      </div>
    </PageLayout>
  )
}
