import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { DateTimeField } from "@/components/shared/DateTimeField"

/** Replaces the old one-click "Snooze" (which set status: 'snoozed' with no
 * way back to an actionable date) — reschedule picks a real new date and the
 * follow-up stays status: 'pending', still visible in the queue. */
export function RescheduleFollowUpDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (dueAt: string) => void
  isSubmitting: boolean
}) {
  const [dueAt, setDueAt] = useState("")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setDueAt("")
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule follow-up</DialogTitle>
        </DialogHeader>

        <DateTimeField
          id="reschedule_due_at"
          dateLabel="New date"
          value={dueAt}
          onChange={setDueAt}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!dueAt || isSubmitting}
            onClick={() => dueAt && onConfirm(new Date(dueAt).toISOString())}
          >
            {isSubmitting ? "Saving…" : "Reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
