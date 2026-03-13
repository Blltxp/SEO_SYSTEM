import { NextResponse } from "next/server"
import { runRankCheck } from "@/lib/ranking"

export const maxDuration = 300 // Vercel Hobby: max 300

export async function POST() {
  const interactiveLocalMode = process.env.NODE_ENV !== "production"
  const isVercel = process.env.VERCEL === "1"

  // บน Vercel: ใช้ CSE เท่านั้น — ไม่โหลด googleRank (ซึ่งมี Puppeteer/Chrome)
  if (isVercel || !interactiveLocalMode) {
    const { checkKeywordRankViaAPI, isGoogleCseConfigured, GoogleRankFetchError } = await import(
      "@/lib/googleRankCse"
    )
    if (!isGoogleCseConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "บน Vercel ต้องตั้ง GOOGLE_CSE_API_KEY และ GOOGLE_CSE_CX ใน Environment Variables — ไปที่ Vercel Dashboard → Settings → Environment Variables"
        },
        { status: 503 }
      )
    }
    try {
      const { recordedAt, counts } = await runRankCheck({
        delayBetweenKeywordsMs: 4000,
        checkKeywordRankFn: checkKeywordRankViaAPI
      })
      return NextResponse.json({ ok: true, recordedAt, counts })
    } catch (e) {
      console.error(e)
      if (e instanceof GoogleRankFetchError) {
        return NextResponse.json(
          { ok: false, error: "Google ส่งผลลัพธ์กลับมาไม่สมบูรณ์หรืออ่านอันดับไม่ได้" },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
        { status: 500 }
      )
    }
  }

  // Local only: ใช้ Puppeteer (โหลด googleRank เฉพาะเมื่อรันจากเครื่องตัวเอง)
  const {
    createGoogleRankSession,
    GoogleChallengeError,
    GoogleRankFetchError,
    waitForGoogleChallengeResolved
  } = await import("@/lib/googleRank")

  const session = await createGoogleRankSession({
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

  try {
    const { recordedAt, counts } = await runRankCheck({
      delayBetweenKeywordsMs: 4000,
      checkKeywordRankFn: session.checkKeywordRank
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
    if (e instanceof GoogleRankFetchError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Google ส่งผลลัพธ์กลับมาไม่สมบูรณ์หรืออ่านอันดับไม่ได้ รอบนี้จึงไม่อัปเดตข้อมูลเพื่อป้องกันการเขียนทับอันดับเดิม"
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
