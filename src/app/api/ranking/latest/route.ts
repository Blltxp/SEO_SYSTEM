import { NextResponse } from "next/server"
import { getLatestRanks, getPreviousRanks } from "@/lib/ranking"

export async function GET() {
  const latest = getLatestRanks()
  const previous = getPreviousRanks(latest.recordedAt)
  return NextResponse.json({
    ...latest,
    previousRecordedAt: previous.recordedAt,
    previousRows: previous.rows
  })
}
