import type { NextConfig } from 'next'
const browserTest = process.env.DEVBOARD_BROWSER_TEST === '1'
const config: NextConfig = {
	// Isolate browser test output from a developer's running instance.
	distDir: browserTest ? '.next-test' : '.next',
	typescript: {
		tsconfigPath: browserTest ? 'tsconfig.e2e.json' : 'tsconfig.json',
	},
}
export default config
