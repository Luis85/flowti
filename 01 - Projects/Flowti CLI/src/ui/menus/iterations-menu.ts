/**
 * iterations-menu.ts — Interactive iteration management menus.
 */

import { printHeader } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { IterationsConfig } from "../../infrastructure/types.js";
import type { AgentReference, ResourceAllocation, CapacityEntry } from "../../domain/iterations/iteration-types.js";
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
	renderIterationDetail, renderAgentAttached, renderResourceAdded, renderCapacityAdded,
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

export async function attachAgentInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Attach Agent");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) {
		deps.log(`\n  No active iteration to attach agents to.\n`);
		return;
	}

	const agentsDir = deps.paths.join(projectPath, "agents");
	if (!deps.disk.existsSync(agentsDir)) {
		deps.log(`\n  No agents folder found at ${agentsDir}.\n`);
		return;
	}

	const files = deps.disk.readdirSync(agentsDir).filter((f: string) => f.endsWith(".md"));
	if (files.length === 0) {
		deps.log(`\n  No agent files found in agents folder.\n`);
		return;
	}

	for (let i = 0; i < files.length; i++) {
		deps.log(`  ${i + 1}. ${files[i]}`);
	}
	const choice = await deps.input.ask("Select agent (number)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= files.length) return;

	const agent: AgentReference = { name: files[idx].replace(/\.md$/, ""), file: files[idx] };
	const ok = attachAgent(deps, projectPath, current.number, agent, config);
	if (ok) renderAgentAttached(agent.name, current.name, deps.log);
}

export async function addResourceInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Add Resource");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) {
		deps.log(`\n  No active iteration to add resources to.\n`);
		return;
	}

	const name = await deps.input.ask("Resource name");
	if (!name) return;

	const role = await deps.input.ask("Role (optional)", "");
	const allocation = await deps.input.ask("Allocation (optional, e.g. 80%)", "");

	const resource: ResourceAllocation = { name, role: role || undefined, allocation: allocation || undefined };
	const ok = addResource(deps, projectPath, current.number, resource, config);
	if (ok) renderResourceAdded(name, current.name, deps.log);
}

export async function addCapacityInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Add Capacity");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) {
		deps.log(`\n  No active iteration to add capacity to.\n`);
		return;
	}

	const label = await deps.input.ask("Label (e.g. Story Points, Hours)");
	if (!label) return;

	const value = await deps.input.ask("Value");
	if (!value) return;

	const unit = await deps.input.ask("Unit (optional)", "");

	const capacity: CapacityEntry = { label, value, unit: unit || undefined };
	const ok = addCapacity(deps, projectPath, current.number, capacity, config);
	if (ok) renderCapacityAdded(label, current.name, deps.log);
}

export async function addScopeItemInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Add Scope Item");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) {
		deps.log(`\n  No active iteration.\n`);
		return;
	}

	const item = await deps.input.ask("Scope item");
	if (!item) return;

	const ok = addScopeItem(deps, projectPath, current.number, item, config);
	if (ok) deps.log(`\n  Added scope item to ${current.name}.`);
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
