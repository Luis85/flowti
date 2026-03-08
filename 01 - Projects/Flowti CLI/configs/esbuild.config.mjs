/**
 * esbuild.config.mjs — Bundles the Flowti CLI into a single main.js.
 *
 * Usage:
 *   node configs/esbuild.config.mjs           Build once
 *   node configs/esbuild.config.mjs --watch   Watch mode (rebuilds on change)
 */

import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const isWatch = process.argv.includes("--watch");

const options = {
	entryPoints: [path.join(projectRoot, "src/main.ts")],
	bundle: true,
	outfile: path.join(projectRoot, "bin/main.js"),
	platform: "node",
	format: "esm",
	target: "node22",
	sourcemap: true,
	minify: false,
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
	console.log("  Built: bin/main.js");
}
