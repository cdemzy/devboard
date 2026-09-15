import { test, expect } from '@playwright/test'
import { openDashboard, createProjects } from './helpers/dashboard'

test('mobile handles stay visible on the left and touch dragging reserves a visible insertion gap', async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 390, height: 844 })
	const service = await openDashboard(
		page,
		createProjects([
			'Prompt stash',
			'Photo Transfer App',
			'InfiniteRadar',
			'Sonetix',
			'Rigify',
		]),
	)
	await page.getByRole('button', { name: 'Open projects', exact: true }).click()
	await expect
		.poll(() =>
			page
				.locator('.project-panel')
				.evaluate((element) => Math.round(element.getBoundingClientRect().left)),
		)
		.toBe(304)
	const list = page.locator('.sidebar-panel-mobile-project-sort-list')
	const handles = list.locator('.sidebar-panel-project-drag-handle')
	await expect(handles).toHaveCount(5)
	for (const handle of await handles.all()) {
		await expect(handle).toHaveCSS('opacity', '1')
	}
	const handle = list.getByRole('button', {
		name: 'Drag Prompt stash to reorder',
		exact: true,
	})
	const handleBox = await handle.boundingBox()
	const selectBox = await list
		.getByRole('button', { name: 'Prompt stash', exact: true })
		.boundingBox()
	const rowBox = await list.locator('[data-project-id="project-1"]').boundingBox()
	const targetBox = await list.locator('[data-project-id="project-5"]').boundingBox()
	if (!handleBox || !selectBox || !rowBox || !targetBox)
		throw new Error('Project drag target is missing')
	expect(handleBox.x + handleBox.width).toBeLessThan(selectBox.x)
	const session = await page.context().newCDPSession(page)
	const x = handleBox.x + handleBox.width / 2
	const startY = handleBox.y + handleBox.height / 2
	await session.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [{ x, y: startY }],
	})
	await session.send('Input.dispatchTouchEvent', {
		type: 'touchMove',
		touchPoints: [{ x, y: startY + 12 }],
	})
	const preview = page.locator(
		'.sidebar-panel-mobile-drawer .sidebar-panel-project-drag-preview',
	)
	const trace = list.locator('.sidebar-panel-project-drop-trace')
	await expect(preview).toBeVisible()
	await expect(preview).toHaveCSS('opacity', '1')
	await expect(preview).toHaveText('Prompt stash')
	await expect(trace).toBeVisible()
	await expect
		.poll(() => trace.evaluate((element) => element.getBoundingClientRect().height))
		.toBe(rowBox.height)
	for (let step = 1; step <= 12; step += 1) {
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [
				{
					x,
					y:
						startY +
						12 +
						((targetBox.y - rowBox.height / 2 - 2 - startY - 12) * step) / 12,
				},
			],
		})
	}
	const entries = () =>
		list
			.locator(':scope > :not(.sidebar-panel-project-drag-source)')
			.evaluateAll((rows) =>
				rows.map((row) => row.getAttribute('data-project-id') ?? 'trace'),
			)
	await expect
		.poll(entries)
		.toEqual(['project-2', 'project-3', 'project-4', 'trace', 'project-5'])
	const gapBox = await trace.boundingBox()
	const nextRowBox = await list.locator('[data-project-id="project-5"]').boundingBox()
	if (!gapBox || !nextRowBox) throw new Error('Insertion gap is missing')
	expect(gapBox.y + gapBox.height).toBeLessThanOrEqual(nextRowBox.y - 3)
	await page.screenshot({ path: testInfo.outputPath('mobile-project-drag.png') })
	const savedOrder = page.waitForResponse(
		(response) =>
			response.url().endsWith('/projects/order') && response.request().method() === 'PUT',
	)
	await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
	await savedOrder
	await expect(preview).toHaveCount(0)
	await expect(trace).toHaveCount(0)
	await expect
		.poll(entries)
		.toEqual(['project-2', 'project-3', 'project-4', 'project-1', 'project-5'])
	expect(service.getOrderRequests()).toBe(1)
	await session.detach()
	await page.reload()
	await page.getByRole('button', { name: 'Open projects', exact: true }).click()
	await expect
		.poll(entries)
		.toEqual(['project-2', 'project-3', 'project-4', 'project-1', 'project-5'])
})

test('canceling a mobile project drag removes the preview and leaves the saved order intact', async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 })
	const service = await openDashboard(
		page,
		createProjects(['Prompt stash', 'InfiniteRadar', 'Sonetix']),
	)
	await page.getByRole('button', { name: 'Open projects', exact: true }).click()
	const list = page.locator('.sidebar-panel-mobile-project-sort-list')
	const handle = list.getByRole('button', {
		name: 'Drag Prompt stash to reorder',
		exact: true,
	})
	await handle.hover()
	const box = await handle.boundingBox()
	if (!box) throw new Error('Project drag handle is missing')
	const session = await page.context().newCDPSession(page)
	const x = box.x + box.width / 2
	const y = box.y + box.height / 2
	await session.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [{ x, y }],
	})
	await session.send('Input.dispatchTouchEvent', {
		type: 'touchMove',
		touchPoints: [{ x, y: y + 80 }],
	})
	await expect(list.locator('.sidebar-panel-project-drop-trace')).toBeVisible()
	await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
	await expect(page.locator('.sidebar-panel-project-drag-preview')).toHaveCount(0)
	await expect(list.locator('.sidebar-panel-project-drop-trace')).toHaveCount(0)
	await expect(list.locator('[data-project-id]').first()).toHaveAttribute(
		'data-project-id',
		'project-1',
	)
	expect(service.getOrderRequests()).toBe(0)
	await session.detach()
})

