import { NextResponse } from "next/server"
import { saveWebsiteStatus } from "@/lib/websiteStatusDb"
import type { WebsiteStatusResult } from "@/lib/websiteStatus"

/** รับผลเช็คสถานะจากสคริปต์ที่รันบนเครื่อง (POST จาก checkWebsiteStatusLocal.ts) */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const results = body?.results as unknown
    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { ok: false, error: "ต้องส่ง results เป็น array ของผลเช็คแต่ละเว็บ" },
        { status: 400 }
      )
    }
    const normalized: WebsiteStatusResult[] = results.map((r: Record<string, unknown>) => ({
      slug: String(r.slug ?? ""),
      name: typeof r.name === "string" ? r.name : "",
      url: String(r.url ?? ""),
      loadTimeMs: typeof r.loadTimeMs === "number" ? r.loadTimeMs : null,
      loadStatus: String(r.loadStatus ?? "ล้มเหลว"),
      fullLoadTimeMs: typeof r.fullLoadTimeMs === "number" ? r.fullLoadTimeMs : null,
      fullLoadStatus: String(r.fullLoadStatus ?? "ล้มเหลว"),
      lineOk: Boolean(r.lineOk),
      phoneOk: Boolean(r.phoneOk),
      lineReason: r.lineReason != null ? String(r.lineReason) : undefined,
      phoneReason: r.phoneReason != null ? String(r.phoneReason) : undefined,
      error: r.error != null ? String(r.error) : undefined
    }))
    const checkedAt = await saveWebsiteStatus(normalized)
    return NextResponse.json({ ok: true, checkedAt, results: normalized })
  } catch (e) {
    const message = e instanceof Error ? e.message : "บันทึกผลไม่สำเร็จ"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
