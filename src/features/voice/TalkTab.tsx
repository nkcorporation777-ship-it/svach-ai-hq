import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { GlowCard } from "@/components/shared/GlowCard"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getFunctionErrorMessage } from "@/lib/functionsError"
import { DemoLinkCard } from "./DemoLinkCard"
import { requestWebCall, useVoiceAgents } from "./hooks"
import { useWebCall } from "./useWebCall"
import { WebCallStage } from "./WebCallStage"

/** Talk to one of your agents through this browser — for testing prompts and
 * for demos. When opened from a lead/client the call lands on that record. */
export function TalkTab() {
  const [params] = useSearchParams()
  const leadId = params.get("lead") ?? undefined
  const clientId = params.get("client") ?? undefined
  const { data: agents } = useVoiceAgents()
  const [agentId, setAgentId] = useState<string | null>(null)
  const call = useWebCall()

  const usable = (agents ?? []).filter((a) => a.audience !== "client_patients")
  const chosen = agentId ?? usable[0]?.id ?? null

  return (
    <div className="flex flex-col gap-6">
      <GlowCard tone="cyan" pulse>
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <h2 className="font-display text-base font-semibold">Talk to an agent</h2>
            {usable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No agents yet — press Sync from Retell (or switch on Demo mode) first.
              </p>
            ) : (
              <Select value={chosen ?? undefined} onValueChange={setAgentId}>
                <SelectTrigger className="w-64">
                  <SelectValue>{usable.find((a) => a.id === chosen)?.name}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {usable.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(leadId || clientId) && (
              <p className="text-xs text-muted-foreground">
                This call will be saved on the {clientId ? "client" : "lead"} you came from.
              </p>
            )}
          </div>

          {chosen && (
            <WebCallStage
              status={call.status}
              agentTalking={call.agentTalking}
              muted={call.muted}
              transcript={call.transcript}
              error={call.error}
              onStart={() =>
                call.start(async () => {
                  try {
                    return await requestWebCall({ agent_id: chosen, lead_id: leadId, client_id: clientId })
                  } catch (err) {
                    throw new Error(await getFunctionErrorMessage(err, "Couldn't start the call."))
                  }
                })
              }
              onStop={call.stop}
              onToggleMute={call.toggleMute}
            />
          )}

          {call.status === "ended" && (
            <p className="text-sm text-muted-foreground">
              Your call will show up under{" "}
              <Link className="text-brand-cyan hover:underline" to="/voice?tab=calls">
                Calls
              </Link>{" "}
              in a few seconds, with its summary and transcript.
            </p>
          )}
        </div>
      </GlowCard>

      <DemoLinkCard />
    </div>
  )
}
