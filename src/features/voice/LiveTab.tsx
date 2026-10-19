import { useState } from "react"
import { Link } from "react-router-dom"
import { PhoneIncoming } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import { getFunctionErrorMessage } from "@/lib/functionsError"
import { cn } from "@/lib/utils"
import { OutcomeBadge } from "./CallBadges"
import { CallWorkflowTimeline } from "./CallWorkflowTimeline"
import { useDemoMode } from "./demoMode"
import { formatMinutes, useLiveCalls, useSimulateInbound, useVoiceCall } from "./hooks"

function LiveTranscript({ transcript }: { transcript: string | null }) {
  const lines = (transcript ?? "").split("\n").filter((l) => l.trim())
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">Waiting for the first words…</p>
  }
  return (
    <div className="flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1">
      {lines.map((line, i) => {
        const isAgent = /^agent:/i.test(line)
        return (
          <div key={i} className={cn("flex", isAgent ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                isAgent
                  ? "rounded-bl-sm border border-brand-cyan/30 bg-brand-cyan/10"
                  : "rounded-br-sm border border-white/10 bg-white/5",
              )}
            >
              {line.replace(/^(agent|caller|user):\s*/i, "")}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** The demo centrepiece: a call happening, its transcript streaming in, and
 * every follow-on step lighting up as it truly lands in the database. */
export function LiveTab() {
  const demo = useDemoMode()
  const { data: calls } = useLiveCalls()
  const simulate = useSimulateInbound()
  const [picked, setPicked] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedId = picked ?? calls?.[0]?.id
  const { data: selected } = useVoiceCall(selectedId)
  // The transcript streams into voice_calls; re-read it as the live list refreshes.
  const liveRow = calls?.find((c) => c.id === selectedId) ?? selected
  const isLive = liveRow?.call_status === "ongoing" || liveRow?.call_status === "registered"

  async function startSim() {
    setError(null)
    setPicked(null)
    try {
      await simulate.mutateAsync()
    } catch (err) {
      setError(await getFunctionErrorMessage(err, "Couldn't start the simulation."))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        {demo ? (
          <Button onClick={startSim} disabled={simulate.isPending}>
            <PhoneIncoming className="size-4" />
            Simulate an incoming call
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Real calls appear here as they happen. Switch on Demo mode to play a simulated call.
          </p>
        )}
        {simulate.isSuccess && (
          <p className="text-sm text-brand-cyan">Call started — watch the transcript and the steps on the right.</p>
        )}
        {error && <p className="text-sm text-status-error">{error}</p>}
      </div>

      {!calls || calls.length === 0 ? (
        <GlowCard tone="cyan">
          <p className="text-sm text-muted-foreground">
            No calls yet.{demo ? " Press “Simulate an incoming call”." : " The next call will appear here instantly."}
          </p>
        </GlowCard>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="flex flex-col gap-6 lg:col-span-3">
            <GlowCard tone={isLive ? "green" : "cyan"} pulse={isLive}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold">
                  {isLive ? "Call in progress" : "Latest call"}
                </h2>
                {liveRow && <OutcomeBadge successful={liveRow.call_successful} status={liveRow.call_status} />}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {(liveRow as { voice_agents?: { name: string } | null } | undefined)?.voice_agents?.name} ·{" "}
                {liveRow?.direction} · {formatMinutes(liveRow?.duration_ms)}
              </p>
              <div className="mt-4">
                <LiveTranscript transcript={liveRow?.transcript ?? null} />
              </div>
              {liveRow?.summary && (
                <p className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Summary</span>
                  {liveRow.summary}
                </p>
              )}
              {selectedId && (
                <Link className="mt-3 inline-block text-xs text-brand-cyan hover:underline" to={`/voice/calls/${selectedId}`}>
                  Open full call
                </Link>
              )}
            </GlowCard>

            <GlowCard tone="violet">
              <h2 className="font-display text-base font-semibold">Recent calls</h2>
              <div className="mt-3 flex flex-col gap-1.5">
                {calls.map((c) => {
                  const name =
                    (c as { clients?: { practice_name: string } | null }).clients?.practice_name ??
                    (c as { leads?: { practice_name: string } | null }).leads?.practice_name ??
                    "Unmatched caller"
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPicked(c.id)}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-[var(--radius-pill)] border px-3 py-2 text-left text-sm transition-colors",
                        c.id === selectedId ? "border-brand-cyan/50 bg-brand-cyan/10" : "border-white/10 hover:border-white/25",
                      )}
                    >
                      <span className="truncate">{name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {c.started_at ? new Date(c.started_at).toLocaleTimeString() : ""}
                      </span>
                    </button>
                  )
                })}
              </div>
            </GlowCard>
          </div>

          <div className="lg:col-span-2">
            <GlowCard tone="green">
              <h2 className="font-display text-base font-semibold">What happened next</h2>
              <p className="mb-4 mt-1 text-xs text-muted-foreground">Each step lights up when it really lands in HQ.</p>
              <CallWorkflowTimeline callId={selectedId} />
            </GlowCard>
          </div>
        </div>
      )}
    </div>
  )
}
