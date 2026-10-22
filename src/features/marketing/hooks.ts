import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"
import type { Tables } from "@/types/database"

// ── Shared vocabulary ───────────────────────────────────────────────────────

export const PLATFORMS = [
  { value: "linkedin", label: "LinkedIn", limit: 3000 },
  { value: "instagram", label: "Instagram", limit: 2200 },
  { value: "facebook", label: "Facebook", limit: 63206 },
  { value: "x", label: "X", limit: 280 },
  { value: "youtube", label: "YouTube", limit: 5000 },
  { value: "threads", label: "Threads", limit: 500 },
] as const
export type Platform = (typeof PLATFORMS)[number]["value"]

export const platformLabel = (p: string) => PLATFORMS.find((x) => x.value === p)?.label ?? p

export type PostStatus = "draft" | "scheduled" | "sending" | "handed_off" | "published" | "failed" | "cancelled"

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  handed_off: "Sent to n8n",
  published: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
}

/** Dot colour for the calendar, same meaning as the badge. */
export const STATUS_DOT: Record<PostStatus, string> = {
  draft: "bg-muted-foreground",
  scheduled: "bg-brand-cyan",
  sending: "bg-status-info",
  handed_off: "bg-status-info",
  published: "bg-status-success",
  failed: "bg-status-error",
  cancelled: "bg-muted-foreground/50",
}

const pad = (n: number) => String(n).padStart(2, "0")

/** ISO timestamp → the local "yyyy-mm-ddTHH:mm" shape DateTimeField uses. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return ""
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}

export type SocialPost = Tables<"social_posts"> & { social_post_metrics: Tables<"social_post_metrics">[] }

export const METRIC_FIELDS = [
  { key: "impressions", label: "Impressions" },
  { key: "reactions", label: "Reactions" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "clicks", label: "Clicks" },
] as const
export type MetricKey = (typeof METRIC_FIELDS)[number]["key"]

/** Reactions + comments + shares + clicks — everything except plain views. */
export function engagementOf(m: Partial<Record<MetricKey, number | null>>) {
  return (m.reactions ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.clicks ?? 0)
}

// ── Posts ───────────────────────────────────────────────────────────────────

export function useSocialPosts() {
  return useQuery({
    queryKey: ["marketing", "posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_posts")
        .select("*, social_post_metrics(*)")
        .order("scheduled_at", { ascending: false, nullsFirst: true })
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as SocialPost[]
    },
    // Statuses move on their own (cron hand-off, n8n callback); keep the view fresh.
    refetchInterval: 60_000,
  })
}

export interface SavePostInput {
  id?: string
  title: string
  body: string
  platforms: Platform[]
  linkUrl: string
  mediaUrls: string[]
  campaign: string
  /** ISO timestamp; null keeps it a draft. */
  scheduledAt: string | null
}

/** Creates or edits a post. A time makes it `scheduled` (the cron hands it to
 * n8n when due); no time keeps it a `draft`. Only drafts, scheduled and failed
 * posts are editable — once n8n has it, it's out of HQ's hands. */
export function useSavePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SavePostInput) => {
      if (!input.title.trim()) throw new Error("Give the post a title.")
      if (input.scheduledAt) {
        if (input.platforms.length === 0) throw new Error("Pick at least one platform to schedule it.")
        if (!input.body.trim()) throw new Error("Write the post before scheduling it.")
      }
      const row = {
        title: input.title.trim(),
        body: input.body,
        platforms: input.platforms,
        link_url: input.linkUrl.trim() || null,
        media_urls: input.mediaUrls.map((u) => u.trim()).filter(Boolean),
        campaign: input.campaign.trim() || null,
        scheduled_at: input.scheduledAt,
        status: input.scheduledAt ? "scheduled" : "draft",
        attempts: 0,
        last_error: null,
      }

      if (input.id) {
        const { data, error } = await supabase
          .from("social_posts")
          .update(row)
          .eq("id", input.id)
          .in("status", ["draft", "scheduled", "failed"])
          .select("id")
        if (error) throw error
        if (!data?.length) throw new Error("This post has already gone to n8n and can't be edited.")
        await logAudit({
          action: input.scheduledAt ? "marketing.post_scheduled" : "marketing.post_updated",
          entityType: "social_post",
          entityId: input.id,
        })
        return { id: input.id }
      }

      const { data: user } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from("social_posts")
        .insert({ ...row, created_by: user.user?.id ?? null })
        .select("id")
        .single()
      if (error) throw error
      await logAudit({
        action: input.scheduledAt ? "marketing.post_scheduled" : "marketing.post_created",
        entityType: "social_post",
        entityId: data.id,
        metadata: { platforms: input.platforms },
      })
      return { id: data.id }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing"] })
    },
  })
}

/** For posts you put up yourself, or when n8n posted but didn't report back. */
export function useMarkPublished() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, publishedUrl }: { id: string; publishedUrl: string }) => {
      const { error } = await supabase
        .from("social_posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          published_url: publishedUrl.trim() || null,
          last_error: null,
        })
        .eq("id", id)
      if (error) throw error
      await logAudit({ action: "marketing.post_marked_published", entityType: "social_post", entityId: id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing"] })
    },
  })
}

export function useCancelPost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("social_posts")
        .update({ status: "cancelled" })
        .eq("id", id)
        .in("status", ["draft", "scheduled", "failed"])
        .select("id")
      if (error) throw error
      if (!data?.length) throw new Error("This post has already gone to n8n.")
      await logAudit({ action: "marketing.post_cancelled", entityType: "social_post", entityId: id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing"] })
    },
  })
}

export function useDeletePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("social_posts").delete().eq("id", id)
      if (error) throw error
      await logAudit({ action: "marketing.post_deleted", entityType: "social_post", entityId: id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing"] })
    },
  })
}

// ── Stats (typed in by hand; n8n can also send them to social-callback) ─────

export type MetricsInput = Record<Platform, Partial<Record<MetricKey, number | null>>>

export function useSaveMetrics() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ postId, metrics }: { postId: string; metrics: Partial<MetricsInput> }) => {
      const rows = Object.entries(metrics).map(([platform, m]) => ({
        post_id: postId,
        platform,
        impressions: m?.impressions ?? null,
        reactions: m?.reactions ?? null,
        comments: m?.comments ?? null,
        shares: m?.shares ?? null,
        clicks: m?.clicks ?? null,
        recorded_at: new Date().toISOString(),
      }))
      if (rows.length === 0) return
      const { error } = await supabase.from("social_post_metrics").upsert(rows, { onConflict: "post_id,platform" })
      if (error) throw error
      await logAudit({ action: "marketing.post_metrics_updated", entityType: "social_post", entityId: postId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing"] })
    },
  })
}

// ── Settings ────────────────────────────────────────────────────────────────

export function useMarketingSettings() {
  return useQuery({
    queryKey: ["marketing", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketing_settings").select("*").maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateMarketingSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ webhookUrl }: { webhookUrl: string }) => {
      const url = webhookUrl.trim()
      if (url && !/^https:\/\//i.test(url)) throw new Error("The webhook URL must start with https://")
      const { error } = await supabase
        .from("marketing_settings")
        .update({ n8n_publish_webhook_url: url || null, updated_at: new Date().toISOString() })
        .eq("id", true)
      if (error) throw error
      await logAudit({ action: "settings.marketing_settings_updated", entityType: "marketing_settings" })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "settings"] })
    },
  })
}
