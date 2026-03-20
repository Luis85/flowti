/** agents-run-menu.ts — Interactive flows for running agents autonomously or generating briefs. */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig } from "../../infrastructure/types.js";
import type { AgentSummary } from "../../domain/agents/agent-types.js";
import type { IterationSummary } from "../../domain/iterations/iteration-types.js";

export type RunMenuDeps = Pick<CliDeps, "disk" | "paths" | "shell" | "clock" | "input" | "log" | "processRunner" | "providerRegistry">;

/**
 * Run an agent: generate a brief and either display the path (prompt-only)
 * or spawn the Claude CLI process (autonomous mode).
 */
export async function runAgentInteractive(
	agent: AgentSummary, iteration: IterationSummary, iterDir: string,
	autonomous: boolean, deps: RunMenuDeps, stateFilePath?: string, availableSkills?: readonly string[],
): Promise<void> {
	const { generateBrief, saveBrief } = await import("../../domain/agents/brief-store.js");
	const brief = generateBrief({ agentName: agent.name, agentDescription: agent.description, agentSkills: agent.skills.map((s) => s.level ? `${s.name} (${s.level})` : s.name), agentRoles: agent.roles, agentPersona: agent.persona, agentMood: agent.mood, agentPersonality: agent.personality, agentAttributes: agent.attributes, agentExperience: agent.experience, systemPrompt: agent.ai?.systemPrompt, iteration, availableSkills });
	const briefPath = saveBrief(deps, iterDir, iteration.number, agent.name, iteration.status, brief);
	if (!autonomous) {
		const { renderBriefGenerated } = await import("../displays/agent-run-display.js");
		renderBriefGenerated(briefPath, agent.name, deps.log);
		return;
	}
	await spawnAndStream(agent, briefPath, iterDir, iteration, deps);
}

/**
 * Run an existing brief file through the Claude CLI (autonomous mode)
 * or just display its path (prompt-only mode).
 */
export async function runBriefInteractive(
	briefPath: string, agentName: string, autonomous: boolean, deps: RunMenuDeps,
): Promise<void> {
	if (!autonomous) {
		const { renderBriefGenerated } = await import("../displays/agent-run-display.js");
		renderBriefGenerated(briefPath, agentName, deps.log);
		return;
	}
	if (!deps.shell.check("claude --version")) {
		deps.log("\n  Claude CLI is not installed or not in PATH.\n");
		return;
	}
	const { renderAgentSpawned, renderStreamEvent } = await import("../displays/agent-run-display.js");
	const agent: AgentSummary = { name: agentName, agentType: "ai", description: "", skills: [], tools: [], roles: [], file: "" };
	const briefContent = deps.disk.readFileSync(briefPath, "utf-8");
	const proc = deps.processRunner.spawn(agent, briefContent);
	const sessionId = `dispatch-${deps.clock.ms()}`;
	renderAgentSpawned(agentName, sessionId, deps.log);
	proc.onEvent((event) => renderStreamEvent(event, "indicator", deps.log));
}

/** List briefs for an iteration and let the user pick one. */
export async function selectBriefInteractive(
	iterDir: string, iterationNumber: number, deps: RunMenuDeps,
): Promise<string | null> {
	const { listBriefs } = await import("../../domain/agents/brief-store.js");
	const briefs = listBriefs(deps, iterDir, iterationNumber);
	if (briefs.length === 0) {
		deps.log("\n  No briefs found for this iteration.\n");
		return null;
	}
	deps.log();
	for (let i = 0; i < briefs.length; i++) {
		deps.log(`  ${i + 1}. ${briefs[i].agentName} [${briefs[i].phase}] — ${briefs[i].status}`);
	}
	const choice = await deps.input.ask("\nSelect brief number (or empty to cancel)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= briefs.length) return null;
	return deps.paths.join(iterDir, "briefs", briefs[idx].file);
}

// ── Internal ─────────────────────────────────────────────────────────

async function spawnAndStream(
	agent: AgentSummary, briefPath: string, iterDir: string,
	iteration: IterationSummary, deps: RunMenuDeps,
): Promise<void> {
	if (!deps.shell.check("claude --version")) {
		deps.log("\n  Claude CLI is not installed or not in PATH.\n");
		return;
	}
	const { renderAgentSpawned, renderStreamEvent } = await import("../displays/agent-run-display.js");
	const briefContent = deps.disk.readFileSync(briefPath, "utf-8");
	const proc = deps.processRunner.spawn(agent, briefContent);
	const sessionId = `dispatch-${deps.clock.ms()}`;
	renderAgentSpawned(agent.name, sessionId, deps.log);
	const thinkingDisplay = "indicator" as const;
	proc.onEvent((event) => renderStreamEvent(event, thinkingDisplay, deps.log));
}

export { type AgentsConfig };
