'use client'
import { useEffect, useRef, useState } from 'react'
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
	MeasuringStrategy,
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
	ChevronsUpDown,
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
	isBoardDragging,
}: {
	task: Task
	edit: (task: Task) => void
	archive: (task: Task) => void
	remove: (task: Task) => void
	disabled: boolean
	isBoardDragging: boolean
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
			layout={isBoardDragging ? false : 'position'}
			transition={{ layout: { duration: 0.22, ease: 'easeOut' } }}
			onClick={() => edit(task)}
			onMouseLeave={() => setActionsOpen(false)}
			data-task-id={task.id}
			className={`task-card group relative min-h-[6.5rem] touch-auto rounded-lg border p-3 shadow-sm transition-[border-color,opacity,transform] duration-150 ${statusStyle.ticket} ${disabled ? 'cursor-default' : 'cursor-pointer'} ${isDragging ? 'opacity-30' : 'hover:border-[#484f58]'}`}
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
			</div>
			<div className="task-card-footer mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 text-muted-foreground">
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

function NewTaskCard({
	status,
	save,
	cancel,
}: {
	status: Status
	save: (title: string) => Promise<void>
	cancel: () => void
}) {
	const [title, setTitle] = useState('')
	const [isSaving, setIsSaving] = useState(false)
	const [error, setError] = useState('')
	const statusStyle = statusStyles[status]

	async function handleSave() {
		const nextTitle = title.trim()
		if (!nextTitle) {
			cancel()
			return
		}
		if (isSaving) return

		setIsSaving(true)
		setError('')
		try {
			await save(nextTitle)
		} catch (error) {
			setError(error instanceof Error ? error.message : 'Unable to create task.')
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<motion.form
			initial={{ opacity: 0, y: -8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -6 }}
			transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.65 }}
			onSubmit={(event) => {
				event.preventDefault()
				void handleSave()
			}}
			className={`kanban-new-task-card min-h-[6.5rem] rounded-lg border border-dashed p-3 ${statusStyle.ticket}`}
		>
			<span
				className={`mb-1 block text-[10px] font-medium tracking-wide ${statusStyle.accent}`}
			>
				New Task
			</span>
			<input
				autoFocus
				value={title}
				onChange={(event) => setTitle(event.target.value)}
				onBlur={() => void handleSave()}
				onKeyDown={(event) => {
					if (event.key === 'Escape') cancel()
				}}
				placeholder="Task title"
				aria-label={`New ${statusLabels[status]} task title`}
				maxLength={240}
				disabled={isSaving}
				className="kanban-new-task-title h-auto !border-0 !bg-transparent px-0 py-0 text-[13px] font-medium !outline-none focus:!outline-none"
			/>
			{error && (
				<p role="alert" className="kanban-new-task-error mt-2 text-xs text-rose-300">
					{error}
				</p>
			)}
		</motion.form>
	)
}

