'use client'
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type RefObject,
	type ReactNode,
} from 'react'
import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
	type Modifier,
} from '@dnd-kit/core'
import {
	arrayMove,
	horizontalListSortingStrategy,
	rectSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import {
	Archive,
	ArrowLeft,
	Database,
	Ellipsis,
	GripVertical,
	Info,
	LayoutDashboard,
	Plus,
	RotateCcw,
	Trash2,
	Undo2,
	X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, json } from '@/lib/api'
import { moveTask } from '@/lib/board'
import type { Project, ProjectTag, Status, Task } from '@/lib/types'
import { Button } from './ui/button'
import { ConfirmDialog } from './ui/confirm-dialog'
import { Tooltip } from './ui/tooltip'
import { TaskEditor } from './editors'
import { KanbanBoard } from './kanban-board'

const boardErrorToastId = 'board-error'
const platformNameToastId = 'platform-name-error'
const recoveryToastDuration = 15_000
const recoveryToastStyle: CSSProperties = {
	backgroundImage: 'linear-gradient(var(--success-text), var(--success-text))',
	backgroundPosition: 'left bottom',
	backgroundRepeat: 'no-repeat',
	backgroundSize: '100% 3px',
}
const restrictSelectedTagDragToHorizontalAxis: Modifier = ({ transform }) => ({
	...transform,
	y: 0,
})
const tagColorValues = {
	green: '#386C4E',
	yellow: '#886826',
	purple: '#6C5082',
	orange: '#88522F',
	blue: '#2f81f7',
	pink: '#7B4760',
	red: '#924943',
	brown: '#6D5340',
} as const

function reportBoardError(error: unknown, fallback: string, retry?: () => void) {
	toast.error(error instanceof Error ? error.message : fallback, {
		id: boardErrorToastId,
		duration: Infinity,
		...(retry
			? {
					action: {
						label: (
							<span className="board-error-retry-action relative grid h-4 w-4 place-items-center">
								<RotateCcw size={14} />
								<span className="sr-only">Reload board</span>
							</span>
						),
						onClick: retry,
					},
					actionButtonStyle: {
						width: 28,
						height: 28,
						padding: 0,
						border: '1px solid #924943',
						borderRadius: '9999px',
						background: '#2A1818',
						color: '#ff7b72',
						justifyContent: 'center',
					},
				}
			: {}),
	})
}

function createRecoveryToastTimer(onExpire?: () => void) {
	let toastId: string | number | null = null
	let timeoutId: ReturnType<typeof setTimeout> | null = null
	let remaining = recoveryToastDuration
	let startedAt = 0

	function pause() {
		if (!timeoutId) return
		clearTimeout(timeoutId)
		timeoutId = null
		remaining -= Date.now() - startedAt
	}

	function resume() {
		if (timeoutId || toastId === null) return
		startedAt = Date.now()
		timeoutId = setTimeout(() => {
			dismiss()
			onExpire?.()
		}, remaining)
	}

	function dismiss() {
		if (timeoutId) clearTimeout(timeoutId)
		timeoutId = null
		if (toastId !== null) toast.dismiss(toastId)
	}

	return {
		pause,
		resume,
		dismiss,
		start(id: string | number) {
			toastId = id
			resume()
		},
	}
}

interface PendingTaskArchiveChange {
	task: Task
	wasArchived: boolean
	isArchived: boolean
	toastId: string | number
	timer: ReturnType<typeof createRecoveryToastTimer>
}

function getNewTagColor(tags: ProjectTag[]): ProjectTag['color'] {
	const colors = Object.keys(tagColorValues) as ProjectTag['color'][]
	const usedColors = new Set(tags.map((tag) => tag.color))
	const availableColors = colors.filter((color) => !usedColors.has(color))
	const candidates = availableColors.length > 0 ? availableColors : colors
	return candidates[Math.floor(Math.random() * candidates.length)]
}

function PlatformTagSkeletons() {
	return (
		<span
			role="status"
			aria-label="Loading platform tags"
			className="project-tag-catalog-loader flex items-center gap-1.5"
		>
			<span className="h-5 w-12 animate-pulse rounded-sm bg-muted-foreground/25" />
			<span className="h-5 w-16 animate-pulse rounded-sm bg-muted-foreground/25" />
		</span>
	)
}

function SortableProjectTag({
	tag,
	onSelect,
	onOptions,
	sortable,
	children,
}: {
	tag: ProjectTag
	onSelect: () => void
	onOptions: () => void
	sortable: boolean
	children?: ReactNode
}) {
	const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
		useSortable({ id: tag.id, disabled: !sortable })
	const style: CSSProperties = {
		transform: CSS.Translate.toString(transform),
		transition,
		zIndex: isDragging ? 40 : undefined,
	}
	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`project-tag-option w-full ${isDragging ? 'opacity-60' : ''}`}
		>
			<div className="project-tag-chip relative flex w-full items-center gap-1.5 rounded-sm px-1 py-1 text-[13px] text-white hover:bg-[#30363d] md:text-xs">
				{sortable && (
					<button
						type="button"
						aria-label={`Reorder ${tag.name}`}
						className="project-tag-drag-handle touch-none rounded-sm p-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
						{...attributes}
						{...listeners}
					>
						<GripVertical size={13} className="h-4 w-4 md:h-[13px] md:w-[13px]" />
					</button>
				)}
				<button
					type="button"
					onClick={onSelect}
					style={{ backgroundColor: tagColorValues[tag.color], lineHeight: 1 }}
					className="project-tag-select rounded-sm px-1.5 py-1 text-white"
				>
					{tag.name}
				</button>
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation()
						onOptions()
					}}
					aria-label={`Platform options for ${tag.name}`}
					className="project-tag-options-trigger ml-auto rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
				>
					<Ellipsis size={16} className="h-5 w-5 md:hidden" />
					<Info size={13} className="hidden md:block md:h-[13px] md:w-[13px]" />
				</button>
				{children}
			</div>
		</div>
	)
}

interface SortableSelectedProjectTagProps {
	tag: string
	color: string
	onRemove: () => void
}

function SortableSelectedProjectTag({
	tag,
	color,
	onRemove,
}: SortableSelectedProjectTagProps) {
	const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
		useSortable({
			id: `selected-tag-${tag}`,
		})
	const style: CSSProperties = {
		backgroundColor: color,
		lineHeight: 1,
		transform: CSS.Translate.toString(transform),
		transition,
		zIndex: isDragging ? 40 : undefined,
	}

	return (
		<span
			ref={setNodeRef}
			style={style}
			className={`project-selected-tag flex shrink-0 items-center gap-1 rounded-sm px-2 py-1.5 text-[13px] text-white md:px-1.5 md:py-1 md:text-xs ${isDragging ? 'opacity-60' : ''}`}
		>
			<span className="project-selected-tag-label order-2">{tag}</span>
			<button
				type="button"
				onClick={(event) => {
					event.stopPropagation()
					onRemove()
				}}
				aria-label={`Remove ${tag} tag`}
				className="project-selected-tag-remove order-1 rounded-sm text-white/65 hover:text-white"
			>
				<X size={12} className="h-[14px] w-[14px] md:h-3 md:w-3" />
			</button>
			<button
				type="button"
				aria-label={`Reorder ${tag}`}
				className="project-selected-tag-drag-handle order-3 touch-none rounded-sm p-0.5 text-white/70 hover:text-white cursor-grab active:cursor-grabbing"
				onClick={(event) => event.stopPropagation()}
				{...attributes}
				{...listeners}
			>
				<GripVertical size={13} className="h-4 w-4 md:h-[13px] md:w-[13px]" />
			</button>
		</span>
	)
}

