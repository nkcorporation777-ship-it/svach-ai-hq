import { CheckCircle2, User, Bot, Cog } from "lucide-react"
import { Card } from "@/components/shared/Card"
import { StatTile } from "@/components/shared/StatTile"
import { ActionQueueCard } from "@/components/shared/ActionQueueCard"
import { useLeads } from "@/features/sales/hooks"
import { useClients } from "@/features/nexus/hooks"
import {
  useSystemHealthEvents,
  useOoaRecommendations,
  useApproveRecommendation,
  useDismissRecommendation,
  useAgentActivity,
} from "./hooks"

const SEVERITY_COLOR: Record<string, string> = {
  info: "text-status-info",
  warning: "text-status-warning",
  error: "text-status-error",
}

const ACTOR_ICON = { user: User, agent: Bot, system: Cog } as const

/** Formats "lead.stage_changed" → "Lead stage changed". */
function formatAction(action: string) {
  const readable = action.replace(/[._]/g, " ")
  return readable.charAt(0).toUpperCase() + readable.slice(1)
}

/**
 * OOA Home — INFORMATION_ARCHITECTURE.md §2. `ooa_recommendations` and
 * `ooa_system_health_events` are genuinely empty until n8n/Hermes exist
 * (PRD.md §5.7, §8) — honest empty states, not fabricated data, per
 * UI_UX_GUIDELINES.md. Stats reuse useLeads()/useClients() rather than new
 * queries — the same data Sales/Nexus already fetch.
 */
export function DashboardPage() {
  const { data: healthEvents, isLoading: healthLoading } = useSystemHealthEvents()
  const { data: recommendations, isLoading: recsLoading } = useOoaRecommendations()
  const { data: activity, isLoading: activityLoading } = useAgentActivity()
  const { data: leads } = useLeads()
  const { data: clients } = useClients()
  const approve = useApproveRecommendation()
  const dismiss = useDismissRecommendation()

  const stageCounts = (leads ?? []).reduce<Record<string, number>>((acc, lead) => {
    acc[lead.stage] = (acc[lead.stage] ?? 0) + 1
    return acc
  }, {})
  const openLeadCount = (leads ?? []).filter(
    (l) => l.stage !== "won" && l.stage !== "lost",
  ).length
  const flaggedClientCount = (clients ?? []).filter((c) => c.isFlagged).length

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
          Dashboard
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">OOA Home</h1>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile
          value={openLeadCount}
          label={`Open leads (${Object.entries(stageCounts)
            .filter(([stage]) => stage !== "won" && stage !== "lost")
            .map(([stage, n]) => `${n} ${stage.replace(/_/g, " ")}`)
            .join(", ") || "none"})`}
        />
        <StatTile value={flaggedClientCount} label="Clients flagged for follow-up" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-base font-semibold">System Health</h2>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-status-success" />
            <span className="text-foreground">Supabase</span>
            <span className="text-muted-foreground">Connected</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            n8n and Hermes aren't connected yet (PRD.md §8) — no status shown until
            they actually report in.
          </p>

          {healthLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : !healthEvents || healthEvents.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No events yet — populates once the Phase 1 n8n workflows are live.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {healthEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between text-sm">
                  <span className={SEVERITY_COLOR[event.severity] ?? "text-foreground"}>
                    {event.event_type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-base font-semibold">
            Business Insights &amp; Action Queue
          </h2>
          {recsLoading ? (
            <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
          ) : !recommendations || recommendations.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No action needed right now.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {recommendations.map((rec) => (
                <ActionQueueCard
                  key={rec.id}
                  title={rec.title}
                  description={rec.description}
                  isApproving={approve.isPending && approve.variables === rec.id}
                  isDismissing={dismiss.isPending && dismiss.variables === rec.id}
                  onApprove={() => approve.mutate(rec.id)}
                  onDismiss={() => dismiss.mutate(rec.id)}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="font-display text-base font-semibold">Agent Activity</h2>
        {activityLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : !activity || activity.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {activity.map((row) => {
              const Icon = ACTOR_ICON[row.actor_type as keyof typeof ACTOR_ICON] ?? User
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-3 border-b border-border pb-3 last:border-0"
                >
                  <Icon className="size-4 shrink-0 text-brand-cyan" />
                  <span className="flex-1 text-sm text-foreground">
                    {formatAction(row.action)}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
