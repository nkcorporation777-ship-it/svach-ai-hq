import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Mic, RefreshCw, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getFunctionErrorMessage } from "@/lib/functionsError"
import { setDemoMode, useDemoMode } from "./demoMode"
import { useDemoData, useSyncRetell, useVoiceStatus } from "./hooks"
import { OverviewTab } from "./OverviewTab"
import { CallsTab } from "./CallsTab"
import { AgentsTab } from "./AgentsTab"
import { AppointmentsTab } from "./AppointmentsTab"
import { CampaignsTab } from "./CampaignsTab"
import { LiveTab } from "./LiveTab"
import { TalkTab } from "./TalkTab"

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "live", label: "Live" },
  { id: "calls", label: "Calls" },
  { id: "appointments", label: "Appointments" },
  { id: "campaigns", label: "Campaigns" },
  { id: "talk", label: "Talk" },
  { id: "agents", label: "Agents" },
] as const

type TabId = (typeof TABS)[number]["id"]

function timeAgo(iso: string | null | undefined) {
  if (!iso) return null
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`
  return `${Math.round(mins / (60 * 24))} d ago`
}

/** Voice Agents department — Retell AI section. Calls reach HQ through the
 * retell-webhook function (live) and the Sync button (backfill); everything
 * here reads our own tables. */
export function VoicePage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "overview") as TabId
  const demo = useDemoMode()
  const { data: status } = useVoiceStatus()
  const sync = useSyncRetell()
  const demoData = useDemoData()
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)

  async function run(action: () => Promise<string>) {
    setMessage(null)
    try {
      setMessage({ kind: "ok", text: await action() })
    } catch (err) {
      setMessage({ kind: "error", text: await getFunctionErrorMessage(err, "Something went wrong.") })
    }
  }

  const lastCall = timeAgo(status?.lastCallAt)
  const lastSync = timeAgo(status?.lastSyncAt)

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
            Voice Agents · Retell AI
          </p>
          <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-semibold">
            <Mic className="size-7 text-brand-cyan" />
            Voice Agents
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            {demo
              ? "Demo mode — showing synthetic demo data only. Real calls are hidden."
              : lastCall
                ? `Last call received ${lastCall}${lastSync ? ` · last sync ${lastSync}` : ""}.`
                : "No calls yet. Connect Retell (see docs/VOICE_AGENTS.md), then press Sync."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={demo}
            onClick={() => setDemoMode(!demo)}
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--radius-pill)] border px-3 py-1.5 text-sm transition-colors",
              demo
                ? "border-brand-cyan/50 bg-brand-cyan/10 text-brand-cyan"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Sparkles className="size-4" />
            Demo mode {demo ? "on" : "off"}
          </button>

          {demo ? (
            <>
              <Button
                size="sm"
                disabled={demoData.isPending}
                onClick={() =>
                  run(async () => {
                    const r = await demoData.mutateAsync("seed")
                    return `Demo data ready: ${r.seeded} calls, ${r.leadsCreated} new demo leads.`
                  })
                }
              >
                {demoData.isPending ? "Working…" : "Seed demo data"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={demoData.isPending}
                onClick={() =>
                  run(async () => {
                    const r = await demoData.mutateAsync("reset")
                    return `Demo data cleared (${r.leadsRemoved} demo leads removed).`
                  })
                }
              >
                <Trash2 className="size-4" />
                Reset demo data
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              disabled={sync.isPending}
              onClick={() =>
                run(async () => {
                  const r = await sync.mutateAsync()
                  return `Synced ${r.agentsSynced} agents and ${r.callsSynced} calls${r.failed ? ` (${r.failed} failed)` : ""}.`
                })
              }
            >
              <RefreshCw className={cn("size-4", sync.isPending && "animate-spin")} />
              {sync.isPending ? "Syncing…" : "Sync from Retell"}
            </Button>
          )}
        </div>
      </header>

      {message && (
        <p className={cn("text-sm", message.kind === "error" ? "text-status-error" : "text-brand-cyan")}>
          {message.text}
        </p>
      )}

      <nav className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setParams(t.id === "overview" ? {} : { tab: t.id })}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm transition-colors",
              tab === t.id
                ? "border-brand-cyan text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab />}
      {tab === "live" && <LiveTab />}
      {tab === "calls" && <CallsTab />}
      {tab === "appointments" && <AppointmentsTab />}
      {tab === "campaigns" && <CampaignsTab />}
      {tab === "talk" && <TalkTab />}
      {tab === "agents" && <AgentsTab />}
    </div>
  )
}
