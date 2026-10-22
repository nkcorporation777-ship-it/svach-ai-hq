// Hands due social posts to n8n, which does the actual posting to LinkedIn /
// Instagram / etc. HQ never talks to the platforms itself (Marketing, Phase 4).
// Called every 5 minutes by a pg_cron job through pg_net — never by a browser —
// so auth is the same shared secret the other cron functions use (vault:
// onboarding_trigger_secret, Edge secret: ONBOARDING_TRIGGER_SECRET).
//
// The n8n webhook URL lives in marketing_settings (Settings → Marketing). Each
// request carries `x-hq-secret` (Edge secret N8N_HQ_SECRET) so the n8n
// workflow can check it really came from HQ. A post n8n accepts becomes
// `handed_off`; n8n then reports the outcome to social-callback. A failed
// hand-off is retried on the next runs, up to MAX_ATTEMPTS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const BATCH = 20
const MAX_ATTEMPTS = 3
const TIMEOUT_MS = 15_000
const NO_WEBHOOK = "n8n webhook URL not set (Settings → Marketing)"

Deno.serve(async (req) => {
  const secret = req.headers.get("x-onboarding-secret")
  if (!secret || secret !== Deno.env.get("ONBOARDING_TRIGGER_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const summary = { due: 0, handed_off: 0, retrying: 0, failed: 0, waiting_for_webhook: 0 }

  try {
    // A run that died mid-send leaves posts in `sending`; put them back in the queue.
    await admin
      .from("social_posts")
      .update({ status: "scheduled" })
      .eq("status", "sending")
      .lt("updated_at", new Date(Date.now() - 10 * 60_000).toISOString())

    const { data: due, error } = await admin
      .from("social_posts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(BATCH)
    if (error) throw error
    summary.due = due?.length ?? 0
    if (!due?.length) return Response.json(summary)

    const { data: settings } = await admin.from("marketing_settings").select("n8n_publish_webhook_url").maybeSingle()
    const webhookUrl = settings?.n8n_publish_webhook_url?.trim()
    if (!webhookUrl || !/^https:\/\//i.test(webhookUrl)) {
      // Leave them queued; they go out as soon as the webhook is set.
      await admin
        .from("social_posts")
        .update({ last_error: NO_WEBHOOK })
        .in("id", due.filter((p) => p.last_error !== NO_WEBHOOK).map((p) => p.id))
      summary.waiting_for_webhook = due.length
      return Response.json(summary)
    }
    const hqSecret = Deno.env.get("N8N_HQ_SECRET") ?? ""

    for (const post of due) {
      // Claim it so an overlapping run can't hand it off twice.
      const { data: claimed } = await admin
        .from("social_posts")
        .update({ status: "sending" })
        .eq("id", post.id)
        .eq("status", "scheduled")
        .select("id")
      if (!claimed?.length) continue

      const attempts = post.attempts + 1
      let failure: string | null = null
      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json", ...(hqSecret ? { "x-hq-secret": hqSecret } : {}) },
          body: JSON.stringify({
            event: "social_post.due",
            post: {
              id: post.id,
              title: post.title,
              body: post.body,
              platforms: post.platforms,
              media_urls: post.media_urls,
              link_url: post.link_url,
              campaign: post.campaign,
              scheduled_at: post.scheduled_at,
            },
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if (!res.ok) failure = `n8n answered ${res.status} ${(await res.text()).slice(0, 200)}`.trim()
      } catch (err) {
        failure = `Could not reach n8n: ${err instanceof Error ? err.message : String(err)}`
      }

      if (!failure) {
        await admin
          .from("social_posts")
          .update({ status: "handed_off", handed_off_at: new Date().toISOString(), attempts, last_error: null })
          .eq("id", post.id)
        summary.handed_off++
      } else if (attempts >= MAX_ATTEMPTS) {
        await admin.from("social_posts").update({ status: "failed", attempts, last_error: failure }).eq("id", post.id)
        summary.failed++
      } else {
        await admin.from("social_posts").update({ status: "scheduled", attempts, last_error: failure }).eq("id", post.id)
        summary.retrying++
      }
    }

    return Response.json(summary)
  } catch (err) {
    console.error("social-publish failed:", err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err), summary }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
})
