import { cn } from "@/lib/utils"
import { POST_STATUS_LABEL, platformLabel, type PostStatus } from "./hooks"

const STATUS_STYLE: Record<PostStatus, string> = {
  draft: "border-border text-muted-foreground",
  scheduled: "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan",
  sending: "border-status-info/40 bg-status-info/10 text-status-info",
  handed_off: "border-status-info/40 bg-status-info/10 text-status-info",
  published: "border-status-success/40 bg-status-success/10 text-status-success",
  failed: "border-status-error/40 bg-status-error/10 text-status-error",
  cancelled: "border-border text-muted-foreground line-through",
}

export function PostStatusBadge({ status }: { status: string }) {
  const s = status as PostStatus
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLE[s],
      )}
    >
      {POST_STATUS_LABEL[s] ?? status}
    </span>
  )
}

export function PlatformChips({ platforms }: { platforms: string[] }) {
  if (platforms.length === 0) return <span className="text-xs text-muted-foreground">No platform yet</span>
  return (
    <span className="flex flex-wrap gap-1">
      {platforms.map((p) => (
        <span key={p} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {platformLabel(p)}
        </span>
      ))}
    </span>
  )
}
