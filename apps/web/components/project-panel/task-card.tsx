import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useSortable } from '@dnd-kit/sortable'
import {
	AlignLeft,
	Archive,
	Flag,
	Gauge,
	GripVertical,
	MoreVertical,
	Trash2,
} from 'lucide-react'
import type { Task } from '@/lib/types'
import { Tooltip } from '../ui/tooltip'
import { statusStyles } from './board-status-styles'

export function TaskCard({
	task,
	edit,
	archive,
	remove,
	disabled,
	isBoardDragging,
	isMobile,
}: {
	task: Task
	edit: (task: Task) => void
	archive: (task: Task) => void
	remove: (task: Task) => void
	disabled: boolean
	isBoardDragging: boolean
	isMobile: boolean
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
			layout={isMobile || isBoardDragging ? false : 'position'}
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

export function TaskDragPreview({ task }: { task: Task }) {
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
