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
	await todo.getByRole('button', { name: 'Show all Todo tasks', exact: true }).click()
	await expect(todo.locator('.task-card')).toHaveCount(4)
	await expect(
		todo.getByRole('button', { name: 'Fourth ticket', exact: true }),
	).toBeVisible()
	await todo.getByRole('button', { name: 'Collapse Todo tasks', exact: true }).click()
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
