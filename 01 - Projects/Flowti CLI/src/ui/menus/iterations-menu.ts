/**
 * iterations-menu.ts — Interactive iteration management menus.
 */

import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { clock } from "../../infrastructure/clock.js";
import { printHeader } from "../../infrastructure/ui.js";
import { input } from "../../infrastructure/input.js";
import { log } from "../../infrastructure/logger.js";
import type { IterationsConfig } from "../../infrastructure/types.js";
import type { AgentReference, ResourceAllocation, CapacityEntry } from "../../domain/iterations/iteration-types.js";
import {
	listIterations, createIteration, startIteration, closeIteration,
	findCurrentIteration, nextIterationNumber, computeEndDate,
	attachAgent, addResource, addCapacity, addScopeItem, addNote,
	advanceToReview,
} from "../../domain/iterations/iteration-store.js";
import {
	renderIterationCreated, renderIterationStarted, renderIterationClosed,
	renderIterationDetail, renderAgentAttached, renderResourceAdded, renderCapacityAdded,
	renderIterationAdvanced,
} from "../displays/iterations-display.js";

function storeDeps() { return { disk, paths, clock } as const; }

export async function addIterationInteractive(projectPath: string, config?: IterationsConfig): Promise<boolean> {
	printHeader("Add Iteration");

	const name = await input.ask("Name");
	if (!name) return false;

	const existing = listIterations(storeDeps(), projectPath, config);
	const num = nextIterationNumber(existing);

	const goal = await input.ask("Goal", "");
	const startDate = await input.ask("Start date (YYYY-MM-DD)", clock.iso().slice(0, 10));
	const endDefault = config?.durationDays ? computeEndDate(startDate, config.durationDays) : "";
	const endDate = await input.ask("End date (YYYY-MM-DD)", endDefault);
	if (!endDate) return false;

	const capacity = await input.ask("Capacity (optional)", "");
	const description = await input.ask("Description (optional)", "");

	const filePath = createIteration(storeDeps(), projectPath, {
		name, number: num, startDate, endDate, goal,
		capacity: capacity || undefined,
		description: description || undefined,
	}, config);

	if (filePath) {
		renderIterationCreated(paths.relative(projectPath, filePath));
		return true;
	}
	return false;
}

function doStart(projectPath: string, iterationNumber: number, name: string, config?: IterationsConfig): void {
	const ok = startIteration(storeDeps(), projectPath, iterationNumber, config);
	if (ok) renderIterationStarted(name);
}

