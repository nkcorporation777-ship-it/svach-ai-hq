import { useState, type ReactNode } from "react"
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { cn } from "@/lib/utils"

export interface PipelineColumn {
  id: string
  label: string
}

export interface PipelineItem {
  id: string
  columnId: string
}

/**
 * Generic drag-and-drop board (INFORMATION_ARCHITECTURE.md §4.1) — moving
 * between columns only, no within-column reordering, so plain @dnd-kit/core
 * droppable/draggable primitives rather than the heavier @dnd-kit/sortable.
 * Not Sales-specific by construction — Sales supplies the columns, items, and
 * card renderer; this component only knows about drag mechanics.
 */
export function PipelineBoard<T extends PipelineItem>({
  columns,
  items,
  renderCard,
  onDrop,
}: {
  columns: PipelineColumn[]
  items: T[]
  renderCard: (item: T, isDragging: boolean) => ReactNode
  onDrop: (itemId: string, toColumnId: string) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const toColumnId = String(over.id)
    const item = items.find((i) => i.id === active.id)
    if (item && item.columnId !== toColumnId) {
      onDrop(String(active.id), toColumnId)
    }
  }

  const activeItem = items.find((i) => i.id === activeId)

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {columns.map((column) => (
          <KanbanColumn key={column.id} column={column}>
            {items
              .filter((item) => item.columnId === column.id)
              .map((item) => (
                <DraggableCard key={item.id} id={item.id}>
                  {renderCard(item, item.id === activeId)}
                </DraggableCard>
              ))}
          </KanbanColumn>
        ))}
      </div>
      <DragOverlay>
        {activeItem ? renderCard(activeItem, true) : null}
      </DragOverlay>
    </DndContext>
  )
}

function KanbanColumn({
  column,
  children,
}: {
  column: PipelineColumn
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "glass-card flex min-h-[240px] flex-col gap-3 transition-colors",
        isOver && "border-brand-azure",
      )}
    >
      <h2 className="font-display text-sm font-semibold">{column.label}</h2>
      <div className="flex flex-col gap-2">{children}</div>
      {!children || (Array.isArray(children) && children.length === 0) ? (
        <p className="text-xs text-muted-foreground">No leads yet.</p>
      ) : null}
    </div>
  )
}

function DraggableCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab touch-none active:cursor-grabbing", isDragging && "opacity-40")}
    >
      {children}
    </div>
  )
}
