import { useCallback, useEffect, useRef, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
import { toast } from 'sonner'
import { api, json } from '@/lib/api'
import { getAppErrorInfo, type AppErrorInfo } from '@/lib/errors'
import type { Project } from '@/lib/types'
const projectsLoadErrorToastId = 'projects-load-error'

export function useWorkspaceProjects() {
	const [projects, setProjects] = useState<Project[]>([])
	const [archivedProjects, setArchivedProjects] = useState<Project[]>([])
	const [active, setActive] = useState<string | null>(null)
	const [archiveLoading, setArchiveLoading] = useState(false)
	const [isCreatingProject, setIsCreatingProject] = useState(false)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [projectsLoadError, setProjectsLoadError] = useState<AppErrorInfo | null>(null)
	const request = useRef(0)
	const projectOrderQueue = useRef(Promise.resolve())
	const projectOrderRevision = useRef(0)
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

	function handleProjectOrderEnd(
		{ active, over }: DragEndEvent,
		insertionIndex?: number,
	) {
		if (!over && insertionIndex === undefined) return
		if (insertionIndex === undefined && active.id === over?.id) return

		// O(n): locate and reorder projects, then serialize persistence in drag order.
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

	async function createProject() {
		if (isCreatingProject || loading || projectsLoadError) return
		setIsCreatingProject(true)
		try {
			const created = await api<Project>(
				'/projects',
				json('POST', { name: 'New Project' }),
			)
			setProjects((previous) => [...previous, created])
			setActive(created.id)
			setError('')
			setProjectsLoadError(null)
			return created
		} catch (error) {
			setError(error instanceof Error ? error.message : 'Unable to create a new project.')
		} finally {
			setIsCreatingProject(false)
		}
	}

	function updateProject(updated: Project) {
		// O(n): replace the updated project without changing navigation order.
		setProjects((previous) =>
			previous.map((project) => (project.id === updated.id ? updated : project)),
		)
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

	return {
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
	}
}
