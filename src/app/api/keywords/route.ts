import { NextResponse } from "next/server"
import { getKeywords } from "@/lib/titleSuggestions"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const site = searchParams.get("site")?.trim() || undefined
  const keywords = getKeywords(site)
  return NextResponse.json(keywords)
}
