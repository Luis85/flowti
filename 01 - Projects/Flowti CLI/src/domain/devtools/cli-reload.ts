/**
 * cli-reload.ts
 *
 * Reloads the flowti-ibde plugin via Obsidian CLI.
 * Gracefully exits if the CLI is not available or Obsidian is not running.
 *
 * Usage: node scripts/cli-reload.ts [--vault=<name>]
 *
 * Exit codes:
 *   0 — reload successful or CLI not available (non-fatal)
 *   1 — unexpected error
 */

import { shell } from "../../infrastructure/shell.js";
import { log, warn } from "../../infrastructure/logger.js";
import { proc } from "../../infrastructure/proc.js";

const PLUGIN_ID = "flowti-ibde";

function parseVaultArg(): string | undefined {
	for (const arg of proc.argv()) {
		if (arg.startsWith("--vault=")) return arg.slice("--vault=".length);
	}
	return undefined;
}

function isCliAvailable(): boolean {
	return shell.execFile("obsidian", ["version"], { timeout: 3000 }) !== null;
}

function main(): void {
	if (!isCliAvailable()) {
		log("[cli] Obsidian CLI not available — skipping reload.");
		return;
	}

	const vault = parseVaultArg();
	const args: string[] = vault
		? [`vault=${vault}`, "plugin:reload", `id=${PLUGIN_ID}`]
		: ["plugin:reload", `id=${PLUGIN_ID}`];

	const result = shell.execFile("obsidian", args, { stdio: "inherit" });
	if (result !== null) {
		log(`[cli] Plugin reloaded: ${PLUGIN_ID}`);
	} else {
		warn(`[cli] Reload failed (non-fatal).`);
	}
}

main();
