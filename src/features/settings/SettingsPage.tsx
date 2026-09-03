import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import { Mail, Layers, Calculator } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/app/providers/useAuth"
import { Card } from "@/components/shared/Card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrencyRange } from "@/lib/format"
import type { Tables } from "@/types/database"
import {
  useEmailTemplates,
  usePricingTiers,
  useBillingSettings,
  useUpdateBillingSettings,
} from "./hooks"
import { EditEmailTemplateDialog } from "./EditEmailTemplateDialog"
import { EditPricingTierDialog } from "./EditPricingTierDialog"

const STEP_LABELS: Record<string, string> = {
  welcome: "Welcome message sent",
  business_details: "Business details collected",
  portal_access: "Portal access requested",
  payment_request: "Deposit received",
  payment_confirmation: "Payment confirmation email",
}

/**
 * INFORMATION_ARCHITECTURE.md §7 — minimal. Profile fields only; no team
 * management, no billing (V1 is single-user/Owner-only, DECISION_LOG.md §1).
 *
 * Also hosts the 5 onboarding-sequence email templates (supabase/functions/
 * onboarding-email) — the only "custom" content in that automation; everything
 * else about when/whether an email sends is deterministic trigger logic, not
 * something to expose as a setting. One of the five (payment_confirmation)
 * isn't tied to its own checklist step — it fires when "Deposit received" is
 * ticked, same as how payment_request fires when "Portal access requested" is.
 */
