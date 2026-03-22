/**
 * action-handlers.ts — Execution backends for agent worker actions.
 *
 * Pure functions that build prompts or generate static responses.
 * The worker calls these, then spawns LLM processes or returns directly.
 */

import { buildConversationPrompt } from "./agent-conversation.js";
import type { AgentCharacter, ConversationTurn } from "./agent-conversation.js";
import type { AgentSummary } from "./agent-types.js";

/** Extract an AgentCharacter from an AgentSummary for prompt building. */
export function buildCharacter(agent: AgentSummary): AgentCharacter {
	return {
		description: agent.description,
		persona: agent.persona,
		mood: agent.mood,
		personality: agent.personality,
		attributes: agent.attributes,
		experience: agent.experience,
	};
}

/** Build a prompt for a task assignment — no prior conversation history. */
export function buildTaskPrompt(
	agentName: string,
	task: string,
	systemPrompt: string | null,
	character: AgentCharacter | undefined,
): string {
	return buildConversationPrompt(agentName, systemPrompt, [], task, character);
}

/** Build a prompt for a conversational response — includes history. */
export function buildResponsePrompt(
	agentName: string,
	message: string,
	systemPrompt: string | null,
	character: AgentCharacter | undefined,
	history: readonly ConversationTurn[],
): string {
	return buildConversationPrompt(agentName, systemPrompt, history, message, character);
}

/** Build a priming prompt for session startup — system + character + history, no user message needed. */
export function buildPrimingPrompt(
	agentName: string,
	systemPrompt: string | null,
	character: AgentCharacter | undefined,
	history: readonly ConversationTurn[],
): string {
	return buildConversationPrompt(agentName, systemPrompt, history, "You are now active. Confirm you are ready.", character);
}

function formatPendingTasks(tasks: Array<{ name: string; status: string }>): string[] {
	if (tasks.length === 0) return ["I have no pending tasks."];
	const header = `I have ${tasks.length} task${tasks.length > 1 ? "s" : ""}:`;
	return [header, ...tasks.map((t) => `- ${t.name} [${t.status}]`)];
}

/** Generate a static response from world-state components (for NPC agents). */
export function respondFromState(agentName: string, components: Record<string, unknown>): string {
	const status = components.status as { state?: string } | undefined;
	const tasks = components.tasks as { items?: Array<{ name: string; status: string }> } | undefined;
	const identity = components.identity as { persona?: string } | undefined;
	const name = identity?.persona ?? agentName;
	const pending = tasks?.items?.filter((t) => t.status !== "done") ?? [];
	return [`I'm ${name}. My current state is ${status?.state ?? "unknown"}.`, ...formatPendingTasks(pending)].join("\n");
}

/** Simple acknowledgment string for NPC task assignment. */
export function acknowledge(_agentName: string, task: string): string {
	return `Task "${task}" acknowledged. I'll work on it.`;
}
