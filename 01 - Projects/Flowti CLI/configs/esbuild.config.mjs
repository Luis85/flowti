/**
 * esbuild.config.mjs — Bundles the Flowti CLI into .flowti/bin/main.js.
 *
 * Usage:
 *   node configs/esbuild.config.mjs           Build once
 *   node configs/esbuild.config.mjs --watch   Watch mode (rebuilds on change)
 */

import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, copyFileSync, writeFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const vaultRoot = path.resolve(projectRoot, "..", "..");
const outDir = path.join(vaultRoot, ".flowti", "bin");
const isWatch = process.argv.includes("--watch");

// Ensure output directory exists
mkdirSync(outDir, { recursive: true });

const options = {
	entryPoints: [path.join(projectRoot, "src/main.ts")],
	bundle: true,
	outfile: path.join(outDir, "main.js"),
	platform: "node",
	format: "esm",
	target: "node22",
	sourcemap: !isWatch,
	minify: !isWatch,
	banner: { js: "#!/usr/bin/env node" },
	external: [
		"node:*",
		"@pythonidaer/complexity-report",
		"@pythonidaer/complexity-report/*",
		"eslint",
		"typedoc",
	],
};

if (isWatch) {
	const ctx = await esbuild.context(options);
	await ctx.watch();
	console.log("  Watching for changes...");
} else {
	await esbuild.build(options);
	// Deploy bootstrap as index.js + package.json so `node .flowti/bin` works
	copyFileSync(
		path.join(projectRoot, "src", "boot", "bootstrap.mjs"),
		path.join(outDir, "index.js"),
	);
	writeFileSync(
		path.join(outDir, "package.json"),
		'{ "type": "module" }\n',
	);
	console.log(`  Built: .flowti/bin/main.js`);
	console.log(`  Copied: .flowti/bin/index.js`);
}
