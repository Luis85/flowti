/**
 * suggestions.ts — Post-command next-step hints.
 *
 * Shows contextual suggestions after key operations complete.
 * Respects --quiet mode (suggestions go through log()).
 */

import { log } from "./logger.js";
import { RESET, DIM, CYAN } from "./ui.js";

export interface Suggestion {
	command: string;
	description: string;
}

/**
 * Display post-command suggestions. No-op if list is empty.
 */
export function showSuggestions(suggestions: Suggestion[]): void {
	if (suggestions.length === 0) return;
	log(`\n  ${DIM}Next:${RESET}`);
	for (const s of suggestions) {
		log(`    ${CYAN}▸${RESET} ${DIM}${s.command}${RESET}  ${s.description}`);
	}
	log();
}

// ── Context-aware suggestion builders ────────────────────────────────

export function afterScaffold(name: string): Suggestion[] {
	return [
		{ command: `cd "${name}" && npm install`, description: "Install dependencies" },
		{ command: `flowti info --project=${name}`, description: "View project info" },
	];
}

export function afterMakeComponent(componentName: string, projectName?: string): Suggestion[] {
	const proj = projectName ? ` --project=${projectName}` : "";
	return [
		{ command: `flowti health${proj}`, description: "Check project health" },
		{ command: `flowti info${proj}`, description: "View updated project info" },
	];
}

export function afterPublish(): Suggestion[] {
	return [
		{ command: "flowti health", description: "Verify project health" },
	];
}

export function afterReports(): Suggestion[] {
	return [
		{ command: "flowti health", description: "View updated health dashboard" },
	];
}
