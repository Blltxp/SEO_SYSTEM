import { NextResponse } from "next/server"
import {
  detectTitleDuplicates,
  detectContentDuplicates,
  type DuplicateTitle,
  type ContentDuplicate
} from "@/lib/duplicate"

export type DuplicatesResponse = {
  titleDuplicates: DuplicateTitle[]
  contentDuplicates: ContentDuplicate[]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const daysParam = searchParams.get("days")
  const sinceDays =
    daysParam != null ? parseInt(daysParam, 10) : undefined
  const validDays =
    sinceDays != null && sinceDays > 0 && sinceDays <= 365 ? sinceDays : undefined

  const titleDuplicates = detectTitleDuplicates(validDays)
  const contentDuplicates = detectContentDuplicates(0.8, 500, validDays)
  const result: DuplicatesResponse = {
    titleDuplicates,
    contentDuplicates
  }
  return NextResponse.json(result)
}
