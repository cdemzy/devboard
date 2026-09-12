"use client";
import { useState } from "react";
import { motion } from "motion/react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  Circle,
  CircleDashed,
  CircleCheck,
  Archive,
  GripVertical,
  Plus,
  AlignLeft,
  SignalHigh,
  SignalMedium,
  SignalLow,
} from "lucide-react";
import { columnTasks } from "@/lib/board";
import { statuses, statusLabels, type Status, type Task } from "@/lib/types";
import { Button } from "./ui/button";
import { Tooltip } from "./ui/tooltip";
const statusIcons = {
  todo: CircleDashed,
  in_progress: Circle,
  done: CircleCheck,
};

function collisionDetectionStrategy(...args: Parameters<typeof pointerWithin>) {
  const pointerCollisions = pointerWithin(...args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(...args);
}

function TaskCard({
  task,
  edit,
  archive,
  disabled,
}: {
  task: Task;
  edit: (task: Task) => void;
  archive: (task: Task) => void;
  disabled: boolean;
}) {
  const { active, over } = useDndContext();
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({ id: task.id, disabled });
  const PriorityIcon = {
    low: SignalLow,
    medium: SignalMedium,
    high: SignalHigh,
  }[task.priority];
  const isDropTarget = active?.id !== task.id && over?.id === task.id;
  return (
    <motion.article
      ref={setNodeRef}
      layout="position"
      transition={{ layout: { duration: 0.22, ease: "easeOut" } }}
      onClick={() => edit(task)}
      {...attributes}
      {...listeners}
      className={`group relative min-h-24 touch-none rounded-lg border border-border bg-[#161b22] p-3 shadow-sm transition-[border-color,opacity,transform] duration-150 ${disabled ? "cursor-default" : "cursor-grab active:scale-[0.98] active:cursor-grabbing"} ${isDragging ? "scale-[0.98] opacity-30" : "hover:border-[#484f58]"} ${isDropTarget ? "after:absolute after:-bottom-1.5 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-primary after:shadow-[0_0_8px_rgb(47_129_247_/_0.9)]" : ""}`}
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
          <span className="mb-1 flex items-center gap-1 text-[10px] font-medium tracking-wide text-primary">
            {task.ticket_id}
            {task.description && <Tooltip label="Description"><AlignLeft size={12} aria-label="Has description" /></Tooltip>}
          </span>
          <span className="block wrap-break-word first-letter:uppercase text-[13px] leading-5 font-medium">
            {task.title}
          </span>
        </button>
        <Tooltip label="Drag to move"><span className="pointer-events-none rounded p-1 text-muted-foreground"><GripVertical size={15} /></span></Tooltip>
      </div>
      <div className="mt-4 flex items-center justify-between text-muted-foreground">
        <span
          className={`flex items-center gap-1.5 text-[11px] capitalize ${task.priority === "high" ? "text-orange-300" : ""}`}
        >
          <PriorityIcon size={13} />
          {task.priority}
        </span>
        <Tooltip label="Archive"><button onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); archive(task); }} disabled={disabled} aria-label={`Archive ${task.ticket_id}`} className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-primary group-hover:opacity-100 disabled:opacity-0"><Archive size={14} /></button></Tooltip>
      </div>
    </motion.article>
  );
}

function TaskDragPreview({ task }: { task: Task }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 520, damping: 30 }}
      className="w-72 rotate-[1deg] rounded-lg border border-primary/60 bg-[#161b22] p-3 shadow-xl"
    >
      <span className="mb-1 block text-[10px] font-medium tracking-wide text-primary">
        {task.ticket_id}
      </span>
      <span className="block wrap-break-word text-[13px] font-medium leading-5">
        {task.title}
      </span>
    </motion.div>
  );
}
function Column({
  status,
  tasks,
  edit,
  archive,
  create,
  disabled,
}: {
  status: Status;
  tasks: Task[];
  edit: (task: Task) => void;
  archive: (task: Task) => void;
  create: (status: Status) => void;
  disabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled });
  const { over } = useDndContext();
  const Icon = statusIcons[status];
  const containsOverTask = tasks.some((task) => task.id === over?.id);
  return (
    <section
      ref={setNodeRef}
      aria-label={statusLabels[status]}
      className={`group/column min-h-[calc(100dvh-15.75rem)] min-w-0 rounded-lg border border-border bg-[#0d1117] p-2 shadow-sm transition-all duration-150 ${isOver || containsOverTask ? "bg-primary/12 ring-1 ring-inset ring-primary/60 shadow-[0_0_24px_rgb(47_129_247_/_0.14)]" : "hover:border-[#484f58]"}`}
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
        <Tooltip label="Add">
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
        </Tooltip>
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
              archive={archive}
              disabled={disabled}
            />
          ))}
        </div>
      </SortableContext>
      {isOver && tasks.length > 0 && <div aria-hidden="true" className="mx-2 mt-3 h-0.5 rounded-full bg-primary shadow-[0_0_8px_rgb(47_129_247_/_0.9)]" />}
      {tasks.length === 0 && (
        <p className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
          No tasks yet
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-full justify-center text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/column:opacity-100 focus-visible:opacity-100"
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
  archive,
  create,
  move,
  disabled,
}: {
  tasks: Task[];
  edit: (task: Task) => void;
  archive: (task: Task) => void;
  create: (status: Status) => void;
  move: (id: string, status: Status, position: number) => void;
  disabled: boolean;
}) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
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
        ? column.findIndex((task) => task.id === targetTask.id) + 1
        : column.filter((task) => task.id !== active.id).length,
    );
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={({ active }) => setActiveTask(tasks.find((task) => task.id === active.id) ?? null)}
      onDragCancel={() => setActiveTask(null)}
      onDragEnd={(event) => {
        onDragEnd(event);
        setActiveTask(null);
      }}
    >
      <div className="grid grid-cols-1 gap-4 pb-6 md:grid-cols-3">
        <>
          {statuses.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={columnTasks(tasks, status)}
              edit={edit}
              archive={archive}
              create={create}
              disabled={disabled}
            />
          ))}
        </>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskDragPreview task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
