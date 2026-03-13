import { NextResponse } from "next/server"
import { checkTitleSimilarity } from "@/lib/titleCheck"

/** GET ?title=... — ตรวจสอบความคล้ายหัวข้อกับที่มีใน 6 เว็บ (≥60% = มีแล้ว) */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const title = searchParams.get("title")?.trim() ?? ""
    const res = await checkTitleSimilarity(title, 60)
    return NextResponse.json(res)
  } catch (e) {
    console.error("[title-check] error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ตรวจสอบไม่สำเร็จ", matches: [], hasSimilar: false },
      { status: 500 }
    )
  }
}
