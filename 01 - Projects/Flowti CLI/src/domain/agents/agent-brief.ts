/**
 * agent-brief.ts — Generates structured context packages for agents.
 *
 * A brief is a self-contained markdown document that can be fed to any AI tool.
 * It combines the agent's system prompt, iteration context, and expected output format
 * into a single document.
 */

import type { ActiveAgent } from "./agent-orchestration.js";
import type { OrchestrationConfig, PhaseBinding } from "../../infrastructure/types.js";
import type { IterationSummary, ScopeItem } from "../iterations/iteration-types.js";
import type { LifecycleTemplate } from "../lifecycle/lifecycle-types.js";

export interface BriefContext {
	readonly agent: ActiveAgent;
	readonly iteration: IterationSummary;
	readonly systemPrompt: string | null;
	readonly validTransitions: readonly string[];
}

/**
 * Generate a structured markdown brief for an agent working on an iteration.
 */
export function generateBrief(ctx: BriefContext): string {
	const { agent, iteration, systemPrompt, validTransitions } = ctx;
	const lines: string[] = [];

	lines.push(`# Agent Brief: ${agent.name} — Iteration #${iteration.number}`);
	lines.push("");

	appendRole(lines, agent);
	appendSystemPrompt(lines, systemPrompt);
	appendIterationContext(lines, iteration, validTransitions);
	appendScopeItems(lines, iteration.scopeItems);
	appendExpectedOutput(lines);

	return lines.join("\n");
}

/**
 * Build the file path for a brief output file.
 */
export function briefFileName(iterationNumber: number, state: string): string {
	return `iteration-${String(iterationNumber).padStart(3, "0")}-${state}.md`;
}

// ── Full-iteration brief ─────────────────────────────────────────────

export interface FullBriefContext {
	readonly agentName: string;
	readonly iteration: IterationSummary;
	readonly systemPrompt: string | null;
	readonly template: LifecycleTemplate;
	readonly orchestration: OrchestrationConfig | undefined;
}

/**
 * Generate a full-iteration brief covering all phases from the current state to done.
 */
export function generateFullIterationBrief(ctx: FullBriefContext): string {
	const { agentName, iteration, systemPrompt, template, orchestration } = ctx;
	const lines: string[] = [];
	const path = buildLifecyclePath(template, iteration.status);

	lines.push(`# Full Iteration Brief: ${agentName} — Iteration #${iteration.number}`);
	lines.push("");

	lines.push("## Your Role");
	lines.push("");
	lines.push(`You are **${agentName}** for this entire iteration. Execute all phases from ${iteration.status} → done.`);
	lines.push("");

	appendSystemPrompt(lines, systemPrompt);

	lines.push("## Lifecycle Path");
	lines.push("");
	lines.push(path.join(" → "));
	lines.push("");

	appendPhaseInstructions(lines, path, orchestration);
	appendIterationContext(lines, iteration, []);
	appendScopeItems(lines, iteration.scopeItems);
	appendFullBriefOutput(lines);

	return lines.join("\n");
}

function buildLifecyclePath(template: LifecycleTemplate, fromState: string): string[] {
	const path: string[] = [fromState];
	let current = fromState;
	const visited = new Set<string>();
	visited.add(current);
	while (!template.terminalStates.includes(current)) {
		const transitions = template.transitions[current] ?? [];
		const next = transitions.find((t) => !template.terminalStates.includes(t) || t === "done") ?? transitions[0];
		if (!next || visited.has(next)) break;
		path.push(next);
		visited.add(next);
		current = next;
	}
	return path;
}

function appendPhaseInstructions(lines: string[], path: string[], orchestration: OrchestrationConfig | undefined): void {
	const phases = orchestration?.phases;
	if (!phases) return;
	const entries = path.map((state) => [state, phases[state]] as [string, PhaseBinding | undefined]).filter(([, b]) => b);
	if (entries.length === 0) return;
	lines.push("## Phase Instructions");
	lines.push("");
	for (const [state, binding] of entries) {
		if (!binding) continue;
		lines.push(`### ${state} (${binding.role ?? "contributor"})`);
		lines.push(binding.instruction ?? "_No specific instruction._");
		lines.push("");
	}
}

function appendFullBriefOutput(lines: string[]): void {
	lines.push("## Expected Output");
	lines.push("");
	lines.push("Update the iteration plan file directly:");
	lines.push("- Mark completed items as `- [x]`");
	lines.push("- Add new items as `- [ ]`");
	lines.push("- Add notes under `## Notes`");
	lines.push("");
}

// ── Section builders ──────────────────────────────────────────────────

function appendRole(lines: string[], agent: ActiveAgent): void {
	lines.push("## Your Role");
	lines.push("");
	lines.push(`You are the **${agent.name}** (${agent.role}) for this iteration.`);
	if (agent.instruction) {
		lines.push(`Your task: ${agent.instruction}`);
	}
	lines.push("");
}

function appendSystemPrompt(lines: string[], systemPrompt: string | null): void {
	if (!systemPrompt) return;
	lines.push("## System Prompt");
	lines.push("");
	lines.push(systemPrompt);
	lines.push("");
}

function appendIterationContext(lines: string[], iteration: IterationSummary, validTransitions: readonly string[]): void {
	lines.push("## Iteration Context");
	lines.push("");
	lines.push(`- **Name**: ${iteration.name}`);
	lines.push(`- **Goal**: ${iteration.goal}`);
	if (iteration.description) lines.push(`- **Description**: ${iteration.description}`);
	lines.push(`- **Status**: ${iteration.status}`);
	lines.push(`- **Dates**: ${iteration.startDate} → ${iteration.endDate}`);
	if (validTransitions.length > 0) {
		lines.push(`- **Next states**: ${validTransitions.join(", ")}`);
	}
	lines.push("");
}

function appendScopeItems(lines: string[], scopeItems: ScopeItem[]): void {
	if (scopeItems.length === 0) {
		lines.push("## Scope Items");
		lines.push("");
		lines.push("_No scope items yet._");
		lines.push("");
		return;
	}
	const done = scopeItems.filter((s) => s.done).length;
	lines.push(`## Scope Items (${done}/${scopeItems.length} done)`);
	lines.push("");
	for (const item of scopeItems) {
		lines.push(`- [${item.done ? "x" : " "}] ${item.text}`);
	}
	lines.push("");
}

function appendExpectedOutput(lines: string[]): void {
	lines.push("## Expected Output");
	lines.push("");
	lines.push("Write your changes directly to the iteration plan file. The CLI will auto-detect changes.");
	lines.push("");
	lines.push("Supported formats:");
	lines.push("- Add scope items as `- [ ] Item text` under the `## Scope Items` section");
	lines.push("- Add notes as freeform text under the `## Notes` section (prefix with date)");
	lines.push("- Mark scope items done by changing `- [ ]` to `- [x]`");
	lines.push("");
}
