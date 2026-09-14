'use client'
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
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
} from '@dnd-kit/core'
import {
	arrayMove,
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
	GripVertical,
	Info,
	LayoutDashboard,
	Plus,
	RotateCcw,
	Trash2,
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
		...(retry ? { action: { label: 'Reload board', onClick: retry } } : {}),
	})
}
function capitalizePlatform(value: string) {
	return value.replace(/(^|[\s-])\p{L}/gu, (character) => character.toUpperCase())
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
			className={`project-tag-option border-0 ${isDragging ? 'opacity-60' : ''}`}
		>
			<div
				style={{
					backgroundColor: tagColorValues[tag.color],
					fontSize: '12px',
					lineHeight: 1,
				}}
				className="project-tag-chip relative flex border-0 items-center rounded-sm text-white"
			>
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation()
						onOptions()
					}}
					aria-label={`Platform options for ${tag.name}`}
					className="project-tag-options-trigger ml-0.5 rounded-sm p-0.5 text-white/70 hover:text-white"
				>
					<Info size={13} />
				</button>
				<button
					type="button"
					onClick={onSelect}
					className="project-tag-select px-1.5 py-1"
				>
					{tag.name}
				</button>
				{sortable && (
					<button
						type="button"
						aria-label={`Reorder ${tag.name}`}
						className="project-tag-drag-handle mr-0.5 touch-none rounded-sm p-0.5 text-white/70 hover:text-white cursor-grab active:cursor-grabbing"
						{...attributes}
						{...listeners}
					>
						<GripVertical size={13} />
					</button>
				)}
				{children}
			</div>
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
	const [archivedTasksLoading, setArchivedTasksLoading] = useState(false)
	const [loading, setLoading] = useState(true)
	const [busy, setBusy] = useState(false)
	const moveQueue = useRef(Promise.resolve())
	const pendingMoves = useRef(
		new Map<string, { status: Status; position: number; revision: number }>(),
	)
	const moveRevisions = useRef(new Map<string, number>())
	const moveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
	const queuedMoveIds = useRef(new Set<string>())
	const tagOrderQueue = useRef(Promise.resolve())
	const tagOrderRevision = useRef(0)
	const [projectDraft, setProjectDraft] = useState(() => ({
		name: project.name === 'New Project' ? '' : project.name,
		description: project.description,
		tags: project.tags,
	}))
	const [tagInput, setTagInputState] = useState('')
	const [tagSuggestions, setTagSuggestions] = useState<ProjectTag[]>([])
	const [tagCatalogLoaded, setTagCatalogLoaded] = useState(false)
	const [tagMenuId, setTagMenuId] = useState<string | null>(null)
	const [tagNameDraft, setTagNameDraft] = useState('')
	const [tagsOpen, setTagsOpen] = useState(false)
	const [isMobileViewport, setIsMobileViewport] = useState(false)
	const tagSheetDragControls = useDragControls()
	const tagSensors = useSensors(
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
					json('PATCH', { ...projectDraft, name }),
				),
			)
			void loadTagSuggestions().catch(() => undefined)
			toast.dismiss(boardErrorToastId)
		} catch (error) {
			reportBoardError(error, 'Unable to save project changes.')
		}
	}, [loadTagSuggestions, project, projectDraft, update])
	const [editor, setEditor] = useState<{ task?: Task; status?: Status } | null>(null)
	const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
	const [taskToArchive, setTaskToArchive] = useState<Task | null>(null)
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
		},
		[],
	)
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
	function archiveTask(task: Task) {
		setTaskToArchive(task)
	}
	function restoreTask(task: Task) {
		void action(async () => {
			await api(`/tasks/${task.id}/restore`, json('POST'))
			await Promise.all([loadTasks(), loadArchivedTasks()])
		}, 'Task restored')
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
		const tag = capitalizePlatform(tagInput.trim())
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
							color: 'purple',
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
	async function renameTag(tag: ProjectTag, value: string) {
		const name = capitalizePlatform(value.trim())
		if (!name) {
			setTagNameDraft(tag.name)
			setTagMenuId(null)
			return
		}
		if (name.length > 40 || name === tag.name) {
			setTagNameDraft(tag.name)
			if (name === tag.name) setTagMenuId(null)
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
		setTagMenuId(null)
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
	function toggleTagMenu(tag: ProjectTag) {
		if (tagMenuId === tag.id) {
			if (!tagNameDraft.trim()) {
				setTagNameDraft(tag.name)
			}
			void persistTagColor(tag)
			setTagMenuId(null)
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
						<input
							value={projectDraft.description}
							onChange={(event) =>
								setProjectDraft((current) => ({
									...current,
									description: event.target.value,
								}))
							}
							onBlur={() => void saveProjectDraft()}
							aria-label="Project description"
							maxLength={90}
							placeholder="Description"
							className="project-description mt-2 h-auto w-full !border-0 !bg-transparent px-0 py-0 text-sm leading-6 text-muted-foreground !outline-none focus:!outline-none"
						/>
						<div className="project-platform-section mt-3 flex items-start gap-3 sm:items-center">
							<div className="project-platform-label mt-3 flex shrink-0 items-center gap-2 text-sm text-muted-foreground sm:mt-0">
								<Database size={15} />
								Platform
							</div>
							<div
								ref={tagMenuRef}
								className="project-platform-editor relative min-w-0 flex-1"
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
									className={`project-tag-trigger flex min-h-9 cursor-pointer flex-nowrap items-center gap-1.5 overflow-x-auto !outline-none [-webkit-tap-highlight-color:transparent] focus:!outline-none md:flex-wrap md:overflow-visible ${tagsOpen ? 'rounded-md px-2 py-3 md:rounded-t-md md:rounded-b-none md:bg-accent md:shadow-[inset_0_1px_0_var(--color-border),inset_1px_0_0_var(--color-border),inset_-1px_0_0_var(--color-border)]' : 'rounded-md px-2 py-3'}`}
									aria-label="Edit project tags"
									aria-expanded={tagsOpen}
								>
									{projectDraft.tags.length === 0 && !tagsOpen ? (
										<span className="px-1 text-xs text-muted-foreground">
											Add platform
										</span>
									) : !tagCatalogLoaded ? (
										<PlatformTagSkeletons />
									) : (
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
														className="rounded-sm text-white/65 hover:text-white"
													>
														<X size={12} />
													</button>
												</span>
											)
										})
									)}
								</div>
								<AnimatePresence>
									{tagsOpen && (
										<motion.button
											type="button"
											aria-label="Close project tag options"
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
											initial={
												isMobileViewport ? { opacity: 0, y: '100%' } : { opacity: 0 }
											}
											animate={{ opacity: 1, y: 0 }}
											exit={isMobileViewport ? { opacity: 0, y: '100%' } : { opacity: 0 }}
											transition={
												isMobileViewport
													? { type: 'spring', stiffness: 420, damping: 36, mass: 0.75 }
													: { duration: 0.15 }
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
													<div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1">
														{projectDraft.tags.map((tag) => {
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
																	}}
																	className="project-tag-sheet-selected-tag flex shrink-0 items-center gap-1 rounded-sm px-2 py-1 text-xs text-white"
																>
																	{tag}
																	<button
																		type="button"
																		onClick={() => {
																			setProjectDraft((current) => ({
																				...current,
																				tags: current.tags.filter((item) => item !== tag),
																			}))
																		}}
																		aria-label={`Remove ${tag} tag`}
																		className="rounded-sm text-white/65 hover:text-white"
																	>
																		<X size={12} />
																	</button>
																</span>
															)
														})}
													</div>
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
														<div className="project-tag-list flex flex-wrap gap-1.5">
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
																		<div className="project-tag-menu absolute left-0 top-full z-30 mt-1 w-40 rounded-md border border-border bg-[#161b22] p-1.5 text-foreground shadow-xl">
																			<div className="project-tag-menu-edit flex gap-1.5">
																				<input
																					ref={tagNameInputRef}
																					value={tagNameDraft}
																					onChange={(event) => {
																						setTagNameDraft(event.target.value)
																						if (event.target.value.trim())
																							toast.dismiss(platformNameToastId)
																					}}
																					onBlur={(event) =>
																						void renameTag(tag, event.target.value)
																					}
																					onKeyDown={(event) => {
																						if (event.key === 'Enter')
																							event.currentTarget.blur()
																						if (event.key === 'Escape') {
																							setTagNameDraft(tag.name)
																							void persistTagColor(tag)
																							setTagMenuId(null)
																						}
																					}}
																					aria-label={`Rename ${tag.name}`}
																					maxLength={40}
																					className="project-tag-name-input h-8 !border !border-[#484f58] !bg-[#2d333b] px-2 py-1 text-xs !outline-none focus:!outline-none"
																				/>
																				<button
																					type="button"
																					onMouseDown={(event) => event.preventDefault()}
																					onClick={() => void deleteTag(tag)}
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
																				{Object.entries(tagColorValues).map(
																					([color, value]) => (
																						<button
																							key={color}
																							type="button"
																							aria-label={`Set ${tag.name} to ${color}`}
																							onClick={() =>
																								updateTagColor(
																									tag,
																									color as ProjectTag['color'],
																								)
																							}
																							style={{ backgroundColor: value }}
																							className="project-tag-color h-5 rounded-sm"
																						/>
																					),
																				)}
																			</div>
																		</div>
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
														className="project-tag-create mt-2 flex w-full items-center gap-2 rounded bg-[#2d333b] px-2 py-1.5 text-left text-xs"
													>
														Create{' '}
														<span className="project-tag-create-name rounded-sm bg-[#484f58] px-2 py-0.5 text-foreground">
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
				<nav className="project-view-navigation mb-5 flex items-center justify-between gap-3 border-b border-border pb-3">
					<div className="project-view-tab-list flex items-center gap-1">
						<button
							onClick={() => setView('board')}
							aria-label="Board"
							className={`project-view-tab flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${view === 'board' ? 'bg-[#30363d] text-foreground shadow-sm' : 'text-muted-foreground hover:bg-[#30363d]/70 hover:text-foreground'}`}
						>
							<LayoutDashboard
								size={14}
								className={view === 'board' ? 'text-primary' : ''}
							/>
							<span className="hidden md:inline">Board</span>
						</button>
						<button
							onClick={() => {
								setView('archived')
								void loadArchivedTasks()
							}}
							aria-label="Archived tasks"
							className={`project-view-tab flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${view === 'archived' ? 'bg-[#30363d] text-foreground shadow-sm' : 'text-muted-foreground hover:bg-[#30363d]/70 hover:text-foreground'}`}
						>
							<Archive size={14} />
							<span className="hidden md:inline">Archived tasks</span>
						</button>
					</div>
					<div className="project-view-actions-section flex items-center gap-1">
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
								className="project-view-new-task !h-auto px-4 py-1.5 active:scale-95"
								disabled={busy || loading}
								aria-label="New task"
								onClick={() => setEditor({})}
							>
								<Plus size={14} />
							</Button>
						)}
					</div>
				</nav>
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
												onClick={() => setTaskToDelete(task)}
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
					<motion.div
						key="board"
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.2 }}
					>
						<KanbanBoard
							tasks={tasks}
							disabled={project.archived}
							loading={loading}
							edit={(task) => setEditor({ task })}
							archive={archiveTask}
							remove={(task) => setTaskToDelete(task)}
							create={(status) => setEditor({ status })}
							move={(...args) => void move(...args)}
						/>
					</motion.div>
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
					initialStatus={editor.status}
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
			<ConfirmDialog
				open={Boolean(taskToArchive)}
				onOpenChange={(open) => !open && setTaskToArchive(null)}
				title="Archive task?"
				description={`Archive ${taskToArchive?.ticket_id ?? 'this task'}? You can restore it later from Archived tasks.`}
				confirmLabel="Archive task"
				busyLabel="Archiving..."
				onConfirm={async () => {
					if (!taskToArchive) return
					await api(`/tasks/${taskToArchive.id}/archive`, json('POST'))
					await loadTasks()
					if (view === 'archived') await loadArchivedTasks()
					toast.success('Task archived')
				}}
			/>
			<ConfirmDialog
				open={Boolean(taskToDelete)}
				onOpenChange={(open) => !open && setTaskToDelete(null)}
				title="Delete task?"
				description={`This will permanently delete ${taskToDelete?.ticket_id ?? 'this task'}.`}
				confirmLabel="Delete task"
				onConfirm={async () => {
					if (!taskToDelete) return
					await api(`/tasks/${taskToDelete.id}`, json('DELETE'))
					await Promise.all([loadTasks(), loadArchivedTasks()])
				}}
			/>
		</>
	)
}
