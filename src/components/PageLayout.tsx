import { ReactNode } from "react"

type PageLayoutProps = {
  title: string
  description?: string
  children: ReactNode
  maxWidth?: "md" | "lg" | "xl" | "full"
}

const MAX = { md: "max-w-3xl", lg: "max-w-4xl", xl: "max-w-6xl", full: "max-w-full" }

export function PageLayout({
  title,
  description,
  children,
  maxWidth = "xl"
}: PageLayoutProps) {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-transparent">
      <div className={`mx-auto ${MAX[maxWidth]} px-4 py-8 sm:px-6 sm:py-10`}>
        <h1 className="text-2xl font-semibold tracking-tight text-amber-50 sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-3xl text-zinc-400">{description}</p>
        )}
        <div className="mt-8">{children}</div>
      </div>
    </div>
  )
}
