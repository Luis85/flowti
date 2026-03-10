/**
 * review-display.ts — Console renderers for review controller responses.
 *
 * Pure display functions that render review data models with ANSI colors.
 */

import { RESET, DIM, GREEN, YELLOW, CYAN } from "../infrastructure/ui.js";
import { log } from "../infrastructure/logger.js";
import type { ChangeImpact } from "../domain/review/change-analysis.js";

// ── Data models ──────────────────────────────────────────────────────

export interface ChangeAnalysisModel {
	projectLabel: string;
	impact: ChangeImpact;
}

export interface ReviewCleanModel {
	removed: boolean;
	vaultPath: string;
}

// ── Renderers ────────────────────────────────────────────────────────

export function renderChangeAnalysis(data: ChangeAnalysisModel): void {
	log(`\n  ${CYAN}Change Analysis${RESET}  ${DIM}${data.projectLabel}${RESET}\n`);
	log(`  ${data.impact.summary}\n`);
	if (data.impact.changedFiles.length > 0) {
		log(`  ${DIM}Changed files:${RESET}`);
		for (const f of data.impact.changedFiles) log(`    ${YELLOW}${f.status}${RESET} ${f.path}`);
		log();
	}
	if (data.impact.affectedDomains.length > 0) log(`  ${DIM}Affected domains:${RESET} ${data.impact.affectedDomains.join(", ")}`);
	if (data.impact.suggestedActions.length > 0) log(`  ${DIM}Suggested actions:${RESET} ${data.impact.suggestedActions.join(", ")}`);
	log();
}

export function renderReviewClean(data: ReviewCleanModel): void {
	if (!data.removed) {
		log(`\n  ${YELLOW}Test vault does not exist: ${data.vaultPath}${RESET}\n`);
		return;
	}
	log(`\n  ${GREEN}Removed${RESET} test vault: ${DIM}${data.vaultPath}${RESET}\n`);
}
