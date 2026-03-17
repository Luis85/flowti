/**
 * agent-stream.ts — Stream-JSON event parser for Claude CLI output.
 *
 * Parses NDJSON lines from `claude --output-format stream-json` into typed
 * domain events. Pure functions — no I/O, no side effects.
 */

// ── Event types ──────────────────────────────────────────────────────

export type AgentStreamEvent =
	| { readonly kind: "thinking"; readonly text: string }
	| { readonly kind: "text"; readonly text: string }
	| { readonly kind: "tool-start"; readonly id: string; readonly name: string }
	| { readonly kind: "tool-input"; readonly index: number; readonly json: string }
	| { readonly kind: "tool-end"; readonly id: string }
	| { readonly kind: "error"; readonly message: string }
	| { readonly kind: "usage"; readonly inputTokens: number; readonly outputTokens: number }
	| { readonly kind: "done" };

// Backward compat — AgentStreamEvent is now an alias for LLMEvent
export type { LLMEvent } from "./llm-types.js";

// ── Stream state ─────────────────────────────────────────────────────

export interface StreamState {
	readonly activeBlocks: Map<number, { type: "thinking" | "text" | "tool"; id?: string }>;
}

export function createStreamState(): StreamState {
	return { activeBlocks: new Map() };
}

// ── State updater ────────────────────────────────────────────────────

export function updateStreamState(state: StreamState, line: string): StreamState {
	let parsed: Record<string, unknown>;
	try { parsed = JSON.parse(line) as Record<string, unknown>; } catch { return state; }
	const type = parsed.type as string | undefined;
	if (type === "content_block_start") {
		const index = parsed.index as number;
		const block = parsed.content_block as Record<string, unknown> | undefined;
		if (!block) return state;
		const blockType = block.type as string;
		const next = new Map(state.activeBlocks);
		if (blockType === "thinking") next.set(index, { type: "thinking" });
		else if (blockType === "text") next.set(index, { type: "text" });
		else if (blockType === "tool_use") next.set(index, { type: "tool", id: block.id as string });
		return { activeBlocks: next };
	}
	if (type === "content_block_stop") {
		const index = parsed.index as number;
		const next = new Map(state.activeBlocks);
		next.delete(index);
		return { activeBlocks: next };
	}
	return state;
}

// ── Line parser ──────────────────────────────────────────────────────

/**
 * Parse a single NDJSON line from Claude CLI `--output-format stream-json`.
 *
 * Supports TWO formats:
 *   1. Claude CLI format — `type: "system"|"assistant"|"result"` (what `claude -p --output-format stream-json` emits)
 *   2. Raw API SSE format — `type: "content_block_start"|"content_block_delta"|...` (for future direct API use)
 */
function parseBlockStart(parsed: Record<string, unknown>): AgentStreamEvent | null {
	const block = parsed.content_block as Record<string, unknown> | undefined;
	if (!block) return null;
	const blockType = block.type as string;
	if (blockType === "thinking") return { kind: "thinking", text: "" };
	if (blockType === "tool_use") return { kind: "tool-start", id: block.id as string, name: block.name as string };
	return null;
}

function parseBlockDelta(parsed: Record<string, unknown>): AgentStreamEvent | null {
	const delta = parsed.delta as Record<string, unknown> | undefined;
	if (!delta) return null;
	const deltaType = delta.type as string;
	if (deltaType === "thinking_delta") return { kind: "thinking", text: delta.thinking as string };
	if (deltaType === "text_delta") return { kind: "text", text: delta.text as string };
	if (deltaType === "input_json_delta") return { kind: "tool-input", index: parsed.index as number, json: delta.partial_json as string };
	return null;
}

function parseBlockStop(parsed: Record<string, unknown>, state: StreamState): AgentStreamEvent | null {
	const index = parsed.index as number;
	const block = state.activeBlocks.get(index);
	if (block?.type === "tool" && block.id) return { kind: "tool-end", id: block.id };
	return null;
}

function parseMessageDelta(parsed: Record<string, unknown>): AgentStreamEvent | null {
	const usage = parsed.usage as Record<string, number> | undefined;
	if (usage) return { kind: "usage", inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 };
	return null;
}

function parseErrorEvent(parsed: Record<string, unknown>): AgentStreamEvent {
	const error = parsed.error as Record<string, unknown> | undefined;
	return { kind: "error", message: (error?.message as string) ?? "Unknown error" };
}

function parseApiSseEvent(type: string, parsed: Record<string, unknown>, state: StreamState): AgentStreamEvent | null {
	if (type === "content_block_start") return parseBlockStart(parsed);
	if (type === "content_block_delta") return parseBlockDelta(parsed);
	if (type === "content_block_stop") return parseBlockStop(parsed, state);
	if (type === "message_delta") return parseMessageDelta(parsed);
	if (type === "message_stop") return { kind: "done" };
	if (type === "error") return parseErrorEvent(parsed);
	return null;
}

export function parseStreamLine(line: string, state: StreamState): AgentStreamEvent | null {
	if (!line) return null;
	let parsed: Record<string, unknown>;
	try { parsed = JSON.parse(line) as Record<string, unknown>; } catch { return null; }
	const type = parsed.type as string | undefined;
	if (!type) return null;

	// ── Claude CLI format ────────────────────────────────────────────
	if (type === "assistant") return parseCliAssistant(parsed);
	if (type === "result") return parseCliResult(parsed);
	if (type === "system" || type === "rate_limit_event") return null;

	// ── Raw API SSE format (future-proofing) ─────────────────────────
	return parseApiSseEvent(type, parsed, state);
}

// ── CLI format helpers ──────────────────────────────────────────────

function parseCliAssistant(parsed: Record<string, unknown>): AgentStreamEvent | null {
	const message = parsed.message as Record<string, unknown> | undefined;
	if (!message) return null;
	const content = message.content as Array<Record<string, unknown>> | undefined;
	if (!content || content.length === 0) return null;
	// Return the first meaningful content block
	for (const block of content) {
		if (block.type === "text" && typeof block.text === "string") return { kind: "text", text: block.text };
		if (block.type === "thinking" && typeof block.thinking === "string") return { kind: "thinking", text: block.thinking };
		if (block.type === "tool_use") return { kind: "tool-start", id: block.id as string, name: block.name as string };
	}
	return null;
}

function parseCliResult(parsed: Record<string, unknown>): AgentStreamEvent | null {
	const subtype = parsed.subtype as string | undefined;
	if (subtype === "error" || parsed.is_error === true) {
		return { kind: "error", message: (parsed.result as string) ?? "Unknown error" };
	}
	const usage = parsed.usage as Record<string, number> | undefined;
	if (usage) return { kind: "usage", inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 };
	return { kind: "done" };
}
