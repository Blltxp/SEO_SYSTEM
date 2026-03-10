import { NextRequest, NextResponse } from "next/server"
import { getLatestRecordedAt, saveManualRankEntries } from "@/lib/ranking"

type RequestBody = {
  recordedAt?: string
  entries?: Array<{
    site_slug?: string
    keyword?: string
    input?: string
  }>
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as RequestBody | null
  const entries = (body?.entries ?? [])
    .map((entry) => ({
      site_slug: entry.site_slug?.trim() ?? "",
      keyword: entry.keyword?.trim() ?? "",
      input: entry.input?.trim() ?? ""
    }))
    .filter((entry) => entry.site_slug && entry.keyword && entry.input)

  if (entries.length === 0) {
    return NextResponse.json({ ok: false, error: "ยังไม่มีข้อมูลแมนนวลให้บันทึก" }, { status: 400 })
  }

  try {
    const recordedAt = body?.recordedAt?.trim() || getLatestRecordedAt()
    const rows = saveManualRankEntries(recordedAt, entries)
    return NextResponse.json({
      ok: true,
      recordedAt,
      updated: rows.length
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    )
  }
}
