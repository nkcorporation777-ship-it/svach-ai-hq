import { useCallback, useEffect, useRef, useState } from "react"
import type { WebCallToken } from "./hooks"

export type WebCallStatus = "idle" | "connecting" | "live" | "ended" | "error"

export interface TranscriptLine {
  role: "agent" | "user"
  content: string
}

// The slice of Retell's (legacy) RetellWebClient we use. Typed here, not imported
// at the top, so the SDK is only downloaded when someone actually starts a call.
interface WebClient {
  on(event: string, handler: (...args: never[]) => void): unknown
  startCall(config: {
    accessToken: string
    callId?: string
    transport?: "livekit" | "gateway"
    iceServers?: RTCIceServer[]
    url?: string
  }): Promise<void>
  stopCall(): void
  mute(): void
  unmute(): void
}

/** Talk to a Retell agent through the browser microphone. The caller supplies
 * `getToken` (our server mints the short-lived token so the Retell key never
 * reaches the browser). The SDK's RetellWebClient is the stable path while
 * RetellClient 3.x needs a public key + the transcript needs a wider key. */
export function useWebCall() {
  const clientRef = useRef<WebClient | null>(null)
  const [status, setStatus] = useState<WebCallStatus>("idle")
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [agentTalking, setAgentTalking] = useState(false)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    clientRef.current?.stopCall()
  }, [])

  useEffect(() => () => clientRef.current?.stopCall(), [])

  const start = useCallback(async (getToken: () => Promise<WebCallToken>) => {
    setError(null)
    setTranscript([])
    setMuted(false)
    setStatus("connecting")
    try {
      // Ask for the microphone first so a denial gives a clear message, and so
      // the token (valid for ~30 s) isn't wasted waiting on a permission prompt.
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
        probe.getTracks().forEach((t) => t.stop())
      } catch {
        throw new Error("Microphone access is blocked — allow it in your browser's address bar and try again.")
      }
      const token = await getToken()
      const { RetellWebClient } = await import("retell-client-js-sdk")
      const client = new RetellWebClient() as unknown as WebClient
      clientRef.current = client
      client.on("call_started", () => setStatus("live"))
      client.on("call_ended", () => {
        setStatus("ended")
        setAgentTalking(false)
      })
      client.on("agent_start_talking", () => setAgentTalking(true))
      client.on("agent_stop_talking", () => setAgentTalking(false))
      client.on("update", ((update: { transcript?: { role: string; content: string }[] }) => {
        if (!Array.isArray(update?.transcript)) return
        setTranscript(
          update.transcript
            .filter((t) => (t.role === "agent" || t.role === "user") && t.content)
            .map((t) => ({ role: t.role as "agent" | "user", content: t.content })),
        )
      }) as never)
      client.on("error", ((err: unknown) => {
        setError(err instanceof Error ? err.message : "The call hit a problem.")
        setStatus("error")
        client.stopCall()
      }) as never)
      await client.startCall({
        accessToken: token.access_token,
        callId: token.call_id,
        transport: token.transport,
        iceServers: token.ice_servers,
        url: token.url,
      })
      setStatus((s) => (s === "connecting" ? "live" : s))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the call.")
      setStatus("error")
    }
  }, [])

  const toggleMute = useCallback(() => {
    const client = clientRef.current
    if (!client) return
    setMuted((m) => {
      if (m) client.unmute()
      else client.mute()
      return !m
    })
  }, [])

  return { status, transcript, agentTalking, muted, error, start, stop, toggleMute }
}
