import { cn } from "@/lib/utils"

export function OutcomeBadge({
  successful,
  status,
}: {
  successful: boolean | null
  status?: string | null
}) {
  if (status === "ongoing" || status === "registered") {
    return <Pill tone="cyan" label="Live" pulse />
  }
  if (successful === true) return <Pill tone="green" label="Successful" />
  if (successful === false) return <Pill tone="amber" label="Unsuccessful" />
  return <Pill tone="muted" label="—" />
}

export function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return <span className="text-muted-foreground">—</span>
  const tone = sentiment === "Positive" ? "green" : sentiment === "Negative" ? "red" : "muted"
  return <Pill tone={tone} label={sentiment} />
}

const TONES = {
  green: "border-status-success/40 bg-status-success/10 text-status-success",
  amber: "border-status-warning/40 bg-status-warning/10 text-status-warning",
  red: "border-status-error/40 bg-status-error/10 text-status-error",
  cyan: "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan",
  muted: "border-border text-muted-foreground",
} as const

export function Pill({
  tone,
  label,
  pulse,
}: {
  tone: keyof typeof TONES
  label: string
  pulse?: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
        TONES[tone],
      )}
    >
      {pulse && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {label}
    </span>
  )
}
