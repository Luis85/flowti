import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const vault = process.env.AGENTONOMOUS_TEST_VAULT ?? 'C:\\Projects\\Agentonomous';
const distDir = resolve(process.cwd(), 'dist');
const targetDir = resolve(vault, '.obsidian', 'plugins', 'agentonomous');
const files = ['main.js', 'manifest.json', 'styles.css'];

mkdirSync(targetDir, { recursive: true });

for (const file of files) {
	const src = resolve(distDir, file);
	if (!existsSync(src)) {
		console.error(`[deploy] missing ${file} in dist/ — run \`npm run build\` first`);
		process.exit(1);
	}
	const dest = resolve(targetDir, file);
	copyFileSync(src, dest);
	const { size } = statSync(dest);
	console.log(`[deploy] ${file} -> ${dest} (${size} bytes)`);
}

console.log(`[deploy] ok — plugin deployed to ${targetDir}`);
