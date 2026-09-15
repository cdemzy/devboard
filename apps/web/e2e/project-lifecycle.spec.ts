import { test, expect } from '@playwright/test'
import { openDashboard, createProjects } from './helpers/dashboard'

test('project creation, name saving and archiving update navigation', async ({
	page,
}) => {
	await openDashboard(page)
	await page
		.getByRole('button', { name: 'Create your first project', exact: true })
		.click()
	const name = page.getByLabel('Project name', { exact: true })
	await expect(name).toHaveValue('')
	await expect(name).toHaveAttribute('placeholder', 'New Project')
	await name.fill('Next idea')
	const savedName = page.waitForResponse(
		(response) =>
			response.request().method() === 'PATCH' &&
			response.url().endsWith('/projects/project-1'),
	)
	await name.blur()
	await savedName
	await expect(page.getByRole('button', { name: 'Next idea', exact: true })).toBeVisible()
	await page.reload()
	await expect(name).toHaveValue('Next idea')
	await page.getByRole('button', { name: 'Archive project', exact: true }).click()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: 'Archive project', exact: true })
		.click()
	await expect(
		page.getByRole('button', { name: 'Create your first project', exact: true }),
	).toBeVisible()
	await page.locator('.sidebar-panel-archive-link').click()
	await expect(
		page.getByRole('heading', { name: 'Next idea', exact: true }),
	).toBeVisible()
})

test('failed project loading blocks creation and retry recovers navigation', async ({
	page,
}) => {
	const service = await openDashboard(page, createProjects(['Next idea']), {
		rejectProjectsLoad: true,
	})
	await expect(
		page.getByRole('button', { name: 'New project', exact: true }),
	).toHaveCount(0)
	await expect(page.locator('.project-panel-load-error-code')).toHaveText(
		'Error code: REQUEST_FAILED',
	)
	service.setRejectProjectsLoad(false)
	await page
		.locator('.project-panel-load-error')
		.getByRole('button', { name: 'Retry', exact: true })
		.click()
	await expect(page.getByLabel('Project name', { exact: true })).toHaveValue('Next idea')
	await expect(
		page.getByRole('button', { name: 'New project', exact: true }),
	).toBeVisible()
	await expect(page.locator('.project-panel-load-error')).toHaveCount(0)
})
