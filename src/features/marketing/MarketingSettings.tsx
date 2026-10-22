import { useEffect, useState } from "react"
import { Share2 } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useMarketingSettings, useUpdateMarketingSettings } from "./hooks"

const CALLBACK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-callback`

/** Settings → Marketing: where HQ sends due posts, and what n8n sends back. */
export function MarketingSettings() {
  const { data: settings } = useMarketingSettings()
  const save = useUpdateMarketingSettings()
  const [webhookUrl, setWebhookUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (settings) setWebhookUrl(settings.n8n_publish_webhook_url ?? "")
  }, [settings])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await save.mutateAsync({ webhookUrl })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.")
    }
  }

  return (
    <GlowCard tone="violet" className="max-w-2xl">
      <div id="marketing" className="flex scroll-mt-6 items-center gap-2">
        <Share2 className="size-4 text-brand-cyan" />
        <h2 className="font-display text-base font-semibold">Marketing: n8n publishing</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Every 5 minutes HQ sends each due post to this n8n webhook, which posts it to the platforms. Until it's set,
        scheduled posts wait in the queue.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="n8n_webhook">n8n webhook URL</Label>
          <Input
            id="n8n_webhook"
            type="url"
            placeholder="https://svach001.app.n8n.cloud/webhook/…"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer text-foreground">How to wire the n8n workflow</summary>
          <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
            <li>
              HQ POSTs <code>{"{ event: \"social_post.due\", post: { id, title, body, platforms, media_urls, link_url, campaign, scheduled_at } }"}</code>{" "}
              with an <code>x-hq-secret</code> header. Check it matches the secret you set as{" "}
              <code>N8N_HQ_SECRET</code> in Supabase.
            </li>
            <li>Answer with any 2xx straight away. Anything else counts as a failed hand-off (retried up to 3 times).</li>
            <li>
              When the posting is done, POST to <code className="break-all">{CALLBACK_URL}</code> with the same{" "}
              <code>x-hq-secret</code> header and{" "}
              <code>{"{ post_id, status: \"published\" | \"failed\", published_url?, error?, metrics? }"}</code>.
            </li>
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
