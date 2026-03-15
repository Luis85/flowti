/** agents-run-menu.ts — Interactive flows for running agents autonomously or generating briefs. */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig } from "../../infrastructure/types.js";
import type { AgentSummary } from "../../domain/agents/agent-types.js";
import type { IterationSummary } from "../../domain/iterations/iteration-types.js";
import type { AgentStreamEvent } from "../../domain/agents/agent-stream.js";

export type RunMenuDeps = Pick<CliDeps, "disk" | "paths" | "shell" | "clock" | "input" | "log">;

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
	await spawnAndStream(agent.name, briefPath, agent, iterDir, iteration, deps, stateFilePath);
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
	const { buildRunSpec } = await import("../../domain/agents/agent-runner.js");
	const { checkClaudeInstalled, launchAgent } = await import("../../infrastructure/agent-process.js");
	const { renderAgentSpawned, renderStreamEvent } = await import("../displays/agent-run-display.js");
	if (!checkClaudeInstalled(deps)) {
		deps.log("\n  Claude CLI is not installed or not in PATH.\n");
		return;
	}
	const spec = buildRunSpec(undefined, briefPath, deps.paths.dirname(briefPath));
	const handle = launchAgent(deps, spec, `manual-${Date.now()}`);
	renderAgentSpawned(agentName, handle.sessionId, deps.log);
	const thinkingDisplay = "indicator" as const;
	handle.subscribe((event: AgentStreamEvent) => renderStreamEvent(event, deps.log, thinkingDisplay));
	await handle.process.waitForExit(300000);
	deps.log("\n  Agent process finished.\n");
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
	agentName: string, briefPath: string, agent: AgentSummary, iterDir: string,
	iteration: IterationSummary, deps: RunMenuDeps, stateFilePath?: string,
): Promise<void> {
	const { buildRunSpec } = await import("../../domain/agents/agent-runner.js");
	const { checkClaudeInstalled, launchAgent } = await import("../../infrastructure/agent-process.js");
	const { createSession, updateSessionStatus, appendStructuredOutput } = await import("../../domain/agents/agent-session.js");
	const { renderAgentSpawned, renderStreamEvent } = await import("../displays/agent-run-display.js");
	if (!checkClaudeInstalled(deps)) {
		deps.log("\n  Claude CLI is not installed or not in PATH.\n");
		return;
	}
	if (stateFilePath) await updateAgentStateDuringRun(deps, stateFilePath, agentName, "busy");
	const spec = buildRunSpec(agent.ai, briefPath, deps.paths.dirname(iterDir));
	const session = createSession(deps, iterDir, agentName, iteration.number, briefPath);
	const handle = launchAgent(deps, spec, session.id);
	renderAgentSpawned(agentName, session.id, deps.log);
	updateSessionStatus(deps, iterDir, session.id, "running");

	const thinkingDisplay = "indicator" as const;
	const events: Array<AgentStreamEvent & { ts: string }> = [];
	let lastUsage: { inputTokens: number; outputTokens: number } | undefined;

	handle.subscribe((event: AgentStreamEvent) => {
		renderStreamEvent(event, deps.log, thinkingDisplay);
		events.push({ ...event, ts: deps.clock.iso() });
		if (event.kind === "usage") lastUsage = { inputTokens: event.inputTokens, outputTokens: event.outputTokens };
	});

	await handle.process.waitForExit(300000);
	if (events.length > 0) appendStructuredOutput(deps, iterDir, session.id, events, lastUsage);
	updateSessionStatus(deps, iterDir, session.id, "completed");
	if (stateFilePath) await updateAgentStateDuringRun(deps, stateFilePath, agentName, "idle");
	deps.log("\n  Agent process finished.\n");
}

/** Agent wrapper state management — updates agent state during autonomous runs. */
async function updateAgentStateDuringRun(
	deps: RunMenuDeps, stateFilePath: string, agentName: string, status: "busy" | "idle",
): Promise<void> {
	try {
		const { readAgentState, writeAgentState } = await import("../../domain/agents/agent-state.js");
		const dir = deps.paths.dirname(stateFilePath);
		const state = readAgentState(deps, dir, agentName);
		const updated = { ...state, status, lastInteraction: deps.clock.iso(), lastInteractionType: "task" as const };
		writeAgentState(deps, dir, agentName, updated);
	} catch { /* state update is best-effort */ }
}

export { type AgentsConfig };
