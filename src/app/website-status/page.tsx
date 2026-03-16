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
  fullLoadTimeMs: number | null
  fullLoadStatus: string
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

/** เปิดจาก localhost หรือไม่ (ปุ่มเช็คจะรันบนเครื่องนี้) */
function useIsLocalhost(): boolean {
  const [is, setIs] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    const host = window.location.hostname
    setIs(host === "localhost" || host === "127.0.0.1")
  }, [])
  return is
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
  const localCommandRef = useRef<HTMLDivElement | null>(null)
  const [copiedCommand, setCopiedCommand] = useState(false)
  const [savingSpeed, setSavingSpeed] = useState(false)
  /** ค่า fullLoadTimeMs ตอนโหลด/หลังบันทึก ใช้เช็คว่ามีการแก้ไขหรือไม่ */
  const [initialSpeeds, setInitialSpeeds] = useState<Record<string, number | null>>({})
  const isLocalhost = useIsLocalhost()

  const hasSpeedChanges =
    results.length > 0 &&
    results.some(
      (r) => (initialSpeeds[r.slug] ?? null) !== (r.fullLoadTimeMs ?? null)
    )

  const handleSpeedChange = (slug: string, value: string) => {
    if (value === "") {
      setResults((prev) => prev.map((r) => (r.slug === slug ? { ...r, fullLoadTimeMs: null } : r)))
      return
    }
    const num = parseFloat(value)
    if (Number.isNaN(num) || num < 0) return
    setResults((prev) =>
      prev.map((r) => (r.slug === slug ? { ...r, fullLoadTimeMs: Math.round(num * 1000) } : r))
    )
  }

  const handleSaveSpeed = async () => {
    setError(null)
    setSavingSpeed(true)
    try {
      const res = await fetch("/api/website-status/speed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: results.map((r) => ({
            slug: r.slug,
            speedSec: r.fullLoadTimeMs != null ? r.fullLoadTimeMs / 1000 : null
          }))
        })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ")
      setInitialSpeeds(
        Object.fromEntries(results.map((r) => [r.slug, r.fullLoadTimeMs ?? null]))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกความเร็วไม่สำเร็จ")
    } finally {
      setSavingSpeed(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoadingLatest(true)
    fetch("/api/website-status/latest")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.results?.length) {
          const list = data.results as WebsiteStatusRow[]
          setResults(list)
          setInitialSpeeds(
            Object.fromEntries(list.map((r) => [r.slug, r.fullLoadTimeMs ?? null]))
          )
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
    if (!isLocalhost) {
      const origin = typeof window !== "undefined" ? window.location.origin : ""
      const cmd = `SITE_URL=${origin} npm run check-website-status`
      try {
        await navigator.clipboard.writeText(cmd)
        setCopiedCommand(true)
        setTimeout(() => setCopiedCommand(false), 3000)
        localCommandRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      } catch {
        setError("คัดลอกคำสั่งไม่สำเร็จ")
      }
      return
    }
    setError(null)
    setChecking(true)
    try {
      const res = await fetch("/api/website-status/check", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "เช็คไม่สำเร็จ")
      }
      const list = data.results ?? []
      setResults(list)
      setInitialSpeeds(
        Object.fromEntries(list.map((r: WebsiteStatusRow) => [r.slug, r.fullLoadTimeMs ?? null]))
      )
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
    const cardEl = exportRef.current
    const hiddenElements = Array.from(cardEl.querySelectorAll<HTMLElement>('[data-export-hide="true"]'))
    const showElements = Array.from(cardEl.querySelectorAll<HTMLElement>('[data-export-show="true"]'))
    const overflowEls = Array.from(cardEl.querySelectorAll<HTMLElement>(".overflow-x-auto"))

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

      hiddenElements.forEach((el) => {
        el.dataset.previousDisplay = el.style.display
        el.style.display = "none"
      })
      showElements.forEach((el) => {
        el.dataset.previousDisplay = el.style.display
        el.style.display = "inline"
      })
      overflowEls.forEach((el) => {
        el.style.overflow = "visible"
        const table = el.querySelector<HTMLElement>("table")
        if (table) table.style.minWidth = "1000px"
      })
      cardEl.style.overflow = "visible"
      cardEl.style.width = "fit-content"
      cardEl.style.minWidth = "1050px"

      await new Promise<void>((r) => setTimeout(r, 80))

      const dataUrl = await toPng(cardEl, {
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
      cardEl.style.width = ""
      cardEl.style.minWidth = ""
      cardEl.style.overflow = ""
      overflowEls.forEach((el) => {
        el.style.overflow = ""
        const table = el.querySelector<HTMLElement>("table")
        if (table) table.style.minWidth = ""
      })
      hiddenElements.forEach((el) => {
        el.style.display = el.dataset.previousDisplay ?? ""
        delete el.dataset.previousDisplay
      })
      showElements.forEach((el) => {
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
      <div className={imageExportLayout ? "mx-auto w-fit min-w-[1050px]" : ""}>
      <Card ref={exportRef}>
        <CardHeader
          title={`สถานะเว็บไซต์ ${displayDate}`}
          subtitle={lastCheckedAt ? `เช็คล่าสุดเมื่อ ${displayDate}` : "กดปุ่มเช็คใหม่เพื่อตรวจสอบ"}
          action={
            <div className="flex flex-wrap items-center gap-2" data-export-hide="true">
              <div className="flex flex-wrap items-center gap-2">
                เช็คสถานะปุ่มแอดไลน์และปุ่มโทร
                <Button
                  onClick={handleCheck}
                  loading={checking}
                  disabled={checking}
                  className="cursor-pointer"
                  title={isLocalhost ? "รันบนเครื่องนี้" : "คัดลอกคำสั่งไปรันบนเครื่องตัวเอง"}
                >
                  {isLocalhost ? "เช็ค" : "เช็ค"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleSaveSpeed}
                  className="cursor-pointer"
                  loading={savingSpeed}
                  disabled={!hasSpeedChanges || savingSpeed || checking || results.length === 0}
                >
                  บันทึกความเร็ว
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleExportImage}
                  className="cursor-pointer"
                  loading={exportingImage}
                  disabled={checking || results.length === 0}
                >
                  บันทึกรูป
                </Button>
              </div>
            </div>
          }
        />
        <CardBody className="p-0">
          {error && (
            <div className="mx-5 mb-4 rounded-lg bg-red-900/20 p-4 text-red-300" data-export-hide="true">
              {error}
            </div>
          )}
          {!isLocalhost && (
            <div ref={localCommandRef} className="mx-5 mb-4 rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-200/90" data-export-hide="true">
              <p className="mb-2 font-medium">เช็คจะรันจากเครื่องคุณ — กดปุ่มด้านบนเพื่อคัดลอกคำสั่ง</p>
              <p className="mb-2 text-zinc-400">
                จากโฟลเดอร์โปรเจกต์ รันคำสั่งด้านล่างในเทอร์มินัล แล้วรีเฟรชหน้านี้เพื่อดูผล
              </p>
              {copiedCommand && (
                <p className="mb-2 text-emerald-400 text-xs">คัดลอกคำสั่งแล้ว — รันในเทอร์มินัลแล้วรีเฟรชหน้านี้</p>
              )}
              <code className="block overflow-x-auto rounded bg-zinc-900/80 px-3 py-2 text-xs">
                SITE_URL={typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app"}{" "}
                npm run check-website-status
              </code>
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
              ยังไม่มีข้อมูล — กดปุ่มเช็คเพื่อตรวจสอบปุ่มแอดไลน์/โทร แล้วกรอกความเร็วได้
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
              <table className={`w-full text-left text-sm ${imageExportLayout ? "min-w-[1000px]" : "min-w-[640px]"}`}>
                <thead>
                  <tr className="border-b border-zinc-700/80 bg-zinc-900/50">
                    <th className="px-5 py-3 font-medium text-zinc-300">เว็บไซต์</th>
                    <th className="px-5 py-3 font-medium text-zinc-300">ความเร็ว (วิ)</th>
                    <th className="px-5 py-3 font-medium text-zinc-300">สถานะปุ่ม แอดไลน์</th>
                    <th className="px-5 py-3 font-medium text-zinc-300">สถานะปุ่ม โทร</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
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
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          placeholder="วิ"
                          className="w-20 rounded border border-zinc-600 bg-zinc-800/80 px-2 py-1 text-sm text-zinc-200 placeholder:text-zinc-500"
                          data-export-hide="true"
                          value={row.fullLoadTimeMs != null ? row.fullLoadTimeMs / 1000 : ""}
                          onChange={(e) => handleSpeedChange(row.slug, e.target.value)}
                        />
                        {row.fullLoadTimeMs != null && (
                          <span
                            className={`ml-2 ${row.fullLoadTimeMs >= 1500 ? "text-amber-500" : "text-emerald-400"}`}
                            data-export-hide="true"
                          >
                            {row.fullLoadTimeMs >= 1500 ? "ช้า" : "ปกติ"}
                          </span>
                        )}
                        <span
                          className={`hidden ${row.fullLoadTimeMs != null ? (row.fullLoadTimeMs >= 1500 ? "text-amber-500" : "text-emerald-400") : "text-zinc-400"}`}
                          data-export-show="true"
                        >
                          {row.fullLoadTimeMs != null
                            ? `${(row.fullLoadTimeMs / 1000).toFixed(1)} วิ ${row.fullLoadTimeMs >= 1500 ? "ช้า" : "ปกติ"}`
                            : "—"}
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
                  ))}
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
