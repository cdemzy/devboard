import { useRef, useState } from 'react'
import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragOverEvent,
	type DragStartEvent,
} from '@dnd-kit/core'
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { motion } from 'motion/react'
import { Archive, CircleUserRound, Layers3, Plus } from 'lucide-react'
import type { Project } from '@/lib/types'
import { Button } from '../ui/button'
import { AccountMenu } from './account-menu'
import {
	createProjectListDragConstraint,
	SidebarProjectSkeletons,
	SortableProjectLink,
} from './project-navigation'
import { mobileButtonTapTransition } from './use-mobile-sidebar'
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
								onDragOver={handleProjectDragOver}
								onDragStart={handleProjectDragStart}
								sensors={projectSensors}
							>
								<div
									ref={setProjectList}
									className="sidebar-panel-mobile-project-sort-list space-y-1"
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
							className="sidebar-panel-mobile-drawer-create absolute bottom-3 left-3 z-10 !h-9 rounded-full px-3 text-sm shadow-lg"
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
				<footer className="sidebar-panel-mobile-drawer-footer mt-auto border-t border-border pt-3">
					<Button
						className="sidebar-panel-mobile-drawer-archive w-full justify-start text-[15px]"
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
