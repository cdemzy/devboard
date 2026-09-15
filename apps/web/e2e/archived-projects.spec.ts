import { test, expect } from '@playwright/test'
import { openDashboard, createProjects } from './helpers/dashboard'

test('archive restoration returns a project to navigation', async ({ page }) => {
	await openDashboard(page, createProjects(['Archived idea'], true))
	await page.locator('.sidebar-panel-archive-link').click()
	await expect(
		page.getByRole('heading', { name: 'Archived idea', exact: true }),
	).toBeVisible()
	await page.getByRole('button', { name: 'Restore Archived idea', exact: true }).click()
	await expect(page.getByText('No archived projects.', { exact: true })).toBeVisible()
	await page.getByRole('button', { name: 'Archived idea', exact: true }).click()
	await expect(page.getByLabel('Project name')).toHaveValue('Archived idea')
})

test('archive deletion requires confirmation and supports cancellation', async ({
	page,
}) => {
	await openDashboard(page, createProjects(['Archived idea'], true))
	await page.locator('.sidebar-panel-archive-link').click()
	await page.getByRole('button', { name: 'Delete Archived idea', exact: true }).click()
	await expect(page.getByRole('dialog')).toContainText('Archived idea')
	await page.getByRole('button', { name: 'Cancel', exact: true }).click()
	await expect(
		page.getByRole('heading', { name: 'Archived idea', exact: true }),
	).toBeVisible()
	await page.getByRole('button', { name: 'Delete Archived idea', exact: true }).click()
	await page.getByRole('button', { name: 'Delete project', exact: true }).click()
	await expect(page.getByRole('dialog')).toHaveCount(0)
	await expect(page.getByText('No archived projects.', { exact: true })).toBeVisible()
})

test('failed archive deletion stays open and can be retried', async ({ page }) => {
	const service = await openDashboard(page, createProjects(['Archived idea'], true))
	service.setRejectDelete(true)
	await page.locator('.sidebar-panel-archive-link').click()
	await page.getByRole('button', { name: 'Delete Archived idea', exact: true }).click()
	await page.getByRole('button', { name: 'Delete project', exact: true }).click()
	await expect(page.getByRole('dialog').getByRole('alert')).toHaveText(
		'Unable to delete project',
	)
	service.setRejectDelete(false)
	await page.getByRole('button', { name: 'Delete project', exact: true }).click()
	await expect(page.getByRole('dialog')).toHaveCount(0)
	await expect(page.getByText('No archived projects.', { exact: true })).toBeVisible()
})
