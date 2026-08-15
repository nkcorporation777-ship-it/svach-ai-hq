import { supabase } from "@/lib/supabase/client"
import type { Json } from "@/types/database"

/**
 * PRD.md's Definition of Done: every write from every actor type gets an
 * audit_logs row (DECISION_LOG.md §6). Called after a Sales/Nexus mutation's
 * real write succeeds — actor_type is always "user" here since this only runs
 * from human-initiated UI actions; "agent"/"system" rows come from AI-assist
 * and Hermes/n8n once those exist. A failed audit write is logged but never
 * fails the caller's mutation — the business write already succeeded, and
 * audit logging shouldn't become a single point of failure for it.
 */
export async function logAudit({
  action,
  entityType,
  entityId,
  metadata,
}: {
  action: string
  entityType?: string
  entityId?: string
  metadata?: Json
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from("audit_logs").insert({
    actor_type: "user",
    actor_id: user?.id ?? null,
    action,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    metadata: metadata ?? {},
  })

  if (error) console.error("audit log write failed:", error)
}
