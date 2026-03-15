/** agent-conversation.ts — Pure functions for building multi-turn conversation prompts. */

// ── Types ────────────────────────────────────────────────────────────

export interface ConversationTurn {
	readonly role: "user" | "agent";
	readonly content: string;
}

/** Structured agent response. */
export interface AgentResponse {
	readonly message: string;
	readonly status: "message" | "question" | "ready" | "error";
}

// ── Response format ─────────────────────────────────────────────────

const RESPONSE_FORMAT = `
# Response Format

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

// ── Prompt builder ───────────────────────────────────────────────────

/**
 * Build a prompt string that includes the agent's system prompt,
 * any prior conversation turns, and the new user message.
 *
 * The resulting prompt is piped to `claude --print` via stdin.
 */
export function buildConversationPrompt(
	agentName: string,
	systemPrompt: string | null,
	history: readonly ConversationTurn[],
	userMessage: string,
): string {
	const parts: string[] = [];

	if (systemPrompt) {
		parts.push("# System Instructions\n");
		parts.push(systemPrompt);
		parts.push("");
	}

	parts.push(`You are ${agentName}. Stay in character and respond naturally.\n`);
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
): string {
	const parts: string[] = [];

	if (systemPrompt) {
		parts.push("# System Instructions\n");
		parts.push(systemPrompt);
		parts.push("");
	}

	parts.push(`You are ${agentName}. You have been assigned a task.\n`);
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

/**
 * Build the Claude CLI command string for a one-shot invocation.
 * The prompt content is piped via stdin by the caller.
 * Pure function — does not touch the filesystem.
 */
export function buildTalkCommand(model: string | undefined): string {
	const parts = ["claude", "--print"];
	if (model) parts.push("--model", model);
	return parts.join(" ");
}
