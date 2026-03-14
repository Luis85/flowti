/**
 * iterations-menu.ts — Interactive iteration management menus.
 */

import { printHeader } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { IterationsConfig } from "../../infrastructure/types.js";
import type { AgentReference, ResourceAllocation, CapacityEntry } from "../../domain/iterations/iteration-types.js";
import { createAgentFile, listAgentFiles, createResourceFile, createEstimationFile } from "../../domain/iterations/iteration-entities.js";
import type { AgentEntity, ResourceNeedEntity, EstimationEntity } from "../../domain/iterations/iteration-entities.js";
import type { LifecycleTemplate } from "../../domain/lifecycle/lifecycle-types.js";
import {
	listIterations, createIteration, transitionIteration, closeIteration,
	findCurrentIteration, nextIterationNumber, computeEndDate,
	attachAgent, addResource, addCapacity, addScopeItem, addNote,
	updateName, updateGoal, updateStartDate, updateEndDate,
	updateDescription, editScopeItem, removeScopeItem, toggleScopeItem,
} from "../../domain/iterations/iteration-store.js";
import { getValidTransitions } from "../../domain/lifecycle/lifecycle-engine.js";
import {
	renderIterationCreated, renderIterationClosed,
	renderIterationDetail, renderIterationList, renderAgentAdded, renderResourceAdded, renderEstimationAdded,
	renderScopeItems, renderAdvanceResult,
} from "../displays/iterations-display.js";

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

export async function addAgentInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Add Agent");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) {
		deps.log(`\n  No active iteration to add agents to.\n`);
		return;
	}

	const selected = await selectOrCreateAgent(projectPath, deps);
	if (!selected) return;

	const agent: AgentReference = { name: selected.name, file: selected.file };
	const ok = attachAgent(deps, projectPath, current.number, agent, config);
	if (ok) renderAgentAdded(selected.name, current.name, deps.log);
}

async function selectOrCreateAgent(projectPath: string, deps: MenuDeps): Promise<{ name: string; file: string } | null> {
	const existing = listAgentFiles(deps, projectPath);
	if (existing.length === 0) return createNewAgent(projectPath, deps);

	deps.log(`\n  Existing agents:`);
	for (let i = 0; i < existing.length; i++) {
		deps.log(`  ${i + 1}. ${existing[i].replace(/\.md$/, "")}`);
	}
	deps.log(`  ${existing.length + 1}. Create new agent`);
	const choice = await deps.input.ask("Select or create (number)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx > existing.length) return null;

	if (idx < existing.length) {
		const agentFile = existing[idx];
		return { name: agentFile.replace(/\.md$/, ""), file: agentFile };
	}
	return createNewAgent(projectPath, deps);
}

async function createNewAgent(projectPath: string, deps: MenuDeps): Promise<{ name: string; file: string } | null> {
	const name = await deps.input.ask("Agent name");
	if (!name) return null;

	const typeChoice = await deps.input.ask("Type (human/ai)", "human");
	const agentType = typeChoice === "ai" ? "ai" as const : "human" as const;
	const description = await deps.input.ask("Description (optional)", "");

	const entity: AgentEntity = { name, type: agentType, description: description || undefined };
	const filePath = createAgentFile(deps, projectPath, entity);
	const file = deps.paths.basename(filePath);
	deps.log(`\n  Created ${deps.paths.relative(projectPath, filePath)}`);
	return { name, file };
}

export async function addResourceInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Add Resource Need");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) {
		deps.log(`\n  No active iteration to add resources to.\n`);
		return;
	}

	const name = await deps.input.ask("Resource name");
	if (!name) return;

	const role = await deps.input.ask("Role (optional)", "");
	const allocation = await deps.input.ask("Allocation (optional, e.g. 80%)", "");

	const entity: ResourceNeedEntity = { name, role: role || undefined, allocation: allocation || undefined };
	const filePath = createResourceFile(deps, projectPath, entity);
	deps.log(`\n  Created ${deps.paths.relative(projectPath, filePath)}`);

	const resource: ResourceAllocation = { name, role: role || undefined, allocation: allocation || undefined };
	const ok = addResource(deps, projectPath, current.number, resource, config);
	if (ok) renderResourceAdded(name, current.name, deps.log);
}

