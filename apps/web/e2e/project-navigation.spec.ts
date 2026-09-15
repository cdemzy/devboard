import { test, expect } from '@playwright/test'
import { openDashboard, createProjects } from './helpers/dashboard'

test('sidebar project drag trace preserves the original insertion slot', async ({
	page,
}) => {
	const service = await openDashboard(
		page,
		createProjects(['First project', 'Second project', 'Third project']),
	)
	await page.getByRole('button', { name: 'Second project', exact: true }).click()
	await expect(page.getByLabel('Project name', { exact: true })).toHaveValue(
		'Second project',
	)
	await page.getByRole('button', { name: 'First project', exact: true }).click()
	await expect(page.getByLabel('Project name', { exact: true })).toHaveValue(
		'First project',
	)

	const dragHandle = page.getByRole('button', {
		name: 'Drag First project to reorder',
		exact: true,
	})
	const trace = page.locator('.sidebar-panel-project-drop-trace')
	const projectListEntries = () =>
		page
			.locator('.sidebar-panel-project-sort-list > *')
			.evaluateAll((items) =>
				items.map((item) => item.getAttribute('data-project-id') ?? 'trace'),
			)

	await expect(dragHandle).toBeVisible()
	const dragHandleBox = await dragHandle.boundingBox()
	const thirdProjectBox = await page
		.locator('.sidebar-panel-project-sort-list [data-project-id="project-3"]')
		.boundingBox()
	if (!dragHandleBox || !thirdProjectBox)
		throw new Error('Project drag target is missing')

	const startX = dragHandleBox.x + dragHandleBox.width / 2
	const startY = dragHandleBox.y + dragHandleBox.height / 2
	await page.mouse.move(startX, startY)
	await page.mouse.down()
	await expect(trace).toBeVisible()
	await expect.poll(projectListEntries).toEqual(['trace', 'project-2', 'project-3'])

	await page.mouse.move(
		thirdProjectBox.x + thirdProjectBox.width / 2,
		thirdProjectBox.y + thirdProjectBox.height - 2,
		{ steps: 12 },
	)
	await expect.poll(projectListEntries).toEqual(['project-2', 'project-3', 'trace'])

	await page.mouse.move(startX, startY, { steps: 12 })
	await expect.poll(projectListEntries).toEqual(['trace', 'project-2', 'project-3'])
	await page.mouse.up()

	await expect.poll(projectListEntries).toEqual(['project-1', 'project-2', 'project-3'])
	expect(service.getOrderRequests()).toBe(0)
})

test('project ordering persists and failed ordering rolls back', async ({ page }) => {
	const service = await openDashboard(
		page,
		createProjects(['First project', 'Second project', 'Third project']),
	)
	const entries = page.locator('.sidebar-panel-project-sort-list [data-project-id]')
	async function dragFirstProjectAfterThird() {
		await page
			.getByRole('button', { name: 'Drag First project to reorder', exact: true })
			.hover()
		const handle = await page
			.getByRole('button', { name: 'Drag First project to reorder', exact: true })
			.boundingBox()
		const target = await entries
			.filter({ has: page.getByRole('button', { name: 'Third project', exact: true }) })
			.boundingBox()
		if (!handle || !target) throw new Error('Project drag target is missing')
		await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
		await page.mouse.down()
		await expect(page.locator('.sidebar-panel-project-drop-trace')).toBeVisible()
		await page.mouse.move(target.x + target.width / 2, target.y + target.height - 2, {
			steps: 12,
		})
		await expect(page.locator('.sidebar-panel-project-sort-list > *').last()).toHaveClass(
			/sidebar-panel-project-drop-trace/,
		)
		await page.mouse.up()
	}
	await dragFirstProjectAfterThird()
	await expect(entries.first()).toHaveAttribute('data-project-id', 'project-2')
	await expect.poll(() => service.getOrderRequests()).toBe(1)
	await page.reload()
	await expect(entries.first()).toHaveAttribute('data-project-id', 'project-2')
	service.setRejectOrder(true)
	await page
		.getByRole('button', { name: 'Drag Third project to reorder', exact: true })
		.hover()
	const handle = await page
		.getByRole('button', { name: 'Drag Third project to reorder', exact: true })
		.boundingBox()
	const target = await entries.first().boundingBox()
	if (!handle || !target) throw new Error('Project drag target is missing')
	await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
	await page.mouse.down()
	await expect(page.locator('.sidebar-panel-project-drop-trace')).toBeVisible()
	await page.mouse.move(target.x + target.width / 2, target.y + 2, { steps: 12 })
	await expect(page.locator('.sidebar-panel-project-sort-list > *').first()).toHaveClass(
		/sidebar-panel-project-drop-trace/,
	)
	await page.mouse.up()
	await expect(page.locator('.project-panel-error')).toContainText('Unable to save order')
	await expect(entries.nth(2)).toHaveAttribute('data-project-id', 'project-1')
})

test('project row padding selects the project', async ({ page }) => {
	await openDashboard(page, createProjects(['First project', 'Second project']))
	const projectName = page.getByLabel('Project name', { exact: true })
	const secondRow = page.locator(
		'.sidebar-panel-project-sort-list [data-project-id="project-2"]',
	)
	await secondRow.click({ position: { x: 2, y: 2 } })
	await expect(projectName).toHaveValue('Second project')
	const firstRow = page.locator(
		'.sidebar-panel-project-sort-list [data-project-id="project-1"]',
	)
	const bounds = await firstRow.boundingBox()
	if (!bounds) throw new Error('Project row is missing')
	await firstRow.click({
		position: { x: bounds.width - 2, y: bounds.height - 2 },
	})
	await expect(projectName).toHaveValue('First project')
})
