import { Link, useNavigate } from "react-router-dom"
import { GlowCard } from "@/components/shared/GlowCard"
import { Stat } from "@/features/finance/FinanceBits"
import { PriorityBadge, SlaCell } from "./SupportBits"
import { PRIORITIES, isOpenStatus, slaOf, useSlaTargets, type Ticket } from "./hooks"

const hours = (ms: number) => {
  const h = ms / 3_600_000
  return h < 1 ? `${Math.round(h * 60)}m` : h < 48 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`
}
const fmtTarget = (h: number) => (h % 24 === 0 && h >= 24 ? `${h / 24}d` : `${h}h`)

/** SLA monitor: what's breached or about to be, and how the last 30 days went. */
export function SlaTab({ tickets }: { tickets: Ticket[] }) {
  const navigate = useNavigate()
  const { data: targets } = useSlaTargets()
  const now = Date.now()

  const open = tickets.filter((t) => isOpenStatus(t.status))
  const withSla = open.map((t) => ({ t, sla: slaOf(t, now) }))
  const breached = withSla.filter(({ sla }) => sla.response === "breached" || sla.resolution === "breached")
  const atRisk = withSla.filter(
    ({ sla }) =>
      !(sla.response === "breached" || sla.resolution === "breached") &&
      (sla.response === "at_risk" || sla.resolution === "at_risk"),
  )
  const attention = [...breached, ...atRisk].map((x) => x.t)

  const since = now - 30 * 86_400_000
  const recent = tickets.filter((t) => t.resolved_at && new Date(t.resolved_at).getTime() >= since)
  const metCount = recent.filter((t) => {
    const s = slaOf(t, now)
    return s.response === "met" && s.resolution === "met"
  }).length

  const perPriority = PRIORITIES.map((p) => {
    const rows = recent.filter((t) => t.priority === p.value)
    const avg = (pick: (t: Ticket) => string | null) => {
      const spans = rows.flatMap((t) => {
        const at = pick(t)
        return at ? [new Date(at).getTime() - new Date(t.opened_at).getTime()] : []
      })
      return spans.length ? hours(spans.reduce((a, b) => a + b, 0) / spans.length) : "—"
    }
    const met = rows.filter((t) => {
      const s = slaOf(t, now)
      return s.response === "met" && s.resolution === "met"
    }).length
    return {
      ...p,
      target: targets?.find((x) => x.priority === p.value),
      resolved: rows.length,
      avgResponse: avg((t) => t.first_responded_at),
      avgResolution: avg((t) => t.resolved_at),
      metPct: rows.length ? `${Math.round((met / rows.length) * 100)}%` : "—",
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GlowCard tone="cyan">
          <Stat label="Open" value={String(open.length)} sub="Tickets and bugs" />
        </GlowCard>
        <GlowCard tone={breached.length ? "red" : "green"}>
          <Stat
            label="Breached"
            value={String(breached.length)}
            sub="Past a response or resolution target"
            tone={breached.length ? "bad" : undefined}
          />
        </GlowCard>
        <GlowCard tone="amber">
          <Stat label="At risk" value={String(atRisk.length)} sub="In the last quarter of their window" />
        </GlowCard>
        <GlowCard tone="violet">
          <Stat
            label="SLA met, 30 days"
            value={recent.length ? `${Math.round((metCount / recent.length) * 100)}%` : "—"}
            sub={`${metCount} of ${recent.length} resolved`}
            tone={recent.length && metCount === recent.length ? "good" : undefined}
          />
        </GlowCard>
      </div>

      <GlowCard tone={breached.length ? "red" : "amber"} className="p-0">
        <div className="p-6 pb-3">
          <h2 className="font-display text-base font-semibold">Needs attention</h2>
        </div>
        {attention.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Nothing breached or at risk right now.</p>
        ) : (
          <ul className="flex flex-col">
            {attention.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/support/${t.id}`)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 px-6 py-3 text-left text-sm hover:bg-white/5"
                >
                  <span className="font-mono text-[11px] text-muted-foreground">{t.ticket_number}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{t.subject}</span>
                  <span className="text-xs text-muted-foreground">{t.clients?.practice_name ?? "Internal"}</span>
                  <PriorityBadge priority={t.priority} />
                  <SlaCell ticket={t} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </GlowCard>

      <GlowCard tone="cyan">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-semibold">Targets and last 30 days</h2>
          <Link to="/settings#sla" className="text-xs text-brand-cyan hover:underline">
            Change targets in Settings
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 font-normal">Priority</th>
                <th className="pb-2 text-right font-normal">Respond within</th>
                <th className="pb-2 text-right font-normal">Resolve within</th>
                <th className="pb-2 text-right font-normal">Resolved</th>
                <th className="pb-2 text-right font-normal">Avg response</th>
                <th className="pb-2 text-right font-normal">Avg resolution</th>
                <th className="pb-2 text-right font-normal">SLA met</th>
              </tr>
            </thead>
            <tbody>
              {perPriority.map((p) => (
                <tr key={p.value} className="border-t border-border/60">
                  <td className="py-2">
                    <PriorityBadge priority={p.value} />
                  </td>
                  <td className="py-2 text-right">{p.target ? fmtTarget(Number(p.target.first_response_hours)) : "—"}</td>
                  <td className="py-2 text-right">{p.target ? fmtTarget(Number(p.target.resolution_hours)) : "—"}</td>
                  <td className="py-2 text-right">{p.resolved}</td>
                  <td className="py-2 text-right">{p.avgResponse}</td>
                  <td className="py-2 text-right">{p.avgResolution}</td>
                  <td className="py-2 text-right">{p.metPct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Clocks run in calendar hours from when a ticket was raised and keep running while it waits on the client.
          Logging a reply stops the response clock; resolving stops both.
        </p>
      </GlowCard>
    </div>
  )
}
