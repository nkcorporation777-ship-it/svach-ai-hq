import { useState } from "react"
import { useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { getFunctionErrorMessage } from "@/lib/functionsError"
import { useSubmitIntake } from "./hooks"

const schema = z.object({
  legal_name: z.string().min(1, "Required"),
  dba: z.string().optional(),
  location: z.string().min(1, "Required"),
  secondary_contact_name: z.string().optional(),
  secondary_contact_email: z.string().email("Invalid email").optional().or(z.literal("")),
  secondary_contact_phone: z.string().optional(),
  services: z.string().min(1, "Required"),
  hours: z.string().optional(),
  website_urls: z.string().optional(),
  uses_crm: z.boolean(),
  crm_name: z.string().optional(),
  uses_database: z.boolean(),
  database_name: z.string().optional(),
  hosting_provider: z.string().optional(),
  dns_manager: z.string().optional(),
  other_software: z.string().optional(),
  billing_contact_name: z.string().optional(),
  billing_contact_email: z.string().email("Invalid email").optional().or(z.literal("")),
  brand_assets_note: z.string().optional(),
  has_phi: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const fieldClass =
  "rounded-[var(--radius-pill)] border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** Public, unauthenticated intake form — the client fills this out from the
 * link in the Business Details onboarding email. No HQ session; auth is the
 * unguessable intake_token in the URL, checked server-side by client-intake. */
export function IntakePage() {
  const { token } = useParams<{ token: string }>()
  const submitIntake = useSubmitIntake()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { uses_crm: false, uses_database: false, has_phi: false },
  })

  const usesCrm = watch("uses_crm")
  const usesDatabase = watch("uses_database")

  async function onSubmit(values: FormValues) {
    if (!token) return
    setSubmitError(null)
    submitIntake.mutate(
      { token, ...values },
      {
        onError: async (error) => {
          setSubmitError(await getFunctionErrorMessage(error, "Something went wrong — please try again."))
        },
      },
    )
  }

  if (submitIntake.isSuccess) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-2xl font-semibold">Thanks — we've got it.</h1>
        <p className="text-sm text-muted-foreground">
          Your details are on their way to the Svach AI team. We'll follow up by email with next steps.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-12">
      <header>
        <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
          Client Intake
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Tell us about your practice</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A couple of minutes now saves a lot of back-and-forth later.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-base font-semibold">Business Information</h2>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="legal_name">Business name</Label>
            <Input id="legal_name" className={fieldClass} {...register("legal_name")} />
            {errors.legal_name && <p className="text-xs text-status-error">{errors.legal_name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dba">Trading as / brand name (if different)</Label>
            <Input id="dba" className={fieldClass} {...register("dba")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location(s) / address</Label>
            <Textarea id="location" rows={2} {...register("location")} />
            {errors.location && <p className="text-xs text-status-error">{errors.location.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="services">Services offered</Label>
            <Textarea id="services" rows={3} {...register("services")} />
            {errors.services && <p className="text-xs text-status-error">{errors.services.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hours">Opening hours / days of operation</Label>
            <Input id="hours" className={fieldClass} {...register("hours")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="website_urls">Website URL(s)</Label>
            <Input id="website_urls" className={fieldClass} {...register("website_urls")} />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-base font-semibold">Contacts</h2>
          <p className="text-xs text-muted-foreground">
            We already have your primary contact on file — this is only for a backup contact and billing.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="secondary_contact_name">Secondary contact name</Label>
            <Input id="secondary_contact_name" className={fieldClass} {...register("secondary_contact_name")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="secondary_contact_email">Secondary contact email</Label>
            <Input id="secondary_contact_email" type="email" className={fieldClass} {...register("secondary_contact_email")} />
            {errors.secondary_contact_email && (
              <p className="text-xs text-status-error">{errors.secondary_contact_email.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="secondary_contact_phone">Secondary contact phone</Label>
            <Input id="secondary_contact_phone" className={fieldClass} {...register("secondary_contact_phone")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="billing_contact_name">Billing contact name (if different from primary)</Label>
            <Input id="billing_contact_name" className={fieldClass} {...register("billing_contact_name")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="billing_contact_email">Billing contact email</Label>
            <Input id="billing_contact_email" type="email" className={fieldClass} {...register("billing_contact_email")} />
            {errors.billing_contact_email && (
              <p className="text-xs text-status-error">{errors.billing_contact_email.message}</p>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-base font-semibold">Systems & Software</h2>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("uses_crm")} />
              We currently use a CRM
            </label>
            {usesCrm && (
              <Input placeholder="Which one?" className={fieldClass} {...register("crm_name")} />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("uses_database")} />
              We use a database or backend platform
            </label>
            {usesDatabase && (
              <Input
                placeholder="Which one? (e.g. Supabase, Firebase, custom)"
                className={fieldClass}
                {...register("database_name")}
              />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hosting_provider">Hosting provider / details</Label>
            <Input id="hosting_provider" className={fieldClass} {...register("hosting_provider")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dns_manager">Who manages your domain/DNS?</Label>
            <Input id="dns_manager" className={fieldClass} {...register("dns_manager")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="other_software">
              Other software in use (booking, payments, email marketing, etc.)
            </Label>
            <Textarea id="other_software" rows={2} {...register("other_software")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand_assets_note">Logo / brand assets (link, or a note that you'll send separately)</Label>
            <Input id="brand_assets_note" className={fieldClass} {...register("brand_assets_note")} />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-base font-semibold">One last thing</h2>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" {...register("has_phi")} />
            <span>
              Does any system you'd grant us access to store patient health information?
            </span>
          </label>
        </section>

        {submitError && <p className="text-sm text-status-error">{submitError}</p>}
        <Button type="submit" disabled={submitIntake.isPending}>
          {submitIntake.isPending ? "Submitting…" : "Submit"}
        </Button>
      </form>
    </div>
  )
}
