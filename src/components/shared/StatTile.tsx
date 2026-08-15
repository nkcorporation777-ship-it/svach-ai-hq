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
      <p className="font-display text-4xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </Card>
  )
}
