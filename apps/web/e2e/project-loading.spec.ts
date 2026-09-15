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
