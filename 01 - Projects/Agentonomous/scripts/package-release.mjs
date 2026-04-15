import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import archiver from 'archiver';

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf8'));
const distDir = resolve(process.cwd(), 'dist');
const zipPath = resolve(distDir, `agentonomous-${manifest.version}.zip`);
const files = ['main.js', 'manifest.json', 'styles.css'];

for (const f of files) {
	if (!existsSync(resolve(distDir, f))) {
		console.error(`[release] missing ${f} in dist/ — run npm run build first`);
		process.exit(1);
	}
}

const output = createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });
archive.on('error', (err) => { throw err; });
archive.pipe(output);
for (const f of files) archive.file(resolve(distDir, f), { name: f });
await archive.finalize();

console.log(`[release] wrote ${zipPath}`);
