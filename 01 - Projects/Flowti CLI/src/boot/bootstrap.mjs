#!/usr/bin/env node

/**
 * bootstrap.mjs — Frictionless CLI launcher.
 *
 * Deployed to: .flowti/bin/index.mjs  (enables `node .flowti/bin`)
 * Invoked by:  flowti.cmd → node .flowti/bin
 *
 * Flow:
 *   1. Derives vault root from own location (.flowti/bin/ → ../../)
 *   2. Reads .flowti/config.json to locate the CLI source project
 *   3. Ensures node_modules are installed (npm ci if missing)
 *   4. Builds the CLI if .flowti/bin/main.mjs is missing
 *   5. Auto-rebuilds if source files are newer than the binary
 *   6. Runs the compiled CLI, forwarding all arguments
 *
 * If there is no source folder, the script errors out — this means
 * the user needs the full repository, not just the .flowti/ distribution.
 */

import { existsSync, readFileSync, statSync, readdirSync, symlinkSync, lstatSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// .flowti/bin/ → vault root is two levels up
const VAULT_ROOT = resolve(__dirname, "..", "..");

// ── Load config ──────────────────────────────────────────────────────

const CONFIG_PATH = resolve(VAULT_ROOT, ".flowti", "config.json");
let config = {};
if (existsSync(CONFIG_PATH)) {
	config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

const BIN_ENTRY = resolve(VAULT_ROOT, ".flowti", "bin", "main.mjs");
const SOURCE_DIR = resolve(VAULT_ROOT, config.source ?? "01 - Projects/Flowti CLI");
const HAS_SOURCE = existsSync(SOURCE_DIR);

// ── Standalone mode ──────────────────────────────────────────────────
//
// If main.mjs already exists, the CLI can run without the source tree.
// This enables test vaults and distributed installs where only .flowti/bin/
// is present. Source-dependent steps (npm ci, build, rebuild) are skipped.

if (!HAS_SOURCE) {
	if (!existsSync(BIN_ENTRY)) {
		console.error(`[flowti] CLI binary not found: ${BIN_ENTRY}`);
		console.error(`[flowti] Source folder not found: ${SOURCE_DIR}`);
		console.error(`[flowti] Either clone the full repository, set "source" in .flowti/config.json,`);
		console.error(`[flowti] or copy the CLI binary into .flowti/bin/main.mjs`);
		process.exit(1);
	}
	// Binary exists — run standalone (skip npm ci / build / rebuild checks)
} else {
	// ── Dev mode: source tree available — ensure build is current ─────

	const NODE_MODULES = resolve(SOURCE_DIR, "node_modules");

	function run(cmd, args, cwd) {
		const result = spawnSync(cmd, args, { stdio: "inherit", cwd, shell: true });
		if (result.status !== 0) {
			process.exit(result.status ?? 1);
		}
	}

	function getNewestMtime(dir) {
		let newest = 0;
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return 0;
		}
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				const sub = getNewestMtime(fullPath);
				if (sub > newest) newest = sub;
			} else if (entry.isFile() && entry.name.endsWith(".ts")) {
				const mtime = statSync(fullPath).mtimeMs;
				if (mtime > newest) newest = mtime;
			}
		}
		return newest;
	}

	function needsRebuild() {
		if (!existsSync(BIN_ENTRY)) return true;
		const binaryMtime = statSync(BIN_ENTRY).mtimeMs;
		const srcDir = resolve(SOURCE_DIR, "src");
		const newestSource = getNewestMtime(srcDir);
		return newestSource > binaryMtime;
	}

	if (!existsSync(NODE_MODULES)) {
		console.log("[flowti] Installing dependencies...");
		run("npm", ["ci"], SOURCE_DIR);
	}

	if (!existsSync(BIN_ENTRY)) {
		console.log("[flowti] Building CLI...");
		run("npm", ["run", "build"], SOURCE_DIR);
	}

	const cliCommand = process.argv[2];
	const skipAutoRebuild = cliCommand === "build" || cliCommand === "build:full";
	if (!skipAutoRebuild && needsRebuild()) {
		console.log("[flowti] Source changes detected, rebuilding...");
		run("npm", ["run", "build"], SOURCE_DIR);
	}
}

// ── 4. Link node_modules for ESM resolution ─────────────────────────
//
// The bundle uses ESM format with ink/react marked as external.
// ESM import resolution walks up from the importing file's directory,
// so .flowti/bin/node_modules must resolve to the project's node_modules.
// A directory junction (Windows) or symlink (Unix) avoids copying.

const binNodeModules = resolve(VAULT_ROOT, ".flowti", "bin", "node_modules");
const sourceNodeModules = resolve(SOURCE_DIR, "node_modules");
if (HAS_SOURCE && existsSync(sourceNodeModules) && !existsSync(binNodeModules)) {
	try {
		symlinkSync(sourceNodeModules, binNodeModules, "junction");
	} catch {
		// Non-fatal — CLI will still work if launched from project dir
	}
}

// ── 5. Run the compiled CLI ──────────────────────────────────────────

const nodeModulesDir = resolve(SOURCE_DIR, "node_modules");
const existingNodePath = process.env.NODE_PATH ?? "";
const nodePath = existingNodePath ? `${nodeModulesDir}${delimiter}${existingNodePath}` : nodeModulesDir;

const result = spawnSync(process.execPath, [BIN_ENTRY, ...process.argv.slice(2)], {
	stdio: "inherit",
	cwd: VAULT_ROOT,
	env: { ...process.env, FLOWTI_VAULT_ROOT: VAULT_ROOT, NODE_PATH: nodePath },
});
process.exit(result.status ?? 0);
