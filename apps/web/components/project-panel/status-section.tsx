import { useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useDndContext, useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
	ChevronsDownUp,
	ChevronsUpDown,
	Circle,
	CircleCheck,
	CircleDashed,
	Plus,
} from 'lucide-react'
import { statusLabels, type Status, type Task } from '@/lib/types'
import { Button } from '../ui/button'
import { Tooltip } from '../ui/tooltip'
import { statusStyles } from './board-status-styles'
import { TaskCard } from './task-card'

const statusIcons = {
	todo: CircleDashed,
	in_progress: Circle,
	done: CircleCheck,
}
interface StatusSectionProps {
	status: Status
	tasks: Task[]
	edit: (task: Task) => void
	archive: (task: Task) => void
	remove: (task: Task) => void
	newTaskStatus: Status | null
	shouldPrependNewTask: boolean
	onStartTask: (status: Status, shouldPrepend?: boolean) => void
	onCreateTask: (status: Status, title: string) => Promise<void>
	onCancelTask: () => void
	disabled: boolean
	loading: boolean
	isMobile: boolean
	isExpanded: boolean
	onToggleExpanded: () => void
	setDropIndicatorNode: (node: HTMLDivElement | null) => void
	isBoardDragging: boolean
}

export function StatusSection({
	status,
	tasks,
	edit,
	archive,
	remove,
	newTaskStatus,
	shouldPrependNewTask,
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
}: StatusSectionProps) {
	const sectionRef = useRef<HTMLElement>(null)
	const shouldScrollAfterExpand = useRef(false)
	const headerRef = useRef<HTMLElement>(null)
	const shouldScrollAfterCollapse = useRef(false)
	const prefersReducedMotion = useReducedMotion()
	const { setNodeRef, isOver } = useDroppable({ id: status, disabled })
	const { over } = useDndContext()
	const Icon = statusIcons[status]
	const statusStyle = statusStyles[status]
	const visibleTasks = isMobile && !isExpanded ? tasks.slice(0, 3) : tasks
	const canToggleTasks = !loading && isMobile && tasks.length > 3
	const containsOverTask = tasks.some((task) => task.id === over?.id)
	const isEmptyStatusSectionDropTarget = tasks.length === 0 && over?.id === status
	function handleToggleExpanded() {
		shouldScrollAfterCollapse.current = isMobile && isExpanded
		shouldScrollAfterExpand.current = isMobile && !isExpanded
		onToggleExpanded()
	}

	function handleTaskRevealComplete() {
		if (!shouldScrollAfterExpand.current || !isMobile || !isExpanded) return
		shouldScrollAfterExpand.current = false
		const section = sectionRef.current
		if (!section) return
		window.scrollTo({
			top: window.scrollY + section.getBoundingClientRect().bottom - window.innerHeight,
			behavior: prefersReducedMotion ? 'instant' : 'smooth',
		})
	}

	function handleTaskExitComplete() {
		if (!shouldScrollAfterCollapse.current) return
		shouldScrollAfterCollapse.current = false
		headerRef.current?.scrollIntoView({
			block: 'start',
			behavior: prefersReducedMotion ? 'instant' : 'smooth',
		})
	}

	function renderTask(task: Task) {
		return (
			<motion.div
				key={task.optimistic_key ?? task.id}
				layout={isMobile || isBoardDragging ? false : 'position'}
				initial={false}
				animate={{ opacity: 1 }}
				transition={{
					layout: { type: 'spring', stiffness: 340, damping: 34, mass: 0.72 },
				}}
			>
				<TaskCard
					task={task}
					edit={edit}
					archive={archive}
					remove={remove}
					disabled={disabled || task.id.startsWith('pending-task-')}
					isBoardDragging={isBoardDragging}
					isMobile={isMobile}
				/>
			</motion.div>
		)
	}

	return (
		<section
			ref={(node) => {
				sectionRef.current = node
				setNodeRef(node)
			}}
			data-board-status-section={status}
			aria-label={statusLabels[status]}
			className={`board-status-section group/board-status-section min-h-0 min-w-0 rounded-lg border p-2 pb-4 shadow-sm transition-colors duration-150 md:min-h-[max(22rem,calc(100dvh-17rem))] ${statusStyle.state} ${isOver || containsOverTask ? statusStyle.active : 'hover:border-[#484f58]'}`}
		>
			<header
				ref={headerRef}
				className="board-status-section-header relative scroll-mt-4 mb-4 flex items-center gap-2 px-1 pt-1"
			>
				<Icon size={15} className={statusStyle.accent} />
				<h2 className="text-xs font-semibold">{statusLabels[status]}</h2>
				<span className="text-xs text-muted-foreground">{tasks.length}</span>
				{canToggleTasks && isExpanded && (
					<Button
						variant="ghost"
						size="icon"
						className="board-status-section-header-collapse absolute left-1/2 top-1/2 !h-7 !w-7 -translate-x-1/2 -translate-y-1/2"
						aria-label={`Collapse ${statusLabels[status]} tasks`}
						aria-expanded={isExpanded}
						onClick={handleToggleExpanded}
					>
						<ChevronsDownUp size={15} />
					</Button>
				)}
				<Tooltip
					label="New Task"
					className="board-status-section-top-add-tooltip ml-auto [&_.ui-tooltip-content]:max-md:hidden"
				>
					<Button
						variant="ghost"
						size="icon"
						className={`board-status-section-top-add !h-7 !w-7 rounded-full border border-current p-0 hover:bg-white/5 ${statusStyle.accent}`}
						aria-label={`Add task to ${statusLabels[status]}`}
						disabled={disabled || loading}
						onClick={() => onStartTask(status, true)}
					>
						<Plus size={15} />
					</Button>
				</Tooltip>
			</header>
			<SortableContext
				items={visibleTasks.map((task) => task.id)}
				strategy={verticalListSortingStrategy}
			>
				<div className="board-status-section-task-list relative space-y-2">
					<div
						ref={setDropIndicatorNode}
						aria-hidden="true"
						className={`board-status-section-drop-indicator pointer-events-none absolute left-2 right-2 z-10 h-0.5 rounded-full transition-none ${statusStyle.drop}`}
						hidden
					/>
					{(isMobile || shouldPrependNewTask) && newTaskStatus === status && (
						<NewTaskCard
							status={status}
							save={(title) => onCreateTask(status, title)}
							cancel={onCancelTask}
						/>
					)}
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
						<>
							<AnimatePresence initial={false}>
								{(isMobile ? tasks.slice(0, 3) : tasks).map(renderTask)}
							</AnimatePresence>
							<AnimatePresence initial={false} onExitComplete={handleTaskExitComplete}>
								{isMobile && isExpanded && tasks.length > 3 && (
									<motion.div
										key="remaining-tasks"
										initial={{ height: 0, overflow: 'hidden' }}
										animate={{
											height: 'auto',
											transitionEnd: { overflow: 'visible' },
										}}
										exit={{ height: 0, overflow: 'hidden' }}
										transition={{
											duration: prefersReducedMotion ? 0 : 0.25,
											ease: 'easeInOut',
										}}
										onAnimationComplete={handleTaskRevealComplete}
										className="board-status-section-expanded-tasks space-y-2"
									>
										{tasks.slice(3).map(renderTask)}
									</motion.div>
								)}
							</AnimatePresence>
						</>
					)}
					{!isMobile && !shouldPrependNewTask && newTaskStatus === status && (
						<NewTaskCard
							status={status}
							save={(title) => onCreateTask(status, title)}
							cancel={onCancelTask}
						/>
					)}
				</div>
			</SortableContext>
			{((!isMobile && tasks.length > 0) || (isMobile && isExpanded)) && (
				<Button
					variant="ghost"
					size="sm"
					className="board-status-section-add-task mt-2 w-full justify-center bg-accent text-muted-foreground opacity-0 transition-[background-color,opacity,transform] duration-150 hover:bg-[#30363d] active:scale-95 group-hover/board-status-section:opacity-100 focus-visible:opacity-100"
					disabled={disabled || loading}
					onClick={() => onStartTask(status)}
				>
					<Plus size={14} />
					<span className="hidden md:inline">Add task</span>
				</Button>
			)}
			{canToggleTasks && (
				<Button
					className="board-status-section-expand mt-2 w-full"
					variant="ghost"
					size="sm"
					aria-expanded={isExpanded}
					aria-label={
						isExpanded
							? `Collapse ${statusLabels[status]} tasks`
							: `Show all ${statusLabels[status]} tasks`
					}
					onClick={handleToggleExpanded}
				>
					{isExpanded ? <ChevronsDownUp size={15} /> : <ChevronsUpDown size={15} />}
				</Button>
			)}
			{!loading &&
				tasks.length === 0 &&
				newTaskStatus !== status &&
				(!isMobile && !isBoardDragging && !disabled ? (
					<button
						type="button"
						data-board-status-section-empty-state={status}
						aria-label={`New task in ${statusLabels[status]}`}
						onClick={() => onStartTask(status)}
						className={`board-status-section-empty-state board-status-section-empty-add group/empty-task relative flex min-h-[6.5rem] w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-[#484f58] px-3 py-3 text-center text-xs text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${statusStyle.emptyHover}`}
					>
						<span className="board-status-section-empty-label group-hover/empty-task:hidden group-focus-visible/empty-task:hidden">
							No tasks yet
						</span>
						<span className="board-status-section-empty-add-label hidden items-center gap-1.5 group-hover/empty-task:flex group-focus-visible/empty-task:flex">
							<Plus size={14} />
							New Task
						</span>
					</button>
				) : (
					<p
						data-board-status-section-empty-state={status}
						className={`board-status-section-empty-state relative flex min-h-[6.5rem] items-center justify-center rounded-lg border border-dashed px-3 py-3 text-center text-xs ${isEmptyStatusSectionDropTarget ? statusStyle.emptyDrop : 'border-[#484f58] text-muted-foreground'}`}
					>
						{isEmptyStatusSectionDropTarget ? 'Move here' : 'No tasks yet'}
					</p>
				))}
		</section>
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
