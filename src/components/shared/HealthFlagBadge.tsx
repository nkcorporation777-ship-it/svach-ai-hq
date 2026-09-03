import { cn } from "@/lib/utils"

/** A small live-status dot — a steady core with an expanding, fading ring
 * behind it, the standard "this is a live signal" treatment. Reused by both
 * states below, just recolored. */
function PulseDot({ colorClass }: { colorClass: string }) {
  return (
    <span className="relative flex size-1.5">
      <span
        className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", colorClass)}
      />
      <span className={cn("relative inline-flex size-1.5 rounded-full", colorClass)} />
    </span>
  )
}

/**
 * Driven by `client_contact_status.is_flagged` (DATABASE_SCHEMA.md) — computed
 * live from the `activities` table, never a stored status. This component just
 * renders whatever the view says; it never derives the flag itself.
 */
export function HealthFlagBadge({
  isFlagged,
  lastContactedAt,
}: {
  isFlagged: boolean
  lastContactedAt: string | null
}) {
  if (!isFlagged) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-status-success/30 bg-status-success/10 px-2 py-0.5 text-xs font-medium text-status-success">
        <PulseDot colorClass="bg-status-success" />
        Healthy
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-status-warning/30 bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning",
      )}
      title={
        lastContactedAt
          ? `Last contact: ${new Date(lastContactedAt).toLocaleDateString()}`
          : "No contact logged yet"
      }
    >
      <PulseDot colorClass="bg-status-warning" />
      No contact in 14+ days
    </span>
  )
}
