"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
  MoreVertical,
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
import { Tooltip } from "./ui/tooltip";
const statusIcons = {
  todo: CircleDashed,
  in_progress: Circle,
  done: CircleCheck,
};
const statusStyles: Record<Status, { accent: string; state: string; ticket: string; active: string; drop: string }> = {
  todo: {
    accent: "text-[#6C5082]",
    state: "border-[#6C5082]/35 bg-[#221D25]",
    ticket: "border-[#6C5082]/45 bg-[#36293F]",
    active: "ring-1 ring-inset ring-[#6C5082]/70",
    drop: "bg-[#6C5082]",
  },
  in_progress: {
    accent: "text-[#886826]",
    state: "border-[#886826]/35 bg-[#23221A]",
    ticket: "border-[#886826]/45 bg-[#373325]",
    active: "ring-1 ring-inset ring-[#886826]/70",
    drop: "bg-[#886826]",
  },
  done: {
    accent: "text-[#386C4E]",
    state: "border-[#386C4E]/35 bg-[#1B211D]",
    ticket: "border-[#386C4E]/45 bg-[#24342B]",
    active: "ring-1 ring-inset ring-[#386C4E]/70",
    drop: "bg-[#386C4E]",
  },
};

function collisionDetectionStrategy(...args: Parameters<typeof pointerWithin>) {
  const pointerCollisions = pointerWithin(...args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(...args);
}

function TaskCard({
  task,
  edit,
  archive,
  remove,
  disabled,
}: {
  task: Task;
  edit: (task: Task) => void;
  archive: (task: Task) => void;
  remove: (task: Task) => void;
  disabled: boolean;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
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
  const statusStyle = statusStyles[task.status];
  const isDropTarget = active?.id !== task.id && over?.id === task.id;
  return (
    <motion.article
      ref={setNodeRef}
      layout="position"
      transition={{ layout: { duration: 0.22, ease: "easeOut" } }}
      onClick={() => edit(task)}
      onMouseLeave={() => setActionsOpen(false)}
      {...attributes}
      {...listeners}
      className={`group relative min-h-24 touch-none rounded-lg border p-3 shadow-sm transition-[border-color,opacity,transform] duration-150 ${statusStyle.ticket} ${disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"} ${isDragging ? "scale-[0.98] opacity-30" : "hover:border-[#484f58]"} ${isDropTarget ? `after:absolute after:-bottom-1.5 after:left-2 after:right-2 after:h-0.5 after:rounded-full ${statusStyle.drop}` : ""}`}
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
          <span className={`mb-1 flex items-center gap-1 text-[10px] font-medium tracking-wide ${statusStyle.accent}`}>
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
        <div className="relative">
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setActionsOpen((open) => !open); }} disabled={disabled} aria-label={`Actions for ${task.ticket_id}`} className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-primary group-hover:opacity-100 disabled:opacity-0"><MoreVertical size={14} /></button>
          <AnimatePresence>
            {actionsOpen && <motion.div initial={{ opacity: 0, x: 6, scale: 0.92 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 6, scale: 0.92 }} transition={{ duration: 0.14 }} onPointerDown={(event) => event.stopPropagation()} className="absolute -bottom-1 right-full z-20 mr-1 flex items-center gap-1 rounded-full border border-border bg-[#161b22] p-1 shadow-xl"><Tooltip label="Archive"><button type="button" onClick={(event) => { event.stopPropagation(); setActionsOpen(false); archive(task); }} disabled={disabled} aria-label={`Archive ${task.ticket_id}`} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Archive size={14} /></button></Tooltip><Tooltip label="Delete"><button type="button" onClick={(event) => { event.stopPropagation(); setActionsOpen(false); remove(task); }} disabled={disabled} aria-label={`Delete ${task.ticket_id}`} className="flex h-7 w-7 items-center justify-center rounded-full text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"><Trash2 size={14} /></button></Tooltip></motion.div>}
          </AnimatePresence>
        </div>
      </div>
    </motion.article>
  );
}

function TaskDragPreview({ task }: { task: Task }) {
  const statusStyle = statusStyles[task.status];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 520, damping: 30 }}
      className={`w-72 rotate-1 rounded-lg border p-3 shadow-xl ${statusStyle.ticket}`}
    >
      <span className={`mb-1 block text-[10px] font-medium tracking-wide ${statusStyle.accent}`}>
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
  remove,
  create,
  disabled,
}: {
  status: Status;
  tasks: Task[];
  edit: (task: Task) => void;
  archive: (task: Task) => void;
  remove: (task: Task) => void;
  create: (status: Status) => void;
  disabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled });
  const { over } = useDndContext();
  const Icon = statusIcons[status];
  const statusStyle = statusStyles[status];
  const containsOverTask = tasks.some((task) => task.id === over?.id);
  return (
    <section
      ref={setNodeRef}
      aria-label={statusLabels[status]}
      className={`group/column min-h-[max(22rem,calc(100dvh-23rem))] min-w-0 rounded-lg border p-2 shadow-sm transition-all duration-150 ${statusStyle.state} ${isOver || containsOverTask ? statusStyle.active : "hover:border-[#484f58]"}`}
    >
      <header className="mb-4 flex items-center gap-2 px-1 pt-1">
        <Icon
          size={15}
          className={statusStyle.accent}
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
              remove={remove}
              disabled={disabled}
            />
          ))}
        </div>
      </SortableContext>
      {isOver && tasks.length > 0 && <div aria-hidden="true" className={`mx-2 mt-3 h-0.5 rounded-full ${statusStyle.drop}`} />}
      {tasks.length === 0 && (
        <p className="flex min-h-[7.5rem] items-center justify-center rounded-lg border border-dashed border-[#484f58] px-3 py-3 text-center text-xs text-muted-foreground">
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
  remove,
  create,
  move,
  disabled,
}: {
  tasks: Task[];
  edit: (task: Task) => void;
  archive: (task: Task) => void;
  remove: (task: Task) => void;
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <>
          {statuses.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={columnTasks(tasks, status)}
              edit={edit}
              archive={archive}
              remove={remove}
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
