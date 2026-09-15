import { NextResponse, type NextRequest } from 'next/server'
import { accessTokenMaxAgeSeconds, createAccessToken } from '@/lib/access'

export async function POST(request: NextRequest) {
	const password = process.env.APP_ACCESS_PASSWORD
	if (!password)
		return new NextResponse('APP_ACCESS_PASSWORD must be configured.', { status: 503 })
	const form = await request.formData()
	const next = String(form.get('next') ?? '/')
	const destination = next.startsWith('/') && !next.startsWith('//') ? next : '/'
	if (String(form.get('password') ?? '') !== password) {
		return NextResponse.redirect(
			new URL(`/access?error=1&next=${encodeURIComponent(destination)}`, request.url),
			303,
		)
	}
	const response = NextResponse.redirect(new URL(destination, request.url), 303)
	response.cookies.set('devboard_access', await createAccessToken(password), {
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: accessTokenMaxAgeSeconds,
	})
	return response
}
