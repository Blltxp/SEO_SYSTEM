import { NextResponse } from "next/server"
import { syncPostsFromWordPress } from "@/lib/syncPosts"

export const maxDuration = 300

/** ดึงโพสต์จาก WordPress ทุกเว็บเข้า DB (เดียวกับ npm run scan) */
export async function POST() {
  try {
    await syncPostsFromWordPress({ context: "api" })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[api/posts/sync]", e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "ซิงค์ไม่สำเร็จ" },
      { status: 500 }
    )
  }
}
