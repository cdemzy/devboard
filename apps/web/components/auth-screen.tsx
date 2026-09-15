'use client'
import { useState } from 'react'
import { Layers3, ArrowRight } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
export function AuthScreen() {
	const [signup, setSignup] = useState(false)
	const [busy, setBusy] = useState(false)
	const [message, setMessage] = useState('')
	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setBusy(true)
		setMessage('')
		const form = new FormData(event.currentTarget)
		const credentials = {
			email: String(form.get('email')).trim(),
			password: String(form.get('password')),
		}
		try {
			const auth = getSupabase().auth
			const { data, error } = signup
				? await auth.signUp({
						...credentials,
						options: { emailRedirectTo: window.location.origin },
					})
				: await auth.signInWithPassword(credentials)
			if (error) throw error
			if (signup && !data.session)
				setMessage('Check your email to confirm your account, then sign in.')
		} catch (error) {
			setMessage(error instanceof Error ? error.message : 'Unable to sign in.')
		} finally {
			setBusy(false)
		}
	}
	return (
		<main className="auth-screen flex min-h-screen items-center justify-center px-5">
			<div className="auth-content w-full max-w-sm">
				<div className="auth-brand mb-12 flex items-center gap-2.5 font-semibold tracking-tight">
					<Layers3 className="text-primary" size={24} /> DevBoard
				</div>
				<h1 className="auth-title text-2xl font-semibold tracking-tight">
					{signup ? 'Create your account' : 'Welcome back'}
				</h1>
				<p className="mb-7 mt-2 text-muted-foreground">
					{signup
						? 'A little structure for your next big idea.'
						: 'Your projects, right where you left them.'}
				</p>
				<form onSubmit={submit} className="auth-form space-y-4">
					<label>
						Email
						<input
							type="email"
							name="email"
							autoComplete="email"
							required
							maxLength={254}
							placeholder="you@example.com"
							className="auth-input"
						/>
					</label>
					<label>
						Password
						<input
							type="password"
							name="password"
							autoComplete={signup ? 'new-password' : 'current-password'}
							minLength={8}
							required
							placeholder="At least 8 characters"
							className="auth-input"
						/>
					</label>
					{message && (
						<p role="status" className="auth-message text-sm text-amber-200">
							{message}
						</p>
					)}
					<Button className="auth-submit w-full" disabled={busy}>
						{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
						<ArrowRight size={15} />
					</Button>
				</form>
				<p className="auth-mode-prompt mt-6 text-center text-sm text-muted-foreground">
					{signup ? 'Already have an account?' : 'New to DevBoard?'}{' '}
					<button
						className="auth-mode-toggle text-foreground underline underline-offset-4"
						onClick={() => {
							setSignup(!signup)
							setMessage('')
						}}
					>
						{signup ? 'Sign in' : 'Create an account'}
					</button>
				</p>
			</div>
		</main>
	)
}