interface ProjectTagEditorFormProps {
	tag: ProjectTag
	tagNameDraft: string
	tagNameInputRef: RefObject<HTMLInputElement | null>
	onTagNameChange: (value: string) => void
	onRename: (value: string, closeAfterSave: boolean) => void
	closeOnRename?: boolean
	onDelete: () => void
	onCancel: () => void
	onColorChange: (color: ProjectTag['color']) => void
}

function ProjectTagEditorForm({
	tag,
	tagNameDraft,
	tagNameInputRef,
	onTagNameChange,
	onRename,
	closeOnRename = true,
	onDelete,
	onCancel,
	onColorChange,
}: ProjectTagEditorFormProps) {
	return (
		<>
			<div className="project-tag-menu-edit flex gap-1.5">
				<input
					ref={tagNameInputRef}
					value={tagNameDraft}
					onChange={(event) => onTagNameChange(event.target.value)}
					onBlur={(event) => {
						if (closeOnRename) onRename(event.target.value, true)
					}}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							if (closeOnRename) event.currentTarget.blur()
							else onRename(event.currentTarget.value, false)
						}
						if (event.key === 'Escape') onCancel()
					}}
					aria-label={`Rename ${tag.name}`}
					maxLength={40}
					className="project-tag-name-input h-8 !border !border-[#484f58] !bg-[#2d333b] px-2 py-1 text-xs !outline-none focus:!outline-none"
				/>
				<button
					type="button"
					onMouseDown={(event) => event.preventDefault()}
					onClick={onDelete}
					aria-label={`Delete ${tag.name}`}
					className="project-tag-delete flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-[#484f58] bg-[#2d333b] text-rose-300 hover:text-rose-200"
				>
					<Trash2 size={13} />
				</button>
			</div>
			<div className="my-2 border-t border-border" />
			<p className="project-tag-colors-label mb-1.5 text-[11px] font-medium text-muted-foreground">
				Colors
			</p>
			<div className="project-tag-colors grid grid-cols-4 gap-1">
				{Object.entries(tagColorValues).map(([color, value]) => (
					<button
						key={color}
						type="button"
						aria-label={`Set ${tag.name} to ${color}`}
						aria-pressed={tag.color === color}
						onClick={() => onColorChange(color as ProjectTag['color'])}
						style={{ backgroundColor: value }}
						className={`project-tag-color h-5 rounded-sm transition-shadow ${tag.color === color ? 'ring-2 ring-foreground ring-offset-1 ring-offset-background' : 'hover:ring-1 hover:ring-foreground/60'}`}
					/>
				))}
			</div>
		</>
	)
}

export function ProjectViewSkeleton() {
	const skeletonColumns = [
		{ id: 'todo', column: 'border-[#6C5082]/35 bg-[#221D25]', accent: 'bg-[#6C5082]/55' },
		{
			id: 'in-progress',
			column: 'border-[#886826]/35 bg-[#23221A]',
			accent: 'bg-[#886826]/55',
		},
		{ id: 'done', column: 'border-[#386C4E]/35 bg-[#1B211D]', accent: 'bg-[#386C4E]/55' },
	]

	return (
		<div
			className="project-view project-view-skeleton mx-auto w-4/5 px-0 pt-5 pb-5 sm:w-full sm:px-5 sm:pt-8 sm:pb-6 md:px-8"
			role="status"
			aria-label="Loading project"
		>
			<header className="project-header mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
				<div className="min-w-0 w-full max-w-3xl flex-1">
					<div className="project-title-skeleton h-9 w-48 animate-pulse rounded-sm bg-muted-foreground/20" />
					<div className="project-description-skeleton mt-3 h-4 w-80 max-w-full animate-pulse rounded-sm bg-muted-foreground/15" />
					<div className="project-platform-skeleton mt-4 grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3">
						<div className="flex items-center gap-2">
							<div className="project-platform-icon-skeleton h-4 w-4 animate-pulse rounded-sm bg-muted-foreground/20" />
							<div className="project-platform-title-skeleton h-3 w-14 animate-pulse rounded-sm bg-muted-foreground/15" />
						</div>
						<div className="project-tag-trigger-skeleton flex h-12 items-center gap-1.5 px-2">
							<div className="h-5 w-16 animate-pulse rounded-sm bg-muted-foreground/20" />
							<div className="h-5 w-12 animate-pulse rounded-sm bg-muted-foreground/15" />
						</div>
					</div>
				</div>
			</header>
			<div className="project-view-toolbar mb-5 flex items-center justify-between gap-3 border-b border-border pb-3">
				<div className="project-view-tab-list flex items-center gap-3">
					<div className="flex items-center gap-2 rounded-full bg-[#30363d] px-3 py-1.5">
						<div className="project-view-tab-icon-skeleton h-4 w-4 animate-pulse rounded-sm bg-primary/55" />
						<div className="view-title-skeleton h-3 w-10 animate-pulse rounded-sm bg-muted-foreground/20" />
					</div>
					<div className="flex items-center gap-2">
						<div className="project-view-tab-icon-skeleton h-4 w-4 animate-pulse rounded-sm bg-muted-foreground/20" />
						<div className="view-title-skeleton h-3 w-20 animate-pulse rounded-sm bg-muted-foreground/15" />
					</div>
				</div>
				<div className="project-view-actions-section flex items-center gap-1">
					<div className="project-view-project-archive-skeleton h-8 w-8" />
					<div className="project-view-new-task-skeleton grid h-8 w-11 place-items-center rounded-md border border-primary/60 bg-primary/10">
						<div className="h-4 w-4 animate-pulse rounded-sm bg-primary/55" />
					</div>
				</div>
			</div>
			<div className="kanban-board-grid grid grid-cols-1 gap-4 sm:grid-cols-3">
				{skeletonColumns.map(({ id, column, accent }) => (
					<section
						key={id}
						aria-hidden="true"
						className={`kanban-column-skeleton min-h-[22rem] rounded-lg border p-2 pb-4 shadow-sm md:min-h-[max(22rem,calc(100dvh-17rem))] ${column}`}
					>
						<div className="flex items-center gap-2 px-1 pt-1">
							<div className={`kanban-column-icon-skeleton h-4 w-4 animate-pulse rounded-sm ${accent}`} />
							<div className="kanban-column-title-skeleton h-3 w-16 animate-pulse rounded-sm bg-muted-foreground/25" />
							<div className="kanban-column-count-skeleton h-3 w-3 animate-pulse rounded-sm bg-muted-foreground/15" />
						</div>
						<div className="mt-4 space-y-2">
							{Array.from({ length: 3 }, (_, index) => (
								<div
									key={index}
									className="kanban-task-skeleton min-h-[6.5rem] animate-pulse rounded-lg border border-border/60 bg-background/30 p-3"
								>
									<div className="h-2 w-12 rounded bg-muted-foreground/20" />
									<div className="mt-4 h-3 w-4/5 rounded bg-muted-foreground/20" />
									<div className="mt-4 h-2 w-16 rounded bg-muted-foreground/20" />
								</div>
							))}
						</div>
						<div className="mt-2 h-8 w-full animate-pulse rounded bg-muted-foreground/10" />
					</section>
				))}
			</div>
			<span className="sr-only">Loading project</span>
		</div>
	)
}

