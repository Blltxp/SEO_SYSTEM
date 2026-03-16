import { NextResponse } from "next/server"
import { updateWebsiteStatusSpeed } from "@/lib/websiteStatusDb"

/** บันทึกความเร็วที่กรอกเอง (หน่วยเป็นวินาที) */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const updates = body?.updates as { slug: string; speedSec: number | null }[]
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { ok: false, error: "ต้องส่ง updates เป็น array ของ { slug, speedSec }" },
        { status: 400 }
      )
    }
    const normalized = updates.map((u) => ({
      slug: String(u.slug ?? ""),
      speedSec: typeof u.speedSec === "number" ? u.speedSec : null
    }))
    await updateWebsiteStatusSpeed(normalized)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : "บันทึกความเร็วไม่สำเร็จ"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
