/**
 * requirements-display.ts — Console renderers for requirements, use cases, and user stories.
 */

import { RESET, DIM, GREEN, CYAN, BOLD, RED, YELLOW } from "../../infrastructure/ui.js";
import type { RequirementSummary, UseCaseSummary, UserStorySummary } from "../../domain/requirements/requirement-types.js";

const PRIORITY_COLORS: Record<string, string> = {
	must: RED,
	should: YELLOW,
	could: CYAN,
	wont: DIM,
};

const STORY_STATUS_COLORS: Record<string, string> = {
	done: GREEN,
	"in-progress": CYAN,
	ready: YELLOW,
	backlog: DIM,
};

export function renderRequirementList(reqs: RequirementSummary[], log: (msg?: string) => void): void {
	if (reqs.length === 0) {
		log(`\n  ${DIM}No requirements defined yet. Use "Add" to create one.${RESET}\n`);
		return;
	}

	log(`\n  ${BOLD}Requirements (${reqs.length})${RESET}\n`);
	for (const r of reqs) {
		const prioColor = PRIORITY_COLORS[r.priority] ?? DIM;
		const typeTag = `${DIM}[${r.requirementType}]${RESET}`;
		log(`  ${CYAN}${r.id}${RESET} ${r.name} ${typeTag} ${prioColor}[${r.priority}]${RESET} [${r.status}]`);
	}
	log();
}

export function renderUseCaseList(useCases: UseCaseSummary[], log: (msg?: string) => void): void {
	if (useCases.length === 0) {
		log(`\n  ${DIM}No use cases defined yet. Use "Add Use Case" to create one.${RESET}\n`);
		return;
	}

	log(`\n  ${BOLD}Use Cases (${useCases.length})${RESET}\n`);
	for (const uc of useCases) {
		log(`  ${CYAN}${uc.id}${RESET} ${uc.name} ${DIM}actor: ${uc.actor}${RESET}`);
	}
	log();
}

export function renderUserStoryList(stories: UserStorySummary[], log: (msg?: string) => void): void {
	if (stories.length === 0) {
		log(`\n  ${DIM}No user stories defined yet. Use "Add User Story" to create one.${RESET}\n`);
		return;
	}

	log(`\n  ${BOLD}User Stories (${stories.length})${RESET}\n`);
	for (const s of stories) {
		const statusColor = STORY_STATUS_COLORS[s.status] ?? DIM;
		const pts = s.storyPoints > 0 ? ` ${DIM}${s.storyPoints}pts${RESET}` : "";
		log(`  ${CYAN}${s.id}${RESET} ${s.name} ${statusColor}[${s.status}]${RESET} ${DIM}role: ${s.role}${RESET}${pts}`);
	}
	log();
}

export function renderRequirementAdded(relPath: string, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Created: ${relPath}`);
}

export function renderRequirementUpdated(name: string, status: string, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}✓${RESET} Updated ${name} → ${status}`);
}
