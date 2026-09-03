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

const SOURCES = ["LinkedIn", "Upwork", "Cold Outreach", "Reference"]

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
    value: z.string().optional().refine((v) => !v || Number(v) >= 0, {
      message: "Must be zero or more",
    }),
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
      value: values.value ? Number(values.value) : null,
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
            <Label>Source</Label>
            <Select value={watch("source")} onValueChange={(v) => setValue("source", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a source" />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="value">Deal value</Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="value"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                className="no-spinner pl-6"
                {...register("value")}
              />
            </div>
            {errors.value && <p className="text-xs text-status-error">{errors.value.message}</p>}
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
