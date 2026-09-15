import { test, expect } from '@playwright/test'
import { openDashboard, createProjects } from './helpers/dashboard'

test('mobile status sections expand and collapse their own tasks and create tasks in the selected status', async ({
	page,
}) => {
	await openDashboard(page, createProjects(['Project']))
	for (const title of [
		'First ticket',
		'Second ticket',
		'Third ticket',
		'Fourth ticket',
	]) {
		await page.getByRole('button', { name: 'New task', exact: true }).click()
		const titleInput = page.getByLabel('New Todo task title', { exact: true })
		await titleInput.fill(title)
		await titleInput.press('Enter')
		await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible()
	}
	await page.setViewportSize({ width: 390, height: 844 })
	const todo = page.getByRole('region', { name: 'Todo', exact: true })
	const progress = page.getByRole('region', { name: 'In Progress', exact: true })
	await expect(todo.locator('.task-card')).toHaveCount(3)
	await expect(todo.locator('.board-status-section-header-collapse')).toHaveCount(0)
	await expect(todo.locator('.board-status-section-add-task')).toHaveCount(0)
	await expect(progress.locator('.board-status-section-add-task')).toHaveCount(0)
	await todo.getByRole('button', { name: 'Show all Todo tasks', exact: true }).click()
	await expect(todo.locator('.task-card')).toHaveCount(4)
	await expect(
		todo.getByRole('button', { name: 'Fourth ticket', exact: true }),
	).toBeVisible()
	await expect
		.poll(async () => {
			const bounds = await todo.boundingBox()
			return bounds ? Math.round(bounds.y + bounds.height) : null
		})
		.toBe(844)
	const bottomAdd = todo.locator('.board-status-section-add-task')
	const collapse = todo.locator('.board-status-section-expand')
	await expect(bottomAdd).toBeVisible()
	const addBounds = await bottomAdd.boundingBox()
	const collapseBounds = await collapse.boundingBox()
	if (!addBounds || !collapseBounds)
		throw new Error('Expanded section controls are missing')
	expect(addBounds.y + addBounds.height).toBeLessThanOrEqual(collapseBounds.y)
	await expect(collapse.locator('svg')).toHaveClass(/lucide-chevrons-down-up/)
	await collapse.click()
	await expect(bottomAdd).toHaveCount(0)
	await expect(todo.locator('.task-card')).toHaveCount(3)
	await expect
		.poll(async () => {
			const header = await todo.locator('.board-status-section-header').boundingBox()
			return header ? Math.round(header.y) : null
		})
		.toBe(16)
	await todo.getByRole('button', { name: 'Show all Todo tasks', exact: true }).click()
	const headerCollapse = todo.locator('.board-status-section-header-collapse')
	await expect(headerCollapse).toBeVisible()
	const headerBounds = await todo.locator('.board-status-section-header').boundingBox()
	const headerCollapseBounds = await headerCollapse.boundingBox()
	if (!headerBounds || !headerCollapseBounds)
		throw new Error('Header collapse control is missing')
	expect(headerCollapseBounds.x + headerCollapseBounds.width / 2).toBeCloseTo(
		headerBounds.x + headerBounds.width / 2,
		1,
	)
	await headerCollapse.press('Enter')
	await expect(headerCollapse).toHaveCount(0)
	await expect(todo.locator('.task-card')).toHaveCount(3)
	await progress
		.getByRole('button', { name: 'Add task to In Progress', exact: true })
		.click()
	const progressTitle = page.getByLabel('New In Progress task title', { exact: true })
	await progressTitle.fill('Started ticket')
	await progressTitle.press('Enter')
	await expect(
		progress.getByRole('button', { name: 'Started ticket', exact: true }),
	).toBeVisible()
	await expect(progress.locator('.board-status-section-empty-state')).toHaveCount(0)
	await expect(todo.locator('.task-card')).toHaveCount(3)
})

test('mobile new tasks appear first and keep their position after reloading', async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await openDashboard(page, createProjects(['Project']))
	const todo = page.getByRole('region', { name: 'Todo', exact: true })
	const savedPosition = page.waitForResponse(
		(response) => response.url().endsWith('/tasks/task-2/move') && response.ok(),
	)
	for (const title of ['Older ticket', 'Newest ticket']) {
		await todo.getByRole('button', { name: 'Add task to Todo', exact: true }).click()
		const input = todo.getByLabel('New Todo task title', { exact: true })
		await input.fill(title)
		await input.press('Enter')
		await expect(todo.locator('.task-card').first()).toContainText(title)
	}
	await expect(todo.locator('.task-card').first()).not.toHaveAttribute(
		'data-task-id',
		/pending/,
	)
	await savedPosition
	await page.reload()
	await expect(todo.locator('.task-card').first()).toContainText('Newest ticket')
})

test('opening a mobile task editor keeps tickets aligned within other status sections', async ({
	page,
}) => {
	await openDashboard(page, createProjects(['Project']))
	for (const status of ['Todo', 'In Progress', 'Done']) {
		await page.getByRole('button', { name: `Add task to ${status}`, exact: true }).click()
		const input = page.getByLabel(`New ${status} task title`, { exact: true })
		await input.fill(`${status} ticket`)
		await input.press('Enter')
		await expect(
			page.getByRole('button', { name: `${status} ticket`, exact: true }),
		).toBeVisible()
	}
	await page.setViewportSize({ width: 390, height: 844 })
	const [offsets] = await Promise.all([
		page.evaluate(async () => {
			const sections = ['in_progress', 'done'].map((status) => {
				const section = document.querySelector<HTMLElement>(
					`[data-board-status-section="${status}"]`,
				)
				const card = section?.querySelector<HTMLElement>('.task-card')
				if (!section || !card) throw new Error('Unaffected status ticket is missing')
				return { section, card }
			})
			const samples: number[][] = []
			for (let frame = 0; frame < 30; frame += 1) {
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
				samples.push(
					sections.map(
						({ section, card }) =>
							card.getBoundingClientRect().top - section.getBoundingClientRect().top,
					),
				)
			}
			return samples
		}),
		page.getByRole('button', { name: 'Add task to Todo', exact: true }).click(),
	])
	for (let sectionIndex = 0; sectionIndex < 2; sectionIndex += 1) {
		const values = offsets.map((sample) => sample[sectionIndex])
		expect(Math.max(...values) - Math.min(...values)).toBeLessThan(1)
	}
	await expect(page.getByLabel('New Todo task title', { exact: true })).toBeVisible()
	for (const status of ['In Progress', 'Done']) {
		const section = page.getByRole('region', { name: status, exact: true })
		await expect(section.locator('.task-card')).toHaveCount(1)
		await expect(section.locator('.kanban-new-task-card')).toHaveCount(0)
	}
})