export async function addEstimationInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Add Estimation");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) {
		deps.log(`\n  No active iteration to add estimations to.\n`);
		return;
	}

	const label = await deps.input.ask("Label (e.g. Story Points, Hours)");
	if (!label) return;

	const value = await deps.input.ask("Value");
	if (!value) return;

	const unit = await deps.input.ask("Unit (optional)", "");

	const entity: EstimationEntity = { label, value, unit: unit || undefined };
	const filePath = createEstimationFile(deps, projectPath, entity);
	deps.log(`\n  Created ${deps.paths.relative(projectPath, filePath)}`);

	const capacity: CapacityEntry = { label, value, unit: unit || undefined };
	const ok = addCapacity(deps, projectPath, current.number, capacity, config);
	if (ok) renderEstimationAdded(label, current.name, deps.log);
}

export async function addScopeItemInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Add Scope Item");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) {
		deps.log(`\n  No active iteration.\n`);
		return;
	}

	let added = 0;
	for (;;) {
		const item = await deps.input.ask("Scope item");
		if (!item) break;

		const ok = addScopeItem(deps, projectPath, current.number, item, config);
		if (ok) { deps.log(`\n  Added scope item to ${current.name}.`); added++; }

		const more = await deps.input.askYesNo("Add another?");
		if (!more) break;
	}
	if (added > 0) deps.log(`\n  ${added} scope item${added > 1 ? "s" : ""} added.`);
}

export async function editDescriptionInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Edit Description");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) {
		deps.log(`\n  No active iteration.\n`);
		return;
	}

	if (current.description) {
		deps.log(`\n  Current description: ${current.description}\n`);
	}

	const description = await deps.input.ask("New description", current.description || "");
	if (!description) return;

	const ok = updateDescription(deps, projectPath, current.number, description, config);
	if (ok) deps.log(`\n  Updated description for ${current.name}.`);
}

export async function addNoteInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Add Note");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) {
		deps.log(`\n  No active iteration.\n`);
		return;
	}

	const note = await deps.input.ask("Note");
	if (!note) return;

	const ok = addNote(deps, projectPath, current.number, note, config);
	if (ok) deps.log(`\n  Added note to ${current.name}.`);
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

function selectScopeItem(current: { name: string; scopeItems: { text: string; done: boolean }[] }, deps: MenuDeps): number | null {
	if (current.scopeItems.length === 0) {
		deps.log(`\n  No scope items in ${current.name}.\n`);
		return null;
	}
	renderScopeItems(current.scopeItems, deps.log);
	return current.scopeItems.length;
}

export async function editScopeInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Edit Task");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) { deps.log(`\n  No active iteration.\n`); return; }

	const count = selectScopeItem(current, deps);
	if (count === null) return;

	const choice = await deps.input.ask("Task number to edit");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= count) return;

	const newText = await deps.input.ask("New text", current.scopeItems[idx].text);
	if (!newText) return;

	const ok = editScopeItem(deps, projectPath, current.number, idx, newText, config);
	if (ok) deps.log(`\n  Updated task in ${current.name}.`);
}

export async function removeScopeInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Remove Task");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) { deps.log(`\n  No active iteration.\n`); return; }

	const count = selectScopeItem(current, deps);
	if (count === null) return;

	const choice = await deps.input.ask("Task number to remove");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= count) return;

	const confirm = await deps.input.askYesNo(`Remove "${current.scopeItems[idx].text}"?`);
	if (!confirm) return;

	const ok = removeScopeItem(deps, projectPath, current.number, idx, config);
	if (ok) deps.log(`\n  Removed task from ${current.name}.`);
}

export async function toggleScopeInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Toggle Task");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) { deps.log(`\n  No active iteration.\n`); return; }

	const count = selectScopeItem(current, deps);
	if (count === null) return;

	const choice = await deps.input.ask("Task number to toggle");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= count) return;

	const ok = toggleScopeItem(deps, projectPath, current.number, idx, config);
	if (ok) {
		const item = current.scopeItems[idx];
		const state = item.done ? "unchecked" : "checked";
		deps.log(`\n  Marked "${item.text}" as ${state}.`);
	}
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
