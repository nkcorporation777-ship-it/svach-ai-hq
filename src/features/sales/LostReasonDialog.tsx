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

/** Fixed set matches the DB CHECK constraint exactly (DATABASE_SCHEMA.md `leads`). */
const LOST_REASONS = [
  { value: "budget", label: "Budget" },
  { value: "timing", label: "Timing" },
  { value: "chose_competitor", label: "Chose a competitor" },
  { value: "building_in_house", label: "Building in-house" },
  { value: "not_ready_for_ai", label: "Not ready for AI" },
  { value: "unresponsive", label: "Unresponsive" },
  { value: "practice_closed", label: "Practice closed" },
  { value: "other", label: "Other" },
] as const

export function LostReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (category: string, detail?: string) => void
  isSubmitting: boolean
}) {
  const [category, setCategory] = useState<string>("")
  const [detail, setDetail] = useState("")

  const needsDetail = category === "other"
  const canConfirm = category !== "" && (!needsDetail || detail.trim() !== "")

  function handleConfirm() {
    onConfirm(category, needsDetail ? detail : undefined)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Why was this lead lost?</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Reason</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsDetail && (
            <div className="flex flex-col gap-1.5">
              <Label>Details</Label>
              <Textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="What happened?"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm || isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? "Saving…" : "Mark as Lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
