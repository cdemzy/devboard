import { useEffect, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { LogOut } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { Button } from '../ui/button'
export function AccountMenu({
	email,
	open,
	close,
	reportError,
	containerRef,
	variant = 'popover',
}: {
	email: string
	open: boolean
	close: () => void
	reportError: (message: string) => void
	containerRef: RefObject<HTMLElement | null>
	variant?: 'popover' | 'sidebar' | 'drawer'
}) {
	const isSidebarPanel = variant === 'sidebar'
	const isDrawerPanel = variant === 'drawer'
	useEffect(() => {
		if (!open) return

		function closeWhenOutside(event: Event) {
			if (!containerRef.current?.contains(event.target as Node)) close()
		}

		document.addEventListener('pointerdown', closeWhenOutside)
		document.addEventListener('focusin', closeWhenOutside)

		return () => {
			document.removeEventListener('pointerdown', closeWhenOutside)
			document.removeEventListener('focusin', closeWhenOutside)
		}
	}, [close, containerRef, open])
	return (
		<AnimatePresence>
			{open && (
				<motion.div
					initial={{ opacity: 0, y: isSidebarPanel ? 6 : -6 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: isSidebarPanel ? 6 : -6 }}
					transition={{ duration: 0.16 }}
					className={`sidebar-panel-account-menu border border-border bg-[#161b22] p-2 ${isSidebarPanel ? 'mb-2 w-full rounded-md' : isDrawerPanel ? 'absolute right-0 top-full z-30 mt-1 w-52 max-w-[calc(100vw-2rem)] rounded-lg shadow-xl' : 'absolute right-0 top-full z-30 mt-1 w-56 rounded-lg shadow-xl'}`}
				>
					<p className="sidebar-panel-account-email truncate px-2 py-2 text-xs text-muted-foreground">
						{email}
					</p>
					<Button
						variant="ghost"
						size="sm"
						className="sidebar-panel-logout w-full justify-start transition-transform active:scale-95"
						onClick={async () => {
							try {
								const { error } = await getSupabase().auth.signOut()
								if (error) throw error
								close()
							} catch (error) {
								reportError(error instanceof Error ? error.message : 'Unable to log out.')
							}
						}}
					>
						<LogOut size={15} />
						Log out
					</Button>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
