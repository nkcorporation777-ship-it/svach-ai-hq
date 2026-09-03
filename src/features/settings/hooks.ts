import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"

/** The 5 automated onboarding-sequence emails (supabase/functions/onboarding-email) —
 * Owner-authored templates. Most map 1:1 to a client_onboarding_steps row, but
 * payment_confirmation doesn't — it fires when "Deposit received" is ticked
 * complete, with no checklist row of its own. */
export function useEmailTemplates() {
  return useQuery({
    queryKey: ["emailTemplates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_email_templates")
        .select("*")
        .order("step_order_index")
      if (error) throw error
      return data
    },
  })
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      subject,
      body,
    }: {
      id: string
      subject: string
      body: string
    }) => {
      const { error } = await supabase
        .from("client_email_templates")
        .update({ subject, body, updated_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
      await logAudit({
        action: "settings.email_template_updated",
        entityType: "client_email_template",
        entityId: id,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailTemplates"] })
    },
  })
}

/** The 3-tier pricing menu — Owner-authored, feeds proposal drafting once that
 * exists. Not client-specific; the same 3 rows apply to every proposal. */
export function usePricingTiers() {
  return useQuery({
    queryKey: ["pricingTiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_tiers")
        .select("*")
        .order("order_index")
      if (error) throw error
      return data
    },
  })
}

export function useUpdatePricingTier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      name,
      price,
      priceMax,
      description,
      features,
      bestFor,
      deliveryTerms,
      isFeatured,
    }: {
      id: string
      name: string
      price: number | null
      priceMax: number | null
      description: string
      features: string
      bestFor: string
      deliveryTerms: string
      isFeatured: boolean
    }) => {
      const { error } = await supabase
        .from("pricing_tiers")
        .update({
          name,
          price,
          price_max: priceMax,
          description,
          features,
          best_for: bestFor,
          delivery_terms: deliveryTerms,
          is_featured: isFeatured,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
      if (error) throw error
      await logAudit({
        action: "settings.pricing_tier_updated",
        entityType: "pricing_tier",
        entityId: id,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricingTiers"] })
    },
  })
}

/** Business-wide billing constants — hourly + premium rate ranges, GST%.
 * Single row, not client-specific. Feeds the Hourly path of proposal
 * drafting the same way pricing_tiers feeds the Tier path. */
export function useBillingSettings() {
  return useQuery({
    queryKey: ["billingSettings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("billing_settings").select("*").maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateBillingSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      hourlyRateMin,
      hourlyRateMax,
      premiumRateMin,
      premiumRateMax,
      gstPercent,
    }: {
      id: string
      hourlyRateMin: number | null
      hourlyRateMax: number | null
      premiumRateMin: number | null
      premiumRateMax: number | null
      gstPercent: number | null
    }) => {
      const { error } = await supabase
        .from("billing_settings")
        .update({
          hourly_rate_min: hourlyRateMin,
          hourly_rate_max: hourlyRateMax,
          premium_rate_min: premiumRateMin,
          premium_rate_max: premiumRateMax,
          gst_percent: gstPercent,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
      if (error) throw error
      await logAudit({
        action: "settings.billing_settings_updated",
        entityType: "billing_settings",
        entityId: id,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billingSettings"] })
    },
  })
}
