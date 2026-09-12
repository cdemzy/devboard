"use client";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Circle,
  CircleDashed,
  CircleCheck,
  GripVertical,
  Plus,
  AlignLeft,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Trash2,
} from "lucide-react";
import { columnTasks } from "@/lib/board";
import { statuses, statusLabels, type Status, type Task } from "@/lib/types";
import { Button } from "./ui/button";
const statusIcons = {
  todo: CircleDashed,
  in_progress: Circle,
  done: CircleCheck,
};
function TaskCard({
  task,
  edit,
  remove,
  disabled,
}: {
  task: Task;
  edit: (task: Task) => void;
  remove: (task: Task) => void;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled });
  const PriorityIcon = {
    low: SignalLow,
    medium: SignalMedium,
    high: SignalHigh,
  }[task.priority];
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={() => edit(task)}
      className={`group cursor-pointer rounded-lg border border-border bg-[#202126] p-3 shadow-sm ${isDragging ? "z-20 opacity-50" : "hover:border-[#454650]"}`}
    >
      <div className="flex items-start gap-1">
        <button
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            edit(task);
          }}
          aria-label={task.title}
          className="min-w-0 flex-1 text-left focus-visible:outline-primary"
        >
          <span className="mb-1 block text-[10px] font-medium tracking-wide text-primary">
            {task.ticket_id}
          </span>
          <span className="block wrap-break-word first-letter:uppercase text-[13px] leading-5 font-medium">
            {task.title}
          </span>
        </button>
        <button
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            remove(task);
          }}
          disabled={disabled}
          aria-label={`Delete ${task.ticket_id}`}
          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-rose-950/40 hover:text-rose-300 focus-visible:opacity-100 focus-visible:outline-primary group-hover:opacity-100 disabled:opacity-0"
        >
          <Trash2 size={14} />
        </button>
        <button
          {...attributes}
          {...listeners}
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Move ${task.title}`}
          className="touch-none rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 cursor-grab"
        >
          <GripVertical size={15} />
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between text-muted-foreground">
        <span
          className={`flex items-center gap-1.5 text-[11px] capitalize ${task.priority === "high" ? "text-orange-300" : ""}`}
        >
          <PriorityIcon size={13} />
          {task.priority}
        </span>
        {task.description && (
          <AlignLeft size={13} aria-label="Has description" />
        )}
      </div>
    </article>
  );
}
function Column({
  status,
  tasks,
  edit,
  remove,
  create,
  disabled,
}: {
  status: Status;
  tasks: Task[];
  edit: (task: Task) => void;
  remove: (task: Task) => void;
  create: (status: Status) => void;
  disabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled });
  const Icon = statusIcons[status];
  return (
    <section
      ref={setNodeRef}
      aria-label={statusLabels[status]}
      className={`min-h-72 min-w-65 flex-1 rounded-lg p-2 ${isOver ? "bg-primary/8" : "bg-[#17181c]"}`}
    >
      <header className="mb-4 flex items-center gap-2 px-1 pt-1">
        <Icon
          size={15}
          className={
            status === "done"
              ? "text-emerald-400"
              : status === "in_progress"
                ? "text-amber-300"
                : "text-muted-foreground"
          }
        />
        <h2 className="text-xs font-semibold">{statusLabels[status]}</h2>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          aria-label={`Add task to ${statusLabels[status]}`}
          disabled={disabled}
          onClick={() => create(status)}
        >
          <Plus size={15} />
        </Button>
      </header>
      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              edit={edit}
              remove={remove}
              disabled={disabled}
            />
          ))}
        </div>
      </SortableContext>
      {tasks.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-9 text-center text-xs text-muted-foreground">
          No tasks yet
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-full justify-start text-muted-foreground"
        disabled={disabled}
        onClick={() => create(status)}
      >
        <Plus size={14} />
        Add task
      </Button>
    </section>
  );
}
export function KanbanBoard({
  tasks,
  edit,
  remove,
  create,
  move,
  disabled,
}: {
  tasks: Task[];
  edit: (task: Task) => void;
  remove: (task: Task) => void;
  create: (status: Status) => void;
  move: (id: string, status: Status, position: number) => void;
  disabled: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id || disabled) return;
    const targetTask = tasks.find((task) => task.id === over.id);
    const status =
      targetTask?.status ??
      (statuses.includes(over.id as Status) ? (over.id as Status) : undefined);
    if (!status) return;
    const column = columnTasks(tasks, status);
    move(
      String(active.id),
      status,
      targetTask
        ? column.findIndex((task) => task.id === targetTask.id)
        : column.filter((task) => task.id !== active.id).length,
    );
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-start gap-4 overflow-x-auto pb-6">
        <>
          {statuses.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={columnTasks(tasks, status)}
              edit={edit}
              remove={remove}
              create={create}
              disabled={disabled}
            />
          ))}
        </>
      </div>
    </DndContext>
  );
}
