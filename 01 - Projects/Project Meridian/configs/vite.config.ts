import { defineConfig, type Plugin } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

/**
 * Vite plugin that copies manifest.json and styles.css into dist/
 * after build — producing a complete Obsidian plugin distribution folder.
 */
function copyPluginAssets(): Plugin {
	return {
		name: 'copy-obsidian-plugin-assets',
		closeBundle() {
			const distDir = resolve(projectRoot, 'dist');
			const assets = ['manifest.json', 'styles.css'];

			for (const file of assets) {
				const src = resolve(projectRoot, file);
				const dest = resolve(distDir, file);
				if (existsSync(src)) {
					copyFileSync(src, dest);
				}
			}
		},
	};
}

export default defineConfig({
	plugins: [copyPluginAssets()],
	build: {
		lib: {
			entry: resolve(projectRoot, 'src/main.ts'),
			formats: ['cjs'],
			fileName: () => 'main.js',
		},
		outDir: resolve(projectRoot, 'dist'),
		emptyOutDir: true,
		sourcemap: true,
		minify: true,
		rollupOptions: {
			external: ['obsidian', 'electron', /^@codemirror\//, /^@lezer\//],
			output: {
				globals: {
					obsidian: 'obsidian',
				},
				banner: '/* Project Meridian — Obsidian Plugin. Generated file, do not edit. */',
			},
		},
	},
});
