import { test, expect } from '@playwright/test'
import { openDashboard, createProjects } from './helpers/dashboard'

interface SidebarFrame {
	width: number
	panelLeft: number
	labelOpacity: string
}
interface SidebarRecording {
	frames: SidebarFrame[]
	widthTransitions: number
}

declare global {
	interface Window {
		sidebarRecording: SidebarRecording
	}
}

test('wide desktop sidebar is expanded from its first frame without a width transition', async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 900 })
	await page.addInitScript(() => {
		const browserWindow = window
		browserWindow.sidebarRecording = { frames: [], widthTransitions: 0 }
		document.addEventListener('transitionrun', (event) => {
			if (
				event.propertyName === 'width' &&
				event.target instanceof Element &&
				event.target.matches('.sidebar-panel')
			) {
				browserWindow.sidebarRecording.widthTransitions += 1
			}
		})
		function recordFrame() {
			const sidebar = document.querySelector('.sidebar-panel')
			const panel = document.querySelector('.project-panel')
			const label = document.querySelector('.sidebar-panel-brand > span')
			if (sidebar && panel && label) {
				browserWindow.sidebarRecording.frames.push({
					width: sidebar.getBoundingClientRect().width,
					panelLeft: panel.getBoundingClientRect().left,
					labelOpacity: getComputedStyle(label).opacity,
				})
			}
			if (browserWindow.sidebarRecording.frames.length < 20)
				requestAnimationFrame(recordFrame)
		}
		requestAnimationFrame(recordFrame)
	})
	await openDashboard(page, createProjects(['First project']))
	await expect
		.poll(() => page.evaluate(() => window.sidebarRecording.frames.length))
		.toBe(20)
	const recording = await page.evaluate(() => window.sidebarRecording)
	expect(recording.widthTransitions).toBe(0)
	for (const frame of recording.frames) {
		expect(frame).toEqual({ width: 256, panelLeft: 256, labelOpacity: '1' })
	}
})

test('narrow desktop sidebar still expands on hover while wide desktop stays open', async ({
	page,
}) => {
	await page.setViewportSize({ width: 1100, height: 900 })
	await openDashboard(page, createProjects(['First project']))
	const sidebar = page.locator('.sidebar-panel')
	await page.mouse.move(500, 500)
	await expect(sidebar).toHaveCSS('width', '64px')
	await sidebar.hover()
	await expect(sidebar).toHaveCSS('width', '256px')
	await page.mouse.move(500, 500)
	await expect(sidebar).toHaveCSS('width', '64px')
	await page.setViewportSize({ width: 1440, height: 900 })
	await expect(sidebar).toHaveCSS('width', '256px')
	await expect(sidebar).toHaveCSS('transition-property', 'none')
	await expect(page.locator('.project-panel')).toHaveCSS('margin-left', '256px')
})
