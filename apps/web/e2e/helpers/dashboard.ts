import { expect, type Page } from '@playwright/test'
import type { Project, Task } from '../../lib/types'
import { moveTask } from '../../lib/board'

export function createProjects(names: string[], archived = false): Project[] {
	return names.map((name, position) => ({
		id: `project-${position + 1}`,
		owner_id: '00000000-0000-4000-8000-000000000001',
		name,
		ticket_prefix: 'DE',
		next_ticket_number: 1,
		description: '',
		tags: [],
		position,
		archived,
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z',
	}))
}

export async function openDashboard(
	page: Page,
	initialProjects: Project[] = [],
	options: { rejectProjectsLoad?: boolean } = {},
) {
	let orderRequests = 0
	let rejectOrder = false
	let rejectProjectsLoad = options.rejectProjectsLoad ?? false
	let rejectDelete = false
	const now = new Date().toISOString()
	const user = {
		id: '00000000-0000-4000-8000-000000000001',
		aud: 'authenticated',
		role: 'authenticated',
		email: 'dev@example.com',
		email_confirmed_at: now,
		app_metadata: {},
		user_metadata: {},
		created_at: now,
	}
	const token = {
		access_token: 'test-access-token',
		refresh_token: 'test-refresh-token',
		token_type: 'bearer',
		expires_in: 3600,
		user,
		setRejectProjectsLoad(value: boolean) {
			rejectProjectsLoad = value
		},
		setRejectDelete(value: boolean) {
			rejectDelete = value
		},
	}
	let projects: Project[] = initialProjects
	let tasks: Task[] = []
	let rejectMove = false
	await page.route('https://devboard-test.supabase.co/auth/v1/**', async (route) => {
		const path = new URL(route.request().url()).pathname
		await route.fulfill({
			json: path.endsWith('/logout') ? {} : path.endsWith('/user') ? user : token,
		})
	})
	await page.route('http://127.0.0.1:8001/**', async (route) => {
		const request = route.request()
		const url = new URL(request.url())
		const path = url.pathname
		const method = request.method()
		const body = request.postDataJSON()
		if (method === 'OPTIONS') {
			await route.fulfill({ status: 204 })
			return
		}
		if (method === 'GET' && path === '/projects') {
			if (rejectProjectsLoad) {
				await route.fulfill({
					status: 503,
					json: { detail: 'Projects temporarily unavailable' },
				})
				return
			}
			await route.fulfill({
				json: projects.filter(
					(p) => p.archived === (url.searchParams.get('archived') === 'true'),
				),
			})
			return
		}
		if (method === 'GET' && path === '/project-tags') {
			await route.fulfill({ json: [] })
			return
		}
		if (method === 'PUT' && path === '/projects/order') {
			orderRequests += 1
			if (rejectOrder) {
				await route.fulfill({ status: 503, json: { detail: 'Unable to save order' } })
				return
			}
			// O(n log n): apply persisted positions and return projects in saved order.
			const positions = new Map<string, number>(
				body.project_ids.map((id: string, index: number) => [id, index]),
			)
			projects = projects
				.map((project) => ({
					...project,
					position: positions.get(project.id) ?? project.position,
				}))
				.sort((a, b) => a.position - b.position)
			await route.fulfill({ status: 204 })
			return
		}
		if (method === 'POST' && path === '/projects') {
			const project = {
				id: `project-${projects.length + 1}`,
				owner_id: user.id,
				ticket_prefix: 'DE',
				next_ticket_number: 1,
				description: '',
				tags: [],
				position: 0,
				...body,
				archived: false,
				created_at: now,
				updated_at: now,
			}
			projects.push(project)
			await route.fulfill({ status: 201, json: project })
			return
		}
		if (path.startsWith('/projects/') && method === 'PATCH') {
			const index = projects.findIndex((project) => project.id === path.split('/')[2])
			projects[index] = { ...projects[index], ...body }
			await route.fulfill({ json: projects[index] })
			return
		}
		if (path.startsWith('/projects/') && method === 'DELETE') {
			if (rejectDelete) {
				await route.fulfill({ status: 503, json: { detail: 'Unable to delete project' } })
				return
			}
			projects = projects.filter((project) => project.id !== path.split('/')[2])
			tasks = []
			await route.fulfill({ status: 204 })
			return
		}
		if (path.endsWith('/tasks') && method === 'GET') {
			await route.fulfill({ json: tasks })
			return
		}
		if (path.endsWith('/tasks') && method === 'POST') {
			const task = {
				...body,
				id: `task-${tasks.length + 1}`,
				project_id: 'project-1',
				position: tasks.filter((t) => t.status === body.status).length,
				ticket_number: tasks.length + 1,
				ticket_id: `DE-${tasks.length + 1}`,
				created_at: now,
				updated_at: now,
			}
			tasks.push(task)
			await route.fulfill({ status: 201, json: task })
			return
		}
		const id = path.split('/')[2]
		if (path.endsWith('/move')) {
			if (rejectMove) {
				await route.fulfill({
					status: 503,
					json: { detail: 'Service temporarily unavailable' },
				})
				return
			}
			tasks = moveTask(tasks, id, body.status, body.position)
			await route.fulfill({ json: tasks })
			return
		}
		if (method === 'PATCH') {
			tasks = tasks.map((t) => (t.id === id ? { ...t, ...body } : t))
			await route.fulfill({ json: tasks.find((t) => t.id === id) })
			return
		}
		if (method === 'DELETE') {
			tasks = tasks.filter((t) => t.id !== id)
			await route.fulfill({ status: 204 })
			return
		}
		await route.fulfill({ status: 404, json: { detail: 'Not found' } })
	})

	await page.goto('/')
	await page.getByRole('button', { name: 'Create an account', exact: true }).click()
	await page.getByLabel('Email', { exact: true }).fill(user.email)
	await page.getByLabel('Password', { exact: true }).fill('strong-password')
	await page.getByRole('button', { name: 'Create account', exact: true }).click()
	await expect(page.locator('.dashboard')).toBeVisible()
	await expect(page.locator('.dashboard [aria-label="Loading projects"]')).toHaveCount(0)
	if (rejectProjectsLoad) {
		await expect(
			page.getByRole('heading', { name: 'Unable to load projects' }),
		).toBeVisible()
	} else if (initialProjects.some((project) => !project.archived)) {
		await expect(page.getByLabel('Project name')).toBeVisible()
	} else {
		await expect(
			page.getByRole('button', { name: 'Create your first project', exact: true }),
		).toBeVisible()
	}
	return {
		user,
		setRejectProjectsLoad(value: boolean) {
			rejectProjectsLoad = value
		},
		setRejectDelete(value: boolean) {
			rejectDelete = value
		},
		setRejectMove(value: boolean) {
			rejectMove = value
		},
		setRejectOrder(value: boolean) {
			rejectOrder = value
		},
		getOrderRequests() {
			return orderRequests
		},
	}
}
