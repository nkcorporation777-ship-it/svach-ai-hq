import { Check, Lock } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Strict sequential gate (DATABASE_SCHEMA.md `client_onboarding_steps`) —
 * enforced here at the application layer, not the database: step N+1 stays
 * locked until step N is complete.
 */
export function SequentialChecklistItem({
  stepName,
  isComplete,
  isLocked,
  onComplete,
}: {
  stepName: string
  isComplete: boolean
  isLocked: boolean
  onComplete: () => void
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-pill)] border border-border px-3 py-2.5",
        isLocked && "opacity-50",
      )}
    >
      <button
        type="button"
        disabled={isLocked || isComplete}
        onClick={onComplete}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          isComplete
            ? "border-status-success bg-status-success/20 text-status-success"
            : "border-border text-transparent hover:border-brand-azure",
        )}
        aria-label={isComplete ? `${stepName} complete` : `Mark ${stepName} complete`}
      >
        {isComplete ? (
          <Check className="size-3" />
        ) : isLocked ? (
          <Lock className="size-3 text-muted-foreground" />
        ) : null}
      </button>
      <span
        className={cn(
          "text-sm",
          isComplete ? "text-muted-foreground line-through" : "text-foreground",
        )}
      >
        {stepName}
      </span>
    </div>
  )
}
