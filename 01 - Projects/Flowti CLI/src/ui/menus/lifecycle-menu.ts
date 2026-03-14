/**
 * lifecycle-menu.ts — Interactive lifecycle management menu.
 *
 * Used by standalone products/features and nested items within projects.
 */

import { runMenu } from "../../infrastructure/menu.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { MenuResult, MenuEntry, EntityType, LifecycleState } from "../../infrastructure/types.js";
import { readLifecycleItem, transitionLifecycleItem, getLifecycleHistory } from "../../domain/lifecycle/lifecycle-store.js";
import { getTemplate, getValidTransitions } from "../../domain/lifecycle/lifecycle-engine.js";
import { renderLifecycleStatus, renderTransitionHistory, renderTransitionResult } from "../displays/lifecycle-display.js";

async function viewStatusInteractive(basePath: string, name: string, deps: MenuDeps, subdir?: string): Promise<void> {
	const record = readLifecycleItem(deps, basePath, name, subdir);
	if (!record) {
		deps.log(`\n  Lifecycle not initialized for "${name}".`);
		return;
	}
	renderLifecycleStatus(record, deps.log);
}

async function transitionInteractive(basePath: string, name: string, deps: MenuDeps, subdir?: string): Promise<void> {
	const record = readLifecycleItem(deps, basePath, name, subdir);
	if (!record) {
		deps.log(`\n  Lifecycle not initialized for "${name}".`);
		return;
	}

	const template = getTemplate(record.entityType);
	if (!template) {
		deps.log(`\n  No lifecycle template for "${record.entityType}".`);
		return;
	}
	const validNext = getValidTransitions(template, record.currentState);

	if (validNext.length === 0) {
		deps.log(`\n  "${name}" is in terminal state [${record.currentState}]. No transitions available.`);
		return;
	}

	deps.log(`\n  Current state: ${record.currentState}`);
	deps.log(`  Valid transitions:`);
	for (let i = 0; i < validNext.length; i++) {
		deps.log(`    ${i + 1}. ${validNext[i]}`);
	}

	const choice = await deps.input.ask("Select transition (number)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= validNext.length) return;

	const reason = await deps.input.ask("Reason for transition", "");
	if (!reason) return;

	const result = transitionLifecycleItem(deps, basePath, name, validNext[idx] as LifecycleState, reason, subdir);
	renderTransitionResult(result, deps.log);
}

async function viewHistoryInteractive(basePath: string, name: string, deps: MenuDeps, subdir?: string): Promise<void> {
	const history = getLifecycleHistory(deps, basePath, name, subdir);
	renderTransitionHistory(history, deps.log);
}

export async function lifecycleStatusMenu(basePath: string, name: string, entityType: EntityType, deps: MenuDeps, subdir?: string): Promise<MenuResult> {
	const items: MenuEntry[] = [
		{
			key: "1",
			label: "View Current State",
			action: async () => {
				await viewStatusInteractive(basePath, name, deps, subdir);
				await deps.input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "2",
			label: "Transition State",
			action: async () => {
				await transitionInteractive(basePath, name, deps, subdir);
				await deps.input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "3",
			label: "View History",
			action: async () => {
				await viewHistoryInteractive(basePath, name, deps, subdir);
				await deps.input.waitForEnter();
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	];

	return runMenu("Lifecycle", items);
}
