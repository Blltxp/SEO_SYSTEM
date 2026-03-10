import { NextResponse } from "next/server"
import { getSites } from "@/lib/titleSuggestions"

export async function GET() {
  const sites = getSites()
  return NextResponse.json(sites)
}
