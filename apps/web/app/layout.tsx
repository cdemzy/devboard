import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'
export const metadata: Metadata = {
	title: 'DevBoard',
	description: 'A focused board for your projects and tasks.',
}
export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en">
			<body>
				{children}
				<Toaster
					className="app-toaster"
					position="top-center"
					theme="dark"
					richColors
					mobileOffset={{ top: 12 }}
				/>
				<Analytics />
			</body>
		</html>
	)
}
