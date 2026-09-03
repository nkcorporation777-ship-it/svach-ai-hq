import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useProjects, type Stage } from "./hooks"
import { ProjectCard } from "./ProjectCard"
import { NewProjectDialog } from "./NewProjectDialog"

/** Delivery — INFORMATION_ARCHITECTURE.md's locked placeholder, built for the
 * first time here. Closes the lifecycle gap: Sales wins a deal → Nexus
 * onboards the client → Delivery is where the actual work gets tracked,
 * Discover → Design → Deploy → Optimise. */
export function DeliveryPage() {
  const { data: projects, isLoading } = useProjects()
  const [newProjectOpen, setNewProjectOpen] = useState(false)

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
            Delivery
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">Projects</h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Discover → Design → Deploy → Optimise.
          </p>
        </div>
        <Button onClick={() => setNewProjectOpen(true)}>
          <Plus className="size-4" />
          New Project
        </Button>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !projects || projects.length === 0 ? (
        <div className="glass-card">
          <p className="text-sm text-muted-foreground">No active projects yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const stage = project.stage as Stage
            const tasksInStage = (
              project as {
                project_tasks?: { stage: string; is_complete: boolean }[]
              }
            ).project_tasks?.filter((t) => t.stage === stage)
            const tasksTotal = tasksInStage?.length ?? 0
            const tasksComplete = tasksInStage?.filter((t) => t.is_complete).length ?? 0
            const practiceName =
              (project as { clients?: { practice_name: string } | null }).clients
                ?.practice_name ?? "Unknown client"
            return (
              <ProjectCard
                key={project.id}
                id={project.id}
                name={project.name}
                practiceName={practiceName}
                stage={stage}
                tasksComplete={tasksComplete}
                tasksTotal={tasksTotal}
              />
            )
          })}
        </div>
      )}

      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
    </div>
  )
}
