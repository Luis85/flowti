#!/usr/bin/env node

/**
 * bootstrap.mjs — Frictionless CLI launcher.
 *
 * Deployed to: .flowti/bin/index.js  (enables `node .flowti/bin`)
 * Invoked by:  flowti.cmd → node .flowti/bin
 *
 * Flow:
 *   1. Derives vault root from own location (.flowti/bin/ → ../../)
 *   2. Reads .flowti/config.json to locate the CLI source project
 *   3. Ensures node_modules are installed (npm ci if missing)
 *   4. Builds the CLI if .flowti/bin/main.js is missing
 *   5. Runs the compiled CLI, forwarding all arguments
 *
 * If there is no source folder, the script errors out — this means
 * the user needs the full repository, not just the .flowti/ distribution.
 */

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
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

const SOURCE_DIR = resolve(VAULT_ROOT, config.source ?? "01 - Projects/Flowti CLI");
const BIN_ENTRY = resolve(VAULT_ROOT, ".flowti", "bin", "main.js");
const NODE_MODULES = resolve(SOURCE_DIR, "node_modules");

// ── Gate: source must exist ──────────────────────────────────────────

if (!existsSync(SOURCE_DIR)) {
	console.error(`[flowti] Source folder not found: ${SOURCE_DIR}`);
	console.error(`[flowti] Clone the full repository or set "source" in .flowti/config.json`);
	process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────

function run(cmd, args, cwd) {
	const result = spawnSync(cmd, args, { stdio: "inherit", cwd, shell: true });
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

// ── 1. Install dependencies if missing ───────────────────────────────

if (!existsSync(NODE_MODULES)) {
	console.log("[flowti] Installing dependencies...");
	run("npm", ["ci"], SOURCE_DIR);
}

// ── 2. Build if .flowti/bin/main.js is missing ───────────────────────

if (!existsSync(BIN_ENTRY)) {
	console.log("[flowti] Building CLI...");
	run("npm", ["run", "build"], SOURCE_DIR);
}

// ── 3. Run the compiled CLI ──────────────────────────────────────────

const result = spawnSync(process.execPath, [BIN_ENTRY, ...process.argv.slice(2)], {
	stdio: "inherit",
	cwd: VAULT_ROOT,
	env: { ...process.env, FLOWTI_VAULT_ROOT: VAULT_ROOT },
});
process.exit(result.status ?? 0);
