import { NextResponse } from "next/server"
import { runRankCheck } from "@/lib/ranking"
import { createGoogleRankSession, GoogleChallengeError, waitForGoogleChallengeResolved } from "@/lib/googleRank"

export const maxDuration = 900

export async function POST() {
  const interactiveLocalMode = process.env.NODE_ENV !== "production"
  const session = interactiveLocalMode
    ? await createGoogleRankSession({
        headless: false,
        channel: "chrome",
        maxPages: 2,
        onChallenge: async ({ keyword, variant, pageNumber, page }) => {
          console.log(
            `[Ranking] Google challenge: keyword="${keyword}" variant=${variant} page=${pageNumber}. Waiting for user to solve it in Chrome...`
          )
          await page.bringToFront().catch(() => {})
          await waitForGoogleChallengeResolved(page)
        }
      })
    : null

  try {
    const { recordedAt, counts } = await runRankCheck({
      delayBetweenKeywordsMs: 2000,
      checkKeywordRankFn: session?.checkKeywordRank
    })
    return NextResponse.json({
      ok: true,
      recordedAt,
      counts
    })
  } catch (e) {
    console.error(e)
    if (e instanceof GoogleChallengeError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            interactiveLocalMode
              ? "Google ส่งหน้า challenge/captcha กลับมา ระบบเปิด Chrome ให้แล้ว แต่ยังไม่ผ่านภายในเวลาที่กำหนด จึงไม่อัปเดตข้อมูลเพื่อป้องกันการเขียนทับอันดับเดิม"
              : "Google ส่งหน้า challenge/captcha กลับมา รอบนี้จึงไม่อัปเดตข้อมูลเพื่อป้องกันการเขียนทับอันดับเดิม"
        },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    )
  } finally {
    await session?.close()
  }
}
