import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { STAGE_LABELS, type Stage } from "./hooks"

const STAGE_GRADIENT: Record<Stage, string> = {
  discover: "from-brand-blue/15 via-bg-glass/40 to-brand-blue/5",
  design: "from-brand-azure/15 via-bg-glass/40 to-brand-azure/5",
  deploy: "from-brand-cyan/15 via-bg-glass/40 to-brand-cyan/5",
  optimise: "from-status-success/15 via-bg-glass/40 to-status-success/5",
}

const STAGE_TEXT: Record<Stage, string> = {
  discover: "text-brand-blue",
  design: "text-brand-azure",
  deploy: "text-brand-cyan",
  optimise: "text-status-success",
}

export function ProjectCard({
  id,
  name,
  practiceName,
  stage,
  tasksComplete,
  tasksTotal,
}: {
  id: string
  name: string
  practiceName: string
  stage: Stage
  tasksComplete: number
  tasksTotal: number
}) {
  return (
    <Link
      to={`/delivery/${id}`}
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-gradient-to-br p-4 transition-all duration-220 ease-standard",
        "hover:-translate-y-1 hover:border-brand-azure/40 hover:shadow-[0_24px_48px_-28px_rgba(59,130,246,0.4)]",
        STAGE_GRADIENT[stage],
      )}
    >
      <p className="text-xs text-muted-foreground">{practiceName}</p>
      <h3 className="mt-0.5 font-display text-base font-semibold">{name}</h3>
      <div className="mt-3 flex items-center justify-between">
        <span className={cn("text-xs font-semibold uppercase tracking-wide", STAGE_TEXT[stage])}>
          {STAGE_LABELS[stage]}
        </span>
        {tasksTotal > 0 && (
          <span className="relative flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-1.5 rounded-full bg-current"
              style={{ animation: "glow-pulse 3s ease-in-out infinite" }}
            />
            {tasksComplete}/{tasksTotal} tasks
          </span>
        )}
      </div>
    </Link>
  )
}
