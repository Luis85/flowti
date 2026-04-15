import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export function concatStyles({ projectRoot }) {
	return {
		name: 'agentonomous-concat-styles',
		closeBundle() {
			const stylesDir = resolve(projectRoot, 'styles');
			const distDir = resolve(projectRoot, 'dist');
			if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
			if (!existsSync(stylesDir)) {
				writeFileSync(resolve(distDir, 'styles.css'), '/* agentonomous: no styles */\n');
				return;
			}
			const files = readdirSync(stylesDir).filter((f) => f.endsWith('.css')).sort();
			const chunks = files.map((f) => {
				const body = readFileSync(resolve(stylesDir, f), 'utf8');
				return `/* ==== ${f} ==== */\n${body}\n`;
			});
			writeFileSync(resolve(distDir, 'styles.css'), chunks.join('\n'));
		},
	};
}
