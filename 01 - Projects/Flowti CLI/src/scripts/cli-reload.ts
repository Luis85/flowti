/**
 * cli-reload.ts — Reload the flowti-ibde plugin via Obsidian CLI.
 *
 * Exported as a pure function for use by devtools.controller.ts.
 */

import { shell } from "../infrastructure/shell.js";
import { log, warn } from "../infrastructure/logger.js";

const PLUGIN_ID = "flowti-ibde";

function isCliAvailable(): boolean {
	return shell.execFile("obsidian", ["version"], { timeout: 3000 }) !== null;
}

export function reloadPlugin(vault?: string): boolean {
	if (!isCliAvailable()) {
		log("[cli] Obsidian CLI not available — skipping reload.");
		return false;
	}

	const args: string[] = vault
		? [`vault=${vault}`, "plugin:reload", `id=${PLUGIN_ID}`]
		: ["plugin:reload", `id=${PLUGIN_ID}`];

	const result = shell.execFile("obsidian", args, { stdio: "inherit" });
	if (result !== null) {
		log(`[cli] Plugin reloaded: ${PLUGIN_ID}`);
		return true;
	}

	warn(`[cli] Reload failed (non-fatal).`);
	return false;
}
