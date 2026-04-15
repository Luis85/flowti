import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, defineProject } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
	test: {
		root: projectRoot,
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts', 'src/**/*.vue'],
			exclude: ['src/main.ts', 'src/plugin.ts'],
			thresholds: {
				statements: 80,
				lines: 80,
				branches: 70,
				functions: 80,
			},
		},
		projects: [
			defineProject({
				plugins: [vue()],
				test: {
					name: 'unit',
					environment: 'jsdom',
					globals: true,
					include: ['tests/**/*.test.ts'],
				},
			}),
			defineProject({
				plugins: [
					vue(),
					storybookTest({ configDir: resolve(projectRoot, 'configs/storybook') }),
				],
				test: {
					name: 'storybook',
					environment: 'jsdom',
					globals: true,
					setupFiles: [],
				},
			}),
		],
	},
});
