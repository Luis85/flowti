/**
 * esbuild.config.mjs — Bundles the Flowti CLI into .flowti/bin/.
 *
 * Produces a single ESM bundle:
 *   main.mjs — Full CLI including Ink TUI, chat renderer, and all pages.
 *
 * Ink/React are marked external — resolved from node_modules at runtime
 * via the symlink in .flowti/bin/node_modules.
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

// ── Single ESM bundle ───────────────────────────────────────────────
// Everything in one file — CLI core, TUI shell, chat renderer, all pages.
// Ink/React are external (ESM, resolved from node_modules via junction).

const mainOptions = {
	entryPoints: [path.join(projectRoot, "src/main.ts")],
	bundle: true,
	outfile: path.join(outDir, "main.mjs"),
	platform: "node",
	format: "esm",
	target: "node22",
	sourcemap: !isWatch,
	minify: !isWatch,
	banner: { js: "#!/usr/bin/env node" },
	external: [
		"node:*",
		"eslint",
		"typedoc",
		"ink",
		"react",
		"react/jsx-runtime",
		"@inkjs/ui",
		"yoga-wasm-web",
		"react-devtools-core",
	],
};

if (isWatch) {
	const mainCtx = await esbuild.context(mainOptions);
	await mainCtx.watch();
	console.log("  Watching for changes...");
} else {
	await esbuild.build(mainOptions);
	// Deploy bootstrap as index.mjs + package.json so `node .flowti/bin` works
	copyFileSync(
		path.join(projectRoot, "src", "boot", "bootstrap.mjs"),
		path.join(outDir, "index.mjs"),
	);
	writeFileSync(
		path.join(outDir, "package.json"),
		JSON.stringify({ type: "module", main: "index.mjs" }, null, 2) + "\n",
	);
	console.log(`  Built: .flowti/bin/main.mjs`);
	console.log(`  Copied: .flowti/bin/index.mjs`);
}
