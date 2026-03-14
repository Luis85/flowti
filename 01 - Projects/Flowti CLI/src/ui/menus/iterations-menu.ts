/**
 * iterations-menu.ts — Interactive iteration management menus.
 */

import { printHeader } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { IterationsConfig } from "../../infrastructure/types.js";
import type { LifecycleTemplate } from "../../domain/lifecycle/lifecycle-types.js";
import {
	listIterations, createIteration, transitionIteration, closeIteration,
	findCurrentIteration, nextIterationNumber, computeEndDate,
	updateName, updateGoal, updateStartDate, updateEndDate,
} from "../../domain/iterations/iteration-store.js";
import { getValidTransitions } from "../../domain/lifecycle/lifecycle-engine.js";
import {
	renderIterationCreated, renderIterationClosed,
	renderIterationDetail, renderIterationList, renderAdvanceResult,
} from "../displays/iterations-display.js";

// Re-export extracted functions for backward compatibility
export {
	addAgentInteractive, addResourceInteractive, addEstimationInteractive,
	addScopeItemInteractive, editDescriptionInteractive, addNoteInteractive,
	editScopeInteractive, removeScopeInteractive, toggleScopeInteractive,
} from "./iterations-scope-menu.js";
export type { AddAgentOptions } from "./iterations-scope-menu.js";

export async function addIterationInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps, template?: LifecycleTemplate): Promise<boolean> {
	printHeader("Add Iteration");

	const name = await deps.input.ask("Name");
	if (!name) return false;

	const existing = listIterations(deps, projectPath, config);
	const num = nextIterationNumber(existing);

	const goal = await deps.input.ask("Goal", "");
	const startDate = await deps.input.ask("Start date (YYYY-MM-DD)", deps.clock.iso().slice(0, 10));
	const endDefault = config?.durationDays ? computeEndDate(startDate, config.durationDays) : "";
	const endDate = await deps.input.ask("End date (YYYY-MM-DD)", endDefault);
	if (!endDate) return false;

	const capacity = await deps.input.ask("Capacity (optional)", "");
	const description = await deps.input.ask("Description (optional)", "");

	const filePath = createIteration(deps, projectPath, {
		name, number: num, startDate, endDate, goal,
		capacity: capacity || undefined,
		description: description || undefined,
	}, config, template);

	if (filePath) {
		renderIterationCreated(deps.paths.relative(projectPath, filePath), deps.log);
		return true;
	}
	return false;
}

export async function advanceIterationInteractive(projectPath: string, config: IterationsConfig | undefined, template: LifecycleTemplate, deps: MenuDeps): Promise<void> {
	printHeader("Advance Iteration");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) {
		deps.log(`\n  No active iteration.\n`);
		return;
	}

	const valid = getValidTransitions(template, current.status).filter((s) => s !== "cancelled");
	if (valid.length === 0) {
		deps.log(`\n  Iteration "${current.name}" is in a terminal state (${current.status}).\n`);
		return;
	}

	const target = valid[0];
	const label = template.labels?.[target] ?? target;

	const confirm = await deps.input.askYesNo(`Advance "${current.name}" from ${current.status} to ${label}?`);
	if (!confirm) return;

	if (target === "done") {
		const result = closeIteration(deps, projectPath, current.number, template, config);
		renderAdvanceResult(result, deps.log);
		if (result.success) renderIterationClosed(current.name, deps.log);
		return;
	}

	const result = transitionIteration(deps, projectPath, current.number, target as never, `Advanced to ${target}`, template, config);
	renderAdvanceResult(result, deps.log);
}

export async function showCurrentIteration(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	const current = findCurrentIteration(deps, projectPath, config);
	if (current) {
		renderIterationDetail(current, deps.log);
		return;
	}

	const create = await deps.input.askYesNo("No current iteration. Create one?");
	if (create) {
		await addIterationInteractive(projectPath, config, deps);
	}
}

export async function editNameInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Edit Name");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) { deps.log(`\n  No active iteration.\n`); return; }

	const name = await deps.input.ask("New name", current.name);
	if (!name) return;

	const ok = updateName(deps, projectPath, current.number, name, config);
	if (ok) deps.log(`\n  Renamed iteration to "${name}".`);
}

export async function editGoalInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Edit Goal");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) { deps.log(`\n  No active iteration.\n`); return; }

	if (current.goal) deps.log(`\n  Current goal: ${current.goal}\n`);

	const goal = await deps.input.ask("New goal", current.goal || "");
	if (!goal) return;

	const ok = updateGoal(deps, projectPath, current.number, goal, config);
	if (ok) deps.log(`\n  Updated goal for ${current.name}.`);
}

export async function editDatesInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Edit Dates");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) { deps.log(`\n  No active iteration.\n`); return; }

	deps.log(`\n  Current: ${current.startDate} → ${current.endDate}\n`);

	const startDate = await deps.input.ask("Start date (YYYY-MM-DD)", current.startDate);
	if (!startDate) return;

	const endDate = await deps.input.ask("End date (YYYY-MM-DD)", current.endDate);
	if (!endDate) return;

	let changed = false;
	if (startDate !== current.startDate) {
		changed = updateStartDate(deps, projectPath, current.number, startDate, config) || changed;
	}
	if (endDate !== current.endDate) {
		changed = updateEndDate(deps, projectPath, current.number, endDate, config) || changed;
	}
	if (changed) deps.log(`\n  Updated dates for ${current.name}: ${startDate} → ${endDate}`);
}

export async function planAheadInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps, template?: LifecycleTemplate): Promise<boolean> {
	printHeader("Plan Ahead");

	const countStr = await deps.input.ask("How many iterations to plan?", "1");
	const count = parseInt(countStr, 10);
	if (isNaN(count) || count < 1) return false;

	const existing = listIterations(deps, projectPath, config);
	let nextNum = nextIterationNumber(existing);
	let created = 0;

	for (let i = 0; i < count; i++) {
		const name = await deps.input.ask(`Name for iteration #${nextNum}`, `Iteration ${nextNum}`);
		if (!name) break;

		const goal = await deps.input.ask("Goal (optional)", "");

		const filePath = createIteration(deps, projectPath, {
			name, number: nextNum, startDate: "", endDate: "", goal,
		}, config, template);

		if (filePath) {
			renderIterationCreated(deps.paths.relative(projectPath, filePath), deps.log);
			created++;
			nextNum++;
		}
	}

	if (created > 0) deps.log(`\n  Planned ${created} iteration${created > 1 ? "s" : ""} ahead.`);
	return created > 0;
}

export async function browseIterationsInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<number | null> {
	printHeader("Browse Iterations");

	const all = listIterations(deps, projectPath, config);
	const editable = all.filter((it) => it.status !== "done" && it.status !== "cancelled");

	if (editable.length === 0) {
		deps.log(`\n  No editable iterations.\n`);
		return null;
	}

	renderIterationList(editable, deps.log);

	const choice = await deps.input.ask("Select iteration number");
	const num = parseInt(choice, 10);
	if (isNaN(num)) return null;

	const match = editable.find((it) => it.number === num);
	if (!match) {
		deps.log(`\n  Iteration #${num} not found or not editable.\n`);
		return null;
	}

	return match.number;
}
