import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCreateFollowUp } from "./hooks"

export function NewFollowUpDialog({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createFollowUp = useCreateFollowUp(clientId)
  const [dueAt, setDueAt] = useState("")
  const [note, setNote] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dueAt) return
    await createFollowUp.mutateAsync({ dueAt: new Date(dueAt).toISOString(), note })
    setDueAt("")
    setNote("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New follow-up</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="due_at">Due</Label>
            <Input
              id="due_at"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Note</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createFollowUp.isPending}>
              {createFollowUp.isPending ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
