import { defineConfig, type Plugin } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

function copyDir(srcDir: string, destDir: string, ext?: string): void {
	if (!existsSync(srcDir)) return;
	mkdirSync(destDir, { recursive: true });
	for (const file of readdirSync(srcDir)) {
		if (ext && !file.endsWith(ext)) continue;
		copyFileSync(resolve(srcDir, file), resolve(destDir, file));
	}
}

/**
 * Vite plugin that assembles a portable vault overlay in dist/:
 *   .obsidian/plugins/project-meridian/  — plugin binary + manifest + styles
 *   03 - Resources/Agents/              — agent JSON data
 *   03 - Resources/Personas/            — persona markdown files
 *
 * Copy dist/ contents into any Obsidian vault to install.
 */
function assembleVaultOverlay(): Plugin {
	return {
		name: 'assemble-vault-overlay',
		closeBundle() {
			const distDir = resolve(projectRoot, 'dist');

			// Plugin binary → .obsidian/plugins/project-meridian/
			const pluginDir = resolve(distDir, '.obsidian/plugins/project-meridian');
			mkdirSync(pluginDir, { recursive: true });
			for (const file of ['main.js', 'main.js.map']) {
				const src = resolve(distDir, file);
				if (existsSync(src)) copyFileSync(src, resolve(pluginDir, file));
			}
			for (const file of ['manifest.json', 'styles.css']) {
				const src = resolve(projectRoot, file);
				if (existsSync(src)) copyFileSync(src, resolve(pluginDir, file));
			}

			// Clean up root-level build artifacts (now inside plugin dir)
			for (const file of ['main.js', 'main.js.map']) {
				const rootFile = resolve(distDir, file);
				if (existsSync(rootFile)) unlinkSync(rootFile);
			}

			// Agent data → 03 - Resources/Agents/
			copyDir(
				resolve(projectRoot, 'agents'),
				resolve(distDir, '03 - Resources/Agents'),
				'.json',
			);

			// Persona files → 03 - Resources/Personas/
			copyDir(
				resolve(projectRoot, 'personas'),
				resolve(distDir, '03 - Resources/Personas'),
				'.md',
			);

			// Location data → 03 - Resources/Locations/
			copyDir(
				resolve(projectRoot, 'locations'),
				resolve(distDir, '03 - Resources/Locations'),
				'.json',
			);

			// Behavior trees → 03 - Resources/BehaviorTrees/
			copyDir(
				resolve(projectRoot, 'behavior-trees'),
				resolve(distDir, '03 - Resources/BehaviorTrees'),
				'.mdsl',
			);

			// Trait definitions → 03 - Resources/Traits/ (JSON + markdown)
			copyDir(resolve(projectRoot, 'traits'), resolve(distDir, '03 - Resources/Traits'), '.json');
			copyDir(resolve(projectRoot, 'traits'), resolve(distDir, '03 - Resources/Traits'), '.md');

			// Region data → 03 - Resources/Regions/
			copyDir(resolve(projectRoot, 'regions'), resolve(distDir, '03 - Resources/Regions'), '.json');

			// Item data → 03 - Resources/Items/
			copyDir(resolve(projectRoot, 'items'), resolve(distDir, '03 - Resources/Items'), '.json');

			// World documentation → 03 - Resources/
			copyDir(resolve(projectRoot, 'items'), resolve(distDir, '03 - Resources/Items'), '.md');
			copyDir(resolve(projectRoot, 'jobs'), resolve(distDir, '03 - Resources/Jobs'), '.md');
			copyDir(resolve(projectRoot, 'properties'), resolve(distDir, '03 - Resources/Properties'), '.md');
			copyDir(resolve(projectRoot, 'graphs'), resolve(distDir, '03 - Resources/Graphs'), '.canvas');

			// Generate build artifacts from game data
			const scripts = [
				'node scripts/generate-readme.mjs',
				'node scripts/generate-world-snapshot.mjs',
			];
			for (const script of scripts) {
				try {
					execSync(script, { cwd: projectRoot, stdio: 'inherit' });
				} catch {
					console.warn(`[build] ${script} failed — skipping`);
				}
			}
		},
	};
}

export default defineConfig({
	plugins: [assembleVaultOverlay()],
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
