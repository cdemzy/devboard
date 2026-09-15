import { Fragment, useRef, useState } from 'react'
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
	type DragStartEvent,
} from '@dnd-kit/core'
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Archive, CircleUserRound, Layers3, Plus } from 'lucide-react'
import type { Project } from '@/lib/types'
import { Button } from '../ui/button'
import { AccountMenu } from './account-menu'
import {
	createProjectListDragConstraint,
	SidebarProjectSkeletons,
	SortableProjectLink,
	ProjectDropTrace,
	ProjectDragPreview,
} from './project-navigation'
export interface DesktopSidebarProps {
	email: string
	projects: Project[]
	activeProjectId: string | null
	isArchiveActive: boolean
	isWideDesktop: boolean
	isLoading: boolean
	isCreatingProject: boolean
	canCreateProjects: boolean
	isAccountOpen: boolean
	onCloseAccount: () => void
	onToggleAccount: () => void
	onReportError: (message: string) => void
	onCreateProject: () => Promise<void>
	onSelectProject: (id: string) => void
	onOpenArchive: () => void
	onReorderProjects: (event: DragEndEvent, insertionIndex?: number) => void
}
export function DesktopSidebar({
	email,
	projects,
	activeProjectId,
	isArchiveActive,
	isWideDesktop,
	isLoading,
	isCreatingProject,
	canCreateProjects,
	isAccountOpen,
	onCloseAccount,
	onToggleAccount,
	onReportError,
	onCreateProject,
	onSelectProject,
	onOpenArchive,
	onReorderProjects,
}: DesktopSidebarProps) {
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
	const [isSidebarHoverExpanded, setIsSidebarHoverExpanded] = useState(false)
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
	const projectSensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	)
	const restrictProjectDragToList = createProjectListDragConstraint(projectList)

	const visibleProjects = projects.filter((project) => project.id !== draggedProjectId)
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
			onReorderProjects(event, insertionIndex)
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
			.querySelector<HTMLElement>('.sidebar-panel-project-drop-trace')
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

	return (
		<aside
			onMouseEnter={() => {
				if (!isWideDesktop && isSidebarCollapsed) setIsSidebarHoverExpanded(true)
			}}
			onMouseLeave={() => {
				if (isWideDesktop) return
				setIsSidebarHoverExpanded(false)
				setIsSidebarCollapsed(true)
				onCloseAccount()
			}}
			className={`sidebar-panel fixed inset-y-0 left-0 z-40 hidden h-dvh flex-col border-r border-border bg-[#161b22] transition-[width] duration-200 md:flex ${sidebarCollapsed ? 'w-16' : 'w-64'}`}
		>
			<div className="sidebar-panel-brand flex h-16 items-center justify-start gap-5.5 border-b border-border pl-[21px] pr-5 text-base font-semibold tracking-tight">
				<Layers3 size={22} className="shrink-0 text-primary" />
				<span className={sidebarLabelClass}>DevBoard</span>
			</div>
			<div className="sidebar-panel-content flex min-h-0 flex-1 flex-col p-2">
				{canCreateProjects && (
					<div className="sidebar-panel-projects-header mb-2 flex items-center justify-start">
						<Button
							className={`sidebar-panel-create flex w-full items-center justify-start ${sidebarItemGapClass} rounded-md border border-primary/60 bg-primary/10 py-2 !px-1.5 text-left text-primary hover:bg-primary/20 hover:text-primary ${isLoading ? 'cursor-not-allowed' : ''}`}
							variant="ghost"
							aria-label={isLoading ? 'Loading projects' : 'New project'}
							disabled={isCreatingProject || isLoading}
							onClick={() => void onCreateProject()}
						>
							{isLoading ? (
								<>
									<span className="sidebar-panel-create-icon-skeleton flex w-8 shrink-0 items-center justify-center">
										<span className="h-4 w-4 animate-pulse rounded bg-primary/45" />
									</span>
									{!sidebarCollapsed && (
										<span className="sidebar-panel-create-label-skeleton h-3 flex-1 animate-pulse rounded bg-primary/45" />
									)}
								</>
							) : (
								<>
									<span className="sidebar-panel-icon flex w-8 shrink-0 items-center justify-center">
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
					className="sidebar-panel-project-list -mr-2 min-h-0 flex-1 overflow-y-auto pr-2"
				>
					{isLoading ? (
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
								className="sidebar-panel-project-sort-list space-y-1"
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
												isActive={!isArchiveActive && activeProjectId === item.id}
												isProjectListDragging={Boolean(draggedProjectId)}
												onSelect={() => onSelectProject(item.id)}
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
				<div className="sidebar-panel-footer mt-auto border-t border-border pt-3">
					<button
						onClick={onOpenArchive}
						className={`sidebar-panel-archive-link flex w-full items-center justify-start ${sidebarItemGapClass} rounded-md py-2 px-2 text-left text-sm transition-colors ${isArchiveActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
					>
						<span className="sidebar-panel-icon flex w-8 shrink-0 items-center justify-center">
							<Archive size={15} />
						</span>
						<span className={sidebarStaticLabelClass}>Archived projects</span>
					</button>
					<div ref={sidebarAccountRef} className="sidebar-panel-account mt-2">
						<AccountMenu
							email={email}
							open={isAccountOpen}
							close={onCloseAccount}
							reportError={onReportError}
							containerRef={sidebarAccountRef}
							variant="sidebar"
						/>
						<button
							type="button"
							className={`sidebar-panel-account-trigger flex w-full items-center justify-start ${sidebarItemGapClass} rounded-md py-2 px-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground`}
							aria-label="Account"
							onClick={onToggleAccount}
						>
							<span className="sidebar-panel-icon flex w-8 shrink-0 items-center justify-center">
								<CircleUserRound size={17} />
							</span>
							<span className={`truncate ${sidebarStaticLabelClass}`}>Account</span>
						</button>
					</div>
				</div>
			</div>
		</aside>
	)
}
