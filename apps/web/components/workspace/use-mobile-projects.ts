import { useEffect, useRef, useState } from 'react'
import { animate, useMotionValue } from 'motion/react'
interface MobileDrawerDragState {
	pointerId: number
	startX: number
	startY: number
	initialOffset: number
	axis: 'pending' | 'horizontal'
	isDragging: boolean
}

const mobileDrawerSpring = {
	type: 'spring',
	stiffness: 420,
	damping: 38,
	mass: 0.7,
} as const

export const mobileButtonTapTransition = {
	type: 'spring',
	stiffness: 620,
	damping: 24,
	mass: 0.45,
} as const

export function useMobileProjects(onCloseAccount: () => void) {
	const [isMobileProjectsOpen, setIsMobileProjectsOpen] = useState(false)
	const [isMobileDrawerRevealed, setIsMobileDrawerRevealed] = useState(false)
	const [isMobileViewport, setIsMobileViewport] = useState(false)
	const mobilePanelX = useMotionValue(0)
	const mobileDrawerDrag = useRef<MobileDrawerDragState | null>(null)
	const isMobilePanelVisible = isMobileViewport && isMobileProjectsOpen
	useEffect(() => {
		const mediaQuery = window.matchMedia('(max-width: 767px)')
		const handleViewportChange = () => {
			setIsMobileViewport(mediaQuery.matches)
			if (!mediaQuery.matches) setIsMobileDrawerRevealed(false)
		}

		handleViewportChange()
		mediaQuery.addEventListener('change', handleViewportChange)

		return () => mediaQuery.removeEventListener('change', handleViewportChange)
	}, [])

	useEffect(() => {
		if (!isMobileViewport) {
			mobilePanelX.jump(0)
			return
		}

		const controls = animate(
			mobilePanelX,
			isMobilePanelVisible ? getMobileDrawerWidth() : 0,
			mobileDrawerSpring,
		)

		if (!isMobilePanelVisible) {
			void controls.then(() => setIsMobileDrawerRevealed(false))
		}

		return controls.stop
	}, [isMobilePanelVisible, isMobileViewport, mobilePanelX])

	useEffect(() => {
		if (!isMobilePanelVisible) return

		const previousBodyOverflow = document.body.style.overflow
		const previousRootOverflow = document.documentElement.style.overflow
		document.body.style.overflow = 'hidden'
		document.documentElement.style.overflow = 'hidden'

		return () => {
			document.body.style.overflow = previousBodyOverflow
			document.documentElement.style.overflow = previousRootOverflow
		}
	}, [isMobilePanelVisible])
	function closeMobileProjects() {
		setIsMobileProjectsOpen(false)
		onCloseAccount()
	}

	function toggleMobileProjects() {
		setIsMobileProjectsOpen((open) => {
			if (!open) setIsMobileDrawerRevealed(true)
			return !open
		})
	}

	function getMobileDrawerWidth() {
		return Math.min(window.innerWidth * 0.78, 384)
	}

	function isDrawerDragExcludedTarget(target: EventTarget | null) {
		return (
			target instanceof Element &&
			Boolean(target.closest('button, a, input, textarea, select, [data-no-drawer-drag]'))
		)
	}

	function handleMobilePanelPointerDown(event: React.PointerEvent<HTMLElement>) {
		if (
			!isMobileViewport ||
			event.pointerType !== 'touch' ||
			(!isMobilePanelVisible && event.clientX > 32) ||
			isDrawerDragExcludedTarget(event.target)
		) {
			return
		}

		mobileDrawerDrag.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			initialOffset: isMobilePanelVisible ? getMobileDrawerWidth() : 0,
			axis: 'pending',
			isDragging: false,
		}
		mobilePanelX.jump(mobilePanelX.get())
	}

	function handleMobilePanelPointerMove(event: React.PointerEvent<HTMLElement>) {
		const drag = mobileDrawerDrag.current
		if (!drag || drag.pointerId !== event.pointerId) return

		const horizontalDistance = event.clientX - drag.startX
		const verticalDistance = event.clientY - drag.startY

		if (drag.axis === 'pending') {
			if (Math.max(Math.abs(horizontalDistance), Math.abs(verticalDistance)) < 8) {
				return
			}

			if (Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) {
				mobileDrawerDrag.current = null
				return
			}

			if (!isMobilePanelVisible && horizontalDistance < 0) {
				mobileDrawerDrag.current = null
				return
			}

			drag.axis = 'horizontal'
			drag.isDragging = true
			setIsMobileDrawerRevealed(true)
			event.currentTarget.setPointerCapture(event.pointerId)
		}

		const drawerWidth = getMobileDrawerWidth()
		const nextOffset = Math.min(
			drawerWidth,
			Math.max(0, drag.initialOffset + horizontalDistance),
		)
		mobilePanelX.set(nextOffset)
	}

	function handleMobilePanelPointerEnd(event: React.PointerEvent<HTMLElement>) {
		const drag = mobileDrawerDrag.current
		if (!drag || drag.pointerId !== event.pointerId) return

		mobileDrawerDrag.current = null

		if (!drag.isDragging) return

		const drawerWidth = getMobileDrawerWidth()
		const finalOffset =
			event.type === 'pointercancel'
				? drag.initialOffset
				: Math.min(
						drawerWidth,
						Math.max(0, drag.initialOffset + event.clientX - drag.startX),
					)
		const shouldOpen = finalOffset >= drawerWidth / 2
		setIsMobileProjectsOpen(shouldOpen)
		void animate(mobilePanelX, shouldOpen ? drawerWidth : 0, mobileDrawerSpring)
	}

	return {
		isMobileProjectsOpen,
		isMobileDrawerRevealed,
		isMobileViewport,
		isMobilePanelVisible,
		mobilePanelX,
		closeMobileProjects,
		toggleMobileProjects,
		handleMobilePanelPointerDown,
		handleMobilePanelPointerMove,
		handleMobilePanelPointerEnd,
	}
}
