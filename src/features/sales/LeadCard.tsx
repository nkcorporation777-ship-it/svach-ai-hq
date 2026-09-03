import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format"

export function LeadCard({
  id,
  practiceName,
  specialtyName,
  value,
  isDragging,
}: {
  id: string
  practiceName: string
  specialtyName?: string | null
  value?: number | null
  isDragging?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-pill)] border border-border bg-gradient-to-br from-brand-blue/15 via-bg-glass/40 to-brand-cyan/10 p-3 transition-all duration-220 ease-standard",
        "hover:-translate-y-0.5 hover:border-brand-azure/40 hover:shadow-[0_16px_32px_-20px_rgba(59,130,246,0.5)]",
        isDragging && "shadow-lg",
      )}
    >
      <Link
        to={`/sales/${id}`}
        onClick={(e) => isDragging && e.preventDefault()}
        className="text-sm font-medium text-foreground hover:text-brand-azure"
      >
        {practiceName}
      </Link>
      {specialtyName && (
        <p className="mt-1 text-xs text-muted-foreground">{specialtyName}</p>
      )}
      {value != null && (
        <p className="mt-1 text-xs font-medium text-brand-cyan">{formatCurrency(value)}</p>
      )}
    </div>
  )
}
