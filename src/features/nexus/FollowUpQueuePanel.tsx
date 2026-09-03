import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAllFollowUps } from "./hooks"

type FollowUpRow = NonNullable<ReturnType<typeof useAllFollowUps>["data"]>[number]

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfToday() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

function FollowUpRowItem({ fu }: { fu: FollowUpRow }) {
  const practiceName = (fu as { clients?: { practice_name: string } | null }).clients
    ?.practice_name
  return (
    <Link
      to={`/nexus/${fu.client_id}`}
      className="flex flex-col gap-0.5 rounded-[var(--radius-pill)] border border-white/10 bg-black/10 px-3 py-2 text-sm transition-colors hover:border-white/25"
    >
      <span className="font-medium text-foreground">{practiceName ?? "Unknown client"}</span>
      <span className="text-xs text-muted-foreground">
        {new Date(fu.due_at).toLocaleString()}
        {fu.note && ` — ${fu.note}`}
      </span>
    </Link>
  )
}

const BUCKET_STYLES = {
  overdue: {
    border: "border-status-error/30",
    heading: "text-status-error",
    glow: "hover:shadow-[0_28px_56px_-28px_rgba(239,68,68,0.45)]",
    glowColor: "rgba(239,68,68,0.55)",
  },
  today: {
    border: "border-status-warning/30",
    heading: "text-status-warning",
    glow: "hover:shadow-[0_28px_56px_-28px_rgba(245,158,11,0.45)]",
    glowColor: "rgba(245,158,11,0.55)",
  },
  upcoming: {
    border: "border-status-info/30",
    heading: "text-status-info",
    glow: "hover:shadow-[0_28px_56px_-28px_rgba(14,165,233,0.45)]",
    glowColor: "rgba(34,211,238,0.55)",
  },
} as const

function FollowUpBucketCard({
  title,
  bucket,
  items,
}: {
  title: string
  bucket: keyof typeof BUCKET_STYLES
  items: FollowUpRow[]
}) {
  const style = BUCKET_STYLES[bucket]
  return (
    <div
      className={cn(
        "glass-card relative flex flex-col gap-3 overflow-hidden transition-all duration-220 ease-standard",
        "hover:-translate-y-1",
        style.border,
        style.glow,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 size-40 rounded-full blur-3xl"
        style={{ backgroundColor: style.glowColor, animation: "glow-pulse 5s ease-in-out infinite" }}
      />
      <div className="relative flex flex-col gap-3">
        <h3 className={cn("text-xs font-semibold tracking-wide uppercase", style.heading)}>
          {title} {items.length > 0 && `(${items.length})`}
        </h3>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">None.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((fu) => (
              <FollowUpRowItem key={fu.id} fu={fu} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Cross-client Follow-up Queue — INFORMATION_ARCHITECTURE.md §5.3. Three
 * standalone cards (not a narrow sidebar list) so "who needs a follow-up
 * today" reads as a real dashboard-style surface, one color per urgency
 * bucket rather than one undifferentiated panel. */
export function FollowUpQueuePanel() {
  const { data: followUps, isLoading } = useAllFollowUps()

  const today0 = startOfToday()
  const today1 = endOfToday()

  const overdue = (followUps ?? []).filter((fu) => new Date(fu.due_at) < today0)
  const today = (followUps ?? []).filter((fu) => {
    const d = new Date(fu.due_at)
    return d >= today0 && d <= today1
  })
  const upcoming = (followUps ?? []).filter((fu) => new Date(fu.due_at) > today1)

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-base font-semibold">Follow-up Queue</h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FollowUpBucketCard title="Overdue" bucket="overdue" items={overdue} />
          <FollowUpBucketCard title="Today" bucket="today" items={today} />
          <FollowUpBucketCard title="Upcoming" bucket="upcoming" items={upcoming} />
        </div>
      )}
    </div>
  )
}
