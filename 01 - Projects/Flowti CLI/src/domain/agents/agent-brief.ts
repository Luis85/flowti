/**
 * agent-brief.ts — Generates structured context packages for agents.
 *
 * A brief is a self-contained markdown document that can be fed to any AI tool.
 * It combines the agent's system prompt, iteration context, and expected output format
 * into a single document.
 */

import type { ActiveAgent } from "./agent-orchestration.js";
import type { IterationSummary, ScopeItem } from "../iterations/iteration-types.js";

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
