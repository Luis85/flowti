/**
 * Flowti CLI bundle (`main.mjs`) is self-contained (no Ink/React peers).
 * This module keeps a small compatibility surface for resolving the CLI entry
 * and optional future bin bootstrap steps.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

export type CliOutputLine = (line: string) => void;

/** Prefer explicit entry file so behavior matches `node main.mjs`. */
export function resolveFlowtiCliEntry(binDir: string): string {
	const mainMjs = join(binDir, "main.mjs");
	if (existsSync(mainMjs)) return mainMjs;
	const indexMjs = join(binDir, "index.mjs");
	if (existsSync(indexMjs)) return indexMjs;
	return binDir;
}

/**
 * Legacy no-op: older Flowti versions installed `react`/`ink` under `.flowti/bin`.
 * The current CLI bundle does not require those packages.
 */
export async function ensureFlowtiCliRuntimeDeps(
	binDir: string,
	_onLine?: CliOutputLine,
): Promise<{ ok: boolean; error?: string }> {
	if (!existsSync(binDir)) {
		return { ok: false, error: `Flowti CLI folder missing: ${binDir}` };
	}
	const entry = resolveFlowtiCliEntry(binDir);
	if (entry !== binDir && !existsSync(entry)) {
		return { ok: false, error: `Flowti CLI bundle missing in ${binDir} (expected main.mjs or index.mjs)` };
	}
	return { ok: true };
}
