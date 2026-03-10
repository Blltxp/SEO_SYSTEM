import { ButtonHTMLAttributes, ReactNode } from "react"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md"
  children: ReactNode
  loading?: boolean
}

const VARIANTS = {
  primary:
    "border border-amber-400/50 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25",
  secondary:
    "border border-zinc-700 bg-zinc-900/80 text-zinc-200 hover:border-amber-500/40 hover:bg-zinc-900 hover:text-amber-100",
  ghost:
    "text-zinc-300 hover:bg-zinc-900 hover:text-amber-100",
  danger:
    "bg-red-700/90 text-white hover:bg-red-700"
}

const SIZES = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm"
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  loading,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          กำลังดำเนินการ…
        </>
      ) : (
        children
      )}
    </button>
  )
}
