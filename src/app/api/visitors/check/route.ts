import { NextResponse } from "next/server"
import { runVisitorCheck } from "@/lib/visitorStats"
import {
  getTodayRecordedDate,
  saveMorningRound,
  saveEveningRound
} from "@/lib/visitorStatsDb"

export const maxDuration = 120

export async function POST(request: Request) {
  let body: { round?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "ส่ง body เป็น JSON ไม่ได้" },
      { status: 400 }
    )
  }

  const round = body?.round === "evening" ? "evening" : "morning"
  const recordedDate = getTodayRecordedDate()

  const { ok, results, error } = await runVisitorCheck(round)

  if (!ok || !results.length) {
    return NextResponse.json(
      { ok: false, error: error || "ดึงสถิติจากเว็บไม่สำเร็จ" },
      { status: 500 }
    )
  }

  const count =
    round === "morning"
      ? await saveMorningRound(recordedDate, results)
      : await saveEveningRound(recordedDate, results)

  return NextResponse.json({
    ok: true,
    round,
    recordedDate,
    count
  })
}
