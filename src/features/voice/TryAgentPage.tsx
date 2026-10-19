import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { GlowCard } from "@/components/shared/GlowCard"
import type { WebCallToken } from "./hooks"
import { useWebCall } from "./useWebCall"
import { WebCallStage } from "./WebCallStage"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const ENDPOINT = `${supabaseUrl}/functions/v1/voice-web-call-public`

async function post(body: Record<string, unknown>) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: supabaseAnonKey },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong — please try again.")
  return data
}

/** Public page — a prospect talks to the demo agent from their own browser.
 * No HQ login: the link's token is the key, and the server enforces the caps. */
export function TryAgentPage() {
  const { token } = useParams<{ token: string }>()
  const [link, setLink] = useState<{ label: string; available: boolean } | "invalid" | null>(null)
  const [agreed, setAgreed] = useState(false)
  const call = useWebCall()

  useEffect(() => {
    if (!token) return
    post({ token, action: "check" })
      .then((d) => setLink({ label: d.label, available: d.available }))
      .catch(() => setLink("invalid"))
  }, [token])

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-12">
      <header className="text-center">
        <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">Svach AI</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          {link && link !== "invalid" ? link.label : "Talk to our voice agent"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Have a real conversation with an AI receptionist — ask about pricing, or try booking a call.
        </p>
      </header>

      {link === null ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : link === "invalid" ? (
        <GlowCard tone="red">
          <p className="text-center text-sm">This demo link isn't active. Please ask us for a new one.</p>
        </GlowCard>
      ) : !link.available ? (
        <GlowCard tone="amber">
          <p className="text-center text-sm">Today's demo slots are all taken — please try again tomorrow.</p>
        </GlowCard>
      ) : (
        <GlowCard tone="cyan" pulse>
          <div className="flex flex-col items-center gap-6">
            <WebCallStage
              status={call.status}
              agentTalking={call.agentTalking}
              muted={call.muted}
              transcript={call.transcript}
              error={call.error}
              startDisabled={!agreed}
              startLabel="Start the conversation"
              onStart={() => call.start(async () => (await post({ token, action: "start" })) as WebCallToken)}
              onStop={call.stop}
              onToggleMute={call.toggleMute}
            />
            {(call.status === "idle" || call.status === "ended" || call.status === "error") && (
              <label className="flex max-w-sm items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span>
                  I understand I'm talking to an AI assistant, and that the call may be recorded and
                  transcribed so Svach AI can improve this demo.
                </span>
              </label>
            )}
          </div>
        </GlowCard>
      )}
    </div>
  )
}
