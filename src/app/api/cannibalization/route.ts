import { NextResponse } from "next/server"
import { detectKeywordCannibalization } from "@/lib/keyword"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const daysParam = searchParams.get("days")
  const sinceDays =
    daysParam != null ? parseInt(daysParam, 10) : undefined
  const validDays =
    sinceDays != null && sinceDays > 0 && sinceDays <= 365 ? sinceDays : undefined

  const result = await detectKeywordCannibalization(validDays)
  return NextResponse.json(result)
}
