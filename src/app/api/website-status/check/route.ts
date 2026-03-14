import { NextResponse } from "next/server"
import { runWebsiteStatusCheck } from "@/lib/websiteStatus"
import { saveWebsiteStatus } from "@/lib/websiteStatusDb"

export const maxDuration = 120

export async function POST() {
  const { ok, results, error } = await runWebsiteStatusCheck()

  if (!ok) {
    return NextResponse.json(
      { ok: false, error: error || "เช็คสถานะเว็บไม่สำเร็จ" },
      { status: 500 }
    )
  }

  const checkedAt = await saveWebsiteStatus(results)
  return NextResponse.json({ ok: true, results, checkedAt })
}
