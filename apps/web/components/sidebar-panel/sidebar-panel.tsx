import { DesktopSidebar, type DesktopSidebarProps } from './desktop-sidebar'
import { MobileProjectDrawer } from './mobile-project-drawer'

interface SidebarPanelProps extends DesktopSidebarProps {
	isMobileOpen: boolean
	isMobileDrawerRevealed: boolean
}

export function SidebarPanel({
	isMobileOpen,
	isMobileDrawerRevealed,
	...props
}: SidebarPanelProps) {
	return (
		<>
			<DesktopSidebar {...props} />
			<MobileProjectDrawer
				email={props.email}
				projects={props.projects}
				activeProjectId={props.activeProjectId}
				isOpen={isMobileOpen}
				isLoading={props.isLoading}
				isCreatingProject={props.isCreatingProject}
				canCreateProjects={props.canCreateProjects}
				isAccountOpen={props.isAccountOpen}
				onCreateProject={() => void props.onCreateProject()}
				onSelectProject={props.onSelectProject}
				onReorderProjects={props.onReorderProjects}
				onOpenArchive={props.onOpenArchive}
				onToggleAccount={props.onToggleAccount}
				onCloseAccount={props.onCloseAccount}
				onReportError={props.onReportError}
			/>
			{!isMobileDrawerRevealed && (
				<div
					aria-hidden="true"
					className="sidebar-panel-mobile-drawer-cover fixed inset-0 z-[25] bg-background md:hidden"
				/>
			)}
		</>
	)
}