export function SettingsPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user.id

  const { data: emailTemplates } = useEmailTemplates()
  const [editingTemplate, setEditingTemplate] = useState<Tables<"client_email_templates"> | null>(
    null,
  )
  const { data: pricingTiers } = usePricingTiers()
  const [editingTier, setEditingTier] = useState<Tables<"pricing_tiers"> | null>(null)

  const { data: billingSettings } = useBillingSettings()
  const updateBillingSettings = useUpdateBillingSettings()
  const [billingForm, setBillingForm] = useState({
    hourlyRateMin: "",
    hourlyRateMax: "",
    premiumRateMin: "",
    premiumRateMax: "",
    gstPercent: "",
  })

  useEffect(() => {
    if (billingSettings) {
      setBillingForm({
        hourlyRateMin: billingSettings.hourly_rate_min?.toString() ?? "",
        hourlyRateMax: billingSettings.hourly_rate_max?.toString() ?? "",
        premiumRateMin: billingSettings.premium_rate_min?.toString() ?? "",
        premiumRateMax: billingSettings.premium_rate_max?.toString() ?? "",
        gstPercent: billingSettings.gst_percent?.toString() ?? "",
      })
    }
  }, [billingSettings])

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, permission_role")
        .eq("id", userId!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })

  const [fullName, setFullName] = useState("")

  useEffect(() => {
    if (profile) setFullName(profile.full_name ?? "")
  }, [profile])

  const updateProfile = useMutation({
    mutationFn: async (full_name: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name })
        .eq("id", userId!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] })
    },
  })

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
          Settings
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Profile</h1>
      </header>

      <div className="glass-card max-w-md">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              updateProfile.mutate(fullName)
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="full_name" className="text-sm text-muted-foreground">
                Full name
              </label>
              <input
                id="full_name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="rounded-[var(--radius-pill)] border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Email</span>
              <p className="text-sm">{session?.user.email}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Role</span>
              <p className="text-sm capitalize">{profile?.permission_role}</p>
            </div>

            <button
              type="submit"
              disabled={updateProfile.isPending}
              className="mt-2 self-start rounded-[var(--radius-card)] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-[var(--duration-button)] ease-[var(--ease-standard)] hover:bg-brand-azure disabled:opacity-60"
            >
              {updateProfile.isPending ? "Saving…" : "Save"}
            </button>
            {updateProfile.isSuccess && (
              <p className="text-sm text-status-success">Saved.</p>
            )}
          </form>
        )}
      </div>

      <Card className="max-w-2xl">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-brand-cyan" />
          <h2 className="font-display text-base font-semibold">Onboarding Email Templates</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Sent automatically as a new client moves through onboarding — edit the copy here,
          nothing else to configure.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {emailTemplates?.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between rounded-[var(--radius-pill)] border border-border px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium">
                  {STEP_LABELS[template.step_key] ?? template.step_key}
                </p>
                <p className="text-xs text-muted-foreground">{template.subject}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditingTemplate(template)}>
                Edit
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="max-w-2xl">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-brand-cyan" />
          <h2 className="font-display text-base font-semibold">Pricing Tiers</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Your 3-tier menu — the reference point for scoping proposals.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {pricingTiers?.map((tier) => (
            <div
              key={tier.id}
              className="flex items-center justify-between rounded-[var(--radius-pill)] border border-border px-3 py-2.5"
            >
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  {tier.name}
                  {tier.is_featured && (
                    <span className="rounded-[var(--radius-pill)] bg-brand-cyan/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-cyan uppercase">
                      Most selected
                    </span>
                  )}
                  <span className="text-xs text-brand-cyan">
                    {formatCurrencyRange(tier.price, tier.price_max)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {tier.description || "No description yet"}
                </p>
                {tier.delivery_terms && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Support: {tier.delivery_terms}
                  </p>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditingTier(tier)}>
                Edit
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="max-w-2xl">
        <div className="flex items-center gap-2">
          <Calculator className="size-4 text-brand-cyan" />
          <h2 className="font-display text-base font-semibold">Billing & Rates</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Business-wide rate card — feeds the hourly path of proposal drafting (Upwork
          clients, mostly). Ranges, not fixed numbers, since the right position within
          each depends on the specific project.
        </p>
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!billingSettings) return
            updateBillingSettings.mutate({
              id: billingSettings.id,
              hourlyRateMin: billingForm.hourlyRateMin ? Number(billingForm.hourlyRateMin) : null,
              hourlyRateMax: billingForm.hourlyRateMax ? Number(billingForm.hourlyRateMax) : null,
              premiumRateMin: billingForm.premiumRateMin
                ? Number(billingForm.premiumRateMin)
                : null,
              premiumRateMax: billingForm.premiumRateMax
                ? Number(billingForm.premiumRateMax)
                : null,
              gstPercent: billingForm.gstPercent ? Number(billingForm.gstPercent) : null,
            })
          }}
        >
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="hourly_min">Hourly rate from</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="hourly_min"
                  type="number"
                  step="0.01"
                  min="0"
                  className="no-spinner pl-6"
                  value={billingForm.hourlyRateMin}
                  onChange={(e) =>
                    setBillingForm((f) => ({ ...f, hourlyRateMin: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="hourly_max">Hourly rate to</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="hourly_max"
                  type="number"
                  step="0.01"
                  min="0"
                  className="no-spinner pl-6"
                  value={billingForm.hourlyRateMax}
                  onChange={(e) =>
                    setBillingForm((f) => ({ ...f, hourlyRateMax: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="premium_min">Premium rate from</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="premium_min"
                  type="number"
                  step="0.01"
                  min="0"
                  className="no-spinner pl-6"
                  value={billingForm.premiumRateMin}
                  onChange={(e) =>
                    setBillingForm((f) => ({ ...f, premiumRateMin: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="premium_max">Premium rate to</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="premium_max"
                  type="number"
                  step="0.01"
                  min="0"
                  className="no-spinner pl-6"
                  value={billingForm.premiumRateMax}
                  onChange={(e) =>
                    setBillingForm((f) => ({ ...f, premiumRateMax: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex max-w-[calc(50%-6px)] flex-col gap-1.5">
            <Label htmlFor="gst">GST %</Label>
            <Input
              id="gst"
              type="number"
              step="0.01"
              min="0"
              className="no-spinner"
              value={billingForm.gstPercent}
              onChange={(e) => setBillingForm((f) => ({ ...f, gstPercent: e.target.value }))}
            />
          </div>

          <Button
            type="submit"
            className="self-start"
            disabled={updateBillingSettings.isPending || !billingSettings}
          >
            {updateBillingSettings.isPending ? "Saving…" : "Save"}
          </Button>
          {updateBillingSettings.isSuccess && (
            <p className="text-sm text-status-success">Saved.</p>
          )}
        </form>
      </Card>

      <EditEmailTemplateDialog
        template={editingTemplate}
        open={!!editingTemplate}
        onOpenChange={(open) => !open && setEditingTemplate(null)}
      />

      <EditPricingTierDialog
        tier={editingTier}
        open={!!editingTier}
        onOpenChange={(open) => !open && setEditingTier(null)}
      />
    </div>
  )
}
