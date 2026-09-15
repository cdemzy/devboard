import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useDndContext, useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ChevronsUpDown, Circle, CircleCheck, CircleDashed, Plus } from 'lucide-react'
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
}

export function StatusSection({
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
}: StatusSectionProps) {
	const { setNodeRef, isOver } = useDroppable({ id: status, disabled })
	const { over } = useDndContext()
	const Icon = statusIcons[status]
	const statusStyle = statusStyles[status]
	const visibleTasks = isMobile && !isExpanded ? tasks.slice(0, 3) : tasks
	const canToggleTasks = !loading && isMobile && tasks.length > 3
	const containsOverTask = tasks.some((task) => task.id === over?.id)
	const isEmptyStatusSectionDropTarget = tasks.length === 0 && over?.id === status
	return (
		<motion.section
			ref={setNodeRef}
			layout={isMobile && !isBoardDragging}
			transition={{
				layout: { type: 'spring', stiffness: 340, damping: 34, mass: 0.72 },
			}}
			data-board-status-section={status}
			aria-label={statusLabels[status]}
			className={`board-status-section group/board-status-section min-h-0 min-w-0 rounded-lg border p-2 pb-4 shadow-sm transition-all duration-150 md:min-h-[max(22rem,calc(100dvh-17rem))] ${statusStyle.state} ${isOver || containsOverTask ? statusStyle.active : 'hover:border-[#484f58]'}`}
		>
			<header className="board-status-section-header mb-4 flex items-center gap-2 px-1 pt-1">
				<Icon size={15} className={statusStyle.accent} />
				<h2 className="text-xs font-semibold">{statusLabels[status]}</h2>
				<Tooltip label="Add">
					<Button
						variant="ghost"
						size="icon"
						className="board-status-section-add !h-auto !w-auto !min-w-0 p-0 hover:bg-transparent"
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
					className="board-status-section-task-list relative space-y-2"
				>
					<div
						ref={setDropIndicatorNode}
						aria-hidden="true"
						className={`board-status-section-drop-indicator pointer-events-none absolute left-2 right-2 z-10 h-0.5 rounded-full transition-none ${statusStyle.drop}`}
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
									key={task.optimistic_key ?? task.id}
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
										disabled={disabled || task.id.startsWith('pending-task-')}
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
					className="board-status-section-expand mt-2 w-full"
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
					data-board-status-section-empty-state={status}
					className={`board-status-section-empty-state relative flex min-h-[6.5rem] items-center justify-center rounded-lg border border-dashed px-3 py-3 text-center text-xs ${isEmptyStatusSectionDropTarget ? statusStyle.emptyDrop : 'border-[#484f58] text-muted-foreground'}`}
				>
					{isEmptyStatusSectionDropTarget ? 'Move here' : 'No tasks yet'}
				</p>
			)}
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
		</motion.section>
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
