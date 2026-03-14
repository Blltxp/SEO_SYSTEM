import { NextResponse } from "next/server"
import { getVisitorStatsByDate, getAvailableVisitorDates } from "@/lib/visitorStatsDb"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")?.trim() || ""

  const availableDates = await getAvailableVisitorDates()

  if (!date) {
    return NextResponse.json({ date: "", rows: [], availableDates })
  }

  const { date: recordedDate, rows } = await getVisitorStatsByDate(date)
  return NextResponse.json({ date: recordedDate, rows, availableDates })
}
