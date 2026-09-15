import { test, expect } from '@playwright/test'
import { openWorkspace } from './helpers/workspace'

test('account menu dismisses outside and logs out', async ({ page }) => {
	const { user } = await openWorkspace(page)
	await page.locator('.workspace-account-trigger').click()
	await expect(page.locator('.workspace-sidebar .workspace-account-email')).toHaveText(
		user.email,
	)
	await page.getByRole('heading', { name: 'Make room for your next idea' }).click()
	await expect(page.locator('.workspace-account-menu')).toHaveCount(0)
	await page.locator('.workspace-account-trigger').click()
	await page.getByRole('button', { name: 'Log out', exact: true }).click()
	await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
	await page.getByLabel('Email', { exact: true }).fill(user.email)
	await page.getByLabel('Password', { exact: true }).fill('strong-password')
	await page.getByRole('button', { name: 'Sign in', exact: true }).click()
	await expect(
		page.getByRole('button', { name: 'Create your first project' }),
	).toBeVisible()
})
