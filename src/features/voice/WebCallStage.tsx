import { Mic, MicOff, PhoneOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TranscriptLine, WebCallStatus } from "./useWebCall"

/** The visual half of a web call: a pulsing orb, controls and the live
 * transcript. Used by the in-app Talk tab and the public "Try our agent" page. */
export function WebCallStage({
  status,
  agentTalking,
  muted,
  transcript,
  error,
  onStart,
  onStop,
  onToggleMute,
  startLabel = "Start talking",
  startDisabled = false,
}: {
  status: WebCallStatus
  agentTalking: boolean
  muted: boolean
  transcript: TranscriptLine[]
  error: string | null
  onStart: () => void
  onStop: () => void
  onToggleMute: () => void
  startLabel?: string
  startDisabled?: boolean
}) {
  const live = status === "live"
  const busy = status === "connecting"

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative flex size-36 items-center justify-center">
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-full bg-brand-cyan/30 blur-2xl transition-opacity",
            live || busy ? "opacity-100" : "opacity-30",
          )}
          style={{ animation: live || busy ? "glow-pulse 2.4s ease-in-out infinite" : undefined }}
        />
        <div
          className={cn(
            "relative flex size-24 items-center justify-center rounded-full border border-brand-cyan/40 bg-brand-cyan/10 transition-transform",
            agentTalking && "scale-110",
          )}
        >
          <Mic className={cn("size-9", live ? "text-brand-cyan" : "text-muted-foreground")} />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {status === "idle" && "Press start and allow the microphone."}
        {status === "connecting" && "Connecting…"}
        {live && (agentTalking ? "The agent is speaking…" : muted ? "Your microphone is muted." : "Listening — go ahead and speak.")}
        {status === "ended" && "The call has ended."}
        {status === "error" && "Something went wrong."}
      </p>

      {error && <p className="max-w-md text-center text-sm text-status-error">{error}</p>}

      <div className="flex items-center gap-3">
        {live || busy ? (
          <>
            <Button variant="ghost" size="sm" onClick={onToggleMute} disabled={!live}>
              {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              {muted ? "Unmute" : "Mute"}
            </Button>
            <Button size="sm" onClick={onStop} className="bg-status-error text-white hover:bg-status-error/90">
              <PhoneOff className="size-4" />
              End call
            </Button>
          </>
        ) : (
          <Button onClick={onStart} disabled={startDisabled}>
            <Mic className="size-4" />
            {status === "ended" || status === "error" ? "Talk again" : startLabel}
          </Button>
        )}
      </div>

      {transcript.length > 0 && (
        <div className="flex max-h-80 w-full max-w-xl flex-col gap-2 overflow-y-auto rounded-xl border border-foreground/10 bg-[var(--inset)] p-4">
          {transcript.map((t, i) => (
            <div key={i} className={cn("flex", t.role === "agent" ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                  t.role === "agent"
                    ? "rounded-bl-sm border border-brand-cyan/30 bg-brand-cyan/10"
                    : "rounded-br-sm border border-foreground/10 bg-foreground/5",
                )}
              >
                {t.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
