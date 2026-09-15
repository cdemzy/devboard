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
	const collapse = todo.getByRole('button', { name: 'Collapse Todo tasks', exact: true })
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
