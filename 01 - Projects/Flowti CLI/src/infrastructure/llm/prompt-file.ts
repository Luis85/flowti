/**
 * prompt-file.ts — Shared temp file utility for CLI-based LLM providers.
 *
 * Writes prompt text to a temp file for piping via stdin, and cleans up after.
 */

import type { IFileSystem, IPaths, IClock } from "../types.js";

export interface PromptFileDeps {
	readonly disk: IFileSystem;
	readonly paths: IPaths;
	readonly clock: IClock;
}

let counter = 0;

export function writePromptFile(deps: PromptFileDeps, content: string): string {
	const tempPath = deps.paths.join(
		deps.paths.resolve("."),
		`.flowti-prompt-${deps.clock.ms()}-${++counter}.tmp`,
	);
	deps.disk.writeFileSync(tempPath, content, "utf-8");
	return tempPath;
}

export function cleanupPromptFile(deps: Pick<PromptFileDeps, "disk">, path: string): void {
	try { deps.disk.unlinkSync(path); } catch { /* file already gone */ }
}
