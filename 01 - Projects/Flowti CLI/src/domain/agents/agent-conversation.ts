/** agent-conversation.ts — Pure functions for building multi-turn conversation prompts. */

import type { AgentAttributes } from "./agent-types.js";

// ── Types ────────────────────────────────────────────────────────────

export interface ConversationTurn {
	readonly role: "user" | "agent";
	readonly content: string;
}

/** Character identity passed to prompt builders for RPG-flavored responses. */
export interface AgentCharacter {
	readonly description?: string;
	readonly persona?: string;
	readonly mood?: string;
	readonly personality?: readonly string[];
	readonly attributes?: AgentAttributes;
	readonly experience?: number;
}

/** Structured agent response. */
export interface AgentResponse {
	readonly message: string;
	readonly status: "message" | "question" | "ready" | "error";
}

// ── Response format ─────────────────────────────────────────────────

const RESPONSE_FORMAT = `
# Response Format

You are in a **live chat**. Keep responses short, conversational, and to the point — 1-3 sentences max. No essays, no bullet lists unless asked.

You MUST respond with a single JSON object. No text before or after the JSON.

\`\`\`json
{
  "message": "Your response text here",
  "status": "message | question | ready | error"
}
\`\`\`

Status values:
- "message" — a statement, answer, or general response
- "question" — you are asking the user a question and need their input
- "ready" — you confirm understanding and are ready to proceed
- "error" — you cannot proceed due to missing information or a problem
`.trim();

/** Detect question from the last non-empty line of text. */
function detectStatus(text: string): AgentResponse["status"] {
	const lines = text.split(/\r?\n/);
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i].trim();
		if (line.length > 0) return line.endsWith("?") ? "question" : "message";
	}
	return "message";
}

/** Parse a raw agent response string into a structured AgentResponse. Falls back gracefully. */
export function parseAgentResponse(raw: string): AgentResponse {
	const trimmed = raw.trim();
	const jsonMatch = trimmed.match(/^\{[\s\S]*\}$/m) ?? trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
	const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : null;
	if (jsonStr) {
		try {
			const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
			if (typeof parsed.message === "string" && typeof parsed.status === "string") {
				const status = parsed.status as AgentResponse["status"];
				if (["message", "question", "ready", "error"].includes(status)) {
					return { message: parsed.message, status };
				}
			}
		} catch { /* fall through to fallback */ }
	}
	return { message: trimmed, status: detectStatus(trimmed) };
}

// ── Character formatting ────────────────────────────────────────────

function formatAttributes(attrs: AgentAttributes): string {
	const parts: string[] = [];
	if (attrs.str !== undefined) parts.push(`STR ${attrs.str}`);
	if (attrs.int !== undefined) parts.push(`INT ${attrs.int}`);
	if (attrs.wis !== undefined) parts.push(`WIS ${attrs.wis}`);
	if (attrs.cha !== undefined) parts.push(`CHA ${attrs.cha}`);
	if (attrs.dex !== undefined) parts.push(`DEX ${attrs.dex}`);
	if (attrs.con !== undefined) parts.push(`CON ${attrs.con}`);
	return parts.join(", ");
}

function appendCharacterTraits(lines: string[], character?: AgentCharacter): void {
	if (character?.mood) lines.push(`**Disposition**: ${character.mood}`);
	if (character?.personality && character.personality.length > 0) lines.push(`**Personality**: ${character.personality.join(". ")}`);
	if (character?.attributes) lines.push(`**Attributes**: ${formatAttributes(character.attributes)}`);
	if (character?.experience !== undefined) lines.push(`**Experience**: ${character.experience} XP`);
}

function hasCharacterTraits(character?: AgentCharacter): boolean {
	return !!(character?.mood || character?.personality || character?.attributes || character?.experience !== undefined);
}

function buildIdentityBlock(agentName: string, character?: AgentCharacter): string {
	const lines: string[] = [];
	const displayName = character?.persona ? `${character.persona} (${agentName})` : agentName;
	lines.push(`You are **${displayName}**.`);
	if (character?.description) lines.push(character.description);
	lines.push("");
	appendCharacterTraits(lines, character);
	if (hasCharacterTraits(character)) {
		lines.push("");
		lines.push("Stay in character. Let your personality and attributes shape how you respond — a high-INT agent reasons deeply, a high-CHA agent communicates warmly, a high-DEX agent moves quickly between ideas.");
	} else {
		lines.push("Stay in character and respond naturally.");
	}
	return lines.join("\n");
}

// ── Prompt builder ───────────────────────────────────────────────────

/**
 * Build a prompt string that includes the agent's system prompt,
 * any prior conversation turns, and the new user message.
 */
export function buildConversationPrompt(
	agentName: string,
	systemPrompt: string | null,
	history: readonly ConversationTurn[],
	userMessage: string,
	character?: AgentCharacter,
): string {
	const parts: string[] = [];

	if (systemPrompt) {
		parts.push("# System Instructions\n");
		parts.push(systemPrompt);
		parts.push("");
	}

	parts.push(buildIdentityBlock(agentName, character));
	parts.push("");
	parts.push(RESPONSE_FORMAT);
	parts.push("");

	if (history.length > 0) {
		parts.push("# Conversation So Far\n");
		for (const turn of history) {
			const label = turn.role === "user" ? "User" : agentName;
			parts.push(`**${label}:** ${turn.content}\n`);
		}
	}

	parts.push(`**User:** ${userMessage}\n`);
	parts.push(`Respond as ${agentName} using the JSON format above:`);

	return parts.join("\n");
}

/**
 * Build a clarification prompt for an agent reviewing a newly assigned task.
 * The agent should ask questions to ensure full understanding before starting work.
 */
export function buildClarificationPrompt(
	agentName: string,
	systemPrompt: string | null,
	taskName: string,
	taskDescription: string,
	taskContext: string,
	history: readonly ConversationTurn[],
	userReply?: string,
	character?: AgentCharacter,
): string {
	const parts: string[] = [];

	if (systemPrompt) {
		parts.push("# System Instructions\n");
		parts.push(systemPrompt);
		parts.push("");
	}

	parts.push(buildIdentityBlock(agentName, character));
	parts.push("You have been assigned a task.\n");
	parts.push(RESPONSE_FORMAT);
	parts.push("");
	parts.push("# Assigned Task\n");
	parts.push(`**Task:** ${taskName}`);
	parts.push(`**Description:** ${taskDescription}`);
	if (taskContext) parts.push(`**Context:** ${taskContext}`);
	parts.push("");

	if (history.length === 0) {
		parts.push("Review this task carefully. Ask clarification questions about anything that is unclear or ambiguous.");
		parts.push("If you have all the information you need, respond with status \"ready\".\n");
	}

	if (history.length > 0) {
		parts.push("# Discussion\n");
		for (const turn of history) {
			const label = turn.role === "user" ? "User" : agentName;
			parts.push(`**${label}:** ${turn.content}\n`);
		}
	}

	if (userReply) {
		parts.push(`**User:** ${userReply}\n`);
		parts.push(`Continue the discussion. Ask follow-up questions if needed, or respond with status "ready" to confirm readiness.\n`);
	}

	parts.push(`Respond as ${agentName} using the JSON format above:`);
	return parts.join("\n");
}

