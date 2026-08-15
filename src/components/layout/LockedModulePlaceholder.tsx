import type { LucideIcon } from "lucide-react"

/**
 * Honest "coming in Phase N" state for locked departments — never a 404, never a
 * blurred/teaser preview. INFORMATION_ARCHITECTURE.md §8.
 */
export function LockedModulePlaceholder({
  icon: Icon,
  label,
  phaseTag,
  description,
}: {
  icon: LucideIcon
  label: string
  phaseTag: string
  description: string
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="glass-card flex max-w-md flex-col items-center gap-4">
        <Icon className="size-8 text-muted-foreground" />
        <h2 className="font-display text-lg font-semibold">{label}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        <span className="rounded-[var(--radius-pill)] border border-border px-3 py-1 font-mono text-xs text-muted-foreground">
          Coming in {phaseTag}
        </span>
      </div>
    </div>
  )
}
