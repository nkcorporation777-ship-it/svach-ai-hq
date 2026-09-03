import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"

export const STAGES = ["discover", "design", "deploy", "optimise"] as const
export type Stage = (typeof STAGES)[number]

export const STAGE_LABELS: Record<Stage, string> = {
  discover: "Discover",
  design: "Design",
  deploy: "Deploy",
  optimise: "Optimise",
}

/** Active projects only (not completed/deleted) — Delivery's own pipeline view. */
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(practice_name), project_tasks(stage, is_complete)")
        .is("completed_at", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(id, practice_name)")
        .eq("id", id!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ["projectTasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId!)
        .order("order_index")
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

/** Clients eligible to start a new project — "Deposit received" (order_index 5)
 * complete, and no existing active project. UI-level filter, matching how the
 * onboarding sequence gate itself is application-layer, not DB-enforced. */
export function useEligibleClientsForNewProject() {
  return useQuery({
    queryKey: ["eligibleClientsForNewProject"],
    queryFn: async () => {
      const [{ data: clients, error: clientsError }, { data: depositSteps, error: stepsError }, { data: activeProjects, error: projectsError }] =
        await Promise.all([
          supabase.from("clients").select("id, practice_name").is("deleted_at", null),
          supabase
            .from("client_onboarding_steps")
            .select("client_id, is_complete")
            .eq("order_index", 5),
          supabase.from("projects").select("client_id").is("completed_at", null).is("deleted_at", null),
        ])
      if (clientsError) throw clientsError
      if (stepsError) throw stepsError
      if (projectsError) throw projectsError

      const depositCompleteIds = new Set(
        (depositSteps ?? []).filter((s) => s.is_complete).map((s) => s.client_id),
      )
      const activeProjectClientIds = new Set((activeProjects ?? []).map((p) => p.client_id))

      return (clients ?? []).filter(
        (c) => depositCompleteIds.has(c.id) && !activeProjectClientIds.has(c.id),
      )
    },
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clientId, name }: { clientId: string; name: string }) => {
      const { data, error } = await supabase
        .from("projects")
        .insert({ client_id: clientId, name })
        .select()
        .single()
      if (error) throw error
      await logAudit({
        action: "project.created",
        entityType: "project",
        entityId: data.id,
        metadata: { client_id: clientId, name },
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      queryClient.invalidateQueries({ queryKey: ["eligibleClientsForNewProject"] })
    },
  })
}

export function useCreateTask(projectId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ title, stage }: { title: string; stage: Stage }) => {
      const { error } = await supabase
        .from("project_tasks")
        .insert({ project_id: projectId!, title, stage })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectTasks", projectId] })
    },
  })
}

/** Flips a task done — the on-page activity write happens synchronously here
 * (matches how Sales' stage-change writes activities directly); Delivery
 * Pulse's async status report is a separate, DB-trigger-driven path, not
 * this hook's job. */
export function useCompleteTask(projectId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (task: { id: string; title: string; stage: Stage }) => {
      const { error } = await supabase
        .from("project_tasks")
        .update({ is_complete: true, completed_at: new Date().toISOString() })
        .eq("id", task.id)
      if (error) throw error

      await supabase.from("activities").insert({
        entity_type: "project",
        entity_id: projectId!,
        type: "task_complete",
        content: `Completed: ${task.title}`,
        metadata: { task_id: task.id, stage: task.stage },
      })

      await logAudit({
        action: "project.task_completed",
        entityType: "project",
        entityId: projectId,
        metadata: { task_id: task.id, stage: task.stage },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectTasks", projectId] })
      queryClient.invalidateQueries({ queryKey: ["activities", "project", projectId] })
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}

/** Hard-gated client-side: the caller must confirm no incomplete tasks exist
 * for the current stage before calling this — see ProjectDetailPage.tsx. This
 * hook itself just performs the transition once that check has passed. */
export function useAdvanceProjectStage(projectId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      fromStage,
      toStage,
    }: {
      fromStage: Stage
      toStage: Stage | null // null = optimise → done
    }) => {
      const update = toStage
        ? { stage: toStage }
        : { completed_at: new Date().toISOString() }
      const { error } = await supabase.from("projects").update(update).eq("id", projectId!)
      if (error) throw error

      await supabase.from("activities").insert({
        entity_type: "project",
        entity_id: projectId!,
        type: "stage_change",
        content: toStage
          ? `Advanced ${STAGE_LABELS[fromStage]} → ${STAGE_LABELS[toStage]}`
          : `Project completed (${STAGE_LABELS[fromStage]} finished)`,
        metadata: { from_stage: fromStage, to_stage: toStage },
      })

      await logAudit({
        action: "project.stage_advanced",
        entityType: "project",
        entityId: projectId,
        metadata: { from_stage: fromStage, to_stage: toStage },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] })
      queryClient.invalidateQueries({ queryKey: ["activities", "project", projectId] })
    },
  })
}
