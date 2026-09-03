import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DateTimeField } from "@/components/shared/DateTimeField"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FollowUpContactType } from "./hooks"

const CONTACT_TYPES: { value: FollowUpContactType; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "whatsapp", label: "WhatsApp" },
]

/** Call/Email/Meeting/WhatsApp all count as real contact for the
 * client_contact_status view (DATABASE_SCHEMA.md) — that's the full option
 * set, not a subset. Chains straight into scheduling the next follow-up so
 * completing and scheduling aren't two separate actions. */
export function CompleteFollowUpDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (
    contactType: FollowUpContactType,
    outcomeNotes: string,
    nextDueAt?: string,
    nextNote?: string,
  ) => void
  isSubmitting: boolean
}) {
  const [contactType, setContactType] = useState<FollowUpContactType | "">("")
  const [outcomeNotes, setOutcomeNotes] = useState("")
  const [scheduleNext, setScheduleNext] = useState(false)
  const [nextDueAt, setNextDueAt] = useState("")
  const [nextNote, setNextNote] = useState("")

  function reset() {
    setContactType("")
    setOutcomeNotes("")
    setScheduleNext(false)
    setNextDueAt("")
    setNextNote("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete follow-up</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>How was contact made?</Label>
            <Select
              value={contactType}
              onValueChange={(v) => setContactType(v as FollowUpContactType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select one" />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>What happened?</Label>
            <Textarea
              value={outcomeNotes}
              onChange={(e) => setOutcomeNotes(e.target.value)}
              placeholder="Notes, a meeting transcript, or a link (e.g. Fathom)"
              rows={4}
            />
          </div>

          <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={scheduleNext}
                onChange={(e) => setScheduleNext(e.target.checked)}
              />
              Schedule the next follow-up now
            </label>
            {scheduleNext && (
              <div className="flex flex-col gap-3 pt-1">
                <DateTimeField
                  id="next_due_at"
                  dateLabel="Next follow-up date"
                  value={nextDueAt}
                  onChange={setNextDueAt}
                />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="next_note">Note (optional)</Label>
                  <Textarea
                    id="next_note"
                    value={nextNote}
                    onChange={(e) => setNextNote(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!contactType || (scheduleNext && !nextDueAt) || isSubmitting}
            onClick={() =>
              contactType &&
              onConfirm(
                contactType,
                outcomeNotes,
                scheduleNext && nextDueAt ? new Date(nextDueAt).toISOString() : undefined,
                scheduleNext ? nextNote : undefined,
              )
            }
          >
            {isSubmitting ? "Saving…" : "Mark Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
