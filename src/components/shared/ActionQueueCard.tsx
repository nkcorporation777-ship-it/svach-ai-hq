import { Check, X } from "lucide-react"
import { Card } from "./Card"
import { Button } from "@/components/ui/button"

/** AI_ARCHITECTURE.md's two-branch approve-to-execute flow — Approve/Dismiss
 * here only transitions status + logs the action; actual n8n/Hermes execution
 * is stubbed (no live integration exists yet, see the Dashboard plan). */
export function ActionQueueCard({
  title,
  description,
  onApprove,
  onDismiss,
  isApproving,
  isDismissing,
}: {
  title: string
  description: string | null
  onApprove: () => void
  onDismiss: () => void
  isApproving: boolean
  isDismissing: boolean
}) {
  const busy = isApproving || isDismissing
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-display text-sm font-semibold">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onDismiss}>
          <X className="size-4" />
          {isDismissing ? "Dismissing…" : "Dismiss"}
        </Button>
        <Button size="sm" disabled={busy} onClick={onApprove}>
          <Check className="size-4" />
          {isApproving ? "Approving…" : "Approve"}
        </Button>
      </div>
    </Card>
  )
}
