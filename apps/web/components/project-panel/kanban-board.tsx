'use client'
import { useEffect, useRef, useState } from 'react'
import {
	DndContext,
	PointerSensor,
	KeyboardSensor,
	useSensor,
	useSensors,
	DragOverlay,
	MeasuringStrategy,
	closestCorners,
	pointerWithin,
	type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { getStatusTasks } from '@/lib/board'
import { statuses, type Status, type Task } from '@/lib/types'
import { StatusSection } from './status-section'
import { TaskDragPreview } from './task-card'

function collisionDetectionStrategy(...args: Parameters<typeof pointerWithin>) {
	const pointerCollisions = pointerWithin(...args)
	return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(...args)
}

function getStatusSectionDropPosition(
	status: Status,
	activeId: string,
	pointerY: number | null,
	fallback: number,
) {
	if (pointerY === null || typeof document === 'undefined') return fallback
	const statusSection = document.querySelector<HTMLElement>(
		`[data-board-status-section="${status}"]`,
	)
	if (!statusSection) return fallback
	const cards = Array.from(
		statusSection.querySelectorAll<HTMLElement>('[data-task-id]'),
	).filter((card) => card.dataset.taskId !== activeId)
	const nextCardIndex = cards.findIndex((card) => {
		const rect = card.getBoundingClientRect()
		return pointerY < rect.top + rect.height / 2
	})
	return nextCardIndex === -1 ? cards.length : nextCardIndex
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
	createTask: (status: Status, title: string, shouldPrepend: boolean) => Promise<void>
	newTaskRequest: number
	move: (id: string, status: Status, position: number) => void
	disabled: boolean
	loading?: boolean
}) {
	const [activeTask, setActiveTask] = useState<Task | null>(null)
	const [isMobileViewport, setIsMobileViewport] = useState(false)
	const [expandedStatuses, setExpandedStatuses] = useState<Set<Status>>(() => new Set())
	const [shouldPrependNewTask, setShouldPrependNewTask] = useState(false)
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
		setShouldPrependNewTask(isMobileViewport)
		setNewTaskStatus('todo')
	}, [newTaskRequest, isMobileViewport])

	function toggleStatusSectionExpansion(status: Status) {
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
	function handleStartTask(status: Status, shouldPrepend = false) {
		setShouldPrependNewTask(isMobileViewport || shouldPrepend)
		setNewTaskStatus(status)
	}
	async function handleCreateTask(status: Status, title: string) {
		await createTask(status, title, isMobileViewport || shouldPrependNewTask)
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
			const statusSection = document.querySelector<HTMLElement>(
				`[data-board-status-section="${status}"]`,
			)
			if (!indicator || !statusSection) {
				clearDropGap()
				return
			}
			const cards = Array.from(
				statusSection.querySelectorAll<HTMLElement>('[data-task-id]'),
			).filter((card) => card.dataset.taskId !== activeId)
			const emptyState = statusSection.querySelector<HTMLElement>(
				'[data-board-status-section-empty-state]',
			)
			if (cards.length === 0 && emptyState) {
				hideDropIndicators()
				clearDropGap()
				return
			}
			const activeCard = document.querySelector<HTMLElement>(
				`[data-task-id="${activeId}"]`,
			)
			const activeTask = tasks.find((task) => task.id === activeId)
			const shouldAppend = status === 'done' && activeTask?.status !== status
			const nextCard = shouldAppend
				? undefined
				: cards.find(
						(card) => pointerY < card.getBoundingClientRect().top + card.offsetHeight / 2,
					)
			const lastCard = cards.at(-1)
			const gapElement = nextCard ?? lastCard
			const gapProperty = nextCard || !lastCard ? 'marginTop' : 'marginBottom'
			if (
				dropGap.current &&
				(dropGap.current.element !== gapElement ||
					dropGap.current.property !== gapProperty)
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
		const sectionTasks = getStatusTasks(
			tasks.filter((task) => task.id !== active.id),
			status,
		)
		const activeTask = tasks.find((task) => task.id === active.id)
		const fallbackPosition = targetTask
			? sectionTasks.findIndex((task) => task.id === targetTask.id) + 1
			: sectionTasks.length
		const shouldAppendCrossStatusDrop = status === 'done' && activeTask?.status !== status
		move(
			String(active.id),
			status,
			shouldAppendCrossStatusDrop
				? sectionTasks.length
				: getStatusSectionDropPosition(
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
					<StatusSection
						key={status}
						status={status}
						tasks={getStatusTasks(tasks, status)}
						edit={edit}
						archive={archive}
						remove={remove}
						newTaskStatus={newTaskStatus}
						shouldPrependNewTask={shouldPrependNewTask}
						onStartTask={handleStartTask}
						onCreateTask={handleCreateTask}
						onCancelTask={() => setNewTaskStatus(null)}
						disabled={disabled}
						loading={loading}
						isMobile={isMobileViewport}
						isExpanded={expandedStatuses.has(status)}
						onToggleExpanded={() => toggleStatusSectionExpansion(status)}
						setDropIndicatorNode={(node) => {
							if (node) dropIndicatorNodes.current.set(status, node)
							else dropIndicatorNodes.current.delete(status)
						}}
						isBoardDragging={activeTask !== null}
					/>
				))}
			</div>
			<DragOverlay adjustScale={false} dropAnimation={null} transition={() => undefined}>
				{activeTask ? <TaskDragPreview task={activeTask} /> : null}
			</DragOverlay>
		</DndContext>
	)
}
