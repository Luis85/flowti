/**
 * iterations-scope-menu.ts — Scope and agent management for iterations.
 *
 * Extracted from iterations-menu.ts to keep files under the line limit.
 */

import { printHeader, RESET, DIM, CYAN } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { IterationsConfig, AgentsConfig } from "../../infrastructure/types.js";
import type { AgentReference, ResourceAllocation, CapacityEntry } from "../../domain/iterations/iteration-types.js";
import type { SuggestedTask } from "../../domain/agents/agent-types.js";
import { createResourceFile, createEstimationFile } from "../../domain/iterations/iteration-entities.js";
import type { ResourceNeedEntity, EstimationEntity } from "../../domain/iterations/iteration-entities.js";
import { agentStore, getProjectAgents, createAgent } from "../../domain/agents/agent-store.js";
import { renderAgentList } from "../displays/agents-display.js";
import {
	findCurrentIteration,
	attachAgent, addResource, addCapacity, addScopeItem, addNote,
	updateDescription, editScopeItem, removeScopeItem, toggleScopeItem,
} from "../../domain/iterations/iteration-store.js";
import {
	renderAgentAdded, renderResourceAdded, renderEstimationAdded, renderScopeItems,
} from "../displays/iterations-display.js";

// ── Agent management ────────────────────────────────────────────────

export interface AddAgentOptions {
	agentsBasePath?: string;
	agentsConfig?: AgentsConfig;
	roster?: string[];
}

export async function addAgentInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps, options?: AddAgentOptions): Promise<void> {
	printHeader("Add Agent to Iteration");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) {
		deps.log(`\n  No active iteration to add agents to.\n`);
		return;
	}

	const basePath = options?.agentsBasePath ?? projectPath;
	const agentsCfg = options?.agentsConfig;
	const roster = options?.roster;
	const selected = await selectOrCreateAgent(basePath, agentsCfg, roster, deps);
	if (!selected) return;

	const agent: AgentReference = { name: selected.name, file: selected.file };
	const ok = attachAgent(deps, projectPath, current.number, agent, config);
	if (ok) renderAgentAdded(selected.name, current.name, deps.log);
}

async function selectOrCreateAgent(agentsBasePath: string, agentsConfig: AgentsConfig | undefined, roster: string[] | undefined, deps: MenuDeps): Promise<{ name: string; file: string } | null> {
	const existing = roster && roster.length > 0
		? getProjectAgents(deps, agentsBasePath, agentsConfig, roster)
		: agentStore.list(deps, agentsBasePath, agentsConfig ? { dir: agentsConfig.dir } : undefined);
	if (existing.length === 0) return createNewAgentViaStore(agentsBasePath, agentsConfig, deps);

	renderAgentList(existing, deps.log);
	deps.log(`  Or type "new" to create a new agent.\n`);
	const choice = await deps.input.ask("Agent name or 'new'");
	if (!choice) return null;
	if (choice.toLowerCase() === "new") return createNewAgentViaStore(agentsBasePath, agentsConfig, deps);

	const match = existing.find((a) => a.name.toLowerCase() === choice.toLowerCase());
	if (!match) {
		deps.log(`\n  Agent "${choice}" not found.\n`);
		return null;
	}
	return { name: match.name, file: match.file };
}

async function createNewAgentViaStore(agentsBasePath: string, agentsConfig: AgentsConfig | undefined, deps: MenuDeps): Promise<{ name: string; file: string } | null> {
	const name = await deps.input.ask("Agent name");
	if (!name) return null;

	const typeChoice = await deps.input.ask("Type (human/ai)", "human");
	const agentType = typeChoice === "ai" ? "ai" as const : "human" as const;
	const description = await deps.input.ask("Description (optional)", "");

	const filePath = createAgent(deps, agentsBasePath, {
		name, agentType, description: description || "",
		skills: [], tools: [], roles: [],
	}, agentsConfig);
	if (!filePath) {
		deps.log(`\n  Agent "${name}" already exists.\n`);
		const agents = agentStore.list(deps, agentsBasePath, agentsConfig ? { dir: agentsConfig.dir } : undefined);
		const match = agents.find((a) => a.name.toLowerCase() === name.toLowerCase());
		return match ? { name: match.name, file: match.file } : null;
	}
	const file = deps.paths.basename(filePath);
	deps.log(`\n  Created ${deps.paths.relative(agentsBasePath, filePath)}`);
	return { name, file };
}

// ── Resource & estimation ───────────────────────────────────────────

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

// ── Scope item management ───────────────────────────────────────────

/** Recommended tasks collected from roster agents, grouped by agent. */
export interface AgentRecommendation {
	readonly agentName: string;
	readonly tasks: SuggestedTask[];
}

export interface ScopeItemOptions {
	readonly recommendations?: AgentRecommendation[];
}

export async function addScopeItemInteractive(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps, options?: ScopeItemOptions): Promise<void> {
	printHeader("Add Scope Item");

	const current = findCurrentIteration(deps, projectPath, config);
	if (!current) {
		deps.log(`\n  No active iteration.\n`);
		return;
	}

	const recs = collectRecommendations(options?.recommendations, current.status);
	displayRecommendations(recs, deps);

	const added = await scopeItemLoop(projectPath, config, deps, current, recs);
	if (added > 0) deps.log(`\n  ${added} scope item${added > 1 ? "s" : ""} added.`);
}

async function scopeItemLoop(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps, current: { name: string; number: number }, recs: FlatRecommendation[]): Promise<number> {
	const hasRecs = recs.length > 0;
	let added = 0;
	for (;;) {
		const prompt = hasRecs && added === 0 ? "Pick a number or enter scope item" : "Scope item";
		const input = await deps.input.ask(prompt);
		if (!input) break;

		const item = resolveRecommendation(input, recs);
		const ok = addScopeItem(deps, projectPath, current.number, item, config);
		if (ok) { deps.log(`\n  Added scope item to ${current.name}.`); added++; }

		const more = await deps.input.askYesNo("Add another?");
		if (!more) break;
	}
	return added;
}

function displayRecommendations(recs: FlatRecommendation[], deps: MenuDeps): void {
	if (recs.length === 0) return;
	deps.log(`\n  ${DIM}Recommended tasks from your agents:${RESET}\n`);
	for (let i = 0; i < recs.length; i++) {
		deps.log(`  ${CYAN}${i + 1}${RESET}  ${recs[i].text} ${DIM}(${recs[i].agent})${RESET}`);
	}
	deps.log(`  ${CYAN}c${RESET}  ${DIM}Custom scope item...${RESET}\n`);
}

interface FlatRecommendation { readonly text: string; readonly agent: string; }

function collectRecommendations(recs: AgentRecommendation[] | undefined, phase: string): FlatRecommendation[] {
	if (!recs || recs.length === 0) return [];
	const flat: FlatRecommendation[] = [];
	for (const rec of recs) {
		for (const task of rec.tasks) {
			if (task.phases.length === 0 || task.phases.includes(phase)) {
				flat.push({ text: task.name, agent: rec.agentName });
			}
		}
	}
	return flat;
}

function resolveRecommendation(input: string, recs: FlatRecommendation[]): string {
	if (input.toLowerCase() === "c") return input;
	const idx = parseInt(input, 10);
	if (!isNaN(idx) && idx >= 1 && idx <= recs.length) return recs[idx - 1].text;
	return input;
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
