import type { ReactNode } from "react"
import { Card } from "./Card"

/**
 * DESIGN_SYSTEM.md's measured stat-tile pattern (oversized bold number + one
 * line of context). No "Source:" line here — UI_UX_GUIDELINES.md's adaptation
 * table says Dashboard's own numbers need no citation, just no fabrication.
 */
export function StatTile({ value, label }: { value: ReactNode; label: string }) {
  return (
    <Card>
      <p className="font-display text-3xl font-semibold text-foreground lg:text-2xl xl:text-3xl 2xl:text-4xl">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </Card>
  )
}
