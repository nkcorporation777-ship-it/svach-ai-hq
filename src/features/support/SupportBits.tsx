import { cn } from "@/lib/utils"
import { formatCountdown, nextDeadline, priorityLabel, slaOf, statusLabel, type SlaState, type Ticket } from "./hooks"

const pill = "inline-flex items-center rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"

const PRIORITY_STYLE: Record<string, string> = {
  urgent: "border-status-error/40 bg-status-error/10 text-status-error",
  high: "border-status-warning/40 bg-status-warning/10 text-status-warning",
  normal: "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan",
  low: "border-border text-muted-foreground",
}

const STATUS_STYLE: Record<string, string> = {
  open: "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan",
  in_progress: "border-status-info/40 bg-status-info/10 text-status-info",
  waiting_on_client: "border-status-warning/40 bg-status-warning/10 text-status-warning",
  resolved: "border-status-success/40 bg-status-success/10 text-status-success",
  closed: "border-border text-muted-foreground",
}

const SLA_STYLE: Record<SlaState, string> = {
  on_track: "text-muted-foreground",
  at_risk: "text-status-warning",
  breached: "text-status-error",
  met: "text-status-success",
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <span className={cn(pill, PRIORITY_STYLE[priority])}>{priorityLabel(priority)}</span>
}

export function TicketStatusBadge({ status }: { status: string }) {
  return <span className={cn(pill, STATUS_STYLE[status])}>{statusLabel(status)}</span>
}

/** One line for a list row: the clock that matters now, or how it ended. */
export function SlaCell({ ticket }: { ticket: Ticket }) {
  const sla = slaOf(ticket)
  const next = nextDeadline(ticket)
  if (!next) {
    const state = sla.resolution === "breached" || sla.response === "breached" ? "breached" : "met"
    return <span className={cn("text-xs", SLA_STYLE[state])}>{state === "met" ? "SLA met" : "SLA missed"}</span>
  }
  const state = (next.label === "First response" ? sla.response : sla.resolution) ?? "on_track"
  return (
    <span className={cn("text-xs whitespace-nowrap", SLA_STYLE[state])}>
      {next.label} {formatCountdown(next.due)}
    </span>
  )
}

export function SlaStateText({ state }: { state: SlaState | null }) {
  if (!state) return <span className="text-muted-foreground">—</span>
  const text = { on_track: "On track", at_risk: "At risk", breached: "Breached", met: "Met" }[state]
  return <span className={cn("font-medium", SLA_STYLE[state])}>{text}</span>
}
