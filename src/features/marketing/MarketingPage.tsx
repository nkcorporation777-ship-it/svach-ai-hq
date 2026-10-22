import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { AlertTriangle, Megaphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnalyticsTab } from "./AnalyticsTab"
import { CalendarTab } from "./CalendarTab"
import { MetricsDialog } from "./MetricsDialog"
import { PostDialog } from "./PostDialog"
import { PostsTab } from "./PostsTab"
import { useMarketingSettings, useSocialPosts, type SocialPost } from "./hooks"

const TABS = [
  { id: "calendar", label: "Calendar" },
  { id: "posts", label: "Posts" },
  { id: "analytics", label: "Analytics" },
] as const

type TabId = (typeof TABS)[number]["id"]

/** Marketing (Phase 4): a content calendar for Svach AI's own social media.
 * HQ schedules; n8n posts (social-publish hands each due post to the webhook
 * set in Settings, n8n reports back to social-callback). Stats are typed in
 * per post until n8n sends them too. */
export function MarketingPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "calendar") as TabId
  const navRef = useRef<HTMLElement>(null)

  // On narrow screens the tab row scrolls; keep the open tab in view.
  useEffect(() => {
    const show = () =>
      navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" })
    show()
    // Web fonts arriving late widen the labels.
    document.fonts?.ready.then(show)
  }, [tab])

  const { data: posts, isLoading } = useSocialPosts()
  const { data: settings } = useMarketingSettings()

  const [postDialog, setPostDialog] = useState<{ open: boolean; post: SocialPost | null; when?: string }>({
    open: false,
    post: null,
  })
  const [metricsPost, setMetricsPost] = useState<SocialPost | null>(null)

  const all = posts ?? []
  const openPost = (post: SocialPost) => setPostDialog({ open: true, post })
  const newPost = (when?: string) => setPostDialog({ open: true, post: null, when })
  // Reopen the latest copy so the dialog reflects status changes from the background refresh.
  const livePost = postDialog.post ? (all.find((p) => p.id === postDialog.post!.id) ?? postDialog.post) : null
  const liveMetricsPost = metricsPost ? (all.find((p) => p.id === metricsPost.id) ?? metricsPost) : null

  const waiting = all.filter((p) => p.status === "scheduled").length
  const failed = all.filter((p) => p.status === "failed").length
  const noWebhook = settings && !settings.n8n_publish_webhook_url

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">Marketing</p>
        <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-semibold">
          <Megaphone className="size-7 text-brand-cyan" />
          Marketing
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Plan and schedule social posts. When one is due, HQ hands it to n8n to publish; you log how it did.
        </p>
      </header>

      {noWebhook && waiting > 0 && (
        <Link
          to="/settings#marketing"
          className="flex items-center gap-3 rounded-[var(--radius-card)] border border-status-warning bg-status-warning/10 px-4 py-3 text-sm font-medium text-status-warning hover:bg-status-warning/20"
        >
          <AlertTriangle className="size-4 shrink-0" />
          {waiting} scheduled post{waiting === 1 ? "" : "s"} can't go out until the n8n webhook is set in Settings.
          Click to set it.
        </Link>
      )}
      {failed > 0 && (
        <button
          type="button"
          onClick={() => setParams({ tab: "posts" })}
          className="flex items-center gap-3 rounded-[var(--radius-card)] border border-status-error bg-status-error/10 px-4 py-3 text-left text-sm font-medium text-status-error hover:bg-status-error/20"
        >
          <AlertTriangle className="size-4 shrink-0" />
          {failed} post{failed === 1 ? "" : "s"} failed to publish. Open to reschedule or mark as posted.
        </button>
      )}

      <nav ref={navRef} className="flex gap-1 overflow-x-auto border-b border-border pb-px [scrollbar-width:none]">
        {TABS.map((t) => (
          <button
            key={t.id}
            aria-current={tab === t.id ? "page" : undefined}
            type="button"
            onClick={() => setParams(t.id === "calendar" ? {} : { tab: t.id })}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-2 text-sm whitespace-nowrap transition-colors",
              tab === t.id
                ? "border-brand-cyan text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "calendar" && <CalendarTab posts={all} onOpenPost={openPost} onNewPost={newPost} />}
      {tab === "posts" && (
        <PostsTab
          posts={all}
          isLoading={isLoading}
          onOpenPost={openPost}
          onNewPost={() => newPost()}
          onOpenMetrics={setMetricsPost}
        />
      )}
      {tab === "analytics" && <AnalyticsTab posts={all} onOpenMetrics={setMetricsPost} />}

      <PostDialog
        open={postDialog.open}
        onOpenChange={(open) => setPostDialog((d) => ({ ...d, open }))}
        post={livePost}
        defaultWhen={postDialog.when}
      />
      <MetricsDialog
        open={!!metricsPost}
        onOpenChange={(open) => !open && setMetricsPost(null)}
        post={liveMetricsPost}
      />
    </div>
  )
}
