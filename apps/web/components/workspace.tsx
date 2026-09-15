'use client'

import {
	Fragment,
	useCallback,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type RefObject,
} from 'react'
import {
	closestCenter,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragMoveEvent,
	type DragOverEvent,
	type DragStartEvent,
	type Modifier,
} from '@dnd-kit/core'
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { animate, AnimatePresence, motion, useMotionValue } from 'motion/react'
import {
	Archive,
	CircleUserRound,
	CircleAlert,
	FolderKanban,
	GripVertical,
	Layers3,
	LogOut,
	Menu,
	Plus,
	RotateCcw,
	Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, json } from '@/lib/api'
import { getAppErrorInfo, type AppErrorInfo } from '@/lib/errors'
import { getSupabase } from '@/lib/supabase'
import type { Project } from '@/lib/types'
import { ProjectView, ProjectViewSkeleton } from './project-view'
import { Button } from './ui/button'
import { ConfirmDialog } from './ui/confirm-dialog'

const projectsLoadErrorToastId = 'projects-load-error'

function createProjectListDragConstraint(projectList: HTMLElement | null): Modifier {
	return ({ activeNodeRect, transform }) => {
		if (!projectList || !activeNodeRect) return { ...transform, x: 0 }

		const listRect = projectList.getBoundingClientRect()
		return {
			...transform,
			x: 0,
			y: Math.min(
				Math.max(transform.y, listRect.top - activeNodeRect.top),
				listRect.bottom + activeNodeRect.height - activeNodeRect.bottom,
			),
		}
	}
}

