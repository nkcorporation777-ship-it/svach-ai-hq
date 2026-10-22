import { useState } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { STATUS_DOT, type PostStatus, type SocialPost } from "./hooks"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const pad = (n: number) => String(n).padStart(2, "0")
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Month grid of everything with a date: scheduled, sent and published posts.
 * Click a day to write a post for it, a post to open it. Drafts without a
 * date live in the Posts tab. */
export function CalendarTab({
  posts,
  onOpenPost,
  onNewPost,
}: {
  posts: SocialPost[]
  onOpenPost: (post: SocialPost) => void
  onNewPost: (when?: string) => void
}) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const byDay = new Map<string, SocialPost[]>()
  for (const p of posts) {
    const iso = p.published_at ?? p.scheduled_at
    if (!iso || p.status === "cancelled") continue
    const key = dayKey(new Date(iso))
    byDay.set(key, [...(byDay.get(key) ?? []), p])
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => (a.published_at ?? a.scheduled_at ?? "").localeCompare(b.published_at ?? b.scheduled_at ?? ""))
  }

  const lead = (month.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ]
  while (cells.length % 7) cells.push(null)
  const today = dayKey(new Date())
  const undated = posts.filter((p) => p.status === "draft" && !p.scheduled_at).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Previous month"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft />
          </Button>
          <h2 className="min-w-32 text-center font-display text-base font-semibold sm:min-w-40 sm:text-lg">
            {month.toLocaleString("en-IN", { month: "long", year: "numeric" })}
          </h2>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Next month"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {undated > 0 && (
            <span className="text-xs text-muted-foreground">
              {undated} undated draft{undated === 1 ? "" : "s"} in Posts
            </span>
          )}
          <Button onClick={() => onNewPost()}>
            <Plus className="size-4" />
            New post
          </Button>
        </div>
      </div>

      <GlowCard tone="cyan" className="p-2 sm:p-4">
        <div className="grid grid-cols-7 gap-px text-center text-xs text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-2">
              <span className="hidden sm:inline">{w}</span>
              <span className="sm:hidden">{w[0]}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="min-h-16 sm:min-h-24" />
            const key = dayKey(d)
            const items = byDay.get(key) ?? []
            const past = key < today
            return (
              <div
                key={i}
                className={cn(
                  "group flex min-h-16 flex-col gap-1 rounded-md border border-border/60 p-1 text-left sm:min-h-24 sm:p-1.5",
                  key === today && "border-brand-cyan/60",
                  past && "opacity-70",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("text-xs", key === today ? "font-semibold text-brand-cyan" : "text-muted-foreground")}>
                    {d.getDate()}
                  </span>
                  {!past && (
                    <button
                      type="button"
                      aria-label={`New post on ${key}`}
                      onClick={() => onNewPost(`${key}T10:00`)}
                      className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  )}
                </div>
                {items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onOpenPost(p)}
                    title={p.title}
                    className="flex items-center gap-1 truncate rounded bg-white/5 px-1 py-0.5 text-left text-[11px] hover:bg-white/10"
                  >
                    <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[p.status as PostStatus])} />
                    <span className="hidden truncate sm:inline">{p.title}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </GlowCard>
    </div>
  )
}