export function ProjectView({
	project,
	update,
	refresh,
}: {
	project: Project
	update: (project: Project) => void
	refresh: () => Promise<void>
}) {
	const [tasks, setTasks] = useState<Task[]>([])
	const [archivedTasks, setArchivedTasks] = useState<Task[]>([])
	const [view, setView] = useState<'board' | 'archived'>('board')
	const [hoveredView, setHoveredView] = useState<'board' | 'archived' | null>(null)
	const [archivedTasksLoading, setArchivedTasksLoading] = useState(false)
	const [loading, setLoading] = useState(true)
	const [busy, setBusy] = useState(false)
	const moveQueue = useRef(Promise.resolve())
	const pendingMoves = useRef(
		new Map<string, { status: Status; position: number; revision: number }>(),
	)
	const moveRevisions = useRef(new Map<string, number>())
	const moveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
	const pendingTaskArchiveChanges = useRef(new Map<string, PendingTaskArchiveChange>())
	const queuedMoveIds = useRef(new Set<string>())
	const tagOrderQueue = useRef(Promise.resolve())
	const tagOrderRevision = useRef(0)
	const [projectDraft, setProjectDraft] = useState(() => ({
		name: project.name === 'New Project' ? '' : project.name,
		description: project.description,
		tags: project.tags,
	}))
	const [tagInput, setTagInputState] = useState('')
	const [newTagColor, setNewTagColor] = useState<ProjectTag['color'] | null>(null)
	const [tagSuggestions, setTagSuggestions] = useState<ProjectTag[]>([])
	const [tagCatalogLoaded, setTagCatalogLoaded] = useState(false)
	const [tagMenuId, setTagMenuId] = useState<string | null>(null)
	const [tagNameDraft, setTagNameDraft] = useState('')
	const [tagsOpen, setTagsOpen] = useState(false)
	const [isMobileViewport, setIsMobileViewport] = useState(false)
	const tagSheetDragControls = useDragControls()
	const projectDescriptionRef = useRef<HTMLTextAreaElement>(null)
	const tagSensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	)
	const selectedTagSensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	)
	const tagMenuRef = useRef<HTMLDivElement>(null)
	const tagNameInputRef = useRef<HTMLInputElement>(null)
	const pendingTagColorsRef = useRef<
		Record<string, { color: ProjectTag['color']; previous: ProjectTag['color'] }>
	>({})
	const loadTagSuggestions = useCallback(async () => {
		const tags = await api<ProjectTag[]>('/project-tags')
		setTagSuggestions(
			tags.map((tag) =>
				pendingTagColorsRef.current[tag.id]
					? { ...tag, color: pendingTagColorsRef.current[tag.id].color }
					: tag,
			),
		)
		setTagCatalogLoaded(true)
	}, [])
	const saveProjectDraft = useCallback(async () => {
		const name = projectDraft.name.trim() || 'New Project'
		const newTagColors = Object.fromEntries(
			tagSuggestions
				.filter(
					(tag) =>
						tag.id.startsWith('pending-') &&
						projectDraft.tags.some(
							(name) => name.toLowerCase() === tag.name.toLowerCase(),
						),
				)
				.map((tag) => [tag.name, tag.color]),
		)
		const unchanged =
			name === project.name &&
			projectDraft.description === project.description &&
			projectDraft.tags.length === project.tags.length &&
			projectDraft.tags.every((tag, index) => tag === project.tags[index])
		if (unchanged) return
		try {
			update(
				await api<Project>(
					`/projects/${project.id}`,
					json('PATCH', { ...projectDraft, name, new_tag_colors: newTagColors }),
				),
			)
			void loadTagSuggestions().catch(() => undefined)
			toast.dismiss(boardErrorToastId)
		} catch (error) {
			reportBoardError(error, 'Unable to save project changes.')
		}
	}, [loadTagSuggestions, project, projectDraft, tagSuggestions, update])
	const [editor, setEditor] = useState<{ task: Task } | null>(null)
	const [newTaskRequest, setNewTaskRequest] = useState(0)
	const [isProjectArchiveConfirmOpen, setIsProjectArchiveConfirmOpen] = useState(false)
	useEffect(() => {
		void loadTagSuggestions().catch(() => undefined)
	}, [loadTagSuggestions])
	useEffect(() => {
		const mediaQuery = window.matchMedia('(max-width: 767px)')
		const updateViewport = () => setIsMobileViewport(mediaQuery.matches)
		updateViewport()
		mediaQuery.addEventListener('change', updateViewport)
		return () => mediaQuery.removeEventListener('change', updateViewport)
	}, [])
	useEffect(() => {
		function closeTags(event: PointerEvent) {
			if (
				tagsOpen &&
				tagMenuRef.current &&
				!tagMenuRef.current.contains(event.target as Node)
			) {
				if (tagMenuId && !tagNameDraft.trim()) {
					const activeTag = tagSuggestions.find((tag) => tag.id === tagMenuId)
					if (activeTag) setTagNameDraft(activeTag.name)
				}
				const activeTag = tagSuggestions.find((tag) => tag.id === tagMenuId)
				if (activeTag) void persistTagColor(activeTag)
				void saveProjectDraft()
				setTagsOpen(false)
				setTagMenuId(null)
			}
		}
		document.addEventListener('pointerdown', closeTags)
		return () => document.removeEventListener('pointerdown', closeTags)
	}, [tagsOpen, tagMenuId, tagNameDraft, tagSuggestions, saveProjectDraft])
	const loadTasks = useCallback(async () => {
		try {
			const result = await api<Task[]>(`/projects/${project.id}/tasks`)
			setTasks(result)
			toast.dismiss(boardErrorToastId)
		} catch (error) {
			reportBoardError(error, 'Unable to load tasks.', () => void loadTasks())
			throw error
		}
	}, [project.id])
	const loadArchivedTasks = useCallback(async () => {
		setArchivedTasksLoading(true)
		try {
			setArchivedTasks(await api<Task[]>(`/projects/${project.id}/tasks?archived=true`))
			toast.dismiss(boardErrorToastId)
		} catch (error) {
			reportBoardError(
				error,
				'Unable to load archived tasks.',
				() => void loadArchivedTasks(),
			)
			throw error
		} finally {
			setArchivedTasksLoading(false)
		}
	}, [project.id])
	useEffect(() => {
		let alive = true
		loadTasks()
			.catch(() => undefined)
			.finally(() => {
				if (alive) setLoading(false)
			})
		return () => {
			alive = false
		}
	}, [loadTasks])
	useEffect(
		() => () => {
			moveTimers.current.forEach((timer) => clearTimeout(timer))
			moveTimers.current.clear()
			pendingTaskArchiveChanges.current.forEach((change) => change.timer.dismiss())
			pendingTaskArchiveChanges.current.clear()
		},
		[],
	)
	useEffect(() => {
		const description = projectDescriptionRef.current
		if (!description) return
		description.style.height = 'auto'
		description.style.height = `${description.scrollHeight}px`
	}, [projectDraft.description])
	async function action(work: () => Promise<void>, successMessage?: string) {
		setBusy(true)
		try {
			await work()
			if (successMessage) toast.success(successMessage)
		} catch (error) {
			reportBoardError(error, 'Something went wrong.')
		} finally {
			setBusy(false)
		}
	}
	function move(id: string, status: Status, position: number) {
		if (project.archived) return
		const revision = (moveRevisions.current.get(id) ?? 0) + 1
		moveRevisions.current.set(id, revision)
		pendingMoves.current.set(id, { status, position, revision })
		setTasks((current) => moveTask(current, id, status, position))
		scheduleMoveSave(id)
	}
	function scheduleMoveSave(id: string) {
		const existingTimer = moveTimers.current.get(id)
		if (existingTimer) clearTimeout(existingTimer)
		moveTimers.current.set(
			id,
			setTimeout(() => {
				moveTimers.current.delete(id)
				queueLatestMove(id)
			}, 180),
		)
	}
	function queueLatestMove(id: string) {
		if (queuedMoveIds.current.has(id)) return
		queuedMoveIds.current.add(id)
		moveQueue.current = moveQueue.current
			.catch(() => undefined)
			.then(async () => {
				const command = pendingMoves.current.get(id)
				pendingMoves.current.delete(id)
				if (!command) {
					queuedMoveIds.current.delete(id)
					return
				}
				try {
					await api<void>(
						`/tasks/${id}/move`,
						json('POST', { status: command.status, position: command.position }),
					)
					toast.dismiss(boardErrorToastId)
				} catch (error) {
					if (moveRevisions.current.get(id) === command.revision) {
						reportBoardError(
							error,
							'Move failed. Reload the board to check the saved state.',
							() => void loadTasks(),
						)
						void loadTasks().catch(() => undefined)
					}
				} finally {
					queuedMoveIds.current.delete(id)
					if (pendingMoves.current.has(id)) scheduleMoveSave(id)
				}
			})
	}
	function applyCachedTaskArchiveState(task: Task, isArchived: boolean) {
		if (isArchived) {
			setTasks((current) => current.filter((item) => item.id !== task.id))
			setArchivedTasks((current) => [
				...current.filter((item) => item.id !== task.id),
				{ ...task, archived: true },
			])
			return
		}

		setTasks((current) =>
			current.some((item) => item.id === task.id)
				? current
				: [...current, { ...task, archived: false }],
		)
		setArchivedTasks((current) => current.filter((item) => item.id !== task.id))
	}
	function cancelPendingTaskArchiveChange(taskId: string) {
		const pendingChange = pendingTaskArchiveChanges.current.get(taskId)
		if (!pendingChange) return
		pendingChange.timer.dismiss()
		pendingTaskArchiveChanges.current.delete(taskId)
	}
	function commitTaskArchiveChange(change: PendingTaskArchiveChange) {
		if (pendingTaskArchiveChanges.current.get(change.task.id) !== change) return
		pendingTaskArchiveChanges.current.delete(change.task.id)

		if (change.isArchived === change.wasArchived) return

		const endpoint = change.isArchived ? 'archive' : 'restore'
		const failureMessage = change.isArchived ? 'Unable to archive task.' : 'Failed to recover task.'
		void api(`/tasks/${change.task.id}/${endpoint}`, json('POST')).catch((error) => {
			applyCachedTaskArchiveState(change.task, change.wasArchived)
			reportBoardError(error, failureMessage)
		})
	}
	function stageTaskArchiveChange(task: Task, isArchived: boolean) {
		const existingChange = pendingTaskArchiveChanges.current.get(task.id)
		const wasArchived = existingChange?.wasArchived ?? task.archived
		existingChange?.timer.dismiss()

		applyCachedTaskArchiveState(task, isArchived)
		const change = {} as PendingTaskArchiveChange
		const timer = createRecoveryToastTimer(() => commitTaskArchiveChange(change))
		const toastId = toast.success(isArchived ? 'Task archived' : 'Task restored', {
			duration: Infinity,
			className: 'task-archive-recovery-toast',
			style: recoveryToastStyle,
			action: {
				label: (
					<span
						className="task-archive-recover-action relative grid h-4 w-4 place-items-center"
						onPointerEnter={timer.pause}
						onPointerLeave={timer.resume}
					>
						<Undo2 size={14} />
					</span>
				),
				onClick: () => {
					timer.dismiss()
					stageTaskArchiveChange(task, !isArchived)
				},
			},
			actionButtonStyle: {
				width: 28,
				height: 28,
				padding: 0,
				border: '1px solid #886826',
				borderRadius: '9999px',
				background: '#23221A',
				color: '#d29922',
				justifyContent: 'center',
			},
		})
		Object.assign(change, { task, wasArchived, isArchived, timer, toastId })
		pendingTaskArchiveChanges.current.set(task.id, change)
		timer.start(toastId)
	}
	function archiveTask(task: Task) {
		stageTaskArchiveChange(task, true)
	}
	function deleteTask(task: Task) {
		cancelPendingTaskArchiveChange(task.id)
		setTasks((current) => current.filter((item) => item.id !== task.id))
		setArchivedTasks((current) => current.filter((item) => item.id !== task.id))
		const toastTimer = createRecoveryToastTimer(() => {
			void api(`/tasks/${task.id}`, json('DELETE')).catch((error) => {
				if (task.archived) {
					setArchivedTasks((current) => [...current, task])
				} else {
					setTasks((current) => [...current, task])
				}
				reportBoardError(error, 'Failed to delete task.')
			})
		})
		const deletionToastId = toast.success('Task deleted', {
			duration: Infinity,
			className: 'task-archive-recovery-toast',
			style: recoveryToastStyle,
			action: {
				label: (
					<span
						className="task-archive-recover-action relative grid h-4 w-4 place-items-center"
						onPointerEnter={toastTimer.pause}
						onPointerLeave={toastTimer.resume}
					>
						<Undo2 size={14} />
					</span>
				),
				onClick: () => {
					toastTimer.dismiss()
					if (task.archived) {
						setArchivedTasks((current) => [...current, task])
					} else {
						setTasks((current) => [...current, task])
					}
				},
			},
			actionButtonStyle: {
				width: 28,
				height: 28,
				padding: 0,
				border: '1px solid #886826',
				borderRadius: '9999px',
				background: '#23221A',
				color: '#d29922',
				justifyContent: 'center',
			},
		})
		toastTimer.start(deletionToastId)
	}
	async function createInlineTask(status: Status, title: string) {
		const task = await api<Task>(
			`/projects/${project.id}/tasks`,
			json('POST', {
				title,
				description: '',
				status,
				priority: 'medium',
				complexity: 'standard',
			}),
		)
		setTasks((current) => [...current, task])
	}
	function restoreTask(task: Task) {
		stageTaskArchiveChange(task, false)
	}
	function handleProjectArchiveAction() {
		if (!project.archived) {
			setIsProjectArchiveConfirmOpen(true)
			return
		}

		void action(async () => {
			await api(`/projects/${project.id}`, json('PATCH', { archived: false }))
			await refresh()
		}, 'Project restored')
	}
	const matchingTags = tagSuggestions.filter((tag) =>
		tag.name.toLowerCase().includes(tagInput.trim().toLowerCase()),
	)
	const canReorderTags =
		!tagInput.trim() && tagSuggestions.every((tag) => !tag.id.startsWith('pending-'))
	function addTag() {
		const tag = tagInput.trim()
		const color = newTagColor ?? getNewTagColor(tagSuggestions)
		if (
			!tag ||
			tag.length > 40 ||
			projectDraft.tags.some((item) => item.toLowerCase() === tag.toLowerCase()) ||
			projectDraft.tags.length >= 20
		)
			return
		setTagSuggestions((current) =>
			current.some((item) => item.name.toLowerCase() === tag.toLowerCase())
				? current
				: [
						...current,
						{
							id: `pending-${tag.toLowerCase()}`,
							name: tag,
							color,
							position: current.length,
						},
					],
		)
		setProjectDraft((current) => ({ ...current, tags: [...current.tags, tag] }))
		setTagInput('')
	}
	function toggleTag(tag: string) {
		setProjectDraft((current) => ({
			...current,
			tags: current.tags.some((item) => item.toLowerCase() === tag.toLowerCase())
				? current.tags.filter((item) => item.toLowerCase() !== tag.toLowerCase())
				: [...current.tags, tag],
		}))
		setTagInput('')
	}
	function setTagInput(value: string) {
		if (tagMenuId) {
			const activeTag = tagSuggestions.find((tag) => tag.id === tagMenuId)
			if (activeTag) void persistTagColor(activeTag)
			setTagMenuId(null)
		}
		setTagInputState(value)
		setNewTagColor((current) =>
			value.trim() ? (current ?? getNewTagColor(tagSuggestions)) : null,
		)
	}
	function handleTagOrderEnd({ active, over }: DragEndEvent) {
		if (!over || active.id === over.id) return
		const previousTags = tagSuggestions
		const oldIndex = previousTags.findIndex((tag) => tag.id === active.id)
		const newIndex = previousTags.findIndex((tag) => tag.id === over.id)
		if (oldIndex < 0 || newIndex < 0) return
		const orderedTags = arrayMove(previousTags, oldIndex, newIndex)
		const revision = tagOrderRevision.current + 1
		tagOrderRevision.current = revision
		setTagSuggestions(orderedTags)
		tagOrderQueue.current = tagOrderQueue.current
			.catch(() => undefined)
			.then(async () => {
				try {
					const savedTags = await api<ProjectTag[]>(
						'/project-tags/order',
						json('PUT', { tag_ids: orderedTags.map((tag) => tag.id) }),
					)
					if (tagOrderRevision.current === revision) setTagSuggestions(savedTags)
				} catch (error) {
					if (tagOrderRevision.current === revision) {
						setTagSuggestions(previousTags)
						reportBoardError(error, 'Unable to save platform order.')
					}
				}
			})
	}
	function handleSelectedTagOrderEnd({ active, over }: DragEndEvent) {
		if (!over || active.id === over.id) return
		const activeIndex = projectDraft.tags.findIndex(
			(tag) => `selected-tag-${tag}` === String(active.id),
		)
		const overIndex = projectDraft.tags.findIndex(
			(tag) => `selected-tag-${tag}` === String(over.id),
		)
		if (activeIndex < 0 || overIndex < 0) return
		setProjectDraft((current) => ({
			...current,
			tags: arrayMove(current.tags, activeIndex, overIndex),
		}))
	}
	function saveFallbackProjectName() {
		void saveProjectDraft()
	}
	function updateTagColor(tag: ProjectTag, color: ProjectTag['color']) {
		const pending = pendingTagColorsRef.current[tag.id]
		pendingTagColorsRef.current[tag.id] = {
			color,
			previous: pending?.previous ?? tag.color,
		}
		setTagSuggestions((tags) =>
			tags.map((item) => (item.id === tag.id ? { ...item, color } : item)),
		)
	}
	async function persistTagColor(tag: ProjectTag) {
		const pending = pendingTagColorsRef.current[tag.id]
		if (!pending) return
		delete pendingTagColorsRef.current[tag.id]
		if (pending.color === pending.previous || tag.id.startsWith('pending-')) return
		try {
			const updated = await api<ProjectTag>(
				`/project-tags/${tag.id}`,
				json('PATCH', { color: pending.color }),
			)
			if (!pendingTagColorsRef.current[tag.id]) {
				setTagSuggestions((tags) =>
					tags.map((item) => (item.id === updated.id ? updated : item)),
				)
			}
		} catch (error) {
			if (!pendingTagColorsRef.current[tag.id]) {
				setTagSuggestions((tags) =>
					tags.map((item) =>
						item.id === tag.id ? { ...item, color: pending.previous } : item,
					),
				)
			}
			reportBoardError(error, 'Unable to save platform color.')
		}
	}
	async function renameTag(tag: ProjectTag, value: string, closeAfterSave = true) {
		const name = value.trim()
		if (!name) {
			setTagNameDraft(tag.name)
			if (closeAfterSave) setTagMenuId(null)
			return
		}
		if (name.length > 40 || name === tag.name) {
			setTagNameDraft(tag.name)
			if (name === tag.name && closeAfterSave) setTagMenuId(null)
			return
		}
		if (
			tagSuggestions.some(
				(item) => item.id !== tag.id && item.name.toLowerCase() === name.toLowerCase(),
			)
		) {
			setTagNameDraft(tag.name)
			reportBoardError(
				new Error('A platform with this name already exists'),
				'Unable to rename platform.',
			)
			return
		}
		if (closeAfterSave) setTagMenuId(null)
		const previousSuggestions = tagSuggestions
		const previousProjectTags = projectDraft.tags
		setTagSuggestions((tags) =>
			tags.map((item) => (item.id === tag.id ? { ...item, name } : item)),
		)
		setProjectDraft((current) => ({
			...current,
			tags: current.tags.map((item) =>
				item.toLowerCase() === tag.name.toLowerCase() ? name : item,
			),
		}))
		toast.dismiss(platformNameToastId)
		if (tag.id.startsWith('pending-')) return
		try {
			const updated = await api<ProjectTag>(
				`/project-tags/${tag.id}`,
				json('PATCH', { name }),
			)
			setTagSuggestions((tags) =>
				tags.map((item) => (item.id === updated.id ? updated : item)),
			)
			await refresh()
		} catch (error) {
			setTagSuggestions(previousSuggestions)
			setProjectDraft((current) => ({ ...current, tags: previousProjectTags }))
			setTagNameDraft(tag.name)
			reportBoardError(error, 'Unable to rename platform.')
		}
	}
	function closeTagMenu(tag: ProjectTag) {
		if (!tagNameDraft.trim()) setTagNameDraft(tag.name)
		void persistTagColor(tag)
		setTagMenuId(null)
	}
	function updateTagNameDraft(value: string) {
		setTagNameDraft(value)
		if (value.trim()) toast.dismiss(platformNameToastId)
	}
	function toggleTagMenu(tag: ProjectTag) {
		if (tagMenuId === tag.id) {
			closeTagMenu(tag)
			return
		}
		const activeTag = tagSuggestions.find((item) => item.id === tagMenuId)
		if (activeTag) void persistTagColor(activeTag)
		setTagNameDraft(tag.name)
		setTagMenuId(tag.id)
	}
	async function deleteTag(tag: ProjectTag) {
		const previousSuggestions = tagSuggestions
		const previousProjectTags = projectDraft.tags
		delete pendingTagColorsRef.current[tag.id]
		setTagSuggestions((tags) => tags.filter((item) => item.id !== tag.id))
		setProjectDraft((current) => ({
			...current,
			tags: current.tags.filter((name) => name.toLowerCase() !== tag.name.toLowerCase()),
		}))
		setTagMenuId(null)
		try {
			await api(`/project-tags/${tag.id}`, json('DELETE'))
		} catch (error) {
			setTagSuggestions(previousSuggestions)
			setProjectDraft((current) => ({ ...current, tags: previousProjectTags }))
			reportBoardError(error, 'Unable to delete tag.')
			return
		}
		try {
			await refresh()
		} catch (error) {
			reportBoardError(error, 'Unable to refresh project after deleting tag.')
		}
	}
	if (loading) return <ProjectViewSkeleton />

	return (
		<>
			<div className="project-view mx-auto w-4/5 px-0 pt-5 pb-5 sm:w-full sm:px-5 sm:pt-8 sm:pb-6 md:px-8">
				<header className="project-header mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
					<div className="min-w-0 w-full max-w-3xl flex-1">
						<input
							value={projectDraft.name}
							onChange={(event) =>
								setProjectDraft((current) => ({ ...current, name: event.target.value }))
							}
							onBlur={saveFallbackProjectName}
							aria-label="Project name"
							autoComplete="off"
							maxLength={120}
							placeholder="New Project"
							className="project-title h-auto w-full !border-0 !bg-transparent px-0 py-0 !text-3xl !font-bold !leading-tight tracking-tight placeholder:text-muted-foreground !outline-none focus:!outline-none"
						/>
						<textarea
							ref={projectDescriptionRef}
							value={projectDraft.description}
							onChange={(event) =>
								setProjectDraft((current) => ({
									...current,
									description: event.target.value.replace(/[\r\n]+/g, ' '),
								}))
							}
							onKeyDown={(event) => {
								if (event.key === 'Enter') event.preventDefault()
							}}
							onBlur={() => void saveProjectDraft()}
							aria-label="Project description"
							maxLength={90}
							rows={1}
							wrap="soft"
							spellCheck={false}
							placeholder="Description"
							className="project-description mt-2 block !min-h-0 w-full resize-none overflow-hidden !border-0 !bg-transparent px-0 py-0 text-sm leading-6 text-muted-foreground !outline-none focus:!outline-none"
						/>
						<div className="project-platform-section mt-3 grid min-h-14 grid-cols-[6rem_minmax(0,1fr)] items-start gap-3 md:min-h-12">
							<div className="project-platform-label flex min-h-14 w-full items-center justify-center gap-2 text-sm leading-none text-muted-foreground md:min-h-12">
								<Database size={15} className="project-platform-icon shrink-0" />
								<span className="project-platform-label-text">Platform</span>
							</div>
							<div
								ref={tagMenuRef}
								className="project-platform-editor relative min-w-0"
							>
								<div
									role="button"
									tabIndex={0}
									onMouseDown={(event) => {
										if (event.target === event.currentTarget) event.preventDefault()
									}}
									onClick={() => setTagsOpen(true)}
									onKeyDown={(event) => {
										if (
											event.target === event.currentTarget &&
											(event.key === 'Enter' || event.key === ' ')
										) {
											event.preventDefault()
											setTagsOpen(true)
										}
									}}
									className={`project-tag-trigger flex h-14 cursor-pointer flex-nowrap items-center gap-1.5 overflow-x-auto overflow-y-hidden !outline-none [-webkit-tap-highlight-color:transparent] focus:!outline-none md:h-12 ${tagsOpen ? 'rounded-md px-2 py-3 md:rounded-t-md md:rounded-b-none md:bg-accent md:shadow-[inset_0_1px_0_var(--color-border),inset_1px_0_0_var(--color-border),inset_-1px_0_0_var(--color-border)]' : 'rounded-md px-2 py-3'}`}
									aria-label="Edit project tags"
									aria-expanded={tagsOpen}
								>
									{projectDraft.tags.length === 0 ? (
										<span className="flex shrink-0 items-center rounded-sm px-1.5 py-1 text-xs leading-3 text-muted-foreground">
											Add platform
										</span>
									) : !tagCatalogLoaded ? (
										<PlatformTagSkeletons />
									) : isMobileViewport ? (
										projectDraft.tags.map((tag) => {
											const catalog = tagSuggestions.find(
												(item) => item.name.toLowerCase() === tag.toLowerCase(),
											)
											return (
												<span
													key={tag}
													style={{
														backgroundColor: catalog
															? tagColorValues[catalog.color]
															: '#30363d',
														fontSize: '12px',
														lineHeight: 1,
													}}
													className="flex shrink-0 border-0 items-center gap-1 rounded-sm px-1.5 py-1 text-white"
												>
													{tag}
													<button
														type="button"
														onClick={(event) => {
															event.stopPropagation()
															setProjectDraft((current) => ({
																...current,
																tags: current.tags.filter((item) => item !== tag),
															}))
														}}
														aria-label={`Remove ${tag} tag`}
														className="hidden rounded-sm text-white/65 hover:text-white md:inline-flex"
													>
														<X size={12} />
													</button>
												</span>
											)
										})
									) : (
						<DndContext
							sensors={selectedTagSensors}
							collisionDetection={closestCenter}
							modifiers={[restrictSelectedTagDragToHorizontalAxis]}
							onDragEnd={handleSelectedTagOrderEnd}
										>
											<SortableContext
												items={projectDraft.tags.map((tag) => `selected-tag-${tag}`)}
							strategy={horizontalListSortingStrategy}
											>
												<div className="project-selected-tag-list flex flex-nowrap gap-1.5">
													{projectDraft.tags.map((tag) => {
														const catalog = tagSuggestions.find(
															(item) => item.name.toLowerCase() === tag.toLowerCase(),
														)
														return (
															<SortableSelectedProjectTag
																key={tag}
																tag={tag}
																color={
																	catalog ? tagColorValues[catalog.color] : '#30363d'
																}
																onRemove={() => {
																	setProjectDraft((current) => ({
																		...current,
																		tags: current.tags.filter((item) => item !== tag),
																	}))
																}}
															/>
														)
													})}
												</div>
											</SortableContext>
										</DndContext>
									)}
								</div>
								<AnimatePresence>
									{tagsOpen && (
										<motion.button
											type="button"
											aria-label="Close project tag options"
											data-no-drawer-drag="true"
											className="project-tag-sheet-backdrop fixed inset-0 z-40 bg-black/50 md:hidden"
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											exit={{ opacity: 0 }}
											transition={{ duration: 0.18 }}
											onClick={() => {
												void saveProjectDraft()
												setTagMenuId(null)
												setTagsOpen(false)
											}}
										/>
									)}
								</AnimatePresence>
								<AnimatePresence>
									{tagsOpen && (
										<motion.div
											role="dialog"
											aria-label="Project tag options"
											data-no-drawer-drag="true"
											className="project-tag-options fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-xl border border-border bg-[#161b22] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl md:absolute md:inset-x-0 md:top-full md:bottom-auto md:z-20 md:max-h-none md:overflow-visible md:rounded-b-md md:rounded-t-none md:border-t-0 md:p-2 md:pb-2 md:shadow-xl"
											drag={isMobileViewport ? 'y' : false}
											dragControls={tagSheetDragControls}
											dragListener={false}
											dragConstraints={{ top: 0, bottom: 240 }}
											dragElastic={{ top: 0, bottom: 0.16 }}
											onDragEnd={(_, info) => {
												if (info.offset.y > 96 || info.velocity.y > 500) {
													void saveProjectDraft()
													setTagMenuId(null)
													setTagsOpen(false)
												}
											}}
											initial={isMobileViewport ? { opacity: 0, y: '100%' } : false}
											animate={isMobileViewport ? { opacity: 1, y: 0 } : undefined}
											exit={isMobileViewport ? { opacity: 0, y: '100%' } : undefined}
											transition={
												isMobileViewport
													? { type: 'spring', stiffness: 420, damping: 36, mass: 0.75 }
													: { duration: 0 }
											}
										>
											<div className="project-tag-sheet-header mb-4 pt-4 md:hidden">
												<button
													type="button"
													onPointerDown={(event) => tagSheetDragControls.start(event)}
													onClick={() => {
														void saveProjectDraft()
														setTagMenuId(null)
														setTagsOpen(false)
													}}
													aria-label="Drag down to close project tag options"
													className="project-tag-sheet-drag-handle absolute inset-x-0 top-1 mx-auto flex h-5 w-full cursor-grab items-center justify-center touch-none active:cursor-grabbing"
												>
													<span className="h-1 w-10 rounded-full bg-muted-foreground/60" />
												</button>
												<div className="flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
													<Database size={16} className="text-primary" />
													Platform
												</div>
											</div>
											<div className="project-tag-sheet-selected mb-4 rounded-lg bg-accent/70 p-3 md:hidden">
												{projectDraft.tags.length > 0 ? (
											<DndContext
												sensors={selectedTagSensors}
												collisionDetection={closestCenter}
												modifiers={[restrictSelectedTagDragToHorizontalAxis]}
												onDragEnd={handleSelectedTagOrderEnd}
													>
														<SortableContext
															items={projectDraft.tags.map(
																(tag) => `selected-tag-${tag}`,
															)}
															strategy={rectSortingStrategy}
														>
															<div className="project-tag-sheet-selected-list flex flex-wrap gap-1.5">
																{projectDraft.tags.map((tag) => {
																	const catalog = tagSuggestions.find(
																		(item) =>
																			item.name.toLowerCase() === tag.toLowerCase(),
																	)
																	return (
																		<SortableSelectedProjectTag
																			key={tag}
																			tag={tag}
																			color={
																				catalog
																					? tagColorValues[catalog.color]
																					: '#30363d'
																			}
																			onRemove={() => {
																				setProjectDraft((current) => ({
																					...current,
																					tags: current.tags.filter(
																						(item) => item !== tag,
																					),
																				}))
																			}}
																		/>
																	)
																})}
															</div>
														</SortableContext>
													</DndContext>
												) : (
													<p className="text-xs text-muted-foreground">
														No platforms selected
													</p>
												)}
											</div>
											<input
												autoFocus={!isMobileViewport}
												value={tagInput}
												onChange={(event) => setTagInput(event.target.value)}
												onKeyDown={(event) => {
													if (event.key === 'Enter') {
														event.preventDefault()
														const exactMatch = tagSuggestions.find(
															(tag) =>
																tag.name.toLowerCase() === tagInput.trim().toLowerCase(),
														)
														if (exactMatch) toggleTag(exactMatch.name)
														else addTag()
													}
												}}
												aria-label="Search or create a project tag"
												maxLength={40}
												placeholder="Search for a tag…"
												className="project-tag-options-search mb-2 h-8 w-full !border !border-border !bg-background px-2 text-xs !outline-none focus:!outline-none"
											/>
											<p className="mb-1.5 text-xs text-muted-foreground">
												Select a tag or create one
											</p>
											{matchingTags.length > 0 && (
												<DndContext
													sensors={tagSensors}
													collisionDetection={closestCenter}
													onDragStart={() => setTagMenuId(null)}
													onDragEnd={handleTagOrderEnd}
												>
													<SortableContext
														items={matchingTags.map((tag) => tag.id)}
														strategy={rectSortingStrategy}
													>
														<div className="project-tag-list flex flex-col gap-1">
															{matchingTags.map((tag) => (
																<SortableProjectTag
																	key={tag.id}
																	tag={tag}
																	sortable={canReorderTags}
																	onSelect={() => {
																		setTagMenuId(null)
																		toggleTag(tag.name)
																	}}
																	onOptions={() => toggleTagMenu(tag)}
																>
																	{tagMenuId === tag.id && (
																		<motion.div
																			initial={
																				isMobileViewport ? { opacity: 0, x: 12 } : false
																			}
																			animate={{ opacity: 1, x: 0 }}
																			transition={
																				isMobileViewport
																					? {
																							type: 'spring',
																							stiffness: 420,
																							damping: 34,
																							mass: 0.65,
																						}
																					: { duration: 0 }
																			}
																			className="project-tag-menu absolute right-8 top-0 z-40 w-44 rounded-md border border-border bg-[#161b22] p-1.5 text-foreground shadow-xl md:left-0 md:right-auto md:top-full md:z-30 md:mt-1 md:w-40"
																		>
																			<ProjectTagEditorForm
																				tag={tag}
																				tagNameDraft={tagNameDraft}
																				tagNameInputRef={tagNameInputRef}
																				onTagNameChange={updateTagNameDraft}
																				onRename={(value, closeAfterSave) =>
																					void renameTag(tag, value, closeAfterSave)
																				}
																				closeOnRename={!isMobileViewport}
																				onDelete={() => void deleteTag(tag)}
																				onCancel={() => closeTagMenu(tag)}
																				onColorChange={(color) =>
																					updateTagColor(tag, color)
																				}
																			/>
																		</motion.div>
																	)}
																</SortableProjectTag>
															))}
														</div>
													</SortableContext>
												</DndContext>
											)}
											{tagInput.trim() &&
												!tagSuggestions.some(
													(tag) =>
														tag.name.toLowerCase() === tagInput.trim().toLowerCase(),
												) && (
													<button
														type="button"
														onClick={addTag}
														aria-label={`Create ${tagInput.trim()} tag with ${newTagColor ?? 'a random'} color`}
														className="project-tag-create mt-2 flex w-full items-center gap-2 rounded bg-[#2d333b] px-2 py-1.5 text-left text-xs"
													>
														Create{' '}
														<span
															style={{ backgroundColor: tagColorValues[newTagColor ?? 'purple'] }}
															className="project-tag-create-color-preview project-tag-create-name rounded-sm px-2 py-0.5 text-foreground"
														>
															{tagInput.trim()}
														</span>
													</button>
												)}
										</motion.div>
									)}
								</AnimatePresence>
							</div>
						</div>
					</div>
				</header>
				<div className="project-view-toolbar mb-5 flex items-center justify-between gap-3 border-b border-border pb-3">
					<nav className="project-view-navigation" aria-label="Project task views">
						<div
							className="project-view-tab-list flex items-center gap-1"
							onPointerLeave={() => setHoveredView(null)}
						>
							<button
								type="button"
								onClick={() => setView('board')}
								onPointerEnter={() => setHoveredView('board')}
								aria-label="Board"
								aria-pressed={view === 'board'}
								className={`project-view-tab relative isolate flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${view === 'board' || hoveredView === 'board' ? 'text-foreground' : 'text-muted-foreground'}`}
							>
								{(hoveredView ?? view) === 'board' && (
									<motion.span
										aria-hidden="true"
										layoutId="project-view-tab-pill"
										transition={{ type: 'spring', stiffness: 500, damping: 35 }}
										className={`project-view-tab-pill pointer-events-none absolute inset-0 -z-10 rounded-full ${view === 'board' ? 'bg-[#30363d] shadow-sm' : 'bg-[#30363d]/70'}`}
									/>
								)}
								<span className="relative z-10 flex items-center gap-2">
									<LayoutDashboard
										size={14}
										className={`project-view-tab-icon ${view === 'board' ? 'text-primary' : ''}`}
									/>
									<span className="view-title hidden md:inline">Board</span>
								</span>
							</button>
							<button
								type="button"
								onClick={() => {
									setView('archived')
									void loadArchivedTasks()
								}}
								onPointerEnter={() => setHoveredView('archived')}
								aria-label="Archived tasks"
								aria-pressed={view === 'archived'}
								className={`project-view-tab relative isolate flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${view === 'archived' || hoveredView === 'archived' ? 'text-foreground' : 'text-muted-foreground'}`}
							>
								{(hoveredView ?? view) === 'archived' && (
									<motion.span
										aria-hidden="true"
										layoutId="project-view-tab-pill"
										transition={{ type: 'spring', stiffness: 500, damping: 35 }}
										className={`project-view-tab-pill pointer-events-none absolute inset-0 -z-10 rounded-full ${view === 'archived' ? 'bg-[#30363d] shadow-sm' : 'bg-[#30363d]/70'}`}
									/>
								)}
								<span className="relative z-10 flex items-center gap-2">
									<Archive
										size={14}
										className={`project-view-tab-icon ${view === 'archived' ? 'text-primary' : ''}`}
									/>
									<span className="view-title hidden md:inline">Archived tasks</span>
								</span>
							</button>
						</div>
					</nav>
					<section
						className="project-view-actions-section flex items-center gap-1"
						aria-label="Project actions"
					>
						<Tooltip label={project.archived ? 'Restore project' : 'Archive project'}>
							<Button
								className="project-view-project-archive hidden md:inline-flex"
								variant="ghost"
								size="icon"
								aria-label={project.archived ? 'Restore project' : 'Archive project'}
								disabled={busy}
								onClick={handleProjectArchiveAction}
							>
								{project.archived ? <ArrowLeft size={14} /> : <Archive size={14} />}
							</Button>
						</Tooltip>
						{!project.archived && (
							<Button
								className="project-view-new-task !h-auto border border-primary/60 !bg-primary/10 px-4 py-1.5 text-primary hover:!bg-primary/20 hover:text-primary active:scale-95"
								disabled={busy || loading}
								aria-label="New task"
								onClick={() => {
									setView('board')
									setNewTaskRequest((current) => current + 1)
								}}
							>
								<Plus size={14} />
							</Button>
						)}
					</section>
				</div>
				{view === 'archived' && (
					<motion.section
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.2 }}
						className="archived-tasks-panel rounded-lg border border-border bg-[#161b22] p-4"
					>
						{archivedTasksLoading ? (
							<p className="archived-tasks-loading text-sm text-muted-foreground">
								Loading archived tasks…
							</p>
						) : archivedTasks.length === 0 ? (
							<p className="archived-tasks-empty text-sm text-muted-foreground">
								No archived tasks.
							</p>
						) : (
							<div className="archived-task-list space-y-2">
								{archivedTasks.map((task) => (
									<div
										key={task.id}
										className="archived-task flex items-center gap-3 rounded-md border border-border bg-background p-3"
									>
										<div className="archived-task-content min-w-0 flex-1">
											<span className="archived-task-ticket text-xs font-medium text-primary">
												{task.ticket_id}
											</span>
											<p className="archived-task-title truncate text-sm font-medium">
												{task.title}
											</p>
										</div>
										<Tooltip label="Restore">
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Restore ${task.ticket_id}`}
												disabled={busy || project.archived}
												onClick={() => restoreTask(task)}
											>
												<RotateCcw size={15} />
											</Button>
										</Tooltip>
										<Tooltip label="Delete permanently">
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Delete ${task.ticket_id}`}
												disabled={busy}
												className="archived-task-delete text-rose-300"
								onClick={() => deleteTask(task)}
											>
												<Trash2 size={15} />
											</Button>
										</Tooltip>
									</div>
								))}
							</div>
						)}
					</motion.section>
				)}
				{view === 'board' && (
					<div className="project-view-board">
						<KanbanBoard
							tasks={tasks}
							disabled={project.archived}
							loading={loading}
							edit={(task) => setEditor({ task })}
							archive={archiveTask}
							remove={deleteTask}
							createTask={createInlineTask}
							newTaskRequest={newTaskRequest}
							move={(...args) => void move(...args)}
						/>
					</div>
				)}
				{view === 'board' && !project.archived && (
					<Button
						className="project-view-mobile-archive mt-5 w-full justify-center bg-accent text-foreground hover:bg-[#30363d] active:scale-[0.98] md:hidden"
						variant="ghost"
						onClick={handleProjectArchiveAction}
					>
						<Archive size={14} />
						Archive project
					</Button>
				)}
				{project.archived && (
					<p className="project-archived-note pb-6 text-[11px] text-muted-foreground">
						Restore this project to change its tasks.
					</p>
				)}
			</div>
			{editor && (
				<TaskEditor
					task={editor.task}
					close={() => setEditor(null)}
					save={async (data, taskId) => {
						if (taskId) {
							setTasks((previous) =>
								previous.map((task) =>
									task.id === taskId
										? { ...task, ...data, updated_at: new Date().toISOString() }
										: task,
								),
							)
						}
						const saved = await api<Task>(
							taskId ? `/tasks/${taskId}` : `/projects/${project.id}/tasks`,
							json(taskId ? 'PATCH' : 'POST', data),
						)
						await loadTasks().catch(() => undefined)
						return saved
					}}
				/>
			)}
			<ConfirmDialog
				open={isProjectArchiveConfirmOpen}
				onOpenChange={setIsProjectArchiveConfirmOpen}
				title="Archive project?"
				description={`Archive "${project.name}"? You can restore it later from Archived projects.`}
				confirmLabel="Archive project"
				busyLabel="Archiving..."
				onConfirm={async () => {
					await api(`/projects/${project.id}`, json('PATCH', { archived: true }))
					await refresh()
					toast.success('Project archived')
				}}
			/>
		</>
	)
}
