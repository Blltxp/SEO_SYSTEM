import { NextResponse } from "next/server"
import { getTitleRecommendationsForRankGaps } from "@/lib/rankDrop"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const threshold = Math.min(
    10,
    Math.max(1, parseInt(searchParams.get("threshold") || "2", 10) || 2)
  )
  const rankThreshold = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("rankThreshold") || "20", 10) || 20)
  )
  const list = getTitleRecommendationsForRankGaps(rankThreshold, threshold)
  return NextResponse.json(list)
}
