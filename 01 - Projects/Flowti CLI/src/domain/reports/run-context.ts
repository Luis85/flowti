/**
 * run-context.ts — Shared context for the current report generation run.
 *
 * The report runner populates this as generators complete.
 * The summary generator reads it to surface failures as findings.
 *
 * Also stores captured output from prerequisite commands so that
 * later generators can parse their output without re-executing them.
 */

import type { GeneratorResult } from "./report-runner.js";

let results: GeneratorResult[] = [];
const commandOutputs = new Map<string, string>();

/** Record a completed generator result. */
export function pushResult(result: GeneratorResult): void {
	results.push(result);
}

/** Get all results accumulated so far in the current run. */
export function getRunResults(): readonly GeneratorResult[] {
	return results;
}

/** Store captured output from a command (keyed by the command string). */
export function setCommandOutput(command: string, output: string): void {
	commandOutputs.set(command, output);
}

/** Retrieve previously captured output for a command, if available. */
export function getCommandOutput(command: string): string | undefined {
	return commandOutputs.get(command);
}

/** Clear the run context (called at the start of each run). */
export function clearRunContext(): void {
	results = [];
	commandOutputs.clear();
}
