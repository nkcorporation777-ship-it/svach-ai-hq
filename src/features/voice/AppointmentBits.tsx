import { Pill } from "./CallBadges"

export function AppointmentStatusBadge({ status }: { status: string }) {
  if (status === "scheduled") return <Pill tone="green" label="Scheduled" />
  if (status === "cancelled") return <Pill tone="red" label="Cancelled" />
  if (status === "rescheduled") return <Pill tone="amber" label="Moved" />
  if (status === "completed") return <Pill tone="muted" label="Completed" />
  return <Pill tone="muted" label={status} />
}

export interface ReminderRow {
  id: string
  kind: string
  channel: string
  status: string
  send_at: string
  error: string | null
}

const REMINDER_LABEL: Record<string, string> = {
  pending: "queued",
  sending: "sending",
  sent: "sent",
  failed: "failed",
  cancelled: "cancelled",
  skipped: "skipped",
}

/** "24h email · queued   1h email · queued" — one chip per reminder. */
export function ReminderChips({ reminders }: { reminders: ReminderRow[] | null | undefined }) {
  if (!reminders || reminders.length === 0) {
    return <span className="text-xs text-muted-foreground">No reminders</span>
  }
  const sorted = [...reminders].sort((a, b) => a.send_at.localeCompare(b.send_at))
  return (
    <div className="flex flex-wrap gap-1.5">
      {sorted.map((r) => {
        const tone =
          r.status === "sent"
            ? "green"
            : r.status === "failed"
              ? "red"
              : r.status === "pending" || r.status === "sending"
                ? "cyan"
                : "muted"
        return (
          <span key={r.id} title={r.error ?? `Due ${new Date(r.send_at).toLocaleString()}`}>
            <Pill tone={tone} label={`${r.kind} ${r.channel} · ${REMINDER_LABEL[r.status] ?? r.status}`} />
          </span>
        )
      })}
    </div>
  )
}
