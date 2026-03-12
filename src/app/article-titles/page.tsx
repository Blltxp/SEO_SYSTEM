"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PageLayout } from "../../components/PageLayout"
import { Card, CardBody, CardHeader } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"

type Suggestion = {
  keyword: string
  title: string
  alreadyUsed: boolean
}

type Site = { id: number; slug: string; name: string }

type WeakKeywordRecommendation = {
  keyword: string
  currentRank: number | null
  droppedInfo?: {
    previousRank: number
    currentRank: number
    previousPage: number
    currentPage: number
    droppedPages: number
  }
}

type SiteRecommendationSummary = {
  site_slug: string
  weakKeywords: WeakKeywordRecommendation[]
  suggestedArticles: { title: string; focusKeyword: string }[]
}

const SITE_META: Record<string, { label: string; group: "groupA" | "groupB" }> = {
  maidwonderland: { label: "แม่บ้านดีดี", group: "groupA" },
  ddmaidservice: { label: "แม่บ้านดีดีเซอร์วิส", group: "groupA" },
  ddmaid: { label: "แม่บ้านอินเตอร์", group: "groupA" },
  nasaladphrao48: { label: "นาซ่าลาดพร้าว", group: "groupB" },
  maidsiam: { label: "แม่บ้านสยาม", group: "groupB" },
  suksawatmaid: { label: "แม่บ้านสุขสวัสดิ์", group: "groupB" }
}

const RECOMMENDATION_GROUPS = [
  { value: "all", label: "ทั้งหมด 6 เว็บ" },
  { value: "groupA", label: "1. แม่บ้านดีดี · แม่บ้านดีดีเซอร์วิส · แม่บ้านอินเตอร์" },
  { value: "groupB", label: "2. นาซ่าลาดพร้าว · แม่บ้านสยาม · แม่บ้านสุขสวัสดิ์" }
] as const

type RecommendationGroup = (typeof RECOMMENDATION_GROUPS)[number]["value"]

