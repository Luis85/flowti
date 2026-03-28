import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	build: {
		lib: {
			entry: resolve(__dirname, '../src/main.ts'),
			formats: ['cjs'],
			fileName: () => 'main.js',
		},
		outDir: resolve(__dirname, '../dist'),
		emptyOutDir: true,
		sourcemap: true,
		rollupOptions: {
			external: ['obsidian', 'electron'],
			output: {
				globals: {
					obsidian: 'obsidian',
				},
			},
		},
	},
});
