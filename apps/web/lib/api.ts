import { getSupabase } from './supabase'
import { appErrorCatalog } from './errors'
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
	const { data, error } = await getSupabase().auth.getSession()
	if (error || !data.session)
		throw new Error(appErrorCatalog.AUTH_SESSION_EXPIRED.message)
	const response = await fetch(
		`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${path}`,
		{
			...options,
			cache: 'no-store',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${data.session.access_token}`,
				...options.headers,
			},
		},
	)
	if (!response.ok) {
		const body = await response.json().catch(() => ({}))
		throw new Error(
			typeof body.detail === 'string'
				? body.detail
				: `Request failed (${response.status}). Please try again.`,
		)
	}
	return response.status === 204 ? (undefined as T) : response.json()
}
export const json = (method: string, data?: unknown): RequestInit => ({
	method,
	...(data === undefined ? {} : { body: JSON.stringify(data) }),
})
