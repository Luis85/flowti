import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
	test: {
		globals: true,
		environment: 'jsdom',
		root: projectRoot,
		include: ['tests/**/*.test.ts'],
		setupFiles: ['tests/setup/canvas-stub.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: ['src/main.ts', 'src/plugin.ts'],
			thresholds: {
				statements: 80,
				lines: 80,
			},
		},
	},
});
