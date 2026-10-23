import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const TONES = {
  cyan: { border: "border-brand-cyan/30", glow: "rgba(34,211,238,0.5)" },
  green: { border: "border-status-success/30", glow: "rgba(34,197,94,0.45)" },
  amber: { border: "border-status-warning/30", glow: "rgba(245,158,11,0.5)" },
  red: { border: "border-status-error/30", glow: "rgba(239,68,68,0.5)" },
  violet: { border: "border-foreground/15", glow: "rgba(139,92,246,0.5)" },
} as const

export type GlowTone = keyof typeof TONES

/** A glass card with a colored corner glow — the standing card style (every
 * card should carry a gradient/glow, not flat glass alone). `pulse` adds the
 * slow breathing animation; leave it off for rows/lists with many cards. */
export function GlowCard({
  tone = "cyan",
  pulse = false,
  className,
  children,
}: {
  tone?: GlowTone
  pulse?: boolean
  className?: string
  children: ReactNode
}) {
  const t = TONES[tone]
  return (
    <div className={cn("glass-card relative overflow-hidden", t.border, className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 size-40 rounded-full blur-3xl"
        style={{
          backgroundColor: t.glow,
          opacity: 0.55,
          animation: pulse ? "glow-pulse 5s ease-in-out infinite" : undefined,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}
