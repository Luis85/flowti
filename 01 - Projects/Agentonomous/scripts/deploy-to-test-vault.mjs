import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const configPath = resolve(process.cwd(), 'configs', 'deploy-targets.json');
if (!existsSync(configPath)) {
	console.error('[deploy] configs/deploy-targets.json not found');
	process.exit(1);
}

const { targets } = JSON.parse(readFileSync(configPath, 'utf8'));
if (!targets?.length) {
	console.error('[deploy] no targets defined in configs/deploy-targets.json');
	process.exit(1);
}

const distDir = resolve(process.cwd(), 'dist');
const files = ['main.js', 'manifest.json', 'styles.css'];

for (const file of files) {
	const src = resolve(distDir, file);
	if (!existsSync(src)) {
		console.error(`[deploy] missing ${file} in dist/ — run \`npm run build\` first`);
		process.exit(1);
	}
}

for (const { name, path: vaultPath } of targets) {
	const targetDir = resolve(vaultPath, '.obsidian', 'plugins', 'agentonomous');
	mkdirSync(targetDir, { recursive: true });

	for (const file of files) {
		const src = resolve(distDir, file);
		const dest = resolve(targetDir, file);
		copyFileSync(src, dest);
		const { size } = statSync(dest);
		console.log(`[deploy:${name}] ${file} -> ${dest} (${size} bytes)`);
	}

	console.log(`[deploy:${name}] ok`);
}