function AccountMenu({
	email,
	open,
	close,
	reportError,
	containerRef,
	variant = 'popover',
}: {
	email: string
	open: boolean
	close: () => void
	reportError: (message: string) => void
	containerRef: RefObject<HTMLElement | null>
	variant?: 'popover' | 'sidebar' | 'drawer'
}) {
	const isSidebarPanel = variant === 'sidebar'
	const isDrawerPanel = variant === 'drawer'
	useEffect(() => {
		if (!open) return

		function closeWhenOutside(event: Event) {
			if (!containerRef.current?.contains(event.target as Node)) close()
		}

		document.addEventListener('pointerdown', closeWhenOutside)
		document.addEventListener('focusin', closeWhenOutside)

		return () => {
			document.removeEventListener('pointerdown', closeWhenOutside)
			document.removeEventListener('focusin', closeWhenOutside)
		}
	}, [close, containerRef, open])
	return (
		<AnimatePresence>
			{open && (
				<motion.div
					initial={{ opacity: 0, y: isSidebarPanel ? 6 : -6 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: isSidebarPanel ? 6 : -6 }}
					transition={{ duration: 0.16 }}
					className={`workspace-account-menu border border-border bg-[#161b22] p-2 ${isSidebarPanel ? 'mb-2 w-full rounded-md' : isDrawerPanel ? 'absolute right-0 top-full z-30 mt-1 w-52 max-w-[calc(100vw-2rem)] rounded-lg shadow-xl' : 'absolute right-0 top-full z-30 mt-1 w-56 rounded-lg shadow-xl'}`}
				>
					<p className="workspace-account-email truncate px-2 py-2 text-xs text-muted-foreground">
						{email}
					</p>
					<Button
						variant="ghost"
						size="sm"
						className="workspace-logout w-full justify-start transition-transform active:scale-95"
						onClick={async () => {
							try {
								const { error } = await getSupabase().auth.signOut()
								if (error) throw error
								close()
							} catch (error) {
								reportError(error instanceof Error ? error.message : 'Unable to log out.')
							}
						}}
					>
						<LogOut size={15} />
						Log out
					</Button>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

function SidebarProjectSkeletons({ collapsed }: { collapsed: boolean }) {
	return (
		<div aria-label="Loading projects" className="space-y-1.5">
			{Array.from({ length: 4 }, (_, index) => (
				<div
					key={index}
					aria-hidden="true"
					className={`flex h-9 items-center justify-start rounded-md pl-2 pr-2 ${collapsed ? 'gap-0' : 'gap-1.5'}`}
				>
					<span className="flex w-8 shrink-0 items-center justify-center">
						<span className="h-4 w-4 animate-pulse rounded bg-muted-foreground/20" />
					</span>
					{!collapsed && (
						<span className="h-3 flex-1 animate-pulse rounded bg-muted-foreground/20" />
					)}
				</div>
			))}
		</div>
	)
}

interface MobileProjectDrawerProps {
	email: string
	projects: Project[]
	activeProjectId: string | null
	isOpen: boolean
	isLoading: boolean
	isCreatingProject: boolean
	canCreateProjects: boolean
	isAccountOpen: boolean
	onCreateProject: () => void
	onSelectProject: (projectId: string) => void
	onReorderProjects: (event: DragEndEvent) => void
	onOpenArchive: () => void
	onToggleAccount: () => void
	onCloseAccount: () => void
	onReportError: (message: string) => void
}

interface SortableProjectLinkProps {
	project: Project
	isActive: boolean
	onSelect: () => void
	variant: 'sidebar' | 'drawer'
	labelClass?: string
	itemGapClass?: string
	dropTracePosition?: 'before' | 'after'
	isProjectListDragging?: boolean
}

function SortableProjectLink({
	project,
	isActive,
	onSelect,
	variant,
	labelClass,
	itemGapClass,
	dropTracePosition,
	isProjectListDragging = false,
}: SortableProjectLinkProps) {
	const selectedOnPointerDown = useRef(false)
	const {
		attributes,
		isDragging,
		listeners,
		setActivatorNodeRef,
		setNodeRef,
		transition,
	} = useSortable({
		id: project.id,
	})
	const style: CSSProperties = {
		transition,
	}
	const isSidebar = variant === 'sidebar'
	const traceClass = dropTracePosition
		? 'workspace-project-drop-trace bg-primary/5 ring-1 ring-inset ring-dashed ring-primary/55'
		: ''
	const toneClass = isDragging
		? 'opacity-0'
		: isActive
			? 'bg-accent text-foreground'
			: isProjectListDragging
				? 'text-muted-foreground'
				: 'text-muted-foreground hover:bg-accent hover:text-foreground'
	function handleSelectPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
		if (event.button !== 0) return

		selectedOnPointerDown.current = true
		onSelect()
	}

	function handleSelectClick() {
		if (selectedOnPointerDown.current) {
			selectedOnPointerDown.current = false
			return
		}

		onSelect()
	}

	return (
		<div
			ref={setNodeRef}
			style={style}
			data-project-id={project.id}
			className={`workspace-${variant}-project-link workspace-project-sortable-link group flex w-full items-center ${isSidebar ? `justify-start ${itemGapClass}` : 'gap-2.5 px-3 py-2.5 text-[15px]'} rounded-md ${isSidebar ? 'py-2 px-1.5 text-sm' : ''} text-left transition-colors ${toneClass} ${traceClass}`}
		>
			<button
				type="button"
				onClick={handleSelectClick}
				onPointerDown={handleSelectPointerDown}
				aria-label={isSidebar && !labelClass ? project.name : undefined}
				aria-current={isActive ? 'page' : undefined}
				className={`workspace-project-select-button flex min-w-0 flex-1 items-center touch-manipulation ${isSidebar ? itemGapClass : 'gap-2.5'} text-left`}
			>
				{isSidebar ? (
					<span className="workspace-sidebar-icon flex w-8 shrink-0 items-center justify-center">
						<FolderKanban size={15} />
					</span>
				) : (
					<FolderKanban size={17} className="shrink-0" />
				)}
				<span className={isSidebar ? `truncate ${labelClass}` : 'truncate'}>
					{project.name}
				</span>
			</button>
			<button
				ref={setActivatorNodeRef}
				type="button"
				aria-label={`Drag ${project.name} to reorder`}
				className={`workspace-project-drag-handle ml-auto flex shrink-0 items-center justify-center rounded-sm p-0 text-muted-foreground transition-opacity touch-none cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-100' : isProjectListDragging ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}
				{...attributes}
				{...listeners}
			>
				<GripVertical aria-hidden="true" size={16} />
			</button>
		</div>
	)
}

function ProjectDragPreview({
	project,
	width,
	height,
	isHidden = false,
}: {
	project: Project
	width: number | null
	height: number | null
	isHidden?: boolean
}) {
	const previewInset = 3
	const previewStyle =
		width && height
			? {
					width: Math.max(width - previewInset * 2, 0),
					height: height * 0.82,
					transform: `translate(${previewInset}px, ${height * 0.09}px)`,
				}
			: undefined

	return (
		<div
			style={previewStyle}
			className={`workspace-project-drag-preview flex box-border items-center gap-2.5 rounded-md border border-primary/65 bg-[#21262d] px-2.5 text-sm text-foreground shadow-xl ${isHidden ? 'opacity-0' : ''}`}
		>
			<FolderKanban size={15} className="shrink-0" />
			<span className="truncate">{project.name}</span>
			<GripVertical size={16} className="ml-auto shrink-0 text-muted-foreground" />
		</div>
	)
}

function ProjectDropTrace({
	height,
	project,
}: {
	height: number | null
	project: Project | null
}) {
	return (
		<div
			aria-hidden="true"
			style={height ? { height } : undefined}
			className="workspace-project-drop-trace box-border h-9 w-full rounded-md border border-dashed border-primary/55 bg-primary/5 p-[3px]"
		>
			{project && (
				<div className="workspace-project-drop-preview flex h-full items-center gap-2.5 rounded-sm bg-[#21262d] px-2.5 text-sm text-foreground shadow-xl">
					<FolderKanban size={15} className="shrink-0" />
					<span className="truncate">{project.name}</span>
					<GripVertical size={16} className="ml-auto shrink-0 text-muted-foreground" />
				</div>
			)}
		</div>
	)
}

interface MobileDrawerDragState {
	pointerId: number
	startX: number
	startY: number
	initialOffset: number
	axis: 'pending' | 'horizontal'
	isDragging: boolean
}

const mobileDrawerSpring = {
	type: 'spring',
	stiffness: 420,
	damping: 38,
	mass: 0.7,
} as const

const mobileButtonTapTransition = {
	type: 'spring',
	stiffness: 620,
	damping: 24,
	mass: 0.45,
} as const

function MobileProjectDrawer({
	email,
	projects,
	activeProjectId,
	isOpen,
	isLoading,
	isCreatingProject,
	canCreateProjects,
	isAccountOpen,
	onCreateProject,
	onSelectProject,
	onReorderProjects,
	onOpenArchive,
	onToggleAccount,
	onCloseAccount,
	onReportError,
}: MobileProjectDrawerProps) {
	const accountRef = useRef<HTMLDivElement>(null)
	const [projectList, setProjectList] = useState<HTMLDivElement | null>(null)
	const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null)
	const [dropProjectId, setDropProjectId] = useState<string | null>(null)
	const [dropProjectPlacement, setDropProjectPlacement] = useState<'before' | 'after'>(
		'before',
	)
	const restrictProjectDragToList = createProjectListDragConstraint(projectList)
	const projectSensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	)
	function handleProjectDragStart({ active }: DragStartEvent) {
		setDraggedProjectId(String(active.id))
	}
	function handleProjectDragOver({ active, over }: DragOverEvent) {
		setDropProjectId(over ? String(over.id) : null)
		const draggedRect = active.rect.current.translated
		setDropProjectPlacement(
			draggedRect &&
				over &&
				draggedRect.top + draggedRect.height / 2 > over.rect.top + over.rect.height / 2
				? 'after'
				: 'before',
		)
	}
	function clearProjectDropTrace() {
		setDraggedProjectId(null)
		setDropProjectId(null)
		setDropProjectPlacement('before')
	}
	function handleProjectDragEnd(event: DragEndEvent) {
		clearProjectDropTrace()
		onReorderProjects(event)
	}
	return (
		<aside
			id="mobile-project-drawer"
			aria-hidden={!isOpen}
			inert={!isOpen}
			className="workspace-mobile-drawer fixed inset-y-0 left-0 z-20 flex w-[78%] max-w-sm flex-col bg-[#161b22] md:hidden"
		>
			<header className="workspace-mobile-drawer-header flex h-16 shrink-0 items-center px-5">
				<div className="workspace-mobile-drawer-brand flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
					<Layers3 size={23} className="text-primary" />
					DevBoard
				</div>
				<div
					ref={accountRef}
					className="workspace-mobile-drawer-account relative ml-auto"
				>
					<Button
						asChild
						className="workspace-mobile-drawer-account-trigger !h-10 !w-10 rounded-full border border-border bg-[#21262d] shadow-sm hover:bg-accent"
						variant="ghost"
						size="icon"
					>
						<motion.button
							type="button"
							aria-label="Account"
							onClick={onToggleAccount}
							whileTap={{ scale: 0.9 }}
							transition={mobileButtonTapTransition}
						>
							<CircleUserRound size={18} />
						</motion.button>
					</Button>
					<AccountMenu
						email={email}
						open={isAccountOpen}
						close={onCloseAccount}
						reportError={onReportError}
						containerRef={accountRef}
						variant="drawer"
					/>
				</div>
			</header>
			<div className="workspace-mobile-drawer-content flex min-h-0 flex-1 flex-col p-3">
				<nav
					aria-label="Projects"
					className="workspace-mobile-drawer-project-list relative -mr-3 min-h-0 flex-1"
				>
					<div className="workspace-mobile-drawer-project-scroll h-full overflow-y-auto pb-12 pr-3">
						{isLoading ? (
							<SidebarProjectSkeletons collapsed={false} />
						) : (
							<DndContext
								collisionDetection={closestCenter}
								modifiers={[restrictProjectDragToList]}
								onDragCancel={clearProjectDropTrace}
								onDragEnd={handleProjectDragEnd}
								onDragOver={handleProjectDragOver}
								onDragStart={handleProjectDragStart}
								sensors={projectSensors}
							>
								<div
									ref={setProjectList}
									className="workspace-mobile-project-sort-list space-y-1"
								>
									<SortableContext
										items={projects.map((project) => project.id)}
										strategy={verticalListSortingStrategy}
									>
										{projects.map((project) => (
											<SortableProjectLink
												key={project.id}
												project={project}
												isActive={activeProjectId === project.id}
												isProjectListDragging={Boolean(draggedProjectId)}
												dropTracePosition={
													draggedProjectId !== project.id && dropProjectId === project.id
														? dropProjectPlacement
														: undefined
												}
												onSelect={() => onSelectProject(project.id)}
												variant="drawer"
											/>
										))}
									</SortableContext>
								</div>
							</DndContext>
						)}
					</div>
					{canCreateProjects && (
						<Button
							asChild
							className="workspace-mobile-drawer-create absolute bottom-3 left-3 z-10 !h-9 rounded-full px-3 text-sm shadow-lg"
							size="sm"
						>
							<motion.button
								type="button"
								disabled={isCreatingProject || isLoading}
								onClick={onCreateProject}
								whileTap={{ scale: 0.96 }}
								transition={mobileButtonTapTransition}
							>
								<Plus size={15} />
								New Project
							</motion.button>
						</Button>
					)}
				</nav>
				<footer className="workspace-mobile-drawer-footer mt-auto border-t border-border pt-3">
					<Button
						className="workspace-mobile-drawer-archive w-full justify-start text-[15px]"
						variant="ghost"
						onClick={onOpenArchive}
					>
						<Archive size={18} />
						Archived projects
					</Button>
				</footer>
			</div>
		</aside>
	)
}

export function Workspace({ email }: { email: string }) {
	const [projects, setProjects] = useState<Project[]>([])
	const [archivedProjects, setArchivedProjects] = useState<Project[]>([])
	const [active, setActive] = useState<string | null>(null)
	const [archiveLoading, setArchiveLoading] = useState(false)
	const [isCreatingProject, setIsCreatingProject] = useState(false)
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
	const [isSidebarHoverExpanded, setIsSidebarHoverExpanded] = useState(false)
	const [isMobileProjectsOpen, setIsMobileProjectsOpen] = useState(false)
	const [isMobileDrawerRevealed, setIsMobileDrawerRevealed] = useState(false)
	const [isMobileViewport, setIsMobileViewport] = useState(false)
	const [isWideDesktop, setIsWideDesktop] = useState(false)
	const mobilePanelX = useMotionValue(0)
	const [workspaceView, setWorkspaceView] = useState<'board' | 'projects' | 'archived'>(
		'board',
	)
	const [accountOpen, setAccountOpen] = useState(false)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [projectsLoadError, setProjectsLoadError] = useState<AppErrorInfo | null>(null)
	const [archivedToDelete, setArchivedToDelete] = useState<Project | null>(null)
	const request = useRef(0)
	const projectOrderQueue = useRef(Promise.resolve())
	const projectOrderRevision = useRef(0)
	const mobileDrawerDrag = useRef<MobileDrawerDragState | null>(null)
	const sidebarAccountRef = useRef<HTMLDivElement>(null)
	const [projectList, setProjectList] = useState<HTMLElement | null>(null)
	const [activeProject, setActiveProject] = useState<Project | null>(null)
	const [activeProjectWidth, setActiveProjectWidth] = useState<number | null>(null)
	const [activeProjectHeight, setActiveProjectHeight] = useState<number | null>(null)
	const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null)
	const [dropProjectIndex, setDropProjectIndex] = useState<number | null>(null)
	const dropProjectIndexRef = useRef<number | null>(null)
	const hasProjectDragMoved = useRef(false)
	const sidebarCollapsed = !isWideDesktop && isSidebarCollapsed && !isSidebarHoverExpanded
	const sidebarLabelClass = `overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] ${sidebarCollapsed ? 'max-w-0 -translate-x-1 opacity-0 duration-0' : 'max-w-44 translate-x-0 opacity-100 duration-200'}`
	const sidebarStaticLabelClass = `overflow-hidden whitespace-nowrap ${sidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-44 opacity-100'}`
	const sidebarItemGapClass = sidebarCollapsed ? 'gap-0' : 'gap-1.5'
	const isMobilePanelVisible = isMobileViewport && isMobileProjectsOpen
	const projectSensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	)
	const restrictProjectDragToList = createProjectListDragConstraint(projectList)

	const load = useCallback(async () => {
		const current = ++request.current
		try {
			const result = await api<Project[]>('/projects?archived=false')
			if (current !== request.current) return
			setError('')
			setProjectsLoadError(null)
			toast.dismiss(projectsLoadErrorToastId)
			setProjects(result)
			setActive((previous) =>
				result.some((project) => project.id === previous)
					? previous
					: (result[0]?.id ?? null),
			)
		} catch (error) {
			if (current === request.current) {
				const details = getAppErrorInfo(error, 'Unable to load projects.')
				setProjectsLoadError(details)
				toast.error(`${details.code}: ${details.message}`, {
					id: projectsLoadErrorToastId,
					duration: Infinity,
				})
			}
		} finally {
			if (current === request.current) setLoading(false)
		}
	}, [])

	const loadArchived = useCallback(async () => {
		setArchiveLoading(true)
		try {
			setArchivedProjects(await api<Project[]>('/projects?archived=true'))
		} catch (error) {
			setError(
				error instanceof Error ? error.message : 'Unable to load archived projects.',
			)
		} finally {
			setArchiveLoading(false)
		}
	}, [])

	useEffect(() => {
		let cancelled = false
		queueMicrotask(() => {
			if (!cancelled) void load()
		})
		return () => {
			cancelled = true
		}
	}, [load, loadArchived])

	useEffect(() => {
		const mediaQuery = window.matchMedia('(max-width: 767px)')
		const handleViewportChange = () => {
			setIsMobileViewport(mediaQuery.matches)
			if (!mediaQuery.matches) setIsMobileDrawerRevealed(false)
		}

		handleViewportChange()
		mediaQuery.addEventListener('change', handleViewportChange)

		return () => mediaQuery.removeEventListener('change', handleViewportChange)
	}, [])

	useEffect(() => {
		const mediaQuery = window.matchMedia('(min-width: 1280px)')
		const handleViewportChange = () => setIsWideDesktop(mediaQuery.matches)

		handleViewportChange()
		mediaQuery.addEventListener('change', handleViewportChange)

		return () => mediaQuery.removeEventListener('change', handleViewportChange)
	}, [])

	useEffect(() => {
		if (!isMobileViewport) {
			mobilePanelX.jump(0)
			return
		}

		const controls = animate(
			mobilePanelX,
			isMobilePanelVisible ? getMobileDrawerWidth() : 0,
			mobileDrawerSpring,
		)

		if (!isMobilePanelVisible) {
			void controls.then(() => setIsMobileDrawerRevealed(false))
		}

		return controls.stop
	}, [isMobilePanelVisible, isMobileViewport, mobilePanelX])

	useEffect(() => {
		if (!isMobilePanelVisible) return

		const previousBodyOverflow = document.body.style.overflow
		const previousRootOverflow = document.documentElement.style.overflow
		document.body.style.overflow = 'hidden'
		document.documentElement.style.overflow = 'hidden'

		return () => {
			document.body.style.overflow = previousBodyOverflow
			document.documentElement.style.overflow = previousRootOverflow
		}
	}, [isMobilePanelVisible])
	const project = projects.find((project) => project.id === active)
	const visibleProjects = projects.filter((project) => project.id !== draggedProjectId)
	function closeMobileProjects() {
		setIsMobileProjectsOpen(false)
		setAccountOpen(false)
	}

	function toggleMobileProjects() {
		setIsMobileProjectsOpen((open) => {
			if (!open) setIsMobileDrawerRevealed(true)
			return !open
		})
	}

	function getMobileDrawerWidth() {
		return Math.min(window.innerWidth * 0.78, 384)
	}

	function isDrawerDragExcludedTarget(target: EventTarget | null) {
		return (
			target instanceof Element &&
			Boolean(target.closest('button, a, input, textarea, select, [data-no-drawer-drag]'))
		)
	}

	function handleMobilePanelPointerDown(event: React.PointerEvent<HTMLElement>) {
		if (
			!isMobileViewport ||
			event.pointerType !== 'touch' ||
			(!isMobilePanelVisible && event.clientX > 32) ||
			isDrawerDragExcludedTarget(event.target)
		) {
			return
		}

		mobileDrawerDrag.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			initialOffset: isMobilePanelVisible ? getMobileDrawerWidth() : 0,
			axis: 'pending',
			isDragging: false,
		}
		mobilePanelX.jump(mobilePanelX.get())
	}

	function handleMobilePanelPointerMove(event: React.PointerEvent<HTMLElement>) {
		const drag = mobileDrawerDrag.current
		if (!drag || drag.pointerId !== event.pointerId) return

		const horizontalDistance = event.clientX - drag.startX
		const verticalDistance = event.clientY - drag.startY

		if (drag.axis === 'pending') {
			if (Math.max(Math.abs(horizontalDistance), Math.abs(verticalDistance)) < 8) {
				return
			}

			if (Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) {
				mobileDrawerDrag.current = null
				return
			}

			if (!isMobilePanelVisible && horizontalDistance < 0) {
				mobileDrawerDrag.current = null
				return
			}

			drag.axis = 'horizontal'
			drag.isDragging = true
			setIsMobileDrawerRevealed(true)
			event.currentTarget.setPointerCapture(event.pointerId)
		}

		const drawerWidth = getMobileDrawerWidth()
		const nextOffset = Math.min(
			drawerWidth,
			Math.max(0, drag.initialOffset + horizontalDistance),
		)
		mobilePanelX.set(nextOffset)
	}

	function handleMobilePanelPointerEnd(event: React.PointerEvent<HTMLElement>) {
		const drag = mobileDrawerDrag.current
		if (!drag || drag.pointerId !== event.pointerId) return

		mobileDrawerDrag.current = null

		if (!drag.isDragging) return

		const drawerWidth = getMobileDrawerWidth()
		const finalOffset =
			event.type === 'pointercancel'
				? drag.initialOffset
				: Math.min(
						drawerWidth,
						Math.max(0, drag.initialOffset + event.clientX - drag.startX),
					)
		const shouldOpen = finalOffset >= drawerWidth / 2
		setIsMobileProjectsOpen(shouldOpen)
		void animate(mobilePanelX, shouldOpen ? drawerWidth : 0, mobileDrawerSpring)
	}

	function selectProject(projectId: string) {
		setActive(projectId)
		setWorkspaceView('board')
		closeMobileProjects()
	}

	function handleProjectOrderEnd(
		{ active, over }: DragEndEvent,
		insertionIndex?: number,
	) {
		if (!over && insertionIndex === undefined) return
		if (insertionIndex === undefined && active.id === over?.id) return

		const previousProjects = projects
		const oldIndex = previousProjects.findIndex((project) => project.id === active.id)
		const newIndex =
			insertionIndex ?? previousProjects.findIndex((project) => project.id === over?.id)
		if (oldIndex < 0 || newIndex < 0) return
		if (oldIndex === newIndex) return

		const orderedProjects = arrayMove(previousProjects, oldIndex, newIndex)
		const revision = projectOrderRevision.current + 1
		projectOrderRevision.current = revision
		setProjects(orderedProjects)
		projectOrderQueue.current = projectOrderQueue.current
			.catch(() => undefined)
			.then(async () => {
				try {
					await api(
						'/projects/order',
						json('PUT', {
							project_ids: orderedProjects.map((project) => project.id),
						}),
					)
				} catch (error) {
					if (projectOrderRevision.current === revision) {
						setProjects(previousProjects)
						setError(
							error instanceof Error ? error.message : 'Unable to save project order.',
						)
					}
				}
			})
	}

	function handleProjectDragStart({ active }: DragStartEvent) {
		const activeId = String(active.id)
		const activeIndex = projects.findIndex((project) => project.id === activeId)

		hasProjectDragMoved.current = false
		setDraggedProjectId(activeId)
		dropProjectIndexRef.current = activeIndex >= 0 ? activeIndex : null
		setDropProjectIndex(dropProjectIndexRef.current)
		setActiveProject(projects[activeIndex] ?? null)
		setActiveProjectWidth(
			document.querySelector<HTMLElement>(`[data-project-id="${active.id}"]`)
				?.offsetWidth ?? null,
		)
		setActiveProjectHeight(
			document.querySelector<HTMLElement>(`[data-project-id="${active.id}"]`)
				?.offsetHeight ?? null,
		)
	}

	function clearProjectDropTrace() {
		hasProjectDragMoved.current = false
		setDraggedProjectId(null)
		dropProjectIndexRef.current = null
		setDropProjectIndex(null)
		setActiveProject(null)
		setActiveProjectWidth(null)
		setActiveProjectHeight(null)
	}

	function handleProjectDragEnd(event: DragEndEvent) {
		const didMove = hasProjectDragMoved.current
		const insertionIndex = dropProjectIndexRef.current
		clearProjectDropTrace()
		if (didMove && insertionIndex !== null) {
			handleProjectOrderEnd(event, insertionIndex)
		}
	}

	function handleProjectDragMove({ active, delta }: DragMoveEvent) {
		if (!hasProjectDragMoved.current) {
			if (Math.abs(delta.y) < 2) return
			hasProjectDragMoved.current = true
		}
		const draggedRect = active.rect.current.translated
		if (!projectList || !draggedRect) return

		const pointerY = draggedRect.top + draggedRect.height / 2
		const traceRect = projectList
			.querySelector<HTMLElement>('.workspace-project-drop-trace')
			?.getBoundingClientRect()
		if (traceRect && pointerY >= traceRect.top && pointerY <= traceRect.bottom) return

		const projectItems = Array.from(
			projectList.querySelectorAll<HTMLElement>('[data-project-id]'),
		)
		// O(n): find the first remaining project row after the dragged card's midpoint.
		const nextItem = projectItems.find((item) => {
			const itemRect = item.getBoundingClientRect()
			return pointerY <= itemRect.top + itemRect.height / 2
		})
		const insertionIndex = nextItem
			? visibleProjects.findIndex((project) => project.id === nextItem.dataset.projectId)
			: visibleProjects.length
		if (insertionIndex < 0) return

		dropProjectIndexRef.current = insertionIndex
		setDropProjectIndex(insertionIndex)
	}

	function openArchive() {
		setWorkspaceView('archived')
		closeMobileProjects()
		void loadArchived()
	}

	async function createEmptyProject() {
		if (isCreatingProject || loading || projectsLoadError) return
		setIsCreatingProject(true)
		try {
			const created = await api<Project>(
				'/projects',
				json('POST', { name: 'New Project' }),
			)
			setProjects((previous) => [...previous, created])
			setActive(created.id)
			setWorkspaceView('board')
			closeMobileProjects()
			setError('')
			setProjectsLoadError(null)
		} catch (error) {
			setError(error instanceof Error ? error.message : 'Unable to create a new project.')
		} finally {
			setIsCreatingProject(false)
		}
	}

	async function restore(project: Project) {
		await api(`/projects/${project.id}`, json('PATCH', { archived: false }))
		toast.success('Project restored')
		await Promise.all([load(), loadArchived()])
		setActive(project.id)
	}

	async function deleteArchivedProject(project: Project) {
		await api(`/projects/${project.id}`, json('DELETE'))
		toast.success('Project deleted')
		await loadArchived()
	}

	return (
		<div className="workspace-shell min-h-screen max-md:overflow-x-clip">
			<aside
				onMouseEnter={() => {
					if (!isWideDesktop && isSidebarCollapsed) setIsSidebarHoverExpanded(true)
				}}
				onMouseLeave={() => {
					if (isWideDesktop) return
					setIsSidebarHoverExpanded(false)
					setIsSidebarCollapsed(true)
					setAccountOpen(false)
				}}
				className={`workspace-sidebar fixed inset-y-0 left-0 z-40 hidden h-dvh flex-col border-r border-border bg-[#161b22] transition-[width] duration-200 md:flex ${sidebarCollapsed ? 'w-16' : 'w-64'}`}
			>
				<div className="workspace-sidebar-brand flex h-16 items-center justify-start gap-5.5 border-b border-border pl-[21px] pr-5 text-base font-semibold tracking-tight">
					<Layers3 size={22} className="shrink-0 text-primary" />
					<span className={sidebarLabelClass}>DevBoard</span>
				</div>
				<div className="workspace-sidebar-content flex min-h-0 flex-1 flex-col p-2">
					{!projectsLoadError && (
						<div className="workspace-projects-header mb-2 flex items-center justify-start">
							<Button
								className={`workspace-sidebar-create flex w-full items-center justify-start ${sidebarItemGapClass} rounded-md border border-primary/60 bg-primary/10 py-2 !px-1.5 text-left text-primary hover:bg-primary/20 hover:text-primary ${loading ? 'cursor-not-allowed' : ''}`}
								variant="ghost"
								aria-label={loading ? 'Loading projects' : 'New project'}
								disabled={isCreatingProject || loading}
								onClick={() => void createEmptyProject()}
							>
								{loading ? (
									<>
										<span className="workspace-sidebar-create-icon-skeleton flex w-8 shrink-0 items-center justify-center">
											<span className="h-4 w-4 animate-pulse rounded bg-primary/45" />
										</span>
										{!sidebarCollapsed && (
											<span className="workspace-sidebar-create-label-skeleton h-3 flex-1 animate-pulse rounded bg-primary/45" />
										)}
									</>
								) : (
									<>
										<span className="workspace-sidebar-icon flex w-8 shrink-0 items-center justify-center">
											<Plus size={17} />
										</span>
										<span className={`truncate ${sidebarLabelClass}`}>New Project</span>
									</>
								)}
							</Button>
						</div>
					)}
					<nav
						aria-label="Projects"
						className="workspace-project-list -mr-2 min-h-0 flex-1 overflow-y-auto pr-2"
					>
						{loading ? (
							<SidebarProjectSkeletons collapsed={sidebarCollapsed} />
						) : (
							<DndContext
								collisionDetection={closestCenter}
								modifiers={[restrictProjectDragToList]}
								onDragCancel={clearProjectDropTrace}
								onDragEnd={handleProjectDragEnd}
								onDragMove={handleProjectDragMove}
								onDragStart={handleProjectDragStart}
								sensors={projectSensors}
							>
								<div
									ref={setProjectList}
									className="workspace-project-sort-list space-y-1"
								>
									<SortableContext
										items={projects.map((project) => project.id)}
										strategy={verticalListSortingStrategy}
									>
										{visibleProjects.map((item, index) => (
											<Fragment key={item.id}>
												{dropProjectIndex === index && (
													<ProjectDropTrace
														height={activeProjectHeight}
														project={activeProject}
													/>
												)}
												<SortableProjectLink
													project={item}
													isActive={workspaceView === 'board' && active === item.id}
													isProjectListDragging={Boolean(draggedProjectId)}
													onSelect={() => selectProject(item.id)}
													variant="sidebar"
													itemGapClass={sidebarItemGapClass}
													labelClass={sidebarLabelClass}
												/>
											</Fragment>
										))}
										{dropProjectIndex === visibleProjects.length && (
											<ProjectDropTrace
												height={activeProjectHeight}
												project={activeProject}
											/>
										)}
									</SortableContext>
								</div>
								<DragOverlay adjustScale={false} dropAnimation={null}>
									{activeProject ? (
										<ProjectDragPreview
											project={activeProject}
											width={activeProjectWidth}
											height={activeProjectHeight}
											isHidden
										/>
									) : null}
								</DragOverlay>
							</DndContext>
						)}
					</nav>
					<div className="workspace-sidebar-footer mt-auto border-t border-border pt-3">
						<button
							onClick={openArchive}
							className={`workspace-archive-link flex w-full items-center justify-start ${sidebarItemGapClass} rounded-md py-2 px-2 text-left text-sm transition-colors ${workspaceView === 'archived' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
						>
							<span className="workspace-sidebar-icon flex w-8 shrink-0 items-center justify-center">
								<Archive size={15} />
							</span>
							<span className={sidebarStaticLabelClass}>Archived projects</span>
						</button>
						<div ref={sidebarAccountRef} className="workspace-account mt-2">
							<AccountMenu
								email={email}
								open={accountOpen}
								close={() => setAccountOpen(false)}
								reportError={setError}
								containerRef={sidebarAccountRef}
								variant="sidebar"
							/>
							<button
								type="button"
								className={`workspace-account-trigger flex w-full items-center justify-start ${sidebarItemGapClass} rounded-md py-2 px-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground`}
								aria-label="Account"
								onClick={() => setAccountOpen((open) => !open)}
							>
								<span className="workspace-sidebar-icon flex w-8 shrink-0 items-center justify-center">
									<CircleUserRound size={17} />
								</span>
								<span className={`truncate ${sidebarStaticLabelClass}`}>Account</span>
							</button>
						</div>
					</div>
				</div>
			</aside>
			<MobileProjectDrawer
				email={email}
				projects={projects}
				activeProjectId={active}
				isOpen={isMobilePanelVisible}
				isLoading={loading}
				isCreatingProject={isCreatingProject}
				canCreateProjects={!projectsLoadError}
				isAccountOpen={accountOpen}
				onCreateProject={() => void createEmptyProject()}
				onSelectProject={selectProject}
				onReorderProjects={handleProjectOrderEnd}
				onOpenArchive={openArchive}
				onToggleAccount={() => setAccountOpen((open) => !open)}
				onCloseAccount={() => setAccountOpen(false)}
				onReportError={setError}
			/>
			{!isMobileDrawerRevealed && (
				<div
					aria-hidden="true"
					className="workspace-mobile-drawer-cover fixed inset-0 z-[25] bg-background md:hidden"
				/>
			)}
			<motion.main
				style={isMobileViewport ? { x: mobilePanelX } : undefined}
				onPointerDown={handleMobilePanelPointerDown}
				onPointerMove={handleMobilePanelPointerMove}
				onPointerUp={handleMobilePanelPointerEnd}
				onPointerCancel={handleMobilePanelPointerEnd}
				className={`workspace-main flex min-h-screen min-w-0 flex-1 flex-col max-md:touch-pan-y max-md:relative max-md:z-30 max-md:bg-background md:h-dvh md:min-h-0 md:overflow-x-hidden md:overflow-y-auto ${isWideDesktop ? 'md:ml-64 md:w-[calc(100%-16rem)]' : 'md:ml-16 md:w-[calc(100%-4rem)]'} ${isMobilePanelVisible ? 'overflow-hidden shadow-2xl' : ''}`}
			>
				<header className="workspace-mobile-header relative z-20 md:hidden">
					<div className="workspace-mobile-bar relative flex min-h-16 items-center justify-center px-4">
						<Button
							asChild
							className="workspace-mobile-project-menu absolute left-4 !h-10 !w-10 rounded-full border border-border bg-[#21262d] shadow-sm hover:bg-accent"
							variant="ghost"
							size="icon"
						>
							<motion.button
								type="button"
								aria-label={isMobilePanelVisible ? 'Close projects' : 'Open projects'}
								aria-controls="mobile-project-drawer"
								aria-expanded={isMobileProjectsOpen}
								onClick={toggleMobileProjects}
								whileTap={{ scale: 0.9 }}
								transition={mobileButtonTapTransition}
							>
								<Menu size={19} />
							</motion.button>
						</Button>
						<div className="workspace-brand pointer-events-none flex items-center">
							<Layers3 size={22} className="text-primary" aria-label="DevBoard" />
						</div>
					</div>
				</header>
				{isMobilePanelVisible && (
					<div
						aria-hidden="true"
						className="workspace-mobile-panel-scrim absolute inset-0 z-10 bg-black/55 md:hidden"
					/>
				)}
				{error && !projectsLoadError && (
					<div
						role="alert"
						className="workspace-error m-6 flex items-center gap-4 rounded-lg border border-rose-900 bg-rose-950/20 p-4 text-rose-200"
					>
						{error}
						<Button
							className="workspace-error-retry"
							variant="outline"
							onClick={() => void load()}
						>
							Retry
						</Button>
					</div>
				)}
				{loading ? (
					<ProjectViewSkeleton />
				) : projectsLoadError ? (
					<div className="workspace-project-load-error flex min-h-[65vh] flex-col items-center justify-center p-8 text-center">
						<CircleAlert size={32} className="mb-5 text-rose-300" />
						<h1 className="text-xl font-semibold">Unable to load projects</h1>
						<p className="mb-1 mt-2 max-w-sm text-sm text-muted-foreground">
							{projectsLoadError.message}
						</p>
						<p className="workspace-project-load-error-code mb-6 text-xs font-medium tracking-wide text-muted-foreground">
							Error code: {projectsLoadError.code}
						</p>
						<Button onClick={() => void load()}>Retry</Button>
					</div>
				) : workspaceView === 'archived' ? (
					<motion.div
						key="archive"
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.2 }}
						className="workspace-archive-panel p-6 md:p-8"
					>
						<h1 className="mb-7 text-2xl font-semibold tracking-tight">
							Archived projects
						</h1>
						{archiveLoading ? (
							<div
								className="workspace-archive-skeleton grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
								role="status"
								aria-label="Loading archived projects"
							>
								{Array.from({ length: 3 }, (_, index) => (
									<div
										key={index}
										aria-hidden="true"
										className="h-32 animate-pulse rounded-lg border border-border bg-muted/10 p-5"
									>
										<div className="h-4 w-3/5 rounded bg-muted-foreground/20" />
										<div className="mt-3 h-3 w-4/5 rounded bg-muted-foreground/15" />
									</div>
								))}
								<span className="sr-only">Loading archived projects</span>
							</div>
						) : archivedProjects.length === 0 ? (
							<div className="flex min-h-[calc(100dvh-14rem)] items-center justify-center text-sm text-muted-foreground">
								No archived projects.
							</div>
						) : (
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
								{archivedProjects.map((item) => (
									<div
										key={item.id}
										className="rounded-lg border border-border bg-[#161b22] p-5"
									>
										<h2 className="text-base font-semibold">{item.name}</h2>
										<div className="mt-5 flex justify-end gap-1">
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Restore ${item.name}`}
												onClick={() => void restore(item)}
											>
												<RotateCcw size={15} />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-rose-300"
												aria-label={`Delete ${item.name}`}
												onClick={() => setArchivedToDelete(item)}
											>
												<Trash2 size={15} />
											</Button>
										</div>
									</div>
								))}
							</div>
						)}
					</motion.div>
				) : (
					<div className="workspace-board-panel">
						{project ? (
							<ProjectView
								key={project.id}
								project={project}
								update={(updated) =>
									setProjects((previous) =>
										previous.map((project) =>
											project.id === updated.id ? updated : project,
										),
									)
								}
								refresh={async () => {
									await Promise.all([load(), loadArchived()])
								}}
							/>
						) : (
							<div className="workspace-empty-projects flex min-h-[65vh] flex-col items-center justify-center p-8 text-center">
								<FolderKanban size={32} className="mb-5 text-primary" />
								<h1 className="text-xl font-semibold">Make room for your next idea</h1>
								<p className="mb-6 mt-2 max-w-sm text-sm text-muted-foreground">
									Create a project, add a few tasks, and take it one step at a time.
								</p>
								<Button
									disabled={isCreatingProject}
									onClick={() => void createEmptyProject()}
								>
									<Plus size={15} />
									Create your first project
								</Button>
							</div>
						)}
					</div>
				)}
			</motion.main>
			<ConfirmDialog
				open={Boolean(archivedToDelete)}
				onOpenChange={(open) => !open && setArchivedToDelete(null)}
				title="Delete project?"
				description={`This will permanently delete "${archivedToDelete?.name ?? 'this project'}" and all of its tasks.`}
				confirmLabel="Delete project"
				onConfirm={async () => {
					if (archivedToDelete) await deleteArchivedProject(archivedToDelete)
				}}
			/>
		</div>
	)
}