async function selectAndStart(projectPath: string, config?: IterationsConfig): Promise<void> {
	const all = listIterations(storeDeps(), projectPath, config);
	const items = all.filter((it) => it.status === "planned");
	if (items.length === 0) {
		const create = await input.askYesNo("No planned iterations. Create one?");
		if (create) await addIterationInteractive(projectPath, config);
		return;
	}

	for (let i = 0; i < items.length; i++) {
		log(`  ${i + 1}. #${items[i].number} ${items[i].name} (${items[i].startDate} → ${items[i].endDate})`);
	}
	const choice = await input.ask("Select iteration (number)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= items.length) return;

	doStart(projectPath, items[idx].number, items[idx].name, config);
}

export async function startIterationInteractive(projectPath: string, config?: IterationsConfig): Promise<void> {
	printHeader("Start Iteration");

	const current = findCurrentIteration(storeDeps(), projectPath, config);
	if (current && current.status === "planned") {
		doStart(projectPath, current.number, current.name, config);
		return;
	}
	if (current) {
		log(`\n  Iteration "${current.name}" is already active (${current.status}).\n`);
		return;
	}

	await selectAndStart(projectPath, config);
}

export async function closeIterationInteractive(projectPath: string, config?: IterationsConfig): Promise<void> {
	printHeader("Close Iteration");

	const current = findCurrentIteration(storeDeps(), projectPath, config);
	if (!current) {
		log(`\n  No active iteration to close.\n`);
		return;
	}

	const confirm = await input.askYesNo(`Close iteration "${current.name}"?`);
	if (!confirm) return;

	const ok = closeIteration(storeDeps(), projectPath, current.number, config);
	if (ok) renderIterationClosed(current.name);
}

export async function showCurrentIteration(projectPath: string, config?: IterationsConfig): Promise<void> {
	const current = findCurrentIteration(storeDeps(), projectPath, config);
	if (current) {
		renderIterationDetail(current);
		return;
	}

	const create = await input.askYesNo("No current iteration. Create one?");
	if (create) {
		await addIterationInteractive(projectPath, config);
	}
}

export async function attachAgentInteractive(projectPath: string, config?: IterationsConfig): Promise<void> {
	printHeader("Attach Agent");

	const current = findCurrentIteration(storeDeps(), projectPath, config);
	if (!current) {
		log(`\n  No active iteration to attach agents to.\n`);
		return;
	}

	const agentsDir = paths.join(projectPath, "agents");
	if (!disk.existsSync(agentsDir)) {
		log(`\n  No agents folder found at ${agentsDir}.\n`);
		return;
	}

	const files = disk.readdirSync(agentsDir).filter((f: string) => f.endsWith(".md"));
	if (files.length === 0) {
		log(`\n  No agent files found in agents folder.\n`);
		return;
	}

	for (let i = 0; i < files.length; i++) {
		log(`  ${i + 1}. ${files[i]}`);
	}
	const choice = await input.ask("Select agent (number)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= files.length) return;

	const agent: AgentReference = { name: files[idx].replace(/\.md$/, ""), file: files[idx] };
	const ok = attachAgent(storeDeps(), projectPath, current.number, agent, config);
	if (ok) renderAgentAttached(agent.name, current.name);
}

export async function addResourceInteractive(projectPath: string, config?: IterationsConfig): Promise<void> {
	printHeader("Add Resource");

	const current = findCurrentIteration(storeDeps(), projectPath, config);
	if (!current) {
		log(`\n  No active iteration to add resources to.\n`);
		return;
	}

	const name = await input.ask("Resource name");
	if (!name) return;

	const role = await input.ask("Role (optional)", "");
	const allocation = await input.ask("Allocation (optional, e.g. 80%)", "");

	const resource: ResourceAllocation = { name, role: role || undefined, allocation: allocation || undefined };
	const ok = addResource(storeDeps(), projectPath, current.number, resource, config);
	if (ok) renderResourceAdded(name, current.name);
}

export async function addCapacityInteractive(projectPath: string, config?: IterationsConfig): Promise<void> {
	printHeader("Add Capacity");

	const current = findCurrentIteration(storeDeps(), projectPath, config);
	if (!current) {
		log(`\n  No active iteration to add capacity to.\n`);
		return;
	}

	const label = await input.ask("Label (e.g. Story Points, Hours)");
	if (!label) return;

	const value = await input.ask("Value");
	if (!value) return;

	const unit = await input.ask("Unit (optional)", "");

	const capacity: CapacityEntry = { label, value, unit: unit || undefined };
	const ok = addCapacity(storeDeps(), projectPath, current.number, capacity, config);
	if (ok) renderCapacityAdded(label, current.name);
}

export async function addScopeItemInteractive(projectPath: string, config?: IterationsConfig): Promise<void> {
	printHeader("Add Scope Item");

	const current = findCurrentIteration(storeDeps(), projectPath, config);
	if (!current) {
		log(`\n  No active iteration.\n`);
		return;
	}

	const item = await input.ask("Scope item");
	if (!item) return;

	const ok = addScopeItem(storeDeps(), projectPath, current.number, item, config);
	if (ok) log(`\n  Added scope item to ${current.name}.`);
}

export async function advanceToReviewInteractive(projectPath: string, config?: IterationsConfig): Promise<void> {
	printHeader("Advance to Review");

	const current = findCurrentIteration(storeDeps(), projectPath, config);
	if (!current) {
		log(`\n  No active iteration.\n`);
		return;
	}
	if (current.status !== "in-progress") {
		log(`\n  Iteration "${current.name}" is not in development (status: ${current.status}).\n`);
		return;
	}

	const confirm = await input.askYesNo(`Move "${current.name}" to review?`);
	if (!confirm) return;

	const ok = advanceToReview(storeDeps(), projectPath, current.number, config);
	if (ok) renderIterationAdvanced(current.name, "review");
}

export async function addNoteInteractive(projectPath: string, config?: IterationsConfig): Promise<void> {
	printHeader("Add Note");

	const current = findCurrentIteration(storeDeps(), projectPath, config);
	if (!current) {
		log(`\n  No active iteration.\n`);
		return;
	}

	const note = await input.ask("Note");
	if (!note) return;

	const ok = addNote(storeDeps(), projectPath, current.number, note, config);
	if (ok) log(`\n  Added note to ${current.name}.`);
}
