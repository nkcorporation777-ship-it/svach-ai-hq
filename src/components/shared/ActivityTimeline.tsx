import { Phone, Mail, StickyNote, ArrowRightLeft, Sparkles } from "lucide-react"
import { useActivities } from "@/hooks/useActivities"

const TYPE_ICON = {
  call: Phone,
  email: Mail,
  note: StickyNote,
  stage_change: ArrowRightLeft,
  ai_draft: Sparkles,
} as const

const TYPE_LABEL: Record<keyof typeof TYPE_ICON, string> = {
  call: "Call",
  email: "Email",
  note: "Note",
  stage_change: "Stage change",
  ai_draft: "AI draft",
}

export function ActivityTimeline({
  entityType,
  entityId,
}: {
  entityType: "lead" | "client"
  entityId: string | undefined
}) {
  const { data: activities, isLoading } = useActivities(entityType, entityId)

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (!activities || activities.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {activities.map((activity) => {
        const type = activity.type as keyof typeof TYPE_ICON
        const Icon = TYPE_ICON[type] ?? StickyNote
        return (
          <div key={activity.id} className="flex gap-3 border-b border-border pb-3 last:border-0">
            <Icon className="mt-0.5 size-4 shrink-0 text-brand-cyan" />
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {TYPE_LABEL[type] ?? type}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {new Date(activity.created_at).toLocaleString()}
                </span>
              </div>
              {activity.content && (
                <p className="text-sm text-foreground">{activity.content}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
