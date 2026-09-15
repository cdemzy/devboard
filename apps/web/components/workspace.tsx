'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { CircleAlert, FolderKanban, Layers3, Menu, Plus } from 'lucide-react'
import { ProjectView, ProjectViewSkeleton } from './project-view'
import { Button } from './ui/button'
import { ProjectSidebar } from './workspace/project-sidebar'
import { MobileProjectDrawer } from './workspace/mobile-project-drawer'
import { ArchivedProjectsPanel } from './workspace/archived-projects-panel'
import { useWorkspaceProjects } from './workspace/use-workspace-projects'
import {
	useMobileProjects,
	mobileButtonTapTransition,
} from './workspace/use-mobile-projects'

export function Workspace({ email }: { email: string }) {
	const {
		projects,
		updateProject,
		archivedProjects,
		active,
		setActive,
		archiveLoading,
		isCreatingProject,
		createProject,
		loading,
		error,
		setError,
		projectsLoadError,
		load,
		loadArchived,
		handleProjectOrderEnd,
		restore,
		deleteArchivedProject,
	} = useWorkspaceProjects()
	const [isWideDesktop, setIsWideDesktop] = useState(false)
	const [workspaceView, setWorkspaceView] = useState<'board' | 'projects' | 'archived'>(
		'board',
	)
	const [accountOpen, setAccountOpen] = useState(false)
	const {
		isMobileProjectsOpen,
		isMobileDrawerRevealed,
		isMobileViewport,
		isMobilePanelVisible,
		mobilePanelX,
		closeMobileProjects,
		toggleMobileProjects,
		handleMobilePanelPointerDown,
		handleMobilePanelPointerMove,
		handleMobilePanelPointerEnd,
	} = useMobileProjects(() => setAccountOpen(false))
	useEffect(() => {
		const mediaQuery = window.matchMedia('(min-width: 1280px)')
		const handleViewportChange = () => setIsWideDesktop(mediaQuery.matches)

		handleViewportChange()
		mediaQuery.addEventListener('change', handleViewportChange)

		return () => mediaQuery.removeEventListener('change', handleViewportChange)
	}, [])

	const project = projects.find((project) => project.id === active)
	function selectProject(projectId: string) {
		setActive(projectId)
		setWorkspaceView('board')
		closeMobileProjects()
	}

	function openArchive() {
		setWorkspaceView('archived')
		closeMobileProjects()
		void loadArchived()
	}

	async function createEmptyProject() {
		const created = await createProject()
		if (created) {
			setWorkspaceView('board')
			closeMobileProjects()
		}
	}

	return (
		<div className="workspace-shell min-h-screen max-md:overflow-x-clip">
			<ProjectSidebar
				email={email}
				projects={projects}
				activeProjectId={workspaceView === 'board' ? active : null}
				isArchiveActive={workspaceView === 'archived'}
				isWideDesktop={isWideDesktop}
				isLoading={loading}
				isCreatingProject={isCreatingProject}
				canCreateProjects={!projectsLoadError}
				isAccountOpen={accountOpen}
				onCloseAccount={() => setAccountOpen(false)}
				onToggleAccount={() => setAccountOpen((open) => !open)}
				onReportError={setError}
				onCreateProject={createEmptyProject}
				onSelectProject={selectProject}
				onOpenArchive={openArchive}
				onReorderProjects={handleProjectOrderEnd}
			/>
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
					<ArchivedProjectsPanel
						archivedProjects={archivedProjects}
						archiveLoading={archiveLoading}
						restore={restore}
						deleteArchivedProject={deleteArchivedProject}
					/>
				) : (
					<div className="workspace-board-panel">
						{project ? (
							<ProjectView
								key={project.id}
								project={project}
								update={updateProject}
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
		</div>
	)
}
