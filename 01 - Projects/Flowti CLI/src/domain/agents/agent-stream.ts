/**
 * agent-stream.ts — Stream-JSON event parser for Claude and Cursor Agent CLIs.
 *
 * Parses NDJSON from `claude -p --output-format stream-json` and
 * `agent -p --output-format stream-json` into typed domain events.
 * Pure functions — no I/O, no side effects.
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
	| { readonly kind: "session"; readonly sessionId: string }
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

/** Cursor Agent CLI `tool_call` NDJSON — map to the same events as Claude tool_use streaming. */
function describeCursorToolCall(toolCall: Record<string, unknown>): { name: string; args: Record<string, unknown> } {
	const read = toolCall.readToolCall as Record<string, unknown> | undefined;
	if (read && typeof read === "object") {
		const args = (read.args as Record<string, unknown>) ?? {};
		const path = args.path;
		return { name: "Read", args: { path, file_path: path } };
	}
	const write = toolCall.writeToolCall as Record<string, unknown> | undefined;
	if (write && typeof write === "object") {
		const args = (write.args as Record<string, unknown>) ?? {};
		const path = args.path;
		return {
			name: "Write",
			args: { path, file_path: path, fileText: args.fileText },
		};
	}
	const fn = toolCall.function as Record<string, unknown> | undefined;
	if (fn && typeof fn === "object") {
		const name = typeof fn.name === "string" ? fn.name : "function";
		let args: Record<string, unknown> = {};
		if (typeof fn.arguments === "string") {
			try {
				args = JSON.parse(fn.arguments) as Record<string, unknown>;
			} catch {
				args = { raw: fn.arguments };
			}
		}
		return { name, args };
	}
	const keys = Object.keys(toolCall).filter((k) => k !== "args");
	if (keys.length === 1) {
		const k = keys[0];
		const inner = toolCall[k] as Record<string, unknown> | undefined;
		const args = inner && typeof inner === "object" ? (inner.args as Record<string, unknown>) ?? {} : {};
		return { name: k, args };
	}
	return { name: "tool", args: {} };
}

function parseCursorToolCallLine(parsed: Record<string, unknown>): readonly AgentStreamEvent[] {
	const subtype = parsed.subtype as string | undefined;
	const callId = parsed.call_id as string | undefined;
	const toolCall = parsed.tool_call as Record<string, unknown> | undefined;
	if (!callId || !toolCall || typeof toolCall !== "object") return [];

	if (subtype === "started") {
		const { name, args } = describeCursorToolCall(toolCall);
		const start: AgentStreamEvent = { kind: "tool-start", id: callId, name };
		const input: AgentStreamEvent = { kind: "tool-input", index: 0, json: JSON.stringify(args) };
		return [start, input];
	}
	if (subtype === "completed") {
		return [{ kind: "tool-end", id: callId }];
	}
	return [];
}

/**
 * Parse one NDJSON line into zero or more stream events.
 * Cursor may emit two events from a single `tool_call` line (start + input args).
 */
export function parseStreamEvents(line: string, state: StreamState): readonly AgentStreamEvent[] {
	if (!line?.trim()) return [];
	let parsed: Record<string, unknown>;
	try { parsed = JSON.parse(line) as Record<string, unknown>; } catch { return []; }
	const type = parsed.type as string | undefined;
	if (!type) return [];

	if (type === "assistant") {
		const e = parseCliAssistant(parsed);
		return e ? [e] : [];
	}
	if (type === "result") {
		const e = parseCliResult(parsed);
		return e ? [e] : [];
	}
	if (type === "system") {
		const sessionId = parsed.session_id as string | undefined;
		return sessionId ? [{ kind: "session" as const, sessionId }] : [];
	}
	if (type === "rate_limit_event" || type === "user") return [];
	if (type === "tool_call") return [...parseCursorToolCallLine(parsed)];

	const e = parseApiSseEvent(type, parsed, state);
	return e ? [e] : [];
}

/** Prefer {@link parseStreamEvents} — one line can yield multiple events (e.g. Cursor `tool_call`). */
export function parseStreamLine(line: string, state: StreamState): AgentStreamEvent | null {
	const evs = parseStreamEvents(line, state);
	return evs[0] ?? null;
}

/**
 * Cursor Agent `stream-json` can emit the same full assistant line twice (especially with
 * `--stream-partial-output`). Skipping when `chunk === buffer.join("")` avoids doubled Talk replies.
 * Do not use for Claude `text_delta` streams — those are incremental slices, not full-message repeats.
 */
export function appendAssistantTextSkipFullDuplicate(buffer: string[], chunk: string): void {
	if (!chunk.trim()) return;
	if (chunk === buffer.join("")) return;
	buffer.push(chunk);
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
