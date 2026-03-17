/**
 * llm-prompt.ts — Capability-aware prompt formatting.
 *
 * Pure functions. No I/O, no side effects.
 * Builds prompt strings from PromptEnvelope, adapting to provider capabilities.
 */

import type { PromptEnvelope, ProviderCapabilities, ResponseFormatHint, AgentIdentity } from "./llm-types.js";
import type { AgentAttributes } from "./agent-types.js";

// ── Pre-formatted detection ─────────────────────────────────────────

/** True when the envelope is a raw pre-built prompt string (bridge mode). */
export function isPreFormatted(envelope: PromptEnvelope): boolean {
	return !envelope.system && !envelope.identity && !envelope.history;
}

// ── JSON format decision ────────────────────────────────────────────

export function shouldRequestJson(hint: ResponseFormatHint | undefined, caps: ProviderCapabilities): boolean {
	if (hint === "text") return false;
	if (hint === "json") return caps.structuredOutput;
	return caps.structuredOutput;
}

// ── Response format block ───────────────────────────────────────────

const RESPONSE_FORMAT = `# Response Format

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
- "error" — you cannot proceed due to missing information or a problem`;

// ── Identity block ──────────────────────────────────────────────────

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

function hasCharacterTraits(id: AgentIdentity): boolean {
	return !!(id.mood || id.personality || id.attributes || id.experience !== undefined);
}

function buildIdentityBlock(id: AgentIdentity): string {
	const lines: string[] = [];
	const displayName = id.persona ? `${id.persona} (${id.name})` : id.name;
	lines.push(`You are **${displayName}**.`);
	if (id.description) lines.push(id.description);
	lines.push("");
	if (id.mood) lines.push(`**Disposition**: ${id.mood}`);
	if (id.personality && id.personality.length > 0) lines.push(`**Personality**: ${id.personality.join(". ")}`);
	if (id.attributes) lines.push(`**Attributes**: ${formatAttributes(id.attributes)}`);
	if (id.experience !== undefined) lines.push(`**Experience**: ${id.experience} XP`);
	if (hasCharacterTraits(id)) {
		lines.push("");
		lines.push("Stay in character. Let your personality and attributes shape how you respond — a high-INT agent reasons deeply, a high-CHA agent communicates warmly, a high-DEX agent moves quickly between ideas.");
	} else {
		lines.push("Stay in character and respond naturally.");
	}
	return lines.join("\n");
}

// ── Main formatter ──────────────────────────────────────────────────

/** Build a prompt string from PromptEnvelope, adapting to provider capabilities. */
export function formatPrompt(envelope: PromptEnvelope, caps: ProviderCapabilities): string {
	const parts: string[] = [];
	const useJson = shouldRequestJson(envelope.responseFormat, caps);
	const name = envelope.identity?.name ?? "Agent";

	if (envelope.system) {
		parts.push("# System Instructions\n");
		parts.push(envelope.system);
		parts.push("");
	}

	if (envelope.identity) {
		parts.push(buildIdentityBlock(envelope.identity));
		parts.push("");
	}

	if (useJson) {
		parts.push(RESPONSE_FORMAT);
		parts.push("");
	}

	if (envelope.taskContext) {
		parts.push("# Assigned Task\n");
		parts.push(`**Task:** ${envelope.taskContext.taskName}`);
		parts.push(`**Description:** ${envelope.taskContext.taskDescription}`);
		if (envelope.taskContext.context) parts.push(`**Context:** ${envelope.taskContext.context}`);
		parts.push("");
	}

	if (envelope.history && envelope.history.length > 0) {
		parts.push("# Conversation So Far\n");
		for (const turn of envelope.history) {
			const label = turn.role === "user" ? "User" : name;
			parts.push(`**${label}:** ${turn.content}\n`);
		}
	}

	parts.push(`**User:** ${envelope.message}\n`);

	if (useJson) {
		parts.push(`Respond as ${name} using the JSON format above:`);
	} else {
		parts.push(`Respond as ${name}:`);
	}

	return parts.join("\n");
}
