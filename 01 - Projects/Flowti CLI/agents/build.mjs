/**
 * build.mjs — Bundles the ExcaliburJS dashboard into .flowti/site/.
 *
 * Usage: node build.mjs [--outdir=<path>]
 *
 * Output:
 *   <outdir>/dashboard.js   — bundled JS
 *   <outdir>/index.html     — copied from project root
 */

import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outdirArg = process.argv.find((a) => a.startsWith("--outdir="));
const outDir = outdirArg
	? resolve(outdirArg.slice("--outdir=".length))
	: resolve(__dirname, "../.flowti/agents");

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

console.log("Dashboard built → .flowti/agents/");
