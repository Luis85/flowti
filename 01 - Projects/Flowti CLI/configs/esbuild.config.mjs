/**
 * esbuild.config.mjs — Bundles the Flowti CLI into .flowti/bin/.
 *
 * Produces a single ESM bundle:
 *   main.mjs — ESM bundle (core CLI + TUI + chat, ink/react external)
 *
 * Ink/React are marked external and resolved at runtime from node_modules.
 * Dynamic imports in main.ts ensure Ink is only loaded for interactive paths.
 *
 * Usage:
 *   node configs/esbuild.config.mjs           Build once
 *   node configs/esbuild.config.mjs --watch   Watch mode (rebuilds on change)
 */

import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, copyFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const vaultRoot = path.resolve(projectRoot, "..", "..");
const outDir = path.join(vaultRoot, ".flowti", "bin");
const isWatch = process.argv.includes("--watch");

// Ensure output directory exists
mkdirSync(outDir, { recursive: true });

const INK_EXTERNALS = [
	"ink",
	"react",
	"react/jsx-runtime",
	"@inkjs/ui",
	"yoga-wasm-web",
	"react-devtools-core",
];

// ── Single ESM bundle ────────────────────────────────────────────────
const mainOptions = {
	entryPoints: [path.join(projectRoot, "src/main.ts")],
	bundle: true,
	outfile: path.join(outDir, "main.mjs"),
	platform: "node",
	format: "esm",
	target: "node22",
	sourcemap: !isWatch,
	minify: !isWatch,
	banner: {
		js: [
			"#!/usr/bin/env node",
			'import { createRequire } from "node:module";',
			"const require = createRequire(import.meta.url);",
		].join("\n"),
	},
	external: [
		"node:*",
		"eslint",
		"typedoc",
		...INK_EXTERNALS,
	],
};

if (isWatch) {
	const ctx = await esbuild.context(mainOptions);
	await ctx.watch();
	console.log("  Watching for changes...");
} else {
	await esbuild.build(mainOptions);
	// Clean up stale artifacts from the old 3-bundle build (main.js, tui.mjs, chat.mjs)
	for (const stale of ["main.js", "main.js.map", "tui.mjs", "tui.mjs.map", "chat.mjs", "chat.mjs.map"]) {
		const p = path.join(outDir, stale);
		if (existsSync(p)) { try { unlinkSync(p); } catch { /* ignore */ } }
	}
	// Deploy bootstrap as index.mjs + package.json so `node .flowti/bin` works
	copyFileSync(
		path.join(projectRoot, "src", "boot", "bootstrap.mjs"),
		path.join(outDir, "index.mjs"),
	);
	writeFileSync(
		path.join(outDir, "package.json"),
		JSON.stringify({ type: "module" }, null, 2) + "\n",
	);
	console.log(`  Built: .flowti/bin/main.mjs`);
	console.log(`  Copied: .flowti/bin/index.mjs`);
}
