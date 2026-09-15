'use client'

import { useCallback, useState } from 'react'
import { useProjects } from '@/hooks/use-projects'
import { SidebarPanel } from './sidebar-panel/sidebar-panel'
import { useMobileSidebar } from './sidebar-panel/use-mobile-sidebar'
import { ProjectPanel } from './project-panel/project-panel'

export function Dashboard({ email }: { email: string }) {
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
	} = useProjects()
	const [projectPanelView, setProjectPanelView] = useState<'board' | 'archived'>('board')
	const [accountOpen, setAccountOpen] = useState(false)
	const [hasInitialProjectLoadFinished, setHasInitialProjectLoadFinished] =
		useState(false)
	const handleInitialProjectLoadComplete = useCallback(() => {
		setHasInitialProjectLoadFinished(true)
	}, [])
	const mobileSidebar = useMobileSidebar(() => setAccountOpen(false))
	const { isMobilePanelVisible, isMobileDrawerRevealed, closeMobileProjects } =
		mobileSidebar

	const project = projects.find((project) => project.id === active)
	const isSidebarLoading = loading || (Boolean(project) && !hasInitialProjectLoadFinished)
	function selectProject(projectId: string) {
		setActive(projectId)
		setProjectPanelView('board')
		closeMobileProjects()
	}

	function openArchive() {
		setProjectPanelView('archived')
		closeMobileProjects()
		void loadArchived()
	}

	async function createEmptyProject() {
		const created = await createProject()
		if (created) {
			setProjectPanelView('board')
			closeMobileProjects()
		}
	}

	return (
		<div className="dashboard min-h-screen max-md:overflow-x-clip">
			<SidebarPanel
				email={email}
				projects={projects}
				activeProjectId={active}
				isMobileOpen={isMobilePanelVisible}
				isMobileDrawerRevealed={isMobileDrawerRevealed}
				isArchiveActive={projectPanelView === 'archived'}
				isLoading={isSidebarLoading}
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
			<ProjectPanel
				project={project}
				view={projectPanelView}
				archivedProjects={archivedProjects}
				archiveLoading={archiveLoading}
				isLoading={loading}
				isCreatingProject={isCreatingProject}
				error={error}
				projectsLoadError={projectsLoadError}
				mobileSidebar={mobileSidebar}
				onReload={load}
				onInitialProjectLoadComplete={handleInitialProjectLoadComplete}
				onCreateProject={createEmptyProject}
				onUpdateProject={updateProject}
				onRefreshProjects={async () => {
					await Promise.all([load(), loadArchived()])
				}}
				onRestoreProject={restore}
				onDeleteArchivedProject={deleteArchivedProject}
			/>
		</div>
	)
}
