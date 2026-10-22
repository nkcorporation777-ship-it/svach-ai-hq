import { useEffect, useState } from "react"
import { Workflow } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useN8nSettings, useUpdateN8nSettings } from "./hooks"

/** Settings → n8n automations: where HQ sends each new lead, and a reminder of
 * what the other workflows need. Social posting has its own card (Marketing). */
export function N8nSettings() {
  const { data: settings } = useN8nSettings()
  const save = useUpdateN8nSettings()
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (settings) setUrl(settings.new_lead_webhook_url ?? "")
  }, [settings])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await save.mutateAsync({ newLeadWebhookUrl: url })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.")
    }
  }

  return (
    <GlowCard tone="cyan" className="max-w-2xl">
      <div id="n8n" className="flex scroll-mt-6 items-center gap-2">
        <Workflow className="size-4 text-brand-cyan" />
        <h2 className="font-display text-base font-semibold">n8n automations</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        n8n emails you about every new lead and sends a follow-up digest at 8:30 AM. Each run, and any failure,
        shows under System Health on the Dashboard.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="n8n_new_lead">New Lead Alert webhook URL</Label>
          <Input
            id="n8n_new_lead"
            type="url"
            placeholder="https://svach001.app.n8n.cloud/webhook/svach-hq-new-lead"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Until it's set, new leads still save normally; System Health notes that no alert went out.
          </p>
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer text-foreground">What n8n needs</summary>
          <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
            <li>
              One shared secret: set it as <code>N8N_HQ_SECRET</code> in Supabase and in n8n's{" "}
              <strong>Svach HQ secret</strong> credential (Header Auth, name <code>x-hq-secret</code>).
            </li>
            <li>
              An SMTP credential <strong>Svach email</strong> for the alert and digest emails, plus the from / to
              addresses on the email nodes.
            </li>
            <li>Publish the workflows, then paste the New Lead Alert production URL above.</li>
          </ol>
        </details>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <Button type="submit" className="self-start" disabled={save.isPending || !settings}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        {save.isSuccess && <p className="text-sm text-status-success">Saved.</p>}
      </form>
    </GlowCard>
  )
}
