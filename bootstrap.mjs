#!/usr/bin/env node

/**
 * bootstrap.mjs — Frictionless CLI launcher.
 *
 * Flow: git clone → cd flowti → ./flowti.cmd
 *   1. Ensures node_modules are installed (npm ci if missing)
 *   2. Builds the CLI if bin/ is missing (npm run build)
 *   3. Runs the compiled CLI, forwarding all arguments
 */

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PROJECT = resolve(__dirname, "01 - Projects", "Flowti CLI");
const BIN_ENTRY = resolve(CLI_PROJECT, "bin", "main.js");
const NODE_MODULES = resolve(CLI_PROJECT, "node_modules");

function run(cmd, args, cwd) {
	const result = spawnSync(cmd, args, { stdio: "inherit", cwd, shell: true });
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

// 1. Install dependencies if missing
if (!existsSync(NODE_MODULES)) {
	console.log("[flowti] Installing dependencies...");
	run("npm", ["ci"], CLI_PROJECT);
}

// 2. Build if bin/ output is missing
if (!existsSync(BIN_ENTRY)) {
	console.log("[flowti] Building CLI...");
	run("npm", ["run", "build"], CLI_PROJECT);
}

// 3. Run the compiled CLI
const result = spawnSync(process.execPath, [BIN_ENTRY, ...process.argv.slice(2)], {
	stdio: "inherit",
	cwd: CLI_PROJECT,
});
process.exit(result.status ?? 0);
