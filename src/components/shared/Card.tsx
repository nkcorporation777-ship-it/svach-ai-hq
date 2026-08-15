import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The one glassmorphism recipe (DESIGN_SYSTEM.md "Surfaces") — every card, panel,
 * and modal in HQ uses this exact recipe. Formalizes the `.glass-card` utility
 * class (used ad hoc in earlier placeholders) into a real component.
 */
export function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn("glass-card", className)}>{children}</div>
}
