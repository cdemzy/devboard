import { test, expect } from '@playwright/test'
import { openDashboard, createProjects } from './helpers/dashboard'

test('selected task view has a pill before hover and restores it after hovering another view', async ({
	page,
}) => {
	await openDashboard(page, createProjects(['Project']))
	const pill = page.locator('.project-view-tab-pill')
	const board = page.getByRole('button', { name: 'Board', exact: true })
	const archived = page.getByRole('button', { name: 'Archived tasks', exact: true })
	async function expectPillOn(target: typeof board) {
		await expect(pill).toBeVisible()
		await expect
			.poll(async () => {
				const pillBox = await pill.boundingBox()
				const tabBox = await target.boundingBox()
				return pillBox && tabBox
					? Math.round(
							Math.abs(pillBox.x - tabBox.x) + Math.abs(pillBox.width - tabBox.width),
						)
					: null
			})
			.toBe(0)
	}
	await expect(board).toHaveAttribute('aria-pressed', 'true')
	await expectPillOn(board)
	await expect(pill).toHaveCSS('background-color', 'rgb(48, 54, 61)')
	await archived.hover()
	await expectPillOn(archived)
	await page.mouse.move(0, 0)
	await expectPillOn(board)
	await archived.click()
	await page.mouse.move(0, 0)
	await expect(archived).toHaveAttribute('aria-pressed', 'true')
	await expectPillOn(archived)
	await board.click()
	await page.mouse.move(0, 0)
	await expectPillOn(board)
})
