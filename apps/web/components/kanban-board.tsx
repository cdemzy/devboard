'use client'
import { useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
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
} from '@dnd-kit/core'
import {
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
	sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import {
	Circle,
	CircleDashed,
	CircleCheck,
	Gauge,
	Archive,
	GripVertical,
	MoreVertical,
	Plus,
	AlignLeft,
	Flag,
	Trash2,
} from 'lucide-react'
import { columnTasks } from '@/lib/board'
import { statuses, statusLabels, type Status, type Task } from '@/lib/types'
import { Button } from './ui/button'
import { Tooltip } from './ui/tooltip'
const statusIcons = {
	todo: CircleDashed,
	in_progress: Circle,
	done: CircleCheck,
}
const statusStyles: Record<
	Status,
	{
		accent: string
		state: string
		ticket: string
		active: string
		drop: string
		emptyDrop: string
	}
> = {
	todo: {
		accent: 'text-[#6C5082]',
		state: 'border-[#6C5082]/35 bg-[#221D25]',
		ticket: 'border-[#6C5082]/45 bg-[#36293F]',
		active: 'ring-1 ring-inset ring-[#6C5082]/70',
		drop: 'bg-[#6C5082]',
		emptyDrop: 'border-[#6C5082] text-[#a371c8]',
	},
	in_progress: {
		accent: 'text-[#886826]',
		state: 'border-[#886826]/35 bg-[#23221A]',
		ticket: 'border-[#886826]/45 bg-[#373325]',
		active: 'ring-1 ring-inset ring-[#886826]/70',
		drop: 'bg-[#886826]',
		emptyDrop: 'border-[#886826] text-[#d29922]',
	},
	done: {
		accent: 'text-[#386C4E]',
		state: 'border-[#386C4E]/35 bg-[#1B211D]',
		ticket: 'border-[#386C4E]/45 bg-[#24342B]',
		active: 'ring-1 ring-inset ring-[#386C4E]/70',
		drop: 'bg-[#386C4E]',
		emptyDrop: 'border-[#386C4E] text-[#56a874]',
	},
}

function collisionDetectionStrategy(...args: Parameters<typeof pointerWithin>) {
	const pointerCollisions = pointerWithin(...args)
	return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(...args)
}

function getColumnDropPosition(
	status: Status,
	activeId: string,
	pointerY: number | null,
	fallback: number,
) {
	if (pointerY === null || typeof document === 'undefined') return fallback
	const column = document.querySelector<HTMLElement>(`[data-kanban-column="${status}"]`)
	if (!column) return fallback
	const cards = Array.from(column.querySelectorAll<HTMLElement>('[data-task-id]')).filter(
		(card) => card.dataset.taskId !== activeId,
	)
	const nextCardIndex = cards.findIndex((card) => {
		const rect = card.getBoundingClientRect()
		return pointerY < rect.top + rect.height / 2
	})
	return nextCardIndex === -1 ? cards.length : nextCardIndex
}

function TaskCard({
	task,
	edit,
	archive,
	remove,
	disabled,
}: {
	task: Task
	edit: (task: Task) => void
	archive: (task: Task) => void
	remove: (task: Task) => void
	disabled: boolean
}) {
	const [actionsOpen, setActionsOpen] = useState(false)
	const { attributes, listeners, setNodeRef, isDragging } = useSortable({
		id: task.id,
		disabled,
	})
	const statusStyle = statusStyles[task.status]
	return (
		<motion.article
			ref={setNodeRef}
			layout="position"
			transition={{ layout: { duration: 0.22, ease: 'easeOut' } }}
			onClick={() => edit(task)}
			onMouseLeave={() => setActionsOpen(false)}
			data-task-id={task.id}
			className={`task-card group relative min-h-24 touch-auto rounded-lg border p-3 shadow-sm transition-[border-color,opacity,transform] duration-150 ${statusStyle.ticket} ${disabled ? 'cursor-default' : 'cursor-pointer'} ${isDragging ? 'opacity-30' : 'hover:border-[#484f58]'}`}
		>
			<div className="task-card-header flex items-start gap-1">
				<button
					disabled={disabled}
					onClick={(event) => {
						event.stopPropagation()
						edit(task)
					}}
					aria-label={task.title}
					className="task-card-title-link min-w-0 flex-1 text-left focus-visible:outline-primary"
				>
					<span
						className={`task-card-ticket mb-1 flex items-center gap-1 text-[10px] font-medium tracking-wide ${statusStyle.accent}`}
					>
						{task.ticket_id}
						{task.description && (
							<Tooltip label="Description">
								<AlignLeft size={12} aria-label="Has description" />
							</Tooltip>
						)}
					</span>
					<span className="task-card-title block wrap-break-word first-letter:uppercase text-[13px] leading-5 font-medium">
						{task.title}
					</span>
				</button>
				<Tooltip label="Drag to move">
					<button
						type="button"
						onClick={(event) => event.stopPropagation()}
						aria-label={`Drag ${task.ticket_id} to move`}
						disabled={disabled}
						className="task-card-drag-handle touch-none rounded p-1 text-muted-foreground cursor-grab active:cursor-grabbing disabled:cursor-default"
						{...attributes}
						{...listeners}
					>
						<GripVertical size={15} />
					</button>
				</Tooltip>
			</div>
			<div className="task-card-footer mt-4 flex items-center justify-between text-muted-foreground">
				<span
					className={`task-card-priority flex items-center gap-1.5 text-[12px] leading-none capitalize ${task.priority === 'high' ? 'text-orange-300' : ''}`}
				>
					<Flag size={14} className="shrink-0" />
					{task.priority}
				</span>
				<span
					className={`task-card-complexity flex items-center gap-1.5 text-[12px] leading-none capitalize ${task.complexity === 'hard' ? 'text-orange-300' : ''}`}
				>
					<Gauge size={14} className="shrink-0" />
					{task.complexity}
				</span>
				<div className="task-card-actions relative">
					<button
						type="button"
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.stopPropagation()
							setActionsOpen((open) => !open)
						}}
						disabled={disabled}
						aria-label={`Actions for ${task.ticket_id}`}
						className="task-actions-trigger focus-visible:outline-primary"
					>
						<MoreVertical size={14} />
					</button>
					<AnimatePresence>
						{actionsOpen && (
							<motion.div
								initial={{ opacity: 0, x: 6, scale: 0.92 }}
								animate={{ opacity: 1, x: 0, scale: 1 }}
								exit={{ opacity: 0, x: 6, scale: 0.92 }}
								transition={{ duration: 0.14 }}
								onPointerDown={(event) => event.stopPropagation()}
								className="task-actions-menu"
							>
								<Tooltip label="Archive">
									<button
										type="button"
										onClick={(event) => {
											event.stopPropagation()
											setActionsOpen(false)
											archive(task)
										}}
										disabled={disabled}
										aria-label={`Archive ${task.ticket_id}`}
										className="task-actions-menu-button"
									>
										<Archive size={12} />
									</button>
								</Tooltip>
								<Tooltip label="Delete">
									<button
										type="button"
										onClick={(event) => {
											event.stopPropagation()
											setActionsOpen(false)
											remove(task)
										}}
										disabled={disabled}
										aria-label={`Delete ${task.ticket_id}`}
										className="task-actions-menu-button task-actions-menu-button-danger"
									>
										<Trash2 size={12} />
									</button>
								</Tooltip>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		</motion.article>
	)
}

function TaskDragPreview({ task }: { task: Task }) {
	const statusStyle = statusStyles[task.status]
	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.96, y: 4 }}
			animate={{ opacity: 1, scale: 1, y: 0 }}
			transition={{ type: 'spring', stiffness: 520, damping: 30 }}
			className={`task-drag-preview w-72 rotate-1 rounded-lg border p-3 shadow-xl ${statusStyle.ticket}`}
		>
			<span
				className={`mb-1 block text-[10px] font-medium tracking-wide ${statusStyle.accent}`}
			>
				{task.ticket_id}
			</span>
			<span className="block wrap-break-word text-[13px] font-medium leading-5">
				{task.title}
			</span>
		</motion.div>
	)
}
function Column({
	status,
	tasks,
	edit,
	archive,
	remove,
	create,
	disabled,
	loading,
	pointerY,
}: {
	status: Status
	tasks: Task[]
	edit: (task: Task) => void
	archive: (task: Task) => void
	remove: (task: Task) => void
	create: (status: Status) => void
	disabled: boolean
	loading: boolean
	pointerY: number | null
}) {
	const { setNodeRef, isOver } = useDroppable({ id: status, disabled })
	const { active, over } = useDndContext()
	const taskListRef = useRef<HTMLDivElement>(null)
	const [dropIndicatorTop, setDropIndicatorTop] = useState<number | null>(null)
	const Icon = statusIcons[status]
	const statusStyle = statusStyles[status]
	const containsOverTask = tasks.some((task) => task.id === over?.id)
	const isDropColumn = over?.id === status || containsOverTask
	const isEmptyColumnDropTarget = tasks.length === 0 && over?.id === status
	useLayoutEffect(() => {
		if (
			!isDropColumn ||
			pointerY === null ||
			tasks.length === 0 ||
			!taskListRef.current
		) {
			setDropIndicatorTop(null)
			return
		}
		const activeId = String(active?.id ?? '')
		const cards = Array.from(
			taskListRef.current.querySelectorAll<HTMLElement>('[data-task-id]'),
		).filter((card) => card.dataset.taskId !== activeId)
		const nextCard = cards.find((card) => {
			const rect = card.getBoundingClientRect()
			return pointerY < rect.top + rect.height / 2
		})
		if (nextCard) {
			setDropIndicatorTop(nextCard.offsetTop - 5)
			return
		}
		const lastCard = cards.at(-1)
		setDropIndicatorTop(lastCard ? lastCard.offsetTop + lastCard.offsetHeight + 4 : 4)
	}, [active?.id, isDropColumn, pointerY, tasks.length])
	return (
		<section
			ref={setNodeRef}
			data-kanban-column={status}
			aria-label={statusLabels[status]}
			className={`kanban-column group/column min-h-[max(22rem,calc(100dvh-17rem))] min-w-0 rounded-lg border p-2 pb-4 shadow-sm transition-all duration-150 ${statusStyle.state} ${isOver || containsOverTask ? statusStyle.active : 'hover:border-[#484f58]'}`}
		>
			<header className="kanban-column-header mb-4 flex items-center gap-2 px-1 pt-1">
				<Icon size={15} className={statusStyle.accent} />
				<h2 className="text-xs font-semibold">{statusLabels[status]}</h2>
				<span className="text-xs text-muted-foreground">{tasks.length}</span>
				<Tooltip label="Add">
					<Button
						variant="ghost"
						size="icon"
						className="ml-auto"
						aria-label={`Add task to ${statusLabels[status]}`}
						disabled={disabled || loading}
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
				<div ref={taskListRef} className="kanban-task-list relative space-y-2">
					{dropIndicatorTop !== null && (
						<div
							aria-hidden="true"
							style={{ top: dropIndicatorTop }}
							className={`kanban-drop-indicator pointer-events-none absolute left-2 right-2 z-10 h-0.5 rounded-full ${statusStyle.drop}`}
						/>
					)}
					{loading
						? Array.from({ length: 3 }, (_, index) => (
								<div
									key={index}
									aria-hidden="true"
									className="kanban-task-skeleton min-h-24 animate-pulse rounded-lg border border-border/60 bg-background/30 p-3"
								>
									<div className="h-2 w-12 rounded bg-muted-foreground/20" />
									<div className="mt-4 h-3 w-4/5 rounded bg-muted-foreground/20" />
									<div className="mt-4 h-2 w-16 rounded bg-muted-foreground/20" />
								</div>
							))
						: tasks.map((task) => (
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
			{!loading && tasks.length === 0 && (
				<p
					className={`kanban-empty-state relative flex min-h-[7.5rem] items-center justify-center rounded-lg border border-dashed px-3 py-3 text-center text-xs ${isEmptyColumnDropTarget ? statusStyle.emptyDrop : 'border-[#484f58] text-muted-foreground'}`}
				>
					{isEmptyColumnDropTarget && (
						<span
							aria-hidden="true"
							className={`kanban-empty-drop-indicator pointer-events-none absolute -top-2 left-2 right-2 h-0.5 rounded-full ${statusStyle.drop}`}
						/>
					)}
					{isEmptyColumnDropTarget ? 'Move here' : 'No tasks yet'}
				</p>
			)}
			<Button
				variant="ghost"
				size="sm"
				className="kanban-add-task mt-2 w-full justify-center text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/column:opacity-100 focus-visible:opacity-100"
				disabled={disabled || loading}
				onClick={() => create(status)}
			>
				<Plus size={14} />
				Add task
			</Button>
		</section>
	)
}
export function KanbanBoard({
	tasks,
	edit,
	archive,
	remove,
	create,
	move,
	disabled,
	loading = false,
}: {
	tasks: Task[]
	edit: (task: Task) => void
	archive: (task: Task) => void
	remove: (task: Task) => void
	create: (status: Status) => void
	move: (id: string, status: Status, position: number) => void
	disabled: boolean
	loading?: boolean
}) {
	const [activeTask, setActiveTask] = useState<Task | null>(null)
	const [pointerY, setPointerY] = useState<number | null>(null)
	const dragStartPointerRef = useRef<{ x: number; y: number } | null>(null)
	const dragPointerRef = useRef<{ x: number; y: number } | null>(null)
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	)
	function onDragEnd({ active, over }: DragEndEvent) {
		if (!over || active.id === over.id || disabled || loading) return
		const targetTask = tasks.find((task) => task.id === over.id)
		const status =
			targetTask?.status ??
			(statuses.includes(over.id as Status) ? (over.id as Status) : undefined)
		if (!status) return
		const column = columnTasks(
			tasks.filter((task) => task.id !== active.id),
			status,
		)
		const fallbackPosition = targetTask
			? column.findIndex((task) => task.id === targetTask.id) + 1
			: column.length
		move(
			String(active.id),
			status,
			getColumnDropPosition(
				status,
				String(active.id),
				dragPointerRef.current?.y ?? null,
				fallbackPosition,
			),
		)
	}
	return (
		<DndContext
			sensors={sensors}
			collisionDetection={collisionDetectionStrategy}
			onDragStart={({ active, activatorEvent }) => {
				const pointerEvent = activatorEvent as PointerEvent
				const pointer =
					Number.isFinite(pointerEvent.clientX) && Number.isFinite(pointerEvent.clientY)
						? { x: pointerEvent.clientX, y: pointerEvent.clientY }
						: null
				dragStartPointerRef.current = pointer
				dragPointerRef.current = pointer
				setPointerY(pointer?.y ?? null)
				setActiveTask(tasks.find((task) => task.id === active.id) ?? null)
			}}
			onDragMove={({ delta }) => {
				if (!dragStartPointerRef.current) return
				const pointer = {
					x: dragStartPointerRef.current.x + delta.x,
					y: dragStartPointerRef.current.y + delta.y,
				}
				dragPointerRef.current = pointer
				setPointerY(pointer.y)
			}}
			onDragCancel={() => {
				dragStartPointerRef.current = null
				dragPointerRef.current = null
				setPointerY(null)
				setActiveTask(null)
			}}
			onDragEnd={(event) => {
				onDragEnd(event)
				dragStartPointerRef.current = null
				dragPointerRef.current = null
				setPointerY(null)
				setActiveTask(null)
			}}
		>
			<div className="kanban-board-grid grid grid-cols-1 gap-4 sm:grid-cols-3">
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
							loading={loading}
							pointerY={pointerY}
						/>
					))}
				</>
			</div>
			<DragOverlay dropAnimation={null}>
				{activeTask ? <TaskDragPreview task={activeTask} /> : null}
			</DragOverlay>
		</DndContext>
	)
}
