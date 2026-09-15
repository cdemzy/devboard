import { useState } from 'react'
import { motion } from 'motion/react'
import { RotateCcw, Trash2 } from 'lucide-react'
import type { Project } from '@/lib/types'
import { Button } from '../ui/button'
import { ConfirmDialog } from '../ui/confirm-dialog'
interface ArchivedProjectsPanelProps {
	archivedProjects: Project[]
	archiveLoading: boolean
	restore: (project: Project) => Promise<void>
	deleteArchivedProject: (project: Project) => Promise<void>
}
export function ArchivedProjectsPanel({
	archivedProjects,
	archiveLoading,
	restore,
	deleteArchivedProject,
}: ArchivedProjectsPanelProps) {
	const [archivedToDelete, setArchivedToDelete] = useState<Project | null>(null)
	return (
		<>
			<motion.div
				key="archive"
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.2 }}
				className="project-panel-archive-panel p-6 md:p-8"
			>
				<h1 className="mb-7 text-2xl font-semibold tracking-tight">Archived projects</h1>
				{archiveLoading ? (
					<div
						className="project-panel-archive-skeleton grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
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
								className="project-panel-archive-project rounded-lg border border-border bg-[#161b22] p-5"
							>
								<h2 className="text-base font-semibold">{item.name}</h2>
								<div className="mt-5 flex justify-end gap-1">
									<Button
										variant="ghost"
										size="icon"
										className="project-panel-archive-restore"
										aria-label={`Restore ${item.name}`}
										onClick={() => void restore(item)}
									>
										<RotateCcw size={15} />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="project-panel-archive-delete text-rose-300"
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
		</>
	)
}
