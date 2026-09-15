import { Fragment, useRef, useState } from 'react'
import {
	closestCenter,
	DndContext,
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
import { motion, useReducedMotion } from 'motion/react'
import { Archive, CircleUserRound, Layers3, Plus } from 'lucide-react'
import type { Project } from '@/lib/types'
import { Button } from '../ui/button'
import { AccountMenu } from './account-menu'
import {
	createProjectListDragConstraint,
	SidebarProjectSkeletons,
	SortableProjectLink,
	ProjectDropTrace,
} from './project-navigation'
import { mobileButtonTapTransition } from './use-mobile-sidebar'
const MotionButton = motion.create(Button)

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
	onReorderProjects: (event: DragEndEvent, insertionIndex?: number) => void
	onOpenArchive: () => void
	onToggleAccount: () => void
	onCloseAccount: () => void
	onReportError: (message: string) => void
}

export function MobileProjectDrawer({
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
	const prefersReducedMotion = useReducedMotion()
	const accountRef = useRef<HTMLDivElement>(null)
	const [projectList, setProjectList] = useState<HTMLDivElement | null>(null)
	const [dragPreview, setDragPreview] = useState<{
		project: Project
		height: number
		top: number
	} | null>(null)
	const [dropProjectIndex, setDropProjectIndex] = useState<number | null>(null)
	const dropProjectIndexRef = useRef<number | null>(null)
	const previousDragDeltaY = useRef(0)
	const draggedProjectIndex = projects.findIndex(
		(project) => project.id === dragPreview?.project.id,
	)
	const visibleProjects = projects.filter(
		(project) => project.id !== dragPreview?.project.id,
	)
	const restrictProjectDragToList = createProjectListDragConstraint(projectList)
	const projectSensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	)
	function handleProjectDragStart({ active }: DragStartEvent) {
		previousDragDeltaY.current = 0
		const index = projects.findIndex((project) => project.id === active.id)
		const project = projects[index]
		const source = projectList?.children[index] as HTMLElement | undefined
		const rect = source?.getBoundingClientRect()
		if (!project || !source || !rect) return
		setDragPreview({
			project,
			height: rect.height,
			top: source.offsetTop,
		})
		dropProjectIndexRef.current = index
		setDropProjectIndex(index)
	}
	function handleProjectDragMove({ active, delta }: DragMoveEvent) {
		const movementY = delta.y - previousDragDeltaY.current
		previousDragDeltaY.current = delta.y
		const draggedRect = active.rect.current.translated
		const currentIndex = dropProjectIndexRef.current
		if (!projectList || !draggedRect || currentIndex === null || movementY === 0) return
		const rows = Array.from(
			projectList.querySelectorAll<HTMLElement>('[data-project-id]'),
		)
		let insertionIndex = currentIndex
		// O(n): advance the gap when the leading card edge reaches a row in the movement direction.
		// Ignore rows on the other side of the gap so shifting a row cannot reverse the collision.
		if (movementY < 0) {
			for (let index = 0; index < currentIndex; index += 1) {
				if (draggedRect.top <= rows[index].getBoundingClientRect().bottom) {
					insertionIndex = index
					break
				}
			}
		} else {
			for (let index = currentIndex; index < rows.length; index += 1) {
				if (draggedRect.bottom < rows[index].getBoundingClientRect().top) break
				insertionIndex = index + 1
			}
		}
		if (insertionIndex === currentIndex) return
		dropProjectIndexRef.current = insertionIndex
		setDropProjectIndex(insertionIndex)
	}
	function clearProjectDropTrace() {
		setDragPreview(null)
		dropProjectIndexRef.current = null
		setDropProjectIndex(null)
	}
	function handleProjectDragEnd(event: DragEndEvent) {
		const insertionIndex = dropProjectIndexRef.current
		clearProjectDropTrace()
		if (insertionIndex !== null) onReorderProjects(event, insertionIndex)
	}
	return (
		<aside
			id="mobile-project-drawer"
			aria-hidden={!isOpen}
			inert={!isOpen}
			className="sidebar-panel-mobile-drawer fixed inset-y-0 left-0 z-20 flex w-[78%] max-w-sm flex-col bg-[#161b22] md:hidden"
		>
			<header className="sidebar-panel-mobile-drawer-header flex h-16 shrink-0 items-center px-5">
				<div className="sidebar-panel-mobile-drawer-brand flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
					<Layers3 size={23} className="text-primary" />
					DevBoard
				</div>
				<div
					ref={accountRef}
					className="sidebar-panel-mobile-drawer-account relative ml-auto"
				>
					<Button
						asChild
						className="sidebar-panel-mobile-drawer-account-trigger !h-10 !w-10 rounded-full border border-border bg-[#21262d] shadow-sm hover:bg-accent"
						variant="ghost"
						size="icon"
					>
						<motion.button
							type="button"
							aria-label="Account"
							aria-expanded={isAccountOpen}
							onClick={onToggleAccount}
							whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
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
			<div className="sidebar-panel-mobile-drawer-content flex min-h-0 flex-1 flex-col p-3">
				<nav
					aria-label="Projects"
					className="sidebar-panel-mobile-drawer-project-list relative -mr-3 min-h-0 flex-1"
				>
					<div className="sidebar-panel-mobile-drawer-project-scroll h-full overflow-y-auto pb-12 pr-3">
						{isLoading ? (
							<SidebarProjectSkeletons collapsed={false} />
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
									className="sidebar-panel-mobile-project-sort-list relative flex flex-col gap-1"
								>
									<SortableContext
										items={projects.map((project) => project.id)}
										strategy={verticalListSortingStrategy}
									>
										{projects.map((project, index) => {
											const isDragSource = dragPreview?.project.id === project.id
											const visibleIndex =
												draggedProjectIndex >= 0 && index > draggedProjectIndex
													? index - 1
													: index
											return (
												<Fragment key={project.id}>
													{!isDragSource && dropProjectIndex === visibleIndex && (
														<ProjectDropTrace
															height={dragPreview?.height ?? null}
															project={dragPreview?.project ?? null}
															variant="drawer"
														/>
													)}
													<SortableProjectLink
														project={project}
														isActive={activeProjectId === project.id}
														isDragSource={isDragSource}
														dragSourceTop={dragPreview?.top}
														isProjectListDragging={Boolean(dragPreview)}
														onSelect={() => onSelectProject(project.id)}
														variant="drawer"
													/>
												</Fragment>
											)
										})}
										{dropProjectIndex === visibleProjects.length && (
											<ProjectDropTrace
												height={dragPreview?.height ?? null}
												project={dragPreview?.project ?? null}
												variant="drawer"
											/>
										)}
									</SortableContext>
								</div>
							</DndContext>
						)}
					</div>
					{canCreateProjects && (
						<Button
							asChild
							className="sidebar-panel-mobile-drawer-create absolute bottom-3 left-3 z-10 !h-9 rounded-full px-3 text-sm shadow-lg"
							size="sm"
						>
							<motion.button
								type="button"
								disabled={isCreatingProject || isLoading}
								onClick={onCreateProject}
								whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
								transition={mobileButtonTapTransition}
							>
								<Plus size={15} />
								New Project
							</motion.button>
						</Button>
					)}
				</nav>
				<footer className="sidebar-panel-mobile-drawer-footer mt-auto border-t border-border pt-3">
					<MotionButton
						whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
						transition={mobileButtonTapTransition}
						className="sidebar-panel-mobile-drawer-archive w-full justify-start text-[15px]"
						variant="ghost"
						onClick={onOpenArchive}
					>
						<Archive size={18} />
						Archived projects
					</MotionButton>
				</footer>
			</div>
		</aside>
	)
}
