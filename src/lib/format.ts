const wholeDollarFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const centsFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return Number.isInteger(value) ? wholeDollarFormatter.format(value) : centsFormatter.format(value)
}

/** Renders a price range ("$1,500–$3,000") when both ends are set, a single
 * amount when only `min` is set, and "—" when neither is. */
export function formatCurrencyRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (min == null) return "—"
  if (max == null || max === min) return formatCurrency(min)
  return `${formatCurrency(min)}–${formatCurrency(max)}`
}
