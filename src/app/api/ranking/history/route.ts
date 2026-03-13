import { NextResponse } from "next/server"
import { getRecordedDatesWithCounts, deleteRankHistoryByRecordedDates } from "@/lib/ranking"

/** GET: รายการ recorded_date พร้อมจำนวน row */
export async function GET() {
  try {
    const limit = 300
    const rows = await getRecordedDatesWithCounts(limit)
    return NextResponse.json(rows)
  } catch (e) {
    console.error("[ranking/history] GET error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ" },
      { status: 500 }
    )
  }
}

/** DELETE: ลบ rank_history ตาม recorded_date ที่ส่งมา (body: { recordedDates: string[] }) */
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const recordedDates = Array.isArray(body?.recordedDates) ? body.recordedDates : []
    const deleted = await deleteRankHistoryByRecordedDates(recordedDates)
    return NextResponse.json({ ok: true, deleted })
  } catch (e) {
    console.error("[ranking/history] DELETE error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ลบข้อมูลไม่สำเร็จ" },
      { status: 500 }
    )
  }
}
