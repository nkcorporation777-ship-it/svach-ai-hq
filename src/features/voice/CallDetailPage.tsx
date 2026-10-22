import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { OutcomeBadge, SentimentBadge } from "./CallBadges"
import { CallWorkflowTimeline } from "./CallWorkflowTimeline"
import {
  formatCents,
  formatMinutes,
  useClientsLite,
  useLeadsLite,
  useResolveReview,
  useVoiceCall,
} from "./hooks"

interface ReviewCandidate {
  entity_type: "lead" | "client"
  entity_id: string
  practice_name: string
}

/** A call HQ couldn't settle on its own: it said "existing client" without a match,
 * or a new lead was created that looks like an existing record. */
function ReviewCard({
  callId,
  reason,
  candidates,
  linked,
  isDemo,
}: {
  callId: string
  reason: string | null
  candidates: ReviewCandidate[]
  linked: boolean
  isDemo: boolean
}) {
  const resolve = useResolveReview()
  const { data: clients } = useClientsLite(isDemo)
  const { data: leads } = useLeadsLite(isDemo)
  const [picked, setPicked] = useState<string>("")

  const parse = (v: string) => {
    const [type, id] = v.split(":")
    return type && id ? { type: type as "lead" | "client", id } : undefined
  }
  const pickedLabel = (() => {
    const t = parse(picked)
    if (!t) return null
    return t.type === "client"
      ? clients?.find((c) => c.id === t.id)?.practice_name
      : leads?.find((l) => l.id === t.id)?.practice_name
  })()

  return (
    <GlowCard tone="amber">
      <h2 className="font-display text-base font-semibold">Needs your review</h2>
      <p className="mt-2 text-sm text-muted-foreground">{reason ?? "HQ couldn't settle this call automatically."}</p>

      {candidates.length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Similar records</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {candidates.map((c) => (
              <li key={`${c.entity_type}:${c.entity_id}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link
                  className="text-brand-cyan hover:underline"
                  to={c.entity_type === "client" ? `/nexus/${c.entity_id}` : `/sales/${c.entity_id}`}
                >
                  {c.practice_name} · {c.entity_type}
                </Link>
                {!linked && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ callId, target: { type: c.entity_type, id: c.entity_id } })}
                  >
                    Link this call
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!linked && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger className="w-64">
              <SelectValue>{pickedLabel ?? "Link to another record…"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Clients</SelectLabel>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={`client:${c.id}`}>
                    {c.practice_name}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Leads</SelectLabel>
                {leads?.map((l) => (
                  <SelectItem key={l.id} value={`lead:${l.id}`}>
                    {l.practice_name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!parse(picked) || resolve.isPending}
            onClick={() => resolve.mutate({ callId, target: parse(picked) })}
          >
            Link call
          </Button>
        </div>
      )}

      <div className="mt-4">
        <Button
          size="sm"
          variant="ghost"
          disabled={resolve.isPending}
          onClick={() => resolve.mutate({ callId })}
        >
          {linked ? "Not a duplicate — dismiss" : "Dismiss without linking"}
        </Button>
      </div>
      {resolve.isError && <p className="mt-2 text-xs text-status-error">{resolve.error.message}</p>}
    </GlowCard>
  )
}

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
          {call.needs_review && (
            <ReviewCard
              callId={call.id}
              reason={call.review_reason}
              candidates={(Array.isArray(call.review_candidates) ? call.review_candidates : []) as unknown as ReviewCandidate[]}
              linked={!!(call.lead_id || call.client_id)}
              isDemo={call.is_demo}
            />
          )}
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
