/**
 * Shared Flowti vault CLI invocation — used by project hub, agent sidepanel, etc.
 */

import { join } from "node:path";
import type { OutputCallback } from "../../domain/projects/types.js";
import { runAsync, FLOWTI_CLI_TIMEOUT_MS } from "./vault-project-cli.js";
import { ensureFlowtiCliRuntimeDeps, resolveFlowtiCliEntry } from "./flowti-cli-runtime.js";

/**
 * Run `node <vault>/.flowti/bin/main.mjs` with the given subcommand/args.
 */
export async function runFlowtiCli(
	vaultBase: string,
	cliSubArgs: string[],
	onOutput?: OutputCallback,
): Promise<{ ok: boolean; error?: string }> {
	const binDir = join(vaultBase, ".flowti", "bin");
	const ensured = await ensureFlowtiCliRuntimeDeps(binDir, onOutput);
	if (!ensured.ok) return ensured;
	const entry = resolveFlowtiCliEntry(binDir);
	return runAsync("node", [entry, ...cliSubArgs], vaultBase, onOutput, { timeoutMs: FLOWTI_CLI_TIMEOUT_MS });
}

/** Regenerate `.flowti/agents/data/agent-dashboard.json` from vault agents + projects. */
export async function runAgentDashboardSync(
	vaultBase: string,
	onOutput?: OutputCallback,
): Promise<{ ok: boolean; error?: string }> {
	return runFlowtiCli(vaultBase, ["agent:dashboard-sync"], onOutput);
}
