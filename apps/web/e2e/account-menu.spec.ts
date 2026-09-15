import { test, expect } from '@playwright/test'
import { openDashboard } from './helpers/dashboard'

test('account menu dismisses outside and logs out', async ({ page }) => {
	const { user } = await openDashboard(page)
	await page.locator('.sidebar-panel-account-trigger').click()
	await expect(page.locator('.sidebar-panel .sidebar-panel-account-email')).toHaveText(
		user.email,
	)
	await page.getByRole('heading', { name: 'Make room for your next idea' }).click()
	await expect(page.locator('.sidebar-panel-account-menu')).toHaveCount(0)
	await page.locator('.sidebar-panel-account-trigger').click()
	await page.getByRole('button', { name: 'Log out', exact: true }).click()
	await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
	await page.getByLabel('Email', { exact: true }).fill(user.email)
	await page.getByLabel('Password', { exact: true }).fill('strong-password')
	await page.getByRole('button', { name: 'Sign in', exact: true }).click()
	await expect(
		page.getByRole('button', { name: 'Create your first project' }),
	).toBeVisible()
})

for (const isMobile of [false, true]) {
	test(`account button toggles its popup on ${isMobile ? 'mobile' : 'desktop'}`, async ({
		page,
	}) => {
		if (isMobile) await page.setViewportSize({ width: 390, height: 844 })
		await openDashboard(page)
		if (isMobile) {
			await page.getByRole('button', { name: 'Open projects', exact: true }).click()
		}
		const panel = page.locator(isMobile ? '#mobile-project-drawer' : '.sidebar-panel')
		const trigger = panel.getByRole('button', { name: 'Account', exact: true })
		const menu = panel.locator('.sidebar-panel-account-menu')
		await trigger.click()
		await expect(trigger).toHaveAttribute('aria-expanded', 'true')
		await expect(menu).toBeVisible()
		await trigger.click()
		await expect(trigger).toHaveAttribute('aria-expanded', 'false')
		await expect(menu).toHaveCount(0)
		await trigger.press('Enter')
		await expect(menu).toBeVisible()
		await trigger.press('Enter')
		await expect(menu).toHaveCount(0)
	})
}
