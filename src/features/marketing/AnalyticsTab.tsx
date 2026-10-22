import { useState } from "react"
import { GlowCard } from "@/components/shared/GlowCard"
import { Stat } from "@/features/finance/FinanceBits"
import { cn } from "@/lib/utils"
import { PLATFORMS, engagementOf, type SocialPost } from "./hooks"

const PERIODS = [
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
  { id: "all", label: "All time", days: null },
] as const

const n = (v: number) => v.toLocaleString("en-IN")
const rate = (eng: number, imp: number) => (imp > 0 ? `${((eng / imp) * 100).toFixed(1)}%` : "—")

/** Totals from the stats typed in (or sent by n8n) for published posts. Only
 * as complete as the numbers entered — posts without stats are called out. */
export function AnalyticsTab({ posts, onOpenMetrics }: { posts: SocialPost[]; onOpenMetrics: (post: SocialPost) => void }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("30")
  const days = PERIODS.find((p) => p.id === period)!.days
  const since = days ? Date.now() - days * 86_400_000 : 0

  const published = posts.filter(
    (p) => p.status === "published" && p.published_at && new Date(p.published_at).getTime() >= since,
  )
  const missingStats = published.filter((p) => p.social_post_metrics.length === 0)

  let impressions = 0
  let engagement = 0
  const perPlatform = new Map<string, { posts: number; impressions: number; engagement: number }>()
  for (const p of published) {
    for (const m of p.social_post_metrics) {
      impressions += m.impressions ?? 0
      engagement += engagementOf(m)
      const row = perPlatform.get(m.platform) ?? { posts: 0, impressions: 0, engagement: 0 }
      row.posts++
      row.impressions += m.impressions ?? 0
      row.engagement += engagementOf(m)
      perPlatform.set(m.platform, row)
    }
  }
  const top = published
    .map((p) => ({ post: p, engagement: p.social_post_metrics.reduce((s, m) => s + engagementOf(m), 0) }))
    .filter((x) => x.engagement > 0)
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 5)
  const upcoming = posts.filter((p) => p.status === "scheduled").length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 self-start rounded-[var(--radius-pill)] border border-border p-1">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={cn(
              "rounded-[var(--radius-pill)] px-3 py-1 text-xs transition-colors",
              period === p.id ? "bg-brand-cyan/15 text-brand-cyan" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GlowCard tone="cyan">
          <Stat label="Published" value={n(published.length)} sub={`${upcoming} more scheduled`} />
        </GlowCard>
        <GlowCard tone="violet">
          <Stat label="Impressions" value={n(impressions)} sub="From stats entered" />
        </GlowCard>
        <GlowCard tone="green">
          <Stat label="Engagement" value={n(engagement)} sub="Reactions, comments, shares, clicks" />
        </GlowCard>
        <GlowCard tone="amber">
          <Stat label="Engagement rate" value={rate(engagement, impressions)} sub="Engagement ÷ impressions" />
        </GlowCard>
      </div>

      {missingStats.length > 0 && (
        <GlowCard tone="amber">
          <p className="text-sm">
            {missingStats.length} published post{missingStats.length === 1 ? " has" : "s have"} no stats yet, so these
            totals are incomplete.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingStats.slice(0, 6).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpenMetrics(p)}
                className="rounded-[var(--radius-pill)] border border-status-warning/40 px-3 py-1 text-xs text-status-warning hover:bg-status-warning/10"
              >
                Add stats: {p.title}
              </button>
            ))}
          </div>
        </GlowCard>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlowCard tone="cyan">
          <h2 className="font-display text-base font-semibold">By platform</h2>
          {perPlatform.size === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No stats in this period yet.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-normal">Platform</th>
                  <th className="pb-2 text-right font-normal">Posts</th>
                  <th className="pb-2 text-right font-normal">Impressions</th>
                  <th className="pb-2 text-right font-normal">Engagement</th>
                  <th className="pb-2 text-right font-normal">Rate</th>
                </tr>
              </thead>
              <tbody>
                {PLATFORMS.filter((p) => perPlatform.has(p.value)).map((p) => {
                  const row = perPlatform.get(p.value)!
                  return (
                    <tr key={p.value} className="border-t border-border/60">
                      <td className="py-2">{p.label}</td>
                      <td className="py-2 text-right">{n(row.posts)}</td>
                      <td className="py-2 text-right">{n(row.impressions)}</td>
                      <td className="py-2 text-right">{n(row.engagement)}</td>
                      <td className="py-2 text-right">{rate(row.engagement, row.impressions)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </GlowCard>

        <GlowCard tone="green">
          <h2 className="font-display text-base font-semibold">Top posts</h2>
          {top.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No engagement recorded in this period yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {top.map(({ post, engagement: e }) => (
                <li key={post.id} className="flex items-center justify-between gap-3 text-sm">
                  <button type="button" className="truncate text-left hover:underline" onClick={() => onOpenMetrics(post)}>
                    {post.title}
                  </button>
                  <span className="shrink-0 font-medium">{n(e)}</span>
                </li>
              ))}
            </ul>
          )}
        </GlowCard>
      </div>
    </div>
  )
}
