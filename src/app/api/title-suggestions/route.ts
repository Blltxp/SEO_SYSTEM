import { NextResponse } from "next/server"
import { getTitleSuggestions } from "@/lib/titleSuggestions"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get("keyword") ?? undefined
  const excludeExisting = searchParams.get("excludeExisting") === "1"
  const site = searchParams.get("site")?.trim() || undefined

  const suggestions = getTitleSuggestions({
    keyword,
    excludeExisting,
    site
  })
  return NextResponse.json(suggestions)
}
