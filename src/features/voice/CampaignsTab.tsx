import { useState } from "react"
import { Link } from "react-router-dom"
import { PhoneOutgoing } from "lucide-react"
import { GlowCard, type GlowTone } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getFunctionErrorMessage } from "@/lib/functionsError"
import { cn } from "@/lib/utils"
import { useDemoMode } from "./demoMode"
import {
  CAMPAIGN_BLURB,
  useCallNow,
  useCampaignCandidates,
  useCampaigns,
  useUpdateCampaign,
  useVoiceAgents,
  type Candidate,
  type CampaignKey,
} from "./hooks"

const TONE: Record<CampaignKey, GlowTone> = {
  speed_to_lead: "cyan",
  proposal_follow_up: "amber",
  client_check_in: "green",
  appointment_call: "violet",
}

type CampaignRow = NonNullable<ReturnType<typeof useCampaigns>["data"]>[number]

function CandidateList({ campaign, demo }: { campaign: CampaignKey; demo: boolean }) {
  const { data: candidates, isLoading } = useCampaignCandidates(campaign)
  const callNow = useCallNow()
  const [status, setStatus] = useState<Record<string, { kind: "ok" | "error"; text: string }>>({})

  async function call(c: Candidate) {
    setStatus((s) => ({ ...s, [c.key]: { kind: "ok", text: "Calling…" } }))
    try {
      await callNow.mutateAsync({ campaign, candidate: c })
      setStatus((s) => ({
        ...s,
        [c.key]: { kind: "ok", text: demo ? "Simulated call started — watch it on the Live tab." : "Call requested." },
      }))
    } catch (err) {
      const text = await getFunctionErrorMessage(err, "Couldn't place the call.")
      setStatus((s) => ({ ...s, [c.key]: { kind: "error", text } }))
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!candidates || candidates.length === 0) {
    return <p className="text-sm text-muted-foreground">Nobody to call right now.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {candidates.map((c) => (
        <div
          key={c.key}
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-pill)] border border-white/10 bg-black/10 px-3 py-2"
        >
          <div className="min-w-0">
            <Link
              className="text-sm font-medium hover:text-brand-cyan"
              to={c.entityType === "client" ? `/nexus/${c.entityId}` : `/sales/${c.entityId}`}
            >
              {c.practice}
            </Link>
            <p className="text-xs text-muted-foreground">
              {c.name} · {c.reason}
            </p>
            {status[c.key] && (
              <p className={cn("mt-0.5 text-xs", status[c.key].kind === "error" ? "text-status-error" : "text-brand-cyan")}>
                {status[c.key].text}
              </p>
            )}
          </div>
          <Button size="sm" disabled={callNow.isPending} onClick={() => call(c)}>
            <PhoneOutgoing className="size-4" />
            {demo ? "Simulate call" : "Call now"}
          </Button>
        </div>
      ))}
    </div>
  )
}

function CampaignCard({ row, demo }: { row: CampaignRow; demo: boolean }) {
  const key = row.key as CampaignKey
  const update = useUpdateCampaign()
  const { data: agents } = useVoiceAgents()
  const ready = !!row.agent_id && !!row.from_number

  return (
    <GlowCard tone={TONE[key]}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">{row.label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{CAMPAIGN_BLURB[key]}</p>
        </div>
        {!demo && (
          <button
            type="button"
            role="switch"
            aria-checked={row.enabled}
            onClick={() => update.mutate({ key, patch: { enabled: !row.enabled } })}
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--radius-pill)] border px-3 py-1.5 text-sm transition-colors",
              row.enabled
                ? "border-status-success/50 bg-status-success/10 text-status-success"
                : "border-border text-muted-foreground",
            )}
          >
            <span className={cn("size-2 rounded-full", row.enabled ? "bg-status-success" : "bg-muted-foreground")} />
            {row.enabled ? "On" : "Off"}
          </button>
        )}
      </div>

      {!demo && (
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Agent</label>
            <Select
              value={row.agent_id ?? "none"}
              onValueChange={(v) => update.mutate({ key, patch: { agent_id: v === "none" ? null : v } })}
            >
              <SelectTrigger className="w-56">
                <SelectValue>
                  {row.agent_id ? (agents?.find((a) => a.id === row.agent_id)?.name ?? "Agent") : "Choose an agent"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {agents?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Call from (your Retell number)</label>
            <Input
              placeholder="+91…"
              className="w-44"
              defaultValue={row.from_number ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v !== (row.from_number ?? "")) update.mutate({ key, patch: { from_number: v || null } })
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Max calls / day</label>
            <Input
              type="number"
              min={1}
              max={500}
              className="no-spinner w-24"
              defaultValue={row.daily_cap}
              onBlur={(e) => {
                const n = Math.round(Number(e.target.value))
                if (n >= 1 && n <= 500 && n !== row.daily_cap) update.mutate({ key, patch: { daily_cap: n } })
              }}
            />
          </div>
        </div>
      )}
      {!demo && (
        <p className="mt-2 text-xs text-muted-foreground">
          Calls only between {row.window_start_hour}:00 and {row.window_end_hour}:00 ({row.timezone}).
          {!ready && " Pick an agent and a number, then switch it on."}
        </p>
      )}
      {update.isError && <p className="mt-2 text-xs text-status-error">{update.error.message}</p>}

      <div className="mt-5">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Who we'd call</h4>
        <CandidateList campaign={key} demo={demo} />
      </div>
    </GlowCard>
  )
}

/** Four outbound campaigns. Always Owner-initiated: nothing dials until you
 * press the button, and the server re-checks every guardrail first. */
export function CampaignsTab() {
  const demo = useDemoMode()
  const { data: campaigns, isLoading } = useCampaigns()

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-sm text-muted-foreground">
        {demo
          ? "Demo mode: “Simulate call” plays a realistic fake call so you can show the whole workflow — nothing is dialed."
          : "Each campaign lists who's due a call. Nothing dials by itself — you press Call now, and every guardrail (opt-out, calling hours, daily cap, no repeat within 24 h) is checked again on the server."}
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {campaigns?.map((row) => (
            <CampaignCard key={row.key} row={row} demo={demo} />
          ))}
        </div>
      )}
    </div>
  )
}
