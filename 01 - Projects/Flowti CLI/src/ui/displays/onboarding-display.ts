/**
 * onboarding-display.ts — Console renderers for onboarding domain data.
 *
 * Pure display functions that render onboarding data models with ANSI colors.
 */

import { RESET, BOLD, DIM, GREEN, RED, CYAN, YELLOW } from "../../infrastructure/ui.js";
import type { PrerequisiteIssue, DependencyResult, FirstRunStatus, PostBuildGuidance } from "../../domain/onboarding/onboarding.js";

export interface NarrationData {
	readonly speaker: string;
	readonly disposition: string;
	readonly content: string;
}

export interface ChecklistItem {
	readonly id: string;
	readonly label: string;
	readonly completed: boolean;
}

export interface TourOption {
	readonly id: string;
	readonly name: string;
	readonly description: string;
}

export function renderPrerequisiteIssues(missing: PrerequisiteIssue[], log: (msg?: string) => void): void {
	if (missing.length === 0) return;
	log(`\n  ${RED}${BOLD}Missing prerequisites:${RESET}\n`);
	for (const dep of missing) {
		log(`  ${RED}✗${RESET} ${dep.name}`);
		log(`    ${DIM}→ ${dep.instruction}${RESET}\n`);
	}
	log(`  ${DIM}Install the above, then run flowti again.${RESET}\n`);
}

export function renderDependencyResult(result: DependencyResult, log: (msg?: string) => void): void {
	if (result.alreadyPresent) return;
	if (result.installed) {
		log(`\n  ${GREEN}✓${RESET} Dependencies installed.\n`);
	} else {
		log(`\n  ${RED}✗${RESET} npm install failed. Check errors above and try again.\n`);
	}
}

export function renderDependencyNeeded(log: (msg?: string) => void): void {
	log(`\n  ${YELLOW}Dependencies not installed.${RESET}`);
	log(`  ${CYAN}▸${RESET} Running npm install...\n`);
}

export function renderFirstRunStatus(status: FirstRunStatus, log: (msg?: string) => void): void {
	if (!status.pluginBuilt) {
		log(`  ${YELLOW}Plugin not yet built.${RESET} Select ${BOLD}Build${RESET} (option 2) to get started.\n`);
	}
}

export function renderPostBuildGuidance(guidance: PostBuildGuidance, log: (msg?: string) => void): void {
	if (!guidance.show) return;
	log(`  ${GREEN}${BOLD}Plugin built successfully!${RESET}\n`);
	log(`  ${BOLD}Next steps:${RESET}`);
	log(`    1. Open this folder as an Obsidian vault: ${DIM}${guidance.vaultRoot}${RESET}`);
	log(`    2. Go to ${CYAN}Settings → Community Plugins → Enable "Flowti - IBDE"${RESET}`);
	log(`    3. Follow the Installer Wizard to set up your vault\n`);
}

export function renderNarration(data: NarrationData, log: (msg?: string) => void): void {
	log();
	log(`  ${CYAN}${BOLD}${data.speaker}${RESET}${DIM} (${data.disposition})${RESET}`);
	log();
	for (const line of data.content.split("\n")) {
		log(`  ${line}`);
	}
	log();
}

export function renderChecklist(items: readonly ChecklistItem[], log: (msg?: string) => void): void {
	log();
	log(`  ${BOLD}Onboarding Progress${RESET}`);
	log();
	for (const item of items) {
		const mark = item.completed ? `${GREEN}[x]${RESET}` : `${DIM}[ ]${RESET}`;
		const label = item.completed ? `${GREEN}${item.label}${RESET}` : item.label;
		log(`  ${mark} ${label}`);
	}
	log();
}

export function renderHintBanner(tourName: string, log: (msg?: string) => void): void {
	log(`  ${YELLOW}${DIM}You're in the ${tourName} — press ${BOLD}b${RESET}${YELLOW}${DIM} when done to continue${RESET}`);
}

export function renderTourSelection(tours: readonly TourOption[], log: (msg?: string) => void): void {
	log();
	log(`  ${BOLD}Available Tours${RESET}`);
	log();
	for (let i = 0; i < tours.length; i++) {
		log(`  ${BOLD}${i + 1}${RESET}  ${tours[i].name}`);
		log(`     ${DIM}${tours[i].description}${RESET}`);
	}
	log();
}
