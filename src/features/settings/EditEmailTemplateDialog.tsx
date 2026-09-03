import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
import type { Tables } from "@/types/database"
import { useUpdateEmailTemplate } from "./hooks"

const schema = z.object({
  subject: z.string().min(1, "Required"),
  body: z.string().min(1, "Required"),
})

type FormValues = z.infer<typeof schema>

/** Edits one row of `client_email_templates` — the copy the automated onboarding
 * sequence (supabase/functions/onboarding-email) actually sends. Merge fields
 * ({{practice_name}}, {{contact_name}}) are plain text the Edge Function replaces
 * at send time — no live preview here, just the placeholder documentation. */
export function EditEmailTemplateDialog({
  template,
  open,
  onOpenChange,
}: {
  template: Tables<"client_email_templates"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateTemplate = useUpdateEmailTemplate()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (template) reset({ subject: template.subject, body: template.body })
  }, [template, reset])

  async function onSubmit(values: FormValues) {
    if (!template) return
    await updateTemplate.mutateAsync({ id: template.id, ...values })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit template — {template?.step_key.replace(/_/g, " ")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" {...register("subject")} />
            {errors.subject && (
              <p className="text-xs text-status-error">{errors.subject.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="body">Body</Label>
            <Textarea id="body" rows={10} {...register("body")} />
            <p className="text-xs text-muted-foreground">
              Available placeholders: {"{{practice_name}}"}, {"{{contact_name}}"}
            </p>
            {errors.body && <p className="text-xs text-status-error">{errors.body.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateTemplate.isPending}>
              {updateTemplate.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
