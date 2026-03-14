"use client"

import { useCallback, useEffect, useState } from "react"
import { PageLayout } from "../../../components/PageLayout"
import { Card, CardBody, CardHeader } from "../../../components/ui/Card"
import { Button } from "../../../components/ui/Button"
import Link from "next/link"
import { Trash2 } from "lucide-react"

type RecordedDateRow = { recorded_date: string; row_count: number }

function formatRecordedAt(value: string) {
  if (!value) return "-"
  const d = new Date(value.replace(" ", "T"))
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "full",
    timeStyle: "medium"
  }).format(d)
}

export default function RankingManagePage() {
  const [rows, setRows] = useState<RecordedDateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const fetchList = useCallback(async () => {
    const res = await fetch("/api/ranking/history")
    if (!res.ok) throw new Error("โหลดรายการไม่สำเร็จ")
    const data = await res.json()
    setRows(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchList()
      .catch((e) => setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด"))
      .finally(() => setLoading(false))
  }, [fetchList])

  const toggleSelect = (recordedDate: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(recordedDate)) next.delete(recordedDate)
      else next.add(recordedDate)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map((r) => r.recorded_date)))
  }

  const handleDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`ต้องการลบ ${selected.size} ชุดข้อมูล (จุดเวลา) ใช่หรือไม่?\n\nการลบจะดำเนินการทันทีและไม่สามารถกู้คืนได้`)) return

    setDeleting(true)
    setError(null)
    try {
      const res = await fetch("/api/ranking/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordedDates: Array.from(selected) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "ลบไม่สำเร็จ")
      setSelected(new Set())
      await fetchList()
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบข้อมูลไม่สำเร็จ")
    } finally {
      setDeleting(false)
    }
  }

  /** จัดกลุ่มตามวันที่ (YYYY-MM-DD) เพื่อดูว่าวันไหนมีหลายเวลา */
  const byDate = rows.reduce<Record<string, RecordedDateRow[]>>((acc, row) => {
    const datePart = row.recorded_date.slice(0, 10)
    if (!acc[datePart]) acc[datePart] = []
    acc[datePart].push(row)
    return acc
  }, {})

  return (
    <PageLayout
      title="จัดการข้อมูล Ranking"
      description="ลบข้อมูลซ้ำซ้อน — บางวันมีหลายจุดเวลา (หลายครั้งต่อวัน) สามารถเลือกลบได้"
      maxWidth="xl"
      titleAlign="center"
    >
      <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/ranking/graph"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-amber-500/40 hover:text-amber-100"
        >
          ← แดชบอร์ด
        </Link>
        <Link
          href="/ranking"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-amber-500/40 hover:text-amber-100"
        >
          ตาราง Ranking →
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/20 p-4 text-red-300">{error}</div>
      )}

      <Card>
        <CardHeader
          title="รายการ recorded_date"
          subtitle="เลือกข้อมูลที่ต้องการลบ (มักเป็นจุดเวลาที่ซ้ำในวันเดียวกัน) แล้วกดปุ่มลบ"
          align="left"
        />
        <CardBody>
          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center gap-2 text-zinc-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
              กำลังโหลด…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-zinc-500">ยังไม่มีข้อมูล rank_history</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Button
                  className="cursor-pointer"
                  variant="secondary"
                  onClick={handleDelete}
                  disabled={selected.size === 0 || deleting}
                  loading={deleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  ลบที่เลือก ({selected.size} ชุด)
                </Button>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-sm text-amber-400 hover:text-amber-200 cursor-pointer"
                >
                  {selected.size === rows.length ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมด"}
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-zinc-700/80">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-900/95">
                    <tr className="border-b border-zinc-700">
                      <th className="w-12 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.size === rows.length && rows.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-zinc-600"
                        />
                      </th>
                      <th className="px-3 py-2.5 font-medium text-amber-100">วัน/เวลา</th>
                      <th className="px-3 py-2.5 font-medium text-amber-100">จำนวน row</th>
                      <th className="px-3 py-2.5 font-medium text-zinc-400">วันที่ (จัดกลุ่ม)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const datePart = row.recorded_date.slice(0, 10)
                      const sameDayCount = byDate[datePart]?.length ?? 0
                      const isDuplicate = sameDayCount > 1
                      return (
                        <tr
                          key={row.recorded_date}
                          className={`border-b border-zinc-800/80 ${
                            isDuplicate ? "bg-amber-500/5" : ""
                          }`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selected.has(row.recorded_date)}
                              onChange={() => toggleSelect(row.recorded_date)}
                              className="rounded border-zinc-600"
                            />
                          </td>
                          <td className="px-3 py-2 font-medium text-zinc-200">
                            {formatRecordedAt(row.recorded_date)}
                          </td>
                          <td className="px-3 py-2 text-zinc-400">{row.row_count} แถว</td>
                          <td className="px-3 py-2 text-zinc-500">
                            {isDuplicate ? (
                              <span className="text-amber-400">
                                วันนี้มี {sameDayCount} จุดเวลา (ซ้ำ)
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-xs text-zinc-500">
                แถวที่มีพื้นหลังเหลือง = วันนั้นมีหลายจุดเวลา (ถือว่าซ้ำซ้อน) — เลือกลบได้ตามต้องการ
              </p>
            </>
          )}
        </CardBody>
      </Card>
    </PageLayout>
  )
}
