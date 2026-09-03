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
import { useUpdatePricingTier } from "./hooks"

const priceField = z.string().optional().refine((v) => !v || Number(v) >= 0, {
  message: "Must be zero or more",
})

const schema = z.object({
  name: z.string().min(1, "Required"),
  price: priceField,
  priceMax: priceField,
  description: z.string().optional(),
  features: z.string().optional(),
  bestFor: z.string().optional(),
  deliveryTerms: z.string().optional(),
  isFeatured: z.boolean(),
})

type FormValues = z.infer<typeof schema>

/** Edits one row of `pricing_tiers` — the 3-tier menu proposal drafting will
 * eventually read from. Free-text features (one per line) rather than a
 * dynamic list-add UI — matches this project's "reusable, not clever" bar.
 * Price is a range (price/priceMax) since real tier pricing is quoted as a
 * range (e.g. "$1,500–$3,000"), not a fixed number. */
export function EditPricingTierDialog({
  tier,
  open,
  onOpenChange,
}: {
  tier: Tables<"pricing_tiers"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateTier = useUpdatePricingTier()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (tier) {
      reset({
        name: tier.name,
        price: tier.price != null ? String(tier.price) : "",
        priceMax: tier.price_max != null ? String(tier.price_max) : "",
        description: tier.description ?? "",
        features: tier.features ?? "",
        bestFor: tier.best_for ?? "",
        deliveryTerms: tier.delivery_terms ?? "",
        isFeatured: tier.is_featured,
      })
    }
  }, [tier, reset])

  async function onSubmit(values: FormValues) {
    if (!tier) return
    await updateTier.mutateAsync({
      id: tier.id,
      name: values.name,
      price: values.price ? Number(values.price) : null,
      priceMax: values.priceMax ? Number(values.priceMax) : null,
      description: values.description ?? "",
      features: values.features ?? "",
      bestFor: values.bestFor ?? "",
      deliveryTerms: values.deliveryTerms ?? "",
      isFeatured: values.isFeatured,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit tier</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-status-error">{errors.name.message}</p>}
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="price">Price from</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  className="no-spinner pl-6"
                  {...register("price")}
                />
              </div>
              {errors.price && <p className="text-xs text-status-error">{errors.price.message}</p>}
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="priceMax">Price to (optional)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="priceMax"
                  type="number"
                  step="0.01"
                  min="0"
                  className="no-spinner pl-6"
                  {...register("priceMax")}
                />
              </div>
              {errors.priceMax && (
                <p className="text-xs text-status-error">{errors.priceMax.message}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Package tagline</Label>
            <Input
              id="description"
              placeholder="e.g. Automate Your Patient Front Desk"
              {...register("description")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="features">Features</Label>
            <Textarea
              id="features"
              rows={6}
              placeholder="One per line — prefix bonus items with 'BONUS:'"
              {...register("features")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bestFor">Best for (optional)</Label>
            <Input id="bestFor" placeholder="Who this tier suits" {...register("bestFor")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deliveryTerms">Support / delivery</Label>
            <Input
              id="deliveryTerms"
              placeholder="e.g. 30 Days Post-Launch Support"
              {...register("deliveryTerms")}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={watch("isFeatured")}
              onChange={(e) => setValue("isFeatured", e.target.checked)}
            />
            Most selected (badge shown to clients)
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateTier.isPending}>
              {updateTier.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
