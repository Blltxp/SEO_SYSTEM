import { NextResponse } from "next/server"
import { getLatestWebsiteStatus } from "@/lib/websiteStatusDb"

export async function GET() {
  const { results, checkedAt } = await getLatestWebsiteStatus()
  return NextResponse.json({ results, checkedAt })
}
