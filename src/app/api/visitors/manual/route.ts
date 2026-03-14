import { NextResponse } from "next/server"
import { getTodayRecordedDate, saveManualVisitorEntries } from "@/lib/visitorStatsDb"

export async function POST(request: Request) {
  let body: { recordedDate?: string; entries?: { site_slug: string; total_visitors?: number | null; morning_round?: number | null; evening_round?: number | null }[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "ส่ง body เป็น JSON ไม่ได้" },
      { status: 400 }
    )
  }

  const recordedDate = (body?.recordedDate?.trim() || getTodayRecordedDate()) as string
  const entries = Array.isArray(body?.entries) ? body.entries : []

  const filtered = entries.filter(
    (e) => e?.site_slug?.trim() && (e.total_visitors != null || e.morning_round != null || e.evening_round != null)
  )
  if (filtered.length === 0) {
    return NextResponse.json(
      { ok: false, error: "ไม่มีรายการที่กรอก" },
      { status: 400 }
    )
  }

  const count = await saveManualVisitorEntries(recordedDate, filtered)
  return NextResponse.json({ ok: true, recordedDate, count })
}
