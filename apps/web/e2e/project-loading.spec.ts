import { test, expect } from '@playwright/test'
import { openDashboard, createProjects } from './helpers/dashboard'

test('initial project loading includes the archive action skeleton and replaces it with the action', async ({
	page,
}) => {
	await openDashboard(page, createProjects(['Project']))
	let releaseProjects!: () => void
	const projectsReady = new Promise<void>((resolve) => {
		releaseProjects = resolve
	})
	await page.route(/http:\/\/127\.0\.0\.1:8001\/projects(?:\?.*)?$/, async (route) => {
		await projectsReady
		await route.fallback()
	})
	await page.reload()
	const skeleton = page.locator('.project-view-project-archive-skeleton')
	try {
		await expect(
			page.getByRole('status', { name: 'Loading project', exact: true }),
		).toBeVisible()
		await expect(skeleton).toBeVisible()
		await expect(skeleton).toHaveCSS('width', '14px')
		await expect(skeleton).toHaveCSS('height', '14px')
		await expect(skeleton).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
		await expect(skeleton).toHaveCSS('animation-name', 'pulse')
	} finally {
		releaseProjects()
	}
	await expect(page.getByLabel('Project name')).toBeVisible()
	await expect(skeleton).toHaveCount(0)
	await expect(page.locator('.project-view-project-archive')).toBeVisible()
	await expect(page.locator('.project-view-project-archive svg')).toHaveCSS(
		'width',
		'14px',
	)
	await expect(page.locator('.project-view-project-archive svg')).toHaveCSS(
		'height',
		'14px',
	)
})

for (const hasTaskLoadError of [false, true]) {
	test(`sidebar waits for the first project's tasks${hasTaskLoadError ? ' and recovers when they fail' : ' without waiting on later project switches'}`, async ({
		page,
	}) => {
		await openDashboard(page, createProjects(['First project', 'Second project']))
		let releaseInitialTasks!: () => void
		const initialTasksReady = new Promise<void>((resolve) => {
			releaseInitialTasks = resolve
		})
		await page.route('http://127.0.0.1:8001/projects/project-1/tasks', async (route) => {
			await initialTasksReady
			if (hasTaskLoadError) {
				await route.fulfill({
					status: 503,
					json: { detail: 'Tasks temporarily unavailable' },
				})
			} else {
				await route.fallback()
			}
		})
		const initialTaskRequest = page.waitForRequest(
			'http://127.0.0.1:8001/projects/project-1/tasks',
		)
		await page.reload()
		await initialTaskRequest
		const sidebar = page.locator('.sidebar-panel')
		try {
			await expect(page.locator('.project-view-skeleton')).toBeVisible()
			await expect(sidebar.locator('div[aria-label="Loading projects"]')).toBeVisible()
			await expect(sidebar.locator('.sidebar-panel-project-select-button')).toHaveCount(0)
		} finally {
			releaseInitialTasks()
		}
		await expect(page.getByLabel('Project name')).toBeVisible()
		await expect(sidebar.locator('[aria-label="Loading projects"]')).toHaveCount(0)
		await expect(
			sidebar.getByRole('button', { name: 'First project', exact: true }),
		).toBeVisible()
		if (hasTaskLoadError) {
			await expect(
				page.getByText('Tasks temporarily unavailable', { exact: true }),
			).toBeVisible()
			return
		}
		let releaseNextTasks!: () => void
		const nextTasksReady = new Promise<void>((resolve) => {
			releaseNextTasks = resolve
		})
		await page.route('http://127.0.0.1:8001/projects/project-2/tasks', async (route) => {
			await nextTasksReady
			await route.fallback()
		})
		await sidebar.getByRole('button', { name: 'Second project', exact: true }).click()
		try {
			await expect(page.locator('.project-view-skeleton')).toBeVisible()
			await expect(sidebar.locator('[aria-label="Loading projects"]')).toHaveCount(0)
			await expect(
				sidebar.getByRole('button', { name: 'First project', exact: true }),
			).toBeVisible()
		} finally {
			releaseNextTasks()
		}
		await expect(page.getByLabel('Project name')).toHaveValue('Second project')
	})
}
