import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { concatStyles } from '../scripts/concat-styles.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function copyManifest(): Plugin {
	return {
		name: 'agentonomous-copy-manifest',
		closeBundle() {
			const src = resolve(projectRoot, 'manifest.json');
			const dest = resolve(projectRoot, 'dist', 'manifest.json');
			if (existsSync(src)) copyFileSync(src, dest);
		},
	};
}

function runDeploy(): Plugin {
	return {
		name: 'agentonomous-run-deploy',
		closeBundle() {
			execSync('node scripts/deploy-to-test-vault.mjs', { cwd: projectRoot, stdio: 'inherit' });
		},
	};
}

export default defineConfig({
	plugins: [
		vue(),
		concatStyles({ projectRoot }),
		copyManifest(),
		...(process.env['AGENTONOMOUS_DEPLOY'] === '1' ? [runDeploy()] : []),
	],
	build: {
		lib: {
			entry: resolve(projectRoot, 'src/main.ts'),
			formats: ['cjs'],
			fileName: () => 'main.js',
		},
		outDir: resolve(projectRoot, 'dist'),
		emptyOutDir: true,
		sourcemap: false,
		minify: true,
		rollupOptions: {
			external: ['obsidian', 'electron', /^node:/],
			output: {
				globals: { obsidian: 'obsidian' },
				banner: '/* Agentonomous — Obsidian plugin. Generated file, do not edit. */',
			},
		},
	},
});
