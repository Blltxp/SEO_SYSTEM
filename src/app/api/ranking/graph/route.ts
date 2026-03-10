import { NextResponse } from "next/server"
import { getRankHistoryForGraph } from "@/lib/ranking"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get("keyword")
  const fromDate = searchParams.get("fromDate")
  const toDate = searchParams.get("toDate")
  if (!keyword || !fromDate || !toDate) {
    return NextResponse.json(
      { error: "ต้องการ keyword, fromDate, toDate (YYYY-MM-DD)" },
      { status: 400 }
    )
  }
  const rows = getRankHistoryForGraph(keyword, fromDate, toDate)
  return NextResponse.json(rows)
}
