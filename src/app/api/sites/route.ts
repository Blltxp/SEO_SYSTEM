import { NextResponse } from "next/server"
import { getSites } from "@/lib/titleSuggestions"

export async function GET() {
  const sites = await getSites()
  return NextResponse.json(sites)
}
