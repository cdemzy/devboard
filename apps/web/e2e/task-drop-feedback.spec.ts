import { test, expect } from '@playwright/test'
import { openDashboard, createProjects } from './helpers/dashboard'

test('empty status sections show one compact drop target and clear populated-section insertion feedback', async ({
	page,
}) => {
	await openDashboard(page, createProjects(['Project']))
	for (const title of ['First ticket', 'Second ticket']) {
		await page.getByRole('button', { name: 'New task', exact: true }).click()
		await page.getByLabel('New Todo task title', { exact: true }).fill(title)
		await page.getByLabel('New Todo task title', { exact: true }).press('Enter')
		await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible()
	}
	const todo = page.getByRole('region', { name: 'Todo', exact: true })
	const progress = page.getByRole('region', { name: 'In Progress', exact: true })
	const done = page.getByRole('region', { name: 'Done', exact: true })
	const emptyTarget = progress.locator('.board-status-section-empty-state')
	const initialTargetBox = await emptyTarget.boundingBox()
	const handle = todo.getByRole('button', { name: 'Drag DE-1 to move', exact: true })
	await handle.hover()
	const handleBox = await handle.boundingBox()
	const secondBox = await todo.locator('[data-task-id="task-2"]').boundingBox()
	if (!initialTargetBox || !handleBox || !secondBox)
		throw new Error('Task drag targets are missing')
	await page.mouse.move(
		handleBox.x + handleBox.width / 2,
		handleBox.y + handleBox.height / 2,
	)
	await page.mouse.down()
	await page.mouse.move(
		handleBox.x + handleBox.width / 2 + 10,
		handleBox.y + handleBox.height / 2 + 10,
	)
	await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + 5, { steps: 8 })
	await expect(todo.locator('.board-status-section-drop-indicator')).toBeVisible()
	await page.mouse.move(
		initialTargetBox.x + initialTargetBox.width / 2,
		initialTargetBox.y + initialTargetBox.height / 2,
		{ steps: 15 },
	)
	await expect(emptyTarget).toHaveText('Move here')
	await expect(page.locator('.board-status-section-drop-indicator:visible')).toHaveCount(0)
	await expect(emptyTarget).toHaveCSS('margin-top', '0px')
	await expect
		.poll(async () => {
			const box = await emptyTarget.boundingBox()
			return box ? Math.round(box.y - initialTargetBox.y) : null
		})
		.toBe(0)
	await expect(todo.locator('[data-task-id="task-2"]')).toHaveCSS('margin-top', '0px')
	const doneTarget = done.locator('.board-status-section-empty-state')
	const doneBox = await doneTarget.boundingBox()
	if (!doneBox) throw new Error('Done drop target is missing')
	await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + doneBox.height / 2, {
		steps: 12,
	})
	await expect(doneTarget).toHaveText('Move here')
	await expect(emptyTarget).toHaveText('No tasks yet')
	await expect(page.locator('.board-status-section-drop-indicator:visible')).toHaveCount(0)
	await page.mouse.move(
		initialTargetBox.x + initialTargetBox.width / 2,
		initialTargetBox.y + initialTargetBox.height / 2,
		{ steps: 12 },
	)
	await expect(emptyTarget).toHaveText('Move here')
	const savedMove = page.waitForResponse(
		(response) =>
			response.url().endsWith('/move') && response.request().method() === 'POST',
	)
	await page.mouse.up()
	await savedMove
	await expect(
		progress.getByRole('button', { name: 'First ticket', exact: true }),
	).toBeVisible()
	await expect(progress.locator('.board-status-section-empty-state')).toHaveCount(0)
	await expect(page.locator('.board-status-section-drop-indicator:visible')).toHaveCount(0)
	await expect(
		todo.getByRole('button', { name: 'Second ticket', exact: true }),
	).toBeVisible()
})
