import { NextResponse } from "next/server"
import { getAvailableRecordedDates, getLatestRanks, getPreviousRanks, getRanksByRecordedAt } from "@/lib/ranking"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const viewRecordedAt = searchParams.get("recordedAt")?.trim() || ""
  const compareTo = searchParams.get("compareTo")?.trim() || ""
  const availableRecordedDates = await getAvailableRecordedDates()

  const latest = await getLatestRanks()
  const main =
    viewRecordedAt && availableRecordedDates.includes(viewRecordedAt)
      ? await getRanksByRecordedAt(viewRecordedAt)
      : latest

  const previous =
    compareTo && compareTo !== main.recordedAt
      ? await getRanksByRecordedAt(compareTo)
      : await getPreviousRanks(main.recordedAt)

  return NextResponse.json({
    ...main,
    previousRecordedAt: previous.recordedAt,
    previousRows: previous.rows,
    availableRecordedDates
  })
}
