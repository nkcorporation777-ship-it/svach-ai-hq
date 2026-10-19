import { useState } from "react"
import { GlowCard } from "@/components/shared/GlowCard"
import { cn } from "@/lib/utils"
import { formatCents, useVoiceUsage } from "./hooks"

const RANGES = [7, 30] as const

/** Usage numbers for the last 7/30 days, from the voice_usage_daily view. */
export function OverviewTab() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(7)
  const { data, isLoading } = useVoiceUsage(days)

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>

  const totals = data?.totals ?? { calls: 0, minutes: 0, costCents: 0, successful: 0 }
  const daily = data?.daily ?? []
  const successRate = totals.calls ? Math.round((totals.successful / totals.calls) * 100) : null
  const maxCalls = Math.max(1, ...daily.map((d) => d.calls))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setDays(r)}
            className={cn(
              "rounded-[var(--radius-pill)] border px-3 py-1 text-xs transition-colors",
              days === r
                ? "border-brand-cyan/50 bg-brand-cyan/10 text-brand-cyan"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Last {r} days
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlowCard tone="cyan" pulse>
          <p className="font-display text-4xl font-semibold">{totals.calls}</p>
          <p className="mt-1 text-sm text-muted-foreground">Calls</p>
        </GlowCard>
        <GlowCard tone="violet" pulse>
          <p className="font-display text-4xl font-semibold">{Math.round(totals.minutes)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Minutes talked</p>
        </GlowCard>
        <GlowCard tone="green" pulse>
          <p className="font-display text-4xl font-semibold">
            {successRate === null ? "—" : `${successRate}%`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Successful calls</p>
        </GlowCard>
        <GlowCard tone="amber" pulse>
          <p className="font-display text-4xl font-semibold">{formatCents(totals.costCents)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Retell cost</p>
        </GlowCard>
      </div>

      <GlowCard tone="cyan">
        <h2 className="font-display text-base font-semibold">Calls per day</h2>
        {daily.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No calls in this period.</p>
        ) : (
          <div className="mt-6 flex h-40 items-end gap-2">
            {daily.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">{d.calls}</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-brand-cyan/30 to-brand-cyan"
                  style={{ height: `${Math.max(6, (d.calls / maxCalls) * 100)}%` }}
                  title={`${d.day}: ${d.calls} calls, ${Math.round(d.minutes)} min`}
                />
                <span className="font-mono text-[10px] text-muted-foreground">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </GlowCard>
    </div>
  )
}
