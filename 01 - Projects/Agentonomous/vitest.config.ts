import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

const projectRoot = dirname(fileURLToPath(import.meta.url));

// @storybook/addon-vitest uses path.relative() and path.normalize() which
// return backslashes on Windows. Vitest glob patterns require forward slashes.
function fixWindowsPaths(): Plugin {
	return {
		name: 'fix-windows-paths',
		configResolved(config) {
			const test = (config as Record<string, unknown>).test as Record<string, unknown> | undefined;
			if (!test) return;
			if (Array.isArray(test.include)) {
				test.include = test.include.map((p: string) => p.replaceAll('\\', '/'));
			}
			if (typeof test.name === 'string') {
				test.name = test.name.replaceAll('\\', '/');
			}
		},
	};
}

export default defineConfig({
	test: {
		root: projectRoot,
		projects: [
			{
				plugins: [vue()],
				resolve: {
					alias: {
						obsidian: resolve(projectRoot, 'tests/__stubs__/obsidian.ts'),
					},
				},
				test: {
					name: 'unit',
					environment: 'jsdom',
					globals: true,
					include: ['tests/**/*.test.ts'],
					coverage: {
						provider: 'v8',
						include: ['src/**/*.ts', 'src/**/*.vue'],
						exclude: [
							'src/main.ts',
							'src/plugin.ts',
							'**/locales/**',
						],
						reporter: ['text', 'html', 'json-summary'],
						reportsDirectory: 'coverage',
						thresholds: {
							statements: 80,
							lines: 80,
							branches: 70,
							functions: 80,
						},
					},
				},
			},
			{
				plugins: [
					vue(),
					storybookTest({ configDir: resolve(projectRoot, '.storybook') }),
					fixWindowsPaths(),
				],
				test: {
					name: 'storybook',
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({}),
						instances: [{ browser: 'chromium' }],
					},
					coverage: {
						provider: 'v8',
						include: ['src/ui/**/*.ts', 'src/ui/**/*.vue'],
						reporter: ['text', 'html'],
						reportsDirectory: 'coverage/storybook',
					},
				},
			},
		],
	},
});
