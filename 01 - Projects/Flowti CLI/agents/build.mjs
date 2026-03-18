/**
 * build.mjs — Bundles the ExcaliburJS dashboard into .flowti/site/.
 *
 * Usage: node build.mjs [--outdir=<path>]
 *
 * Output:
 *   <outdir>/dashboard.js   — bundled JS
 *   <outdir>/index.html     — copied from project root
 *   <outdir>/assets/...     — character sprite PNGs
 */

import { build } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outdirArg = process.argv.find((a) => a.startsWith("--outdir="));
// Default: vault root's .flowti/agents/
// agents/ → Flowti CLI/ → 01 - Projects/ → vault root
const outDir = outdirArg
	? resolve(outdirArg.slice("--outdir=".length))
	: resolve(__dirname, "../../../.flowti/agents");

mkdirSync(outDir, { recursive: true });
mkdirSync(resolve(outDir, "data"), { recursive: true });

await build({
	entryPoints: [resolve(__dirname, "src/main.ts")],
	bundle: true,
	outfile: resolve(outDir, "dashboard.js"),
	format: "esm",
	platform: "browser",
	target: "es2022",
	sourcemap: true,
	minify: false,
	logLevel: "info",
});

copyFileSync(resolve(__dirname, "index.html"), resolve(outDir, "index.html"));

// ── Copy character sprite assets ────────────────────────────────────
const assetsDir = resolve(__dirname, "assets/Actor/Characters");
if (existsSync(assetsDir)) {
	const characters = readdirSync(assetsDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name);

	for (const char of characters) {
		const animDir = join(assetsDir, char, "SeparateAnim");
		if (!existsSync(animDir)) continue;

		const outAnimDir = resolve(outDir, "assets/Actor/Characters", char, "SeparateAnim");
		mkdirSync(outAnimDir, { recursive: true });

		for (const file of ["Idle.png", "Walk.png"]) {
			const src = join(animDir, file);
			if (existsSync(src)) {
				copyFileSync(src, join(outAnimDir, file));
			}
		}
	}
	console.log(`Copied sprite assets for ${characters.length} characters`);
}

console.log("Dashboard built → .flowti/agents/");