export default function ArticleTitlesPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterKeyword, setFilterKeyword] = useState("")
  const [filterSite, setFilterSite] = useState("")
  const [excludeExisting, setExcludeExisting] = useState(true)
  const [notOnPage1List, setNotOnPage1List] = useState<SiteRecommendationSummary[]>([])
  const [loadingDropped, setLoadingDropped] = useState(true)
  const [recommendationGroup, setRecommendationGroup] = useState<RecommendationGroup>("all")
  const [copiedKey, setCopiedKey] = useState("")

  useEffect(() => {
    setLoadingDropped(true)
    fetch("/api/recommend-titles-dropped-rank?rankThreshold=20")
      .then((res) => (res.ok ? res.json() : []))
      .then(setNotOnPage1List)
      .catch(() => setNotOnPage1List([]))
      .finally(() => setLoadingDropped(false))
  }, [])

  useEffect(() => {
    const kwUrl = filterSite ? `/api/keywords?site=${encodeURIComponent(filterSite)}` : "/api/keywords"
    fetch(kwUrl)
      .then((res) => res.ok ? res.json() : [])
      .then(setKeywords)
      .catch(() => setKeywords([]))
    fetch("/api/sites")
      .then((res) => res.ok ? res.json() : [])
      .then(setSites)
      .catch(() => setSites([]))
  }, [filterSite])

  useEffect(() => {
    if (filterKeyword && !keywords.includes(filterKeyword)) {
      setFilterKeyword("")
    }
  }, [filterKeyword, keywords])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterKeyword) params.set("keyword", filterKeyword)
    if (excludeExisting) params.set("excludeExisting", "1")
    if (filterSite) params.set("site", filterSite)
    fetch(`/api/title-suggestions?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("โหลดไม่สำเร็จ")
        return res.json()
      })
      .then((data) => setSuggestions(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filterKeyword, filterSite, excludeExisting])

  const suggestionsList = Array.isArray(suggestions) ? suggestions : []
  const byKeyword = (filterKeyword
    ? [filterKeyword]
    : keywords
  ).map((kw) => ({
    keyword: kw,
    items: suggestionsList.filter((s) => s.keyword === kw)
  })).filter((g) => g.items.length > 0)

  const visibleRecommendations = notOnPage1List.filter((item) => {
    if (recommendationGroup === "all") return true
    return SITE_META[item.site_slug]?.group === recommendationGroup
  })

  const siteLabel = (slug: string) => SITE_META[slug]?.label || slug
  const weakKeywordLabel = (item: WeakKeywordRecommendation) => {
    if (item.currentRank == null) return "ไม่พบ"
    return `#${item.currentRank}`
  }
  const buildRecommendationCopyText = (item: SiteRecommendationSummary) => {
    const articleSection = item.suggestedArticles
      .slice(0, 4)
      .map((article, index) => `${index + 1}. ${article.title} [${article.focusKeyword}]`)
      .join("\n")

    return [
      `${siteLabel(item.site_slug)}`,
      articleSection || "- ไม่มีหัวข้อแนะนำ"
    ].join("\n")
  }
  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((current) => (current === key ? "" : current)), 2000)
    } catch {
      setError("คัดลอกไม่สำเร็จ")
    }
  }
  const siteGroupLabel = recommendationGroup === "all"
    ? "ทุกเว็บ"
    : RECOMMENDATION_GROUPS.find((g) => g.value === recommendationGroup)?.label || "ทุกเว็บ"

  return (
    <PageLayout
      title="หัวข้อบทความแนะนำ (SEO)"
      description="สรุปเป็นรายเว็บ โดยหยิบ keyword ที่อันดับยังไม่ดีของแต่ละเว็บ แล้วคัด 4 บทความแนะนำให้อ่านง่ายขึ้น"
      maxWidth="xl"
    >
      <Card className="mb-8 border-amber-500/30 bg-gradient-to-br from-[#1c1710] to-[#0c0c0c]">
        <CardHeader
          title="แนะนำหัวข้อ 4 บทความต่อเว็บ"
          subtitle={`กำลังแสดง: ${siteGroupLabel} · ใช้ keyword ที่เกิน Top 20 หรือยังไม่พบ มาเป็นฐานในการคัดหัวข้อ`}
        />
        <CardBody>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {RECOMMENDATION_GROUPS.map((group) => {
              const active = recommendationGroup === group.value
              return (
                <button
                  key={group.value}
                  type="button"
                  onClick={() => setRecommendationGroup(group.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    active
                      ? "border-amber-400 bg-amber-400/15 text-amber-200 shadow-[0_0_0_1px_rgba(251,191,36,0.18)]"
                      : "border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:border-amber-500/40 hover:text-amber-200"
                  }`}
                >
                  {group.label}
                </button>
              )
            })}
            {visibleRecommendations.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  copyText(
                    visibleRecommendations.map((item) => buildRecommendationCopyText(item)).join("\n\n--------------------\n\n"),
                    "all"
                  )
                }
              >
                {copiedKey === "all" ? "คัดลอกแล้ว" : "คัดลอกทั้งหมด"}
              </Button>
            )}
          </div>

          {loadingDropped ? (
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" />
              กำลังโหลด…
            </div>
          ) : visibleRecommendations.length === 0 ? (
            <p className="text-sm text-zinc-400">
              ตอนนี้ในกลุ่มนี้ยังไม่มีเว็บที่มี keyword เกิน Top 20 หรือยังไม่พบ
            </p>
          ) : (
            <ul className="space-y-4">
              {visibleRecommendations.map((d) => (
                <li
                  key={d.site_slug}
                  className="rounded-xl border border-amber-500/20 bg-black/40 p-4 shadow-[0_0_0_1px_rgba(251,191,36,0.06)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-amber-100">
                        {siteLabel(d.site_slug)}
                      </span>
                      <Badge variant="neutral" className="border border-amber-500/25 bg-amber-500/10 text-amber-200">
                        keyword อ่อน {d.weakKeywords.length} คำ
                      </Badge>
                    </div>
                    <span className="text-xs text-zinc-500">
                      คัดให้ {Math.min(4, d.suggestedArticles.length)} บทความ
                    </span>
                  </div>
                  <div className="mt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => copyText(buildRecommendationCopyText(d), d.site_slug)}
                    >
                      {copiedKey === d.site_slug ? "คัดลอกแล้ว" : "คัดลอกหัวข้อ + keyword"}
                    </Button>
                  </div>

                  <div className="mt-3">
                    <p className="text-sm font-medium text-amber-100">keyword ที่อันดับยังไม่ดี</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {d.weakKeywords.slice(0, 8).map((item) => (
                        <span
                          key={`${d.site_slug}-${item.keyword}`}
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-xs text-zinc-200"
                          title={item.droppedInfo ? `เคยอยู่หน้า ${item.droppedInfo.previousPage} แล้วหล่นมา ${item.droppedInfo.droppedPages} หน้า` : undefined}
                        >
                          <span>{item.keyword}</span>
                          <span className="text-amber-300">{weakKeywordLabel(item)}</span>
                          {item.droppedInfo && <span className="text-red-300">หล่น {item.droppedInfo.droppedPages} หน้า</span>}
                        </span>
                      ))}
                      {d.weakKeywords.length > 8 && (
                        <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-xs text-zinc-400">
                          +{d.weakKeywords.length - 8} keyword
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-medium text-amber-100">4 บทความที่ควรทำก่อน</p>
                    <ul className="mt-2 grid gap-2 md:grid-cols-2">
                      {d.suggestedArticles.slice(0, 4).map((article, i) => (
                        <li
                          key={`${article.title}-${i}`}
                          className="rounded-lg border border-amber-500/15 bg-zinc-950/70 px-3 py-2"
                        >
                          <div className="mb-1 flex items-center gap-2 text-xs">
                            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-200">
                              โฟกัส: {article.focusKeyword}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-100">{article.title}</p>
                        </li>
                      ))}
                    </ul>
                    {d.suggestedArticles.length === 0 && (
                      <p className="mt-2 text-sm text-zinc-500">ตอนนี้ไม่มีหัวข้อใหม่ที่ยังไม่ซ้ำในระบบสำหรับเว็บนี้</p>
                    )}
                    <p className="mt-3 text-xs text-zinc-500">
                      หมายเหตุ: 4 หัวข้อนี้คัดจากหลาย keyword ที่อันดับอ่อนของเว็บเดียวกัน ไม่จำเป็นต้องยึดแค่ keyword เดียว
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader
          title="คลังหัวข้อค้นเองเพิ่มเติม"
          subtitle="ส่วนนี้ไว้เปิดดูหัวข้อทั้งหมดเพิ่มเองภายหลัง แยกจาก 4 บทความแนะนำหลักด้านบน"
        />
        <CardBody>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">แสดงสำหรับเว็บ:</span>
          <select
            value={filterSite}
            onChange={(e) => setFilterSite(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          >
              <option value="">ทั้งหมด</option>
              {sites.map((s) => (
                <option key={s.id} value={s.slug}>{siteLabel(s.slug)}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">กรอง keyword:</span>
            <select
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
            <option value="">ทั้งหมด ({keywords.length} คำ)</option>
              {keywords.map((kw) => (
                <option key={kw} value={kw}>{kw}</option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={excludeExisting}
              onChange={(e) => setExcludeExisting(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {filterSite ? "ซ่อนหัวข้อที่มีในเว็บนี้แล้ว" : "ซ่อนหัวข้อที่มีในระบบแล้ว"}
            </span>
            </label>
          </div>
        </CardBody>
      </Card>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</p>
      )}
      {loading ? (
          <div className="flex items-center gap-2 text-zinc-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
            กำลังโหลด…
          </div>
        ) : suggestions.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-6 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
            {excludeExisting
              ? "ไม่มีหัวข้อเหลือ (หรือลองปิดตัวเลือก “ซ่อนหัวข้อที่มีในระบบแล้ว”)"
              : "ไม่มีข้อมูล"}
          </p>
        ) : (
          <ul className="space-y-8">
            {byKeyword.map(({ keyword, items }) => (
              <li key={keyword}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">{keyword}</h2>
                  <Badge variant="neutral">{items.length} หัวข้อ</Badge>
                </div>
                <ul className="space-y-2">
                  {items.map((s, i) => (
                    <li
                      key={`${s.title}-${i}`}
                      className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      <span className="text-zinc-900 dark:text-zinc-100">{s.title}</span>
                      {s.alreadyUsed && (
                        <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                          (มีในระบบแล้ว)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
    </PageLayout>
  )
}
