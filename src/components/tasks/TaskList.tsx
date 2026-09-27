import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '@/lib/types'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { TaskItem, type TaskItemProps } from './TaskItem'

function SortableRow({ id, children }: { id: string; children: (props: any) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.85 : 1,
    position: isDragging ? 'relative' as const : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        dragHandleProps: { ...attributes, ...listeners },
        innerRef: setNodeRef,
        isDragging,
      })}
    </div>
  )
}

export interface TaskListProps {
  tasks: Task[]
  /** Rendered above each item if supplied */
  renderItem?: (props: Omit<TaskItemProps, 'task' | 'onToggle' | 'onOpen' | 'onToggleImportant'> & { task: Task }) => React.ReactNode
  /** Grouping label shown while dragging (optional) */
  onReorder?: (activeId: string, overId: string) => void
  compact?: boolean
  hideProject?: boolean
  empty?: React.ReactNode
  /** Optional callback when a row is clicked outside of its internal controls */
  onTaskClick?: (task: Task) => void
  footer?: React.ReactNode
}

export function TaskList({ tasks, onReorder, compact, hideProject, empty }: TaskListProps) {
  const toggleComplete = useStore((s) => s.toggleComplete)
  const toggleImportant = useStore((s) => s.toggleImportant)
  const openTask = useUIStore((s) => s.openTask)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (over && active.id !== over.id && onReorder) onReorder(String(active.id), String(over.id))
  }

  const ordered = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder)

  if (ordered.length === 0) {
    return empty ? <>{empty}</> : null
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ordered.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-0.5">
          {ordered.map((task) => (
            <SortableRow key={task.id} id={task.id}>
              {(sortProps) => (
                <TaskItem
                  task={task}
                  compact={compact}
                  hideProject={hideProject}
                  onToggle={() => toggleComplete(task.id)}
                  onOpen={() => openTask(task.id)}
                  onToggleImportant={() => toggleImportant(task.id)}
                  {...sortProps}
                />
              )}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
