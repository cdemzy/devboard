import { useRef, type CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { FolderKanban, GripVertical } from 'lucide-react'
import type { Modifier } from '@dnd-kit/core'
import type { Project } from '@/lib/types'
export function createProjectListDragConstraint(
	projectList: HTMLElement | null,
): Modifier {
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

export function SidebarProjectSkeletons({ collapsed }: { collapsed: boolean }) {
	return (
		<div aria-label="Loading projects" className="space-y-1.5">
			{Array.from({ length: 10 }, (_, index) => (
				<div
					key={index}
					aria-hidden="true"
					className={`flex h-9 items-center justify-start rounded-md pl-2 pr-2 xl:gap-1.5 ${collapsed ? 'gap-0' : 'gap-1.5'}`}
				>
					<span className="flex w-8 shrink-0 items-center justify-center">
						<span className="h-4 w-4 animate-pulse rounded bg-muted-foreground/20" />
					</span>
					<span
						className={`sidebar-panel-project-label-skeleton h-3 flex-1 animate-pulse rounded bg-muted-foreground/20 ${collapsed ? 'hidden xl:block' : ''}`}
					/>
				</div>
			))}
		</div>
	)
}

interface SortableProjectLinkProps {
	project: Project
	isActive: boolean
	isCollapsed?: boolean
	onSelect: () => void
	variant: 'sidebar' | 'drawer'
	labelClass?: string
	itemGapClass?: string
	isDragSource?: boolean
	dragSourceTop?: number
	isProjectListDragging?: boolean
}

export function SortableProjectLink({
	project,
	isActive,
	isCollapsed = false,
	onSelect,
	variant,
	labelClass,
	itemGapClass,
	isDragSource = false,
	dragSourceTop,
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
		// Preserve the source geometry so drag measurements remain anchored to its origin.
		top: isDragSource ? dragSourceTop : undefined,
	}
	const isSidebar = variant === 'sidebar'
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
			data-project-id={isDragSource ? undefined : project.id}
			aria-hidden={isDragSource || undefined}
			className={`sidebar-panel-${variant}-project-link sidebar-panel-project-sortable-link group flex w-full items-center ${isDragSource ? 'sidebar-panel-project-drag-source absolute inset-x-0 pointer-events-none' : ''} ${isSidebar ? `justify-start ${itemGapClass}` : 'gap-2.5 px-3 py-2.5 text-[15px]'} rounded-md ${isSidebar ? 'py-2 px-1.5 text-sm' : ''} text-left transition-colors ${toneClass}`}
		>
			<button
				type="button"
				onClick={handleSelectClick}
				onPointerDown={handleSelectPointerDown}
				aria-label={isSidebar && !labelClass ? project.name : undefined}
				aria-current={isActive ? 'page' : undefined}
				className={`sidebar-panel-project-select-button flex min-w-0 flex-1 items-center touch-manipulation ${isSidebar ? itemGapClass : 'gap-2.5'} text-left`}
			>
				{isSidebar ? (
					<span className="sidebar-panel-icon flex w-8 shrink-0 items-center justify-center">
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
				className={`sidebar-panel-project-drag-handle flex shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-opacity touch-none cursor-grab active:cursor-grabbing ${isSidebar && isCollapsed ? 'max-xl:invisible' : ''} ${isSidebar ? `ml-auto p-0 ${isDragging ? 'opacity-100' : isProjectListDragging ? 'opacity-0' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}` : 'order-first h-7 w-7 opacity-100'}`}
				{...attributes}
				{...listeners}
			>
				<GripVertical aria-hidden="true" size={16} />
			</button>
		</div>
	)
}

export function ProjectDragPreview({
	project,
	width,
	height,
	isHidden = false,
	variant = 'sidebar',
}: {
	project: Project
	width: number | null
	height: number | null
	isHidden?: boolean
	variant?: 'sidebar' | 'drawer'
}) {
	const isDrawer = variant === 'drawer'
	const previewInset = isDrawer ? 0 : 3
	const previewStyle =
		width && height
			? {
					width: Math.max(width - previewInset * 2, 0),
					height: isDrawer ? height : height * 0.82,
					transform: `translate(${previewInset}px, ${isDrawer ? 0 : height * 0.09}px)`,
				}
			: undefined

	return (
		<div
			style={previewStyle}
			className={`sidebar-panel-project-drag-preview flex box-border items-center gap-2.5 rounded-md border border-primary/65 bg-[#21262d] ${isDrawer ? 'px-3 text-[15px]' : 'px-2.5 text-sm'} text-foreground shadow-xl ${isHidden ? 'opacity-0' : ''}`}
		>
			<FolderKanban size={15} className="shrink-0" />
			<span className="truncate">{project.name}</span>
			<GripVertical
				size={16}
				className={`shrink-0 text-muted-foreground ${isDrawer ? 'order-first w-7' : 'ml-auto'}`}
			/>
		</div>
	)
}

export function ProjectDropTrace({
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
			className="sidebar-panel-project-drop-trace box-border h-9 w-full rounded-md border border-dashed border-primary/55 bg-primary/5 p-[3px]"
		>
			{project && (
				<div className="sidebar-panel-project-drop-preview flex h-full items-center gap-2.5 rounded-sm bg-[#21262d] px-2.5 text-sm text-foreground shadow-xl">
					<FolderKanban size={15} className="shrink-0" />
					<span className="truncate">{project.name}</span>
					<GripVertical size={16} className="ml-auto shrink-0 text-muted-foreground" />
				</div>
			)}
		</div>
	)
}