function TaskDragPreview({ task }: { task: Task }) {
	const statusStyle = statusStyles[task.status]
	return (
		<div
			className={`task-drag-preview w-72 rotate-1 rounded-lg border p-3 shadow-xl ${statusStyle.ticket}`}
		>
			<div className="task-card-header flex items-start gap-1">
				<div className="min-w-0 flex-1">
					<span
						className={`task-card-ticket mb-1 flex items-center gap-1 text-[10px] font-medium tracking-wide ${statusStyle.accent}`}
					>
						{task.ticket_id}
						{task.description && <AlignLeft size={12} aria-label="Has description" />}
					</span>
					<span className="task-card-title block wrap-break-word first-letter:uppercase text-[13px] leading-5 font-medium">
						{task.title}
					</span>
				</div>
				<GripVertical size={15} className="shrink-0 text-muted-foreground" />
			</div>
			<div className="task-card-footer mt-4 grid grid-cols-2 items-center gap-2 text-muted-foreground">
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
			</div>
		</div>
	)
}
function Column({
	status,
	tasks,
	edit,
	archive,
	remove,
	newTaskStatus,
	onStartTask,
	onCreateTask,
	onCancelTask,
	disabled,
	loading,
	isMobile,
	isExpanded,
	onToggleExpanded,
	setDropIndicatorNode,
	isBoardDragging,
}: {
	status: Status
	tasks: Task[]
	edit: (task: Task) => void
	archive: (task: Task) => void
	remove: (task: Task) => void
	newTaskStatus: Status | null
	onStartTask: (status: Status) => void
	onCreateTask: (status: Status, title: string) => Promise<void>
	onCancelTask: () => void
	disabled: boolean
	loading: boolean
	isMobile: boolean
	isExpanded: boolean
	onToggleExpanded: () => void
	setDropIndicatorNode: (node: HTMLDivElement | null) => void
	isBoardDragging: boolean
}) {
	const { setNodeRef, isOver } = useDroppable({ id: status, disabled })
	const { over } = useDndContext()
	const Icon = statusIcons[status]
	const statusStyle = statusStyles[status]
	const visibleTasks = isMobile && !isExpanded ? tasks.slice(0, 3) : tasks
	const canToggleTasks = !loading && isMobile && tasks.length > 3
	const containsOverTask = tasks.some((task) => task.id === over?.id)
	const isEmptyColumnDropTarget = tasks.length === 0 && over?.id === status
	return (
		<motion.section
			ref={setNodeRef}
			layout={isMobile && !isBoardDragging}
			transition={{
				layout: { type: 'spring', stiffness: 340, damping: 34, mass: 0.72 },
			}}
			data-kanban-column={status}
			aria-label={statusLabels[status]}
			className={`kanban-column group/column min-h-0 min-w-0 rounded-lg border p-2 pb-4 shadow-sm transition-all duration-150 md:min-h-[max(22rem,calc(100dvh-17rem))] ${statusStyle.state} ${isOver || containsOverTask ? statusStyle.active : 'hover:border-[#484f58]'}`}
		>
			<header className="kanban-column-header mb-4 flex items-center gap-2 px-1 pt-1">
				<Icon size={15} className={statusStyle.accent} />
				<h2 className="text-xs font-semibold">{statusLabels[status]}</h2>
				<Tooltip label="Add">
					<Button
						variant="ghost"
						size="icon"
						className="kanban-column-add !h-auto !w-auto !min-w-0 p-0 hover:bg-transparent"
						aria-label={`Add task to ${statusLabels[status]}`}
						disabled={disabled || loading}
						onClick={() => onStartTask(status)}
					>
						<Plus size={15} />
					</Button>
				</Tooltip>
				<span className="text-xs text-muted-foreground">{tasks.length}</span>
			</header>
			<SortableContext
				items={visibleTasks.map((task) => task.id)}
				strategy={verticalListSortingStrategy}
			>
				<motion.div
					layout={isMobile && !isBoardDragging}
					transition={{
						layout: { type: 'spring', stiffness: 340, damping: 34, mass: 0.72 },
					}}
					className="kanban-task-list relative space-y-2"
				>
					<div
						ref={setDropIndicatorNode}
						aria-hidden="true"
					className={`kanban-drop-indicator pointer-events-none absolute left-2 right-2 z-10 h-0.5 rounded-full transition-none ${statusStyle.drop}`}
						hidden
					/>
					{loading ? (
						Array.from({ length: 3 }, (_, index) => (
							<div
								key={index}
								aria-hidden="true"
								className="kanban-task-skeleton min-h-[6.5rem] animate-pulse rounded-lg border border-border/60 bg-background/30 p-3"
							>
								<div className="h-2 w-12 rounded bg-muted-foreground/20" />
								<div className="mt-4 h-3 w-4/5 rounded bg-muted-foreground/20" />
								<div className="mt-4 h-2 w-16 rounded bg-muted-foreground/20" />
							</div>
						))
					) : (
						<AnimatePresence initial={false}>
							{visibleTasks.map((task) => (
								<motion.div
									key={task.id}
									layout={isBoardDragging ? false : 'position'}
									initial={isMobile ? { opacity: 0, y: -10 } : false}
									animate={{ opacity: 1, y: 0 }}
									exit={isMobile ? { opacity: 0, y: -8 } : undefined}
									transition={{
										layout: { type: 'spring', stiffness: 340, damping: 34, mass: 0.72 },
										opacity: { duration: 0.16 },
										y: { type: 'spring', stiffness: 420, damping: 32, mass: 0.65 },
									}}
								>
									<TaskCard
										task={task}
										edit={edit}
										archive={archive}
										remove={remove}
										disabled={disabled}
										isBoardDragging={isBoardDragging}
									/>
								</motion.div>
							))}
						</AnimatePresence>
					)}
					{newTaskStatus === status && (
						<NewTaskCard
							status={status}
							save={(title) => onCreateTask(status, title)}
							cancel={onCancelTask}
						/>
					)}
				</motion.div>
			</SortableContext>
			{canToggleTasks && (
				<Button
					className="kanban-column-expand mt-2 w-full"
					variant="ghost"
					size="sm"
					aria-expanded={isExpanded}
					aria-label={
						isExpanded
							? `Collapse ${statusLabels[status]} tasks`
							: `Show all ${statusLabels[status]} tasks`
					}
					onClick={onToggleExpanded}
				>
					<ChevronsUpDown size={15} />
				</Button>
			)}
			{!loading && tasks.length === 0 && newTaskStatus !== status && (
				<p
					data-kanban-empty-state={status}
					className={`kanban-empty-state relative flex min-h-[6.5rem] items-center justify-center rounded-lg border border-dashed px-3 py-3 text-center text-xs ${isEmptyColumnDropTarget ? statusStyle.emptyDrop : 'border-[#484f58] text-muted-foreground'}`}
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
				className="kanban-add-task mt-2 w-full justify-center bg-accent text-muted-foreground opacity-0 transition-[background-color,opacity,transform] duration-150 hover:bg-[#30363d] active:scale-95 group-hover/column:opacity-100 focus-visible:opacity-100"
				disabled={disabled || loading}
				onClick={() => onStartTask(status)}
			>
				<Plus size={14} />
				<span className="hidden md:inline">Add task</span>
			</Button>
		</motion.section>
	)
}
export function KanbanBoard({
	tasks,
	edit,
	archive,
	remove,
	createTask,
	newTaskRequest,
	move,
	disabled,
	loading = false,
}: {
	tasks: Task[]
	edit: (task: Task) => void
	archive: (task: Task) => void
	remove: (task: Task) => void
	createTask: (status: Status, title: string) => Promise<void>
	newTaskRequest: number
	move: (id: string, status: Status, position: number) => void
	disabled: boolean
	loading?: boolean
}) {
	const [activeTask, setActiveTask] = useState<Task | null>(null)
	const [isMobileViewport, setIsMobileViewport] = useState(false)
	const [expandedStatuses, setExpandedStatuses] = useState<Set<Status>>(() => new Set())
	const [newTaskStatus, setNewTaskStatus] = useState<Status | null>(null)
	const dragStartPointerRef = useRef<{ x: number; y: number } | null>(null)
	const dragPointerRef = useRef<{ x: number; y: number } | null>(null)
	const dropIndicatorNodes = useRef(new Map<Status, HTMLDivElement>())
	const dropIndicatorFrame = useRef<number | null>(null)
	const dropGap = useRef<{
		element: HTMLElement
		property: 'marginBottom' | 'marginTop'
	} | null>(null)
	const previousNewTaskRequest = useRef(0)
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	)
	useEffect(() => {
		const mediaQuery = window.matchMedia('(max-width: 767px)')
		const handleViewportChange = () => setIsMobileViewport(mediaQuery.matches)

		handleViewportChange()
		mediaQuery.addEventListener('change', handleViewportChange)

		return () => mediaQuery.removeEventListener('change', handleViewportChange)
	}, [])
	useEffect(() => {
		if (newTaskRequest === previousNewTaskRequest.current) return
		previousNewTaskRequest.current = newTaskRequest
		setNewTaskStatus('todo')
	}, [newTaskRequest])

	function toggleColumnExpansion(status: Status) {
		setExpandedStatuses((current) => {
			const next = new Set(current)

			if (next.has(status)) {
				next.delete(status)
			} else {
				next.add(status)
			}

			return next
		})
	}
	async function handleCreateTask(status: Status, title: string) {
		await createTask(status, title)
		setNewTaskStatus(null)
	}
	function hideDropIndicators() {
		dropIndicatorNodes.current.forEach((indicator) => {
			indicator.hidden = true
		})
	}
	function cancelDropIndicatorFrame() {
		if (dropIndicatorFrame.current === null) return
		cancelAnimationFrame(dropIndicatorFrame.current)
		dropIndicatorFrame.current = null
	}
	function clearDropGap() {
		if (!dropGap.current) return
		dropGap.current.element.style[dropGap.current.property] = ''
		dropGap.current = null
	}
	function updateDropIndicator(
		overId: string | number | undefined,
		activeId: string,
		pointerY: number,
	) {
		cancelDropIndicatorFrame()
		dropIndicatorFrame.current = requestAnimationFrame(() => {
			dropIndicatorFrame.current = null
			const targetTask = tasks.find((task) => task.id === String(overId))
			const status =
				targetTask?.status ??
				(statuses.includes(overId as Status) ? (overId as Status) : undefined)
			if (!status) {
				hideDropIndicators()
				clearDropGap()
				return
			}
			const indicator = dropIndicatorNodes.current.get(status)
			const column = document.querySelector<HTMLElement>(`[data-kanban-column="${status}"]`)
			if (!indicator || !column) {
				clearDropGap()
				return
			}
			const cards = Array.from(column.querySelectorAll<HTMLElement>('[data-task-id]')).filter(
				(card) => card.dataset.taskId !== activeId,
			)
			const activeCard = document.querySelector<HTMLElement>(`[data-task-id="${activeId}"]`)
			const activeTask = tasks.find((task) => task.id === activeId)
			const shouldAppend = status === 'done' && activeTask?.status !== status
			const nextCard = shouldAppend
				? undefined
				: cards.find((card) => pointerY < card.getBoundingClientRect().top + card.offsetHeight / 2)
			const lastCard = cards.at(-1)
			const gapElement =
				nextCard ??
				lastCard ??
				column.querySelector<HTMLElement>('[data-kanban-empty-state]')
			const gapProperty = nextCard || !lastCard ? 'marginTop' : 'marginBottom'
			if (
				dropGap.current &&
				(dropGap.current.element !== gapElement || dropGap.current.property !== gapProperty)
			) {
				clearDropGap()
			}
			if (gapElement) {
				gapElement.style[gapProperty] = `${(activeCard?.offsetHeight ?? 104) + 8}px`
				dropGap.current = { element: gapElement, property: gapProperty }
			}
			const top = nextCard
				? nextCard.offsetTop - 5
				: lastCard
					? lastCard.offsetTop + lastCard.offsetHeight + 4
					: 4
			hideDropIndicators()
			indicator.style.top = `${top}px`
			indicator.hidden = false
		})
	}
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
		const activeTask = tasks.find((task) => task.id === active.id)
		const fallbackPosition = targetTask
			? column.findIndex((task) => task.id === targetTask.id) + 1
			: column.length
		const shouldAppendCrossStatusDrop =
			status === 'done' && activeTask?.status !== status
		move(
			String(active.id),
			status,
			shouldAppendCrossStatusDrop
				? column.length
				: getColumnDropPosition(
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
			measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
			onDragStart={({ active, activatorEvent }) => {
				const pointerEvent = activatorEvent as PointerEvent
				const pointer =
					Number.isFinite(pointerEvent.clientX) && Number.isFinite(pointerEvent.clientY)
						? { x: pointerEvent.clientX, y: pointerEvent.clientY }
						: null
				dragStartPointerRef.current = pointer
				dragPointerRef.current = pointer
				cancelDropIndicatorFrame()
				hideDropIndicators()
				clearDropGap()
				setActiveTask(tasks.find((task) => task.id === active.id) ?? null)
			}}
			onDragMove={({ active, delta, over }) => {
				if (!dragStartPointerRef.current) return
				const pointer = {
					x: dragStartPointerRef.current.x + delta.x,
					y: dragStartPointerRef.current.y + delta.y,
				}
				dragPointerRef.current = pointer
				updateDropIndicator(over?.id, String(active.id), pointer.y)
			}}
			onDragCancel={() => {
				dragStartPointerRef.current = null
				dragPointerRef.current = null
				cancelDropIndicatorFrame()
				hideDropIndicators()
				clearDropGap()
				setActiveTask(null)
			}}
			onDragEnd={(event) => {
				clearDropGap()
				onDragEnd(event)
				dragStartPointerRef.current = null
				dragPointerRef.current = null
				cancelDropIndicatorFrame()
				hideDropIndicators()
				setActiveTask(null)
			}}
		>
			<div className="kanban-board-grid grid grid-cols-1 gap-4 sm:grid-cols-3">
				{statuses.map((status) => (
					<Column
						key={status}
						status={status}
						tasks={columnTasks(tasks, status)}
						edit={edit}
						archive={archive}
						remove={remove}
						newTaskStatus={newTaskStatus}
						onStartTask={setNewTaskStatus}
						onCreateTask={handleCreateTask}
						onCancelTask={() => setNewTaskStatus(null)}
						disabled={disabled}
						loading={loading}
						isMobile={isMobileViewport}
						isExpanded={expandedStatuses.has(status)}
						onToggleExpanded={() => toggleColumnExpansion(status)}
						setDropIndicatorNode={(node) => {
							if (node) dropIndicatorNodes.current.set(status, node)
							else dropIndicatorNodes.current.delete(status)
						}}
						isBoardDragging={activeTask !== null}
					/>
				))}
			</div>
			<DragOverlay
				adjustScale={false}
				dropAnimation={null}
				transition={() => undefined}
			>
				{activeTask ? <TaskDragPreview task={activeTask} /> : null}
			</DragOverlay>
		</DndContext>
	)
}
