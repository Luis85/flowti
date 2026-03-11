/**
 * cli-reload.ts — Reload the flowti-ibde plugin via Obsidian CLI.
 *
 * Pure function — all I/O injected via deps.
 */

import type { CliDeps } from "../../infrastructure/deps.js";

const PLUGIN_ID = "flowti-ibde";

export function reloadPlugin(vault: string | undefined, deps: Pick<CliDeps, "shell" | "log" | "warn">): boolean {
	const cliAvailable = deps.shell.execFile("obsidian", ["version"], { timeout: 3000 }) !== null;
	if (!cliAvailable) {
		deps.log("[cli] Obsidian CLI not available — skipping reload.");
		return false;
	}

	const args: string[] = vault
		? [`vault=${vault}`, "plugin:reload", `id=${PLUGIN_ID}`]
		: ["plugin:reload", `id=${PLUGIN_ID}`];

	const result = deps.shell.execFile("obsidian", args, { stdio: "inherit" });
	if (result !== null) {
		deps.log(`[cli] Plugin reloaded: ${PLUGIN_ID}`);
		return true;
	}

	deps.warn(`[cli] Reload failed (non-fatal).`);
	return false;
}