test('mobile project handles support keyboard reordering', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 })
	const service = await openDashboard(
		page,
		createProjects(['Prompt stash', 'InfiniteRadar', 'Sonetix']),
	)
	await page.getByRole('button', { name: 'Open projects', exact: true }).click()
	const list = page.locator('.sidebar-panel-mobile-project-sort-list')
	const handle = list.getByRole('button', {
		name: 'Drag Prompt stash to reorder',
		exact: true,
	})
	await handle.hover()
	await handle.focus()
	await page.keyboard.press('Space')
	await expect(list.locator('.sidebar-panel-project-drop-trace')).toBeVisible()
	await page.keyboard.press('ArrowDown')
	await expect(
		list.locator(':scope > :not(.sidebar-panel-project-drag-source)').nth(1),
	).toHaveClass(/sidebar-panel-project-drop-trace/)
	await page.keyboard.press('Space')
	await expect(list.locator('[data-project-id]').first()).toHaveAttribute(
		'data-project-id',
		'project-2',
	)
	await expect.poll(() => service.getOrderRequests()).toBe(1)
})

for (const isScrolled of [false, true]) {
	test(`mobile drag preserves its origin and shifts neighboring rows on edge contact${isScrolled ? ' after scrolling' : ''}`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 640 })
		const projects = createProjects(
			Array.from({ length: 12 }, (_, index) => `Project ${index + 1}`),
		)
		const service = await openDashboard(page, projects)
		await page.getByRole('button', { name: 'Open projects', exact: true }).click()
		const list = page.locator('.sidebar-panel-mobile-project-sort-list')
		if (isScrolled) {
			await page
				.locator('.sidebar-panel-mobile-drawer-project-scroll')
				.evaluate((element) => {
					element.scrollTop = 104
				})
		}
		const handle = list.getByRole('button', {
			name: 'Drag Project 6 to reorder',
			exact: true,
		})
		await handle.hover()
		const handleBox = await handle.boundingBox()
		const rowBox = await list.locator('[data-project-id="project-6"]').boundingBox()
		if (!handleBox || !rowBox) throw new Error('Middle project drag target is missing')
		const session = await page.context().newCDPSession(page)
		const x = handleBox.x + handleBox.width / 2
		const startY = handleBox.y + handleBox.height / 2
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchStart',
			touchPoints: [{ x, y: startY }],
		})
		const preview = page.locator(
			'.sidebar-panel-mobile-drawer .sidebar-panel-project-drag-preview',
		)
		const trace = list.locator('.sidebar-panel-project-drop-trace')
		for (const delta of [12, 1, 2]) {
			await session.send('Input.dispatchTouchEvent', {
				type: 'touchMove',
				touchPoints: [{ x, y: startY + delta }],
			})
			await expect(preview).toBeVisible()
			await expect
				.poll(async () => {
					const box = await preview.boundingBox()
					return box ? Math.round(box.y - rowBox.y) : null
				})
				.toBe(delta === 12 ? 0 : delta)
			await expect
				.poll(async () => {
					const box = await trace.boundingBox()
					return box ? Math.round(box.y - rowBox.y) : null
				})
				.toBe(0)
		}
		const entries = () =>
			list
				.locator(':scope > :not(.sidebar-panel-project-drag-source)')
				.evaluateAll((rows) =>
					rows.map((row) => row.getAttribute('data-project-id') ?? 'trace'),
				)
		const originEntries = projects.map((project) =>
			project.id === 'project-6' ? 'trace' : project.id,
		)
		await expect.poll(entries).toEqual(originEntries)
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ x, y: startY + 5 }],
		})
		await expect
			.poll(entries)
			.toEqual([
				'project-1',
				'project-2',
				'project-3',
				'project-4',
				'project-5',
				'project-7',
				'trace',
				'project-8',
				'project-9',
				'project-10',
				'project-11',
				'project-12',
			])
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ x, y: startY + 6 }],
		})
		await expect(
			list.locator(':scope > :not(.sidebar-panel-project-drag-source)').nth(6),
		).toHaveClass(/sidebar-panel-project-drop-trace/)
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ x, y: startY - 5 }],
		})
		await expect
			.poll(entries)
			.toEqual([
				'project-1',
				'project-2',
				'project-3',
				'project-4',
				'trace',
				'project-5',
				'project-7',
				'project-8',
				'project-9',
				'project-10',
				'project-11',
				'project-12',
			])
		await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
		await expect
			.poll(entries)
			.toEqual([
				'project-1',
				'project-2',
				'project-3',
				'project-4',
				'project-6',
				'project-5',
				'project-7',
				'project-8',
				'project-9',
				'project-10',
				'project-11',
				'project-12',
			])
		await expect.poll(() => service.getOrderRequests()).toBe(1)
		await session.detach()
	})
}
