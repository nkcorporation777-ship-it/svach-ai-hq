// n8n reports back here after it has tried to post something social-publish
// handed it: published (with the live URL), or failed (with the reason). It can
// also send stats per platform, which land in social_post_metrics exactly as if
// the Owner had typed them in.
//
// Server-to-server (verify_jwt = false); auth is the shared `x-hq-secret`
// header (Edge secret N8N_MARKETING_SECRET) that social-publish also sends.
//
// Body: { post_id, status: "published" | "failed", published_url?, error?,
//         metrics?: [{ platform, impressions?, reactions?, comments?, shares?, clicks? }] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PLATFORMS = new Set(["linkedin", "instagram", "facebook", "x", "youtube", "threads"])
const METRIC_FIELDS = ["impressions", "reactions", "comments", "shares", "clicks"] as const

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" })
  const expected = Deno.env.get("N8N_MARKETING_SECRET")
  const given = req.headers.get("x-hq-secret") ?? ""
  if (!expected || !timingSafeEqual(given, expected)) return json(401, { error: "Unauthorized" })

  const body = await req.json().catch(() => null)
  const postId = body?.post_id
  const status = body?.status
  if (typeof postId !== "string" || (status !== "published" && status !== "failed" && status !== undefined)) {
    return json(400, { error: "post_id is required; status must be 'published' or 'failed' when given." })
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const { data: post } = await admin.from("social_posts").select("id, status").eq("id", postId).maybeSingle()
  if (!post) return json(404, { error: "Post not found." })

  if (status === "published") {
    const url = typeof body.published_url === "string" && /^https?:\/\//i.test(body.published_url) ? body.published_url : null
    const { error } = await admin
      .from("social_posts")
      .update({ status: "published", published_at: new Date().toISOString(), published_url: url, last_error: null })
      .eq("id", postId)
    if (error) return json(500, { error: error.message })
  } else if (status === "failed") {
    const reason = typeof body.error === "string" && body.error.trim() ? body.error.trim().slice(0, 500) : "n8n reported a failure"
    const { error } = await admin.from("social_posts").update({ status: "failed", last_error: reason }).eq("id", postId)
    if (error) return json(500, { error: error.message })
  }

  let metricsSaved = 0
  if (Array.isArray(body.metrics)) {
    const rows = body.metrics
      .filter((m: Record<string, unknown>) => typeof m?.platform === "string" && PLATFORMS.has(m.platform))
      .map((m: Record<string, unknown>) => {
        const row: Record<string, unknown> = { post_id: postId, platform: m.platform, recorded_at: new Date().toISOString() }
        for (const f of METRIC_FIELDS) {
          const v = Number(m[f])
          if (m[f] !== undefined && m[f] !== null && Number.isFinite(v) && v >= 0) row[f] = Math.round(v)
        }
        return row
      })
    if (rows.length) {
      const { error } = await admin.from("social_post_metrics").upsert(rows, { onConflict: "post_id,platform" })
      if (error) return json(500, { error: error.message })
      metricsSaved = rows.length
    }
  }

  await admin.from("audit_logs").insert({
    actor_type: "system",
    action: status ? `marketing.post_${status}` : "marketing.post_metrics_updated",
    entity_type: "social_post",
    entity_id: postId,
    metadata: { source: "n8n", metrics: metricsSaved },
  })

  return json(200, { ok: true, metrics_saved: metricsSaved })
})
