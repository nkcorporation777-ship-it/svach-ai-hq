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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSpecialties } from "@/hooks/useSpecialties"
import { useCreateLead } from "./hooks"

/** Mirrors the DB constraints (DATABASE_SCHEMA.md `leads`) — practice_name
 * required, at least one contact method required. The DB is the real
 * enforcement; this just avoids a doomed round-trip. */
const schema = z
  .object({
    practice_name: z.string().min(1, "Required"),
    contact_name: z.string().optional(),
    contact_email: z.string().email().optional().or(z.literal("")),
    contact_phone: z.string().optional(),
    specialty_id: z.string().optional(),
    source: z.string().optional(),
  })
  .refine((data) => !!data.contact_email || !!data.contact_phone, {
    message: "At least one contact method is required",
    path: ["contact_email"],
  })

type FormValues = z.infer<typeof schema>

export function NewLeadDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: specialties } = useSpecialties()
  const createLead = useCreateLead()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    await createLead.mutateAsync({
      practice_name: values.practice_name,
      contact_name: values.contact_name || null,
      contact_email: values.contact_email || null,
      contact_phone: values.contact_phone || null,
      specialty_id: values.specialty_id || null,
      source: values.source || null,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="practice_name">Practice name</Label>
            <Input id="practice_name" {...register("practice_name")} />
            {errors.practice_name && (
              <p className="text-xs text-status-error">{errors.practice_name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact_name">Contact name</Label>
            <Input id="contact_name" {...register("contact_name")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact_email">Contact email</Label>
            <Input id="contact_email" type="email" {...register("contact_email")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact_phone">Contact phone</Label>
            <Input id="contact_phone" {...register("contact_phone")} />
            {errors.contact_email && (
              <p className="text-xs text-status-error">{errors.contact_email.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Specialty</Label>
            <Select
              value={watch("specialty_id")}
              onValueChange={(v) => setValue("specialty_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a specialty" />
              </SelectTrigger>
              <SelectContent>
                {specialties?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source">Source</Label>
            <Input id="source" {...register("source")} placeholder="e.g. Strategy session" />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createLead.isPending}>
              {createLead.isPending ? "Creating…" : "Create Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
