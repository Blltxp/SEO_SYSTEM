import { ReactNode } from "react"

export function Card({
  children,
  className = ""
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-amber-500/15 bg-zinc-950/85 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-amber-500/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-semibold text-amber-100">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>
        )}
      </div>
      {action && <div className="mt-2 sm:mt-0">{action}</div>}
    </div>
  )
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>
}
