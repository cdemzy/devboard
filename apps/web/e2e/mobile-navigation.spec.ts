import { test, expect } from '@playwright/test'
import { openDashboard, createProjects } from './helpers/dashboard'

test('mobile drawer selects projects, closes, and releases scroll locking', async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await openDashboard(page, createProjects(['First project', 'Second project']))
	const drawer = page.locator('#mobile-project-drawer')
	await expect(drawer).toHaveAttribute('inert', '')
	await page.getByRole('button', { name: 'Open projects', exact: true }).click()
	await expect(drawer).not.toHaveAttribute('inert', '')
	await expect
		.poll(() => page.evaluate(() => document.body.style.overflow))
		.toBe('hidden')
	await drawer.getByRole('button', { name: 'Second project', exact: true }).click()
	await expect(page.getByLabel('Project name')).toHaveValue('Second project')
	await expect(
		page.getByRole('button', { name: 'Open projects', exact: true }),
	).toHaveAttribute('aria-expanded', 'false')
	await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('')
	await expect
		.poll(() =>
			page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
		)
		.toBe(true)
})

test('touch swipes open and close the mobile drawer', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await openDashboard(page)
	const session = await page.context().newCDPSession(page)
	async function swipe(startX: number, endX: number) {
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchStart',
			touchPoints: [{ x: startX, y: 650 }],
		})
		for (let step = 1; step <= 12; step += 1) {
			await session.send('Input.dispatchTouchEvent', {
				type: 'touchMove',
				touchPoints: [{ x: startX + ((endX - startX) * step) / 12, y: 650 }],
			})
		}
		await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
	}
	await swipe(8, 240)
	await expect(
		page.getByRole('button', { name: 'Close projects', exact: true }),
	).toHaveAttribute('aria-expanded', 'true')
	await expect
		.poll(() => page.evaluate(() => document.body.style.overflow))
		.toBe('hidden')
	await expect
		.poll(() =>
			page
				.locator('.project-panel')
				.evaluate((element) => Math.round(element.getBoundingClientRect().left)),
		)
		.toBe(304)
	await swipe(370, 150)
	await expect(
		page.getByRole('button', { name: 'Open projects', exact: true }),
	).toHaveAttribute('aria-expanded', 'false')
	await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('')
	await session.detach()
})
