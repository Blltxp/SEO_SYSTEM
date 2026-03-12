import { ComponentPropsWithoutRef, forwardRef, ReactNode } from "react"

export const Card = forwardRef<
  HTMLDivElement,
  { children: ReactNode; className?: string } & Omit<ComponentPropsWithoutRef<"div">, "children">
>(function Card({ children, className = "", ...props }, ref) {
  return (
    <div
      ref={ref}
      className={`rounded-2xl border border-amber-500/15 bg-zinc-950/85 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur ${className}`}
      {...props}
    >
      {children}
    </div>
  )
})

export function CardHeader({
  title,
  subtitle,
  action,
  align = "left"
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  align?: "left" | "center"
}) {
  return (
    <div className={`flex flex-col gap-1 border-b border-amber-500/10 px-5 py-4 ${align === "center" ? "items-center text-center" : "sm:flex-row sm:items-center sm:justify-between"}`}>
      <div className={align === "center" ? "text-center" : ""}>
        <h2 className="font-semibold text-amber-100">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>
        )}
      </div>
      {action && <div className={align === "center" ? "mt-2" : "mt-2 sm:mt-0"}>{action}</div>}
    </div>
  )
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>
}
