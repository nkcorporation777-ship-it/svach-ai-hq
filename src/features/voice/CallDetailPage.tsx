import { Link, useParams } from "react-router-dom"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { cn } from "@/lib/utils"
import { OutcomeBadge, SentimentBadge } from "./CallBadges"
import { CallWorkflowTimeline } from "./CallWorkflowTimeline"
import { formatCents, formatMinutes, useVoiceCall } from "./hooks"

function TranscriptView({ transcript }: { transcript: string }) {
  const lines = transcript.split("\n").filter((l) => l.trim())
  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, i) => {
        const isAgent = /^agent:/i.test(line)
        const text = line.replace(/^(agent|caller|user):\s*/i, "")
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
              <p className="mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {isAgent ? "Agent" : "Caller"}
              </p>
              {text}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  )
}

export function CallDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: call, isLoading } = useVoiceCall(id)

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!call) return <p className="text-sm text-muted-foreground">Call not found.</p>

  const lead = (call as { leads?: { id: string; practice_name: string } | null }).leads
  const client = (call as { clients?: { id: string; practice_name: string } | null }).clients
  const agent = (call as { voice_agents?: { name: string } | null }).voice_agents
  const analysis = (call.analysis ?? {}) as Record<string, unknown>
  const analysisEntries = Object.entries(analysis).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  )

  return (
    <div className="flex flex-col gap-8">
      <Link
        to="/voice?tab=calls"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to calls
      </Link>

      <header>
        <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
          {call.direction ?? "call"} · {call.call_type === "web_call" ? "web call" : "phone call"}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          {client?.practice_name ?? lead?.practice_name ?? "Unmatched caller"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {agent?.name ?? "Voice agent"} ·{" "}
          {call.started_at ? new Date(call.started_at).toLocaleString() : "time unknown"}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <GlowCard tone="cyan">
            <h2 className="font-display text-base font-semibold">Summary</h2>
            <p className="mt-3 text-sm">{call.summary ?? "No summary yet — the call may still be in progress."}</p>
          </GlowCard>

          <GlowCard tone="violet">
            <h2 className="font-display text-base font-semibold">Transcript</h2>
            <div className="mt-4">
              {call.transcript ? (
                <TranscriptView transcript={call.transcript} />
              ) : (
                <p className="text-sm text-muted-foreground">No transcript stored for this call.</p>
              )}
            </div>
          </GlowCard>
        </div>

        <div className="flex flex-col gap-6">
          <GlowCard tone="green">
            <h2 className="font-display text-base font-semibold">Details</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <Fact label="Outcome">
                <OutcomeBadge successful={call.call_successful} status={call.call_status} />
              </Fact>
              <Fact label="Sentiment">
                <SentimentBadge sentiment={call.sentiment} />
              </Fact>
              <Fact label="Duration">{formatMinutes(call.duration_ms)}</Fact>
              <Fact label="Retell cost">{formatCents(call.cost_cents)}</Fact>
              <Fact label="Ended because">{call.disconnection_reason?.replace(/_/g, " ") ?? "—"}</Fact>
              <Fact label="Record">
                {client ? (
                  <Link className="text-brand-cyan hover:underline" to={`/nexus/${client.id}`}>
                    Client
                  </Link>
                ) : lead ? (
                  <Link className="text-brand-cyan hover:underline" to={`/sales/${lead.id}`}>
                    Lead
                  </Link>
                ) : (
                  "Not matched"
                )}
              </Fact>
            </dl>
            {call.recording_url && (
              <a
                href={call.recording_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-cyan hover:underline"
              >
                Open recording <ExternalLink className="size-3.5" />
              </a>
            )}
          </GlowCard>

          <GlowCard tone="cyan">
            <h2 className="font-display text-base font-semibold">What happened next</h2>
            <div className="mt-4">
              <CallWorkflowTimeline callId={call.id} />
            </div>
          </GlowCard>

          {analysisEntries.length > 0 && (
            <GlowCard tone="amber">
              <h2 className="font-display text-base font-semibold">What the agent captured</h2>
              <dl className="mt-4 flex flex-col gap-3">
                {analysisEntries.map(([k, v]) => (
                  <Fact key={k} label={k.replace(/_/g, " ")}>
                    {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}
                  </Fact>
                ))}
              </dl>
            </GlowCard>
          )}
        </div>
      </div>
    </div>
  )
}
