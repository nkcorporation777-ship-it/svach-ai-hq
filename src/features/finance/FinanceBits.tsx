import { cn } from "@/lib/utils"
import { STATUS_LABEL, displayStatus, type DisplayStatus } from "./hooks"

const STATUS_STYLE: Record<DisplayStatus, string> = {
  draft: "border-border text-muted-foreground",
  sent: "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan",
  partially_paid: "border-status-warning/40 bg-status-warning/10 text-status-warning",
  paid: "border-status-success/40 bg-status-success/10 text-status-success",
  void: "border-border text-muted-foreground line-through",
  overdue: "border-status-error/40 bg-status-error/10 text-status-error",
}

export function StatusBadge({ invoice }: { invoice: { status: string; due_date: string } }) {
  const status = displayStatus(invoice)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: "good" | "bad"
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-2xl font-semibold",
          tone === "good" && "text-status-success",
          tone === "bad" && "text-status-error",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
