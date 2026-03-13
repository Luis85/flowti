/**
 * lifecycle-menu.ts — Interactive lifecycle management menu.
 *
 * Used by standalone products/features and nested items within projects.
 */

import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { clock } from "../../infrastructure/clock.js";
import { input } from "../../infrastructure/input.js";
import { runMenu } from "../../infrastructure/menu.js";
import { log } from "../../infrastructure/logger.js";
import type { MenuResult, MenuEntry, EntityType, LifecycleState } from "../../infrastructure/types.js";
import { readLifecycleItem, transitionLifecycleItem, getLifecycleHistory } from "../../domain/lifecycle/lifecycle-store.js";
import { getTemplate, getValidTransitions } from "../../domain/lifecycle/lifecycle-engine.js";
import { renderLifecycleStatus, renderTransitionHistory, renderTransitionResult } from "../displays/lifecycle-display.js";

function storeDeps() { return { disk, paths, clock } as const; }

async function viewStatusInteractive(basePath: string, name: string, subdir?: string): Promise<void> {
	const record = readLifecycleItem(storeDeps(), basePath, name, subdir);
	if (!record) {
		log(`\n  Lifecycle not initialized for "${name}".`);
		return;
	}
	renderLifecycleStatus(record);
}

async function transitionInteractive(basePath: string, name: string, subdir?: string): Promise<void> {
	const record = readLifecycleItem(storeDeps(), basePath, name, subdir);
	if (!record) {
		log(`\n  Lifecycle not initialized for "${name}".`);
		return;
	}

	const template = getTemplate(record.entityType);
	const validNext = getValidTransitions(template, record.currentState);

	if (validNext.length === 0) {
		log(`\n  "${name}" is in terminal state [${record.currentState}]. No transitions available.`);
		return;
	}

	log(`\n  Current state: ${record.currentState}`);
	log(`  Valid transitions:`);
	for (let i = 0; i < validNext.length; i++) {
		log(`    ${i + 1}. ${validNext[i]}`);
	}

	const choice = await input.ask("Select transition (number)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= validNext.length) return;

	const reason = await input.ask("Reason for transition", "");
	if (!reason) return;

	const result = transitionLifecycleItem(storeDeps(), basePath, name, validNext[idx] as LifecycleState, reason, subdir);
	renderTransitionResult(result);
}

async function viewHistoryInteractive(basePath: string, name: string, subdir?: string): Promise<void> {
	const history = getLifecycleHistory(storeDeps(), basePath, name, subdir);
	renderTransitionHistory(history);
}

export async function lifecycleStatusMenu(basePath: string, name: string, entityType: EntityType, subdir?: string): Promise<MenuResult> {
	const items: MenuEntry[] = [
		{
			key: "1",
			label: "View Current State",
			action: async () => {
				await viewStatusInteractive(basePath, name, subdir);
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "2",
			label: "Transition State",
			action: async () => {
				await transitionInteractive(basePath, name, subdir);
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "3",
			label: "View History",
			action: async () => {
				await viewHistoryInteractive(basePath, name, subdir);
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	];

	return runMenu("Lifecycle", items);
}
