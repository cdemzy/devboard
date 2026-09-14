'use client'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
export const Dialog = DialogPrimitive.Root
export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description
export function DialogContent({
	children,
	className,
	hideClose = false,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { hideClose?: boolean }) {
	return (
		<DialogPrimitive.Portal>
			<DialogPrimitive.Overlay className="ui-dialog-overlay" data-no-drawer-drag="true" />
			<DialogPrimitive.Content
				className={cn('ui-dialog-content', className)}
				data-no-drawer-drag="true"
				{...props}
			>
				{children}
				{!hideClose && (
					<DialogPrimitive.Close aria-label="Close dialog" className="ui-dialog-close">
						<X size={16} />
					</DialogPrimitive.Close>
				)}
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	)
}
