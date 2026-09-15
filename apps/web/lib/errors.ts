export const appErrorCatalog = {
	AUTH_SERVICE_UNAVAILABLE: {
		message: 'Authentication service unavailable',
	},
	AUTH_SESSION_EXPIRED: {
		message: 'Your session has expired. Please sign in again.',
	},
	REQUEST_FAILED: {
		message: 'Request failed. Please try again.',
	},
} as const

export type AppErrorCode = keyof typeof appErrorCatalog

export interface AppErrorInfo {
	code: AppErrorCode
	message: string
}

export function getAppErrorInfo(error: unknown, fallback: string): AppErrorInfo {
	const message = error instanceof Error ? error.message : fallback
	const knownError = Object.entries(appErrorCatalog).find(
		([, details]) => details.message === message,
	)

	return knownError
		? {
				code: knownError[0] as AppErrorCode,
				message,
			}
		: {
				code: 'REQUEST_FAILED',
				message,
			}
}
