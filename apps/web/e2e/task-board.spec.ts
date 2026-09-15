import { test, expect } from '@playwright/test'
import { openWorkspace } from './helpers/workspace'

test('task editing, drag persistence, rollback and keyboard movement', async ({
	page,
}, testInfo) => {
	const browserErrors: string[] = []
	page.on('pageerror', (error) => browserErrors.push(error.message))
	const service = await openWorkspace(page)
	await page.getByRole('button', { name: 'Create your first project' }).click()
	await page.getByLabel('Project name').fill('Developer portal')
	await page.getByLabel('Project name').blur()
	await expect(page.getByLabel('Project name')).toHaveValue('Developer portal')
	for (const title of ['Write API', 'Build interface']) {
		await page.getByRole('button', { name: 'New task', exact: true }).click()
		await page.getByLabel('New Todo task title', { exact: true }).fill(title)
		await page.getByLabel('New Todo task title', { exact: true }).press('Enter')
		await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible()
	}
	await page.screenshot({
		path: testInfo.outputPath('board-desktop.png'),
		fullPage: true,
	})
	await page.setViewportSize({ width: 390, height: 844 })
	await expect
		.poll(() =>
			page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
		)
		.toBe(true)
	await page.getByRole('button', { name: 'Write API', exact: true }).click()
	await expect(page.getByRole('dialog')).toBeVisible()
	await page.getByRole('button', { name: 'Minimize task', exact: true }).click()
	await page.screenshot({
		path: testInfo.outputPath('board-mobile.png'),
		fullPage: true,
	})
	await page.setViewportSize({ width: 1280, height: 720 })
	const todo = page.getByRole('region', { name: 'Todo', exact: true })
	const progress = page.getByRole('region', {
		name: 'In Progress',
		exact: true,
	})
	const done = page.getByRole('region', { name: 'Done', exact: true })
	const drag = async (title: string, target: ReturnType<typeof page.getByRole>) => {
		await page
			.locator('.task-card')
			.filter({ has: page.getByRole('button', { name: title, exact: true }) })
			.locator('.task-card-drag-handle')
			.hover()
		const start = await page
			.locator('.task-card')
			.filter({ has: page.getByRole('button', { name: title, exact: true }) })
			.locator('.task-card-drag-handle')
			.boundingBox()
		const end = await target.boundingBox()
		if (!start || !end) throw new Error('Drag target is missing')
		await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
		await page.mouse.down()
		await page.mouse.move(start.x + start.width / 2 + 10, start.y + start.height / 2 + 10)
		await expect(
			page.locator('.task-card-drag-handle[aria-pressed="true"]'),
		).toBeVisible()
		await page.mouse.move(end.x + end.width / 2, end.y + end.height - 2, {
			steps: 15,
		})
		const savedMove = page.waitForResponse(
			(response) =>
				response.url().endsWith('/move') && response.request().method() === 'POST',
		)
		await page.mouse.up()
		await savedMove
	}
	await drag(
		'Write API',
		page.locator('.task-card').filter({
			has: page.getByRole('button', { name: 'Build interface', exact: true }),
		}),
	)
	await expect(todo.locator('article').first()).toContainText('Build interface')
	await drag('Write API', progress)
	await expect(
		progress.getByRole('button', { name: 'Write API', exact: true }),
	).toBeVisible()
	await page.reload()
	await expect(
		progress.getByRole('button', { name: 'Write API', exact: true }),
	).toBeVisible()
	service.setRejectMove(true)
	await drag('Write API', done)
	await expect(
		page.getByText('Service temporarily unavailable', { exact: true }),
	).toBeVisible()
	await expect(
		progress.getByRole('button', { name: 'Write API', exact: true }),
	).toBeVisible()
	service.setRejectMove(false)
	const handle = page.getByRole('button', {
		name: 'Drag DE-1 to move',
		exact: true,
	})
	await handle.focus()
	await page.keyboard.press('Space')
	await expect(handle).toHaveAttribute('aria-pressed', 'true')
	await page.keyboard.press('ArrowRight')
	await expect(
		page.getByRole('status').filter({ hasText: 'over droppable area done' }),
	).toBeVisible()
	const keyboardMove = page.waitForResponse(
		(response) =>
			response.url().endsWith('/move') && response.request().method() === 'POST',
	)
	await page.keyboard.press('Space')
	await keyboardMove
	await expect(done.getByRole('button', { name: 'Write API', exact: true })).toBeVisible()
	await page.getByRole('button', { name: 'Write API', exact: true }).click()
	await page.getByLabel('Title', { exact: true }).fill('API complete')
	await page.getByLabel('Priority').selectOption('high')
	const savedTask = page.waitForResponse(
		(response) =>
			response.url().endsWith('/tasks/task-1') && response.request().method() === 'PATCH',
	)
	await page.getByRole('button', { name: 'Minimize task', exact: true }).click()
	await savedTask
	await expect(
		page.getByRole('button', { name: 'API complete', exact: true }),
	).toBeVisible()
	await page.getByRole('button', { name: 'Actions for DE-1', exact: true }).click()
	await page.getByRole('button', { name: 'Delete DE-1', exact: true }).click()
	await expect(
		page.getByRole('button', { name: 'API complete', exact: true }),
	).toHaveCount(0)
	expect(browserErrors).toEqual([])
})
