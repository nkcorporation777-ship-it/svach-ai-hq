import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft, Plus, Check } from "lucide-react"
import { Card } from "@/components/shared/Card"
import { ActivityTimeline } from "@/components/shared/ActivityTimeline"
import { SequentialChecklistItem } from "@/components/shared/SequentialChecklistItem"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  useProject,
  useProjectTasks,
  useCreateTask,
  useCompleteTask,
  useAdvanceProjectStage,
  STAGES,
  STAGE_LABELS,
  type Stage,
} from "./hooks"

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: project, isLoading } = useProject(id)
  const { data: tasks } = useProjectTasks(id)
  const createTask = useCreateTask(id)
  const completeTask = useCompleteTask(id)
  const advanceStage = useAdvanceProjectStage(id)
  const [newTaskTitle, setNewTaskTitle] = useState("")

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!project) return <p className="text-sm text-muted-foreground">Project not found.</p>

  const currentStage = project.stage as Stage
  const currentIndex = STAGES.indexOf(currentStage)
  const isDone = !!project.completed_at
  const client = (project as { clients?: { id: string; practice_name: string } | null }).clients

  const tasksInCurrentStage = (tasks ?? []).filter((t) => t.stage === currentStage)
  const incompleteInCurrentStage = tasksInCurrentStage.filter((t) => !t.is_complete)
  const canAdvance = incompleteInCurrentStage.length === 0

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    await createTask.mutateAsync({ title: newTaskTitle.trim(), stage: currentStage })
    setNewTaskTitle("")
  }

  function handleAdvance() {
    if (!canAdvance) return
    const nextStage = STAGES[currentIndex + 1] ?? null
    advanceStage.mutate({ fromStage: currentStage, toStage: nextStage })
  }

  return (
    <div className="flex flex-col gap-8">
      <Link
        to="/delivery"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Delivery
      </Link>

      <header>
        <h1 className="font-display text-3xl font-semibold">{project.name}</h1>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <h2 className="font-display text-base font-semibold">Stages</h2>
            <div className="mt-4 flex flex-col gap-2">
              {STAGES.map((stage, i) => {
                const stepIsComplete = isDone || i < currentIndex
                const stepIsLocked =
                  !isDone && (i > currentIndex || (i === currentIndex && !canAdvance))
                return (
                  <SequentialChecklistItem
                    key={stage}
                    stepName={STAGE_LABELS[stage]}
                    isComplete={stepIsComplete}
                    isLocked={stepIsLocked}
                    onComplete={handleAdvance}
                  />
                )
              })}
            </div>
            {!isDone && !canAdvance && (
              <p className="mt-3 text-xs text-status-warning">
                {incompleteInCurrentStage.length} task
                {incompleteInCurrentStage.length === 1 ? "" : "s"} left in{" "}
                {STAGE_LABELS[currentStage]} before you can advance.
              </p>
            )}
            {isDone && (
              <p className="mt-3 text-xs text-status-success">Project completed.</p>
            )}
          </Card>

          {!isDone && (
            <Card>
              <h2 className="font-display text-base font-semibold">
                Tasks — {STAGE_LABELS[currentStage]}
              </h2>
              <form onSubmit={handleAddTask} className="mt-4 flex gap-2">
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add a task…"
                />
                <Button type="submit" size="sm" disabled={createTask.isPending}>
                  <Plus className="size-4" />
                  Add
                </Button>
              </form>
              <div className="mt-4 flex flex-col gap-2">
                {tasksInCurrentStage.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks logged yet.</p>
                ) : (
                  tasksInCurrentStage.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      disabled={task.is_complete || completeTask.isPending}
                      onClick={() =>
                        completeTask.mutate({
                          id: task.id,
                          title: task.title,
                          stage: task.stage as Stage,
                        })
                      }
                      className={cn(
                        "flex items-center gap-3 rounded-[var(--radius-pill)] border border-border px-3 py-2.5 text-left transition-colors",
                        !task.is_complete && "hover:border-brand-azure",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border",
                          task.is_complete
                            ? "border-status-success bg-status-success/20 text-status-success"
                            : "border-border text-transparent",
                        )}
                      >
                        {task.is_complete && <Check className="size-3" />}
                      </span>
                      <span
                        className={cn(
                          "text-sm",
                          task.is_complete
                            ? "text-muted-foreground line-through"
                            : "text-foreground",
                        )}
                      >
                        {task.title}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </Card>
          )}

          <Card>
            <h2 className="font-display text-base font-semibold">Activity</h2>
            <div className="mt-4">
              <ActivityTimeline entityType="project" entityId={project.id} />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="font-display text-base font-semibold">Profile</h2>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Client</dt>
                <dd>
                  {client ? (
                    <Link
                      to={`/nexus/${client.id}`}
                      className="text-foreground hover:text-brand-azure"
                    >
                      {client.practice_name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Stage</dt>
                <dd className="capitalize">{isDone ? "Completed" : STAGE_LABELS[currentStage]}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Started</dt>
                <dd>{new Date(project.created_at).toLocaleDateString()}</dd>
              </div>
              {project.completed_at && (
                <div>
                  <dt className="text-xs text-muted-foreground">Completed</dt>
                  <dd>{new Date(project.completed_at).toLocaleDateString()}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}
