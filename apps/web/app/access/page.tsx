'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { LockKeyhole } from 'lucide-react'

function AccessForm() {
	const searchParams = useSearchParams()
	const next = searchParams.get('next') ?? '/'
	return (
		<main className="access-screen grid min-h-screen place-items-center p-6">
			<section className="access-card w-full max-w-sm rounded-xl border border-border bg-[#161b22] p-7 shadow-2xl">
				<form action="/api/access" method="post" className="access-form space-y-4">
					<input type="hidden" name="next" value={next} />
					<input
						aria-label="Password"
						name="password"
						type="password"
						autoComplete="current-password"
						autoFocus
						required
					/>
					{searchParams.get('error') && (
						<p role="alert" className="access-error text-sm text-rose-300">
							Incorrect password. Try again.
						</p>
					)}
					<button className="access-submit flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90">
						<LockKeyhole size={15} />
						Continue
					</button>
				</form>
			</section>
		</main>
	)
}

export default function AccessPage() {
	return (
		<Suspense fallback={<main className="access-loading min-h-screen bg-background" />}>
			<AccessForm />
		</Suspense>
	)
}
