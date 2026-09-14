'use client'

import { useState } from 'react'
import { Button } from './button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog'

export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = 'Delete',
	busyLabel = 'Deleting...',
	onConfirm,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: string
	confirmLabel?: string
	busyLabel?: string
	onConfirm: () => Promise<void>
}) {
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')

	async function confirm() {
		setBusy(true)
		setError('')
		try {
			await onConfirm()
			onOpenChange(false)
		} catch (error) {
			setError(error instanceof Error ? error.message : 'Unable to delete.')
		} finally {
			setBusy(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
			<DialogContent className="confirm-dialog max-w-sm">
				<DialogTitle className="confirm-dialog-title text-lg font-semibold">
					{title}
				</DialogTitle>
				<DialogDescription className="confirm-dialog-description mt-2 text-sm text-muted-foreground">
					{description}
				</DialogDescription>
				{error && (
					<p role="alert" className="confirm-dialog-error mt-4 text-sm text-rose-300">
						{error}
					</p>
				)}
				<div className="confirm-dialog-actions mt-6 flex justify-end gap-2">
					<Button
						className="confirm-dialog-cancel"
						variant="ghost"
						disabled={busy}
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						className="confirm-dialog-confirm"
						variant="destructive"
						disabled={busy}
						onClick={() => void confirm()}
					>
						{busy ? busyLabel : confirmLabel}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
