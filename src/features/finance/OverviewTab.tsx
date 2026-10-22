import { GlowCard } from "@/components/shared/GlowCard"
import { Stat } from "./FinanceBits"
import { formatMoney, useFinanceOverview } from "./hooks"

/** Money in vs out for the last six months, what's still owed, and who pays most. */
export function OverviewTab() {
  const { data, isLoading } = useFinanceOverview()

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>

  const peak = Math.max(1, ...data.months.flatMap((m) => [m.collected, m.spent]))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GlowCard tone="green">
          <Stat label="Collected this month" value={formatMoney(data.collectedThisMonth)} sub="Payments received, incl. GST" />
        </GlowCard>
        <GlowCard tone="amber">
          <Stat label="Spent this month" value={formatMoney(data.spentThisMonth)} sub="Logged expenses" />
        </GlowCard>
        <GlowCard tone="cyan">
          <Stat
            label="Outstanding"
            value={formatMoney(data.outstanding)}
            sub={`${data.outstandingCount} unpaid invoice${data.outstandingCount === 1 ? "" : "s"}`}
          />
        </GlowCard>
        <GlowCard tone={data.overdueCount > 0 ? "red" : "violet"}>
          <Stat
            label="Overdue"
            value={formatMoney(data.overdue)}
            sub={`${data.overdueCount} past due`}
            tone={data.overdueCount > 0 ? "bad" : undefined}
          />
        </GlowCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <GlowCard tone="cyan" className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">Last six months</h2>
            <p className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-status-success" /> Collected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-status-warning" /> Spent
              </span>
            </p>
          </div>
          <div className="mt-6 flex h-48 items-end gap-3">
            {data.months.map((m) => (
              <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div
                    title={`Collected ${formatMoney(m.collected)}`}
                    className="w-1/3 max-w-8 rounded-t bg-status-success/80"
                    style={{ height: `${Math.max(2, (m.collected / peak) * 100)}%` }}
                  />
                  <div
                    title={`Spent ${formatMoney(m.spent)}`}
                    className="w-1/3 max-w-8 rounded-t bg-status-warning/80"
                    style={{ height: `${Math.max(2, (m.spent / peak) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </GlowCard>

        <GlowCard tone="violet">
          <h2 className="font-display text-base font-semibold">Top payers</h2>
          <p className="mt-1 text-xs text-muted-foreground">Last six months</p>
          {data.topClients.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {data.topClients.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 font-medium">{formatMoney(c.collected)}</span>
                </li>
              ))}
            </ul>
          )}
        </GlowCard>
      </div>

      <p className="text-xs text-muted-foreground">
        Net this month: {formatMoney(data.netThisMonth)} (collected minus expenses). Figures include GST where invoices
        charged it; this is a tracking view, not a tax return.
      </p>
    </div>
  )
}
