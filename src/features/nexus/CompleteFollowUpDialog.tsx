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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Only call/email count as contact for the client_contact_status view
 * (DATABASE_SCHEMA.md) — those are the only two options offered here. */
export function CompleteFollowUpDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (contactType: "call" | "email", note: string) => void
  isSubmitting: boolean
}) {
  const [contactType, setContactType] = useState<"call" | "email" | "">("")
  const [note, setNote] = useState("")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete follow-up</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>How was contact made?</Label>
            <Select value={contactType} onValueChange={(v) => setContactType(v as "call" | "email")}>
              <SelectTrigger>
                <SelectValue placeholder="Select one" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!contactType || isSubmitting}
            onClick={() => contactType && onConfirm(contactType, note)}
          >
            {isSubmitting ? "Saving…" : "Mark Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
