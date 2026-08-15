import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

export function LeadCard({
  id,
  practiceName,
  specialtyName,
  isDragging,
}: {
  id: string
  practiceName: string
  specialtyName?: string | null
  isDragging?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-pill)] border border-border bg-bg-glass/40 p-3 transition-shadow",
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
    </div>
  )
}
