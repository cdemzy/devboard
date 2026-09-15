import { motion } from 'motion/react'
import { CircleAlert, FolderKanban, Layers3, Menu, Plus } from 'lucide-react'
import type { AppErrorInfo } from '@/lib/errors'
import type { Project } from '@/lib/types'
import { Button } from '../ui/button'
import {
	mobileButtonTapTransition,
	type useMobileSidebar,
} from '../sidebar-panel/use-mobile-sidebar'
import { ArchivedProjectsPanel } from './archived-projects-panel'
import { ProjectView, ProjectViewSkeleton } from './project-view'

interface ProjectPanelProps {
	project: Project | undefined
	view: 'board' | 'archived'
	archivedProjects: Project[]
	archiveLoading: boolean
	isLoading: boolean
	isCreatingProject: boolean
	error: string
	projectsLoadError: AppErrorInfo | null
	isWideDesktop: boolean
	mobileSidebar: ReturnType<typeof useMobileSidebar>
	onReload: () => Promise<void>
	onCreateProject: () => Promise<void>
	onUpdateProject: (project: Project) => void
	onRefreshProjects: () => Promise<void>
	onRestoreProject: (project: Project) => Promise<void>
	onDeleteArchivedProject: (project: Project) => Promise<void>
}

export function ProjectPanel({
	project,
	view,
	archivedProjects,
	archiveLoading,
	isLoading,
	isCreatingProject,
	error,
	projectsLoadError,
	isWideDesktop,
	mobileSidebar,
	onReload,
	onCreateProject,
	onUpdateProject,
	onRefreshProjects,
	onRestoreProject,
	onDeleteArchivedProject,
}: ProjectPanelProps) {
	const {
		isMobileViewport,
		mobilePanelX,
		isMobilePanelVisible,
		isMobileProjectsOpen,
		toggleMobileProjects,
		handleMobilePanelPointerDown,
		handleMobilePanelPointerMove,
		handleMobilePanelPointerEnd,
	} = mobileSidebar
	return (
		<motion.main
			style={isMobileViewport ? { x: mobilePanelX } : undefined}
			onPointerDown={handleMobilePanelPointerDown}
			onPointerMove={handleMobilePanelPointerMove}
			onPointerUp={handleMobilePanelPointerEnd}
			onPointerCancel={handleMobilePanelPointerEnd}
			className={`project-panel flex min-h-screen min-w-0 flex-1 flex-col max-md:touch-pan-y max-md:relative max-md:z-30 max-md:bg-background md:h-dvh md:min-h-0 md:overflow-x-hidden md:overflow-y-auto ${isWideDesktop ? 'md:ml-64 md:w-[calc(100%-16rem)]' : 'md:ml-16 md:w-[calc(100%-4rem)]'} ${isMobilePanelVisible ? 'overflow-hidden shadow-2xl' : ''}`}
		>
			<header className="project-panel-mobile-header relative z-20 md:hidden">
				<div className="project-panel-mobile-bar relative flex min-h-16 items-center justify-center px-4">
					<Button
						asChild
						className="project-panel-mobile-project-menu absolute left-4 !h-10 !w-10 rounded-full border border-border bg-[#21262d] shadow-sm hover:bg-accent"
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
					<div className="project-panel-brand pointer-events-none flex items-center">
						<Layers3 size={22} className="text-primary" aria-label="DevBoard" />
					</div>
				</div>
			</header>
			{isMobilePanelVisible && (
				<div
					aria-hidden="true"
					className="project-panel-mobile-scrim absolute inset-0 z-10 bg-black/55 md:hidden"
				/>
			)}
			{error && !projectsLoadError && (
				<div
					role="alert"
					className="project-panel-error m-6 flex items-center gap-4 rounded-lg border border-rose-900 bg-rose-950/20 p-4 text-rose-200"
				>
					{error}
					<Button
						className="project-panel-error-retry"
						variant="outline"
						onClick={() => void onReload()}
					>
						Retry
					</Button>
				</div>
			)}
			{isLoading ? (
				<ProjectViewSkeleton />
			) : projectsLoadError ? (
				<div className="project-panel-load-error flex min-h-[65vh] flex-col items-center justify-center p-8 text-center">
					<CircleAlert size={32} className="mb-5 text-rose-300" />
					<h1 className="text-xl font-semibold">Unable to load projects</h1>
					<p className="mb-1 mt-2 max-w-sm text-sm text-muted-foreground">
						{projectsLoadError.message}
					</p>
					<p className="project-panel-load-error-code mb-6 text-xs font-medium tracking-wide text-muted-foreground">
						Error code: {projectsLoadError.code}
					</p>
					<Button onClick={() => void onReload()}>Retry</Button>
				</div>
			) : view === 'archived' ? (
				<ArchivedProjectsPanel
					archivedProjects={archivedProjects}
					archiveLoading={archiveLoading}
					restore={onRestoreProject}
					deleteArchivedProject={onDeleteArchivedProject}
				/>
			) : (
				<div className="project-panel-board">
					{project ? (
						<ProjectView
							key={project.id}
							project={project}
							update={onUpdateProject}
							refresh={onRefreshProjects}
						/>
					) : (
						<div className="project-panel-empty-projects flex min-h-[65vh] flex-col items-center justify-center p-8 text-center">
							<FolderKanban size={32} className="mb-5 text-primary" />
							<h1 className="text-xl font-semibold">Make room for your next idea</h1>
							<p className="mb-6 mt-2 max-w-sm text-sm text-muted-foreground">
								Create a project, add a few tasks, and take it one step at a time.
							</p>
							<Button disabled={isCreatingProject} onClick={() => void onCreateProject()}>
								<Plus size={15} />
								Create your first project
							</Button>
						</div>
					)}
				</div>
			)}
		</motion.main>
	)
}
