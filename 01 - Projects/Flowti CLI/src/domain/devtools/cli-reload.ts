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

import { execFileSync } from "node:child_process";
import { log } from "../../infrastructure/logger.js";

const PLUGIN_ID = "flowti-ibde";

function parseVaultArg(): string | undefined {
	for (const arg of process.argv.slice(2)) {
		if (arg.startsWith("--vault=")) return arg.slice("--vault=".length);
	}
	return undefined;
}

function isCliAvailable(): boolean {
	try {
		execFileSync("obsidian", ["version"], {
			encoding: "utf-8",
			timeout: 3000,
			windowsHide: true,
		});
		return true;
	} catch {
		return false;
	}
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

	try {
		execFileSync("obsidian", args, {
			encoding: "utf-8",
			stdio: "inherit",
			timeout: 10_000,
			windowsHide: true,
		});
		log(`[cli] Plugin reloaded: ${PLUGIN_ID}`);
	} catch (err) {
		console.warn(
			`[cli] Reload failed (non-fatal): ${err instanceof Error ? err.message : err}`,
		);
	}
}

main();
