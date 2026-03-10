import { ReactNode } from "react"

type BadgeProps = {
  children: ReactNode
  variant?: "success" | "warning" | "neutral" | "info"
  className?: string
}

const VARIANTS = {
  success: "bg-emerald-900/30 text-emerald-300 border border-emerald-500/20",
  warning: "bg-amber-400/10 text-amber-200 border border-amber-400/25",
  neutral: "bg-zinc-900/90 text-zinc-200 border border-zinc-700",
  info: "bg-sky-900/30 text-sky-300 border border-sky-500/20"
}

export function Badge({ children, variant = "neutral", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
