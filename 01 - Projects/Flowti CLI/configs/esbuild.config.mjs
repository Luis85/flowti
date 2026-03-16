/**
 * esbuild.config.mjs — Bundles the Flowti CLI into .flowti/bin/.
 *
 * Produces three bundles:
 *   main.js  — CJS bundle (core CLI, no ink/react)
 *   tui.mjs  — ESM bundle (Ink TUI shell + all pages)
 *   chat.mjs — ESM bundle (ink chat renderer + React components)
 *
 * The CJS bundle loads tui.mjs / chat.mjs at runtime via pathToFileURL +
 * dynamic import(). This avoids CJS/ESM interop issues with ink (ESM-only,
 * top-level await).
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

const INK_EXTERNALS = [
	"ink",
	"react",
	"react/jsx-runtime",
	"@inkjs/ui",
	"yoga-wasm-web",
	"react-devtools-core",
];

// ── Bundle 1: Main CLI (CJS) ────────────────────────────────────────
// Excludes ink/react — they're loaded via tui.mjs / chat.mjs when needed.

const mainOptions = {
	entryPoints: [path.join(projectRoot, "src/main.ts")],
	bundle: true,
	outfile: path.join(outDir, "main.js"),
	platform: "node",
	format: "cjs",
	target: "node22",
	sourcemap: !isWatch,
	minify: !isWatch,
	banner: { js: "#!/usr/bin/env node" },
	external: [
		"node:*",
		"eslint",
		"typedoc",
		...INK_EXTERNALS,
	],
};

// ── Bundle 2: TUI shell (ESM) ──────────────────────────────────────
// Ink TUI with all pages, loaders, and primitives.
// Loaded at runtime via pathToFileURL + dynamic import() from main.ts.

const tuiOptions = {
	entryPoints: [path.join(projectRoot, "src/tui/tui-entry.ts")],
	bundle: true,
	outfile: path.join(outDir, "tui.mjs"),
	platform: "node",
	format: "esm",
	target: "node22",
	sourcemap: !isWatch,
	minify: !isWatch,
	external: ["node:*", ...INK_EXTERNALS],
};

// ── Bundle 3: Chat renderer (ESM) ───────────────────────────────────
// Ink is ESM-only with top-level await — must be an ESM bundle.
// Loaded at runtime via pathToFileURL + dynamic import() from chat-handlers.ts.

const chatOptions = {
	entryPoints: [path.join(projectRoot, "src/infrastructure/chat/ink-chat-renderer.ts")],
	bundle: true,
	outfile: path.join(outDir, "chat.mjs"),
	platform: "node",
	format: "esm",
	target: "node22",
	sourcemap: !isWatch,
	minify: !isWatch,
	external: ["node:*", ...INK_EXTERNALS],
};

if (isWatch) {
	const [mainCtx, tuiCtx, chatCtx] = await Promise.all([
		esbuild.context(mainOptions),
		esbuild.context(tuiOptions),
		esbuild.context(chatOptions),
	]);
	await Promise.all([mainCtx.watch(), tuiCtx.watch(), chatCtx.watch()]);
	console.log("  Watching for changes...");
} else {
	await Promise.all([
		esbuild.build(mainOptions),
		esbuild.build(tuiOptions),
		esbuild.build(chatOptions),
	]);
	// Deploy bootstrap as index.mjs + package.json so `node .flowti/bin` works
	copyFileSync(
		path.join(projectRoot, "src", "boot", "bootstrap.mjs"),
		path.join(outDir, "index.mjs"),
	);
	writeFileSync(
		path.join(outDir, "package.json"),
		JSON.stringify({ type: "commonjs", main: "index.mjs" }, null, 2) + "\n",
	);
	console.log(`  Built: .flowti/bin/main.js`);
	console.log(`  Built: .flowti/bin/tui.mjs`);
	console.log(`  Built: .flowti/bin/chat.mjs`);
	console.log(`  Copied: .flowti/bin/index.mjs`);
}
