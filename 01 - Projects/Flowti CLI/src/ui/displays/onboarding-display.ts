/**
 * onboarding-display.ts — Console renderers for onboarding domain data.
 *
 * Pure display functions that render onboarding data models with ANSI colors.
 */

import { log } from "../../infrastructure/logger.js";
import { RESET, BOLD, DIM, GREEN, RED, CYAN, YELLOW } from "../../infrastructure/ui.js";
import type { PrerequisiteIssue, DependencyResult, FirstRunStatus, PostBuildGuidance } from "../../domain/onboarding/onboarding.js";

export function renderPrerequisiteIssues(missing: PrerequisiteIssue[]): void {
	if (missing.length === 0) return;
	log(`\n  ${RED}${BOLD}Missing prerequisites:${RESET}\n`);
	for (const dep of missing) {
		log(`  ${RED}✗${RESET} ${dep.name}`);
		log(`    ${DIM}→ ${dep.instruction}${RESET}\n`);
	}
	log(`  ${DIM}Install the above, then run flowti again.${RESET}\n`);
}

export function renderDependencyResult(result: DependencyResult): void {
	if (result.alreadyPresent) return;
	if (result.installed) {
		log(`\n  ${GREEN}✓${RESET} Dependencies installed.\n`);
	} else {
		log(`\n  ${RED}✗${RESET} npm install failed. Check errors above and try again.\n`);
	}
}

export function renderDependencyNeeded(): void {
	log(`\n  ${YELLOW}Dependencies not installed.${RESET}`);
	log(`  ${CYAN}▸${RESET} Running npm install...\n`);
}

export function renderFirstRunStatus(status: FirstRunStatus): void {
	if (!status.pluginBuilt) {
		log(`  ${YELLOW}Plugin not yet built.${RESET} Select ${BOLD}Build${RESET} (option 2) to get started.\n`);
	}
}

export function renderPostBuildGuidance(guidance: PostBuildGuidance): void {
	if (!guidance.show) return;
	log(`  ${GREEN}${BOLD}Plugin built successfully!${RESET}\n`);
	log(`  ${BOLD}Next steps:${RESET}`);
	log(`    1. Open this folder as an Obsidian vault: ${DIM}${guidance.vaultRoot}${RESET}`);
	log(`    2. Go to ${CYAN}Settings → Community Plugins → Enable "Flowti - IBDE"${RESET}`);
	log(`    3. Follow the Installer Wizard to set up your vault\n`);
}
