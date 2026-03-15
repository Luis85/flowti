import { describe, it, expect } from "vitest";
import { parseStreamLine, createStreamState, updateStreamState, type StreamState } from "../../../src/domain/agents/agent-stream.js";

function state(blocks?: Record<number, { type: "thinking" | "text" | "tool"; id?: string }>): StreamState {
	const s = createStreamState();
	if (blocks) for (const [k, v] of Object.entries(blocks)) s.activeBlocks.set(Number(k), v);
	return s;
}

// ── parseStreamLine ──────────────────────────────────────────────────

describe("parseStreamLine", () => {
	const empty = createStreamState();

	describe("invalid / ignorable input", () => {
		it("returns null for invalid JSON", () => {
			expect(parseStreamLine("not-json", empty)).toBeNull();
		});

		it("returns null for empty string", () => {
			expect(parseStreamLine("", empty)).toBeNull();
		});

		it("returns null for ping events", () => {
			expect(parseStreamLine(JSON.stringify({ type: "ping" }), empty)).toBeNull();
		});

		it("returns null for unknown event types", () => {
			expect(parseStreamLine(JSON.stringify({ type: "message_start" }), empty)).toBeNull();
		});

		it("returns null for JSON without type field", () => {
			expect(parseStreamLine(JSON.stringify({ foo: "bar" }), empty)).toBeNull();
		});
	});

	describe("content_block_start", () => {
		it("returns thinking event for thinking block", () => {
			const line = JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "thinking" } });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "thinking", text: "" });
		});

		it("returns null for text block start", () => {
			const line = JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text" } });
			expect(parseStreamLine(line, empty)).toBeNull();
		});

		it("returns tool-start for tool_use block", () => {
			const line = JSON.stringify({
				type: "content_block_start",
				index: 1,
				content_block: { type: "tool_use", id: "tool_abc123", name: "Bash" },
			});
			expect(parseStreamLine(line, empty)).toEqual({ kind: "tool-start", id: "tool_abc123", name: "Bash" });
		});

		it("returns null when content_block is missing", () => {
			const line = JSON.stringify({ type: "content_block_start", index: 0 });
			expect(parseStreamLine(line, empty)).toBeNull();
		});
	});

	describe("content_block_delta", () => {
		it("returns thinking event for thinking_delta", () => {
			const line = JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Let me think..." } });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "thinking", text: "Let me think..." });
		});

		it("returns text event for text_delta", () => {
			const line = JSON.stringify({ type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Hello world" } });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "text", text: "Hello world" });
		});

		it("returns tool-input for input_json_delta", () => {
			const line = JSON.stringify({ type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: '{"cmd"' } });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "tool-input", index: 2, json: '{"cmd"' });
		});

		it("returns null for unknown delta type", () => {
			const line = JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "unknown_delta" } });
			expect(parseStreamLine(line, empty)).toBeNull();
		});

		it("returns null when delta is missing", () => {
			const line = JSON.stringify({ type: "content_block_delta", index: 0 });
			expect(parseStreamLine(line, empty)).toBeNull();
		});
	});

	describe("content_block_stop", () => {
		it("returns tool-end for tool block stop", () => {
			const s = state({ 1: { type: "tool", id: "tool_abc123" } });
			const line = JSON.stringify({ type: "content_block_stop", index: 1 });
			expect(parseStreamLine(line, s)).toEqual({ kind: "tool-end", id: "tool_abc123" });
		});

		it("returns null for thinking block stop", () => {
			const s = state({ 0: { type: "thinking" } });
			const line = JSON.stringify({ type: "content_block_stop", index: 0 });
			expect(parseStreamLine(line, s)).toBeNull();
		});

		it("returns null for text block stop", () => {
			const s = state({ 0: { type: "text" } });
			const line = JSON.stringify({ type: "content_block_stop", index: 0 });
			expect(parseStreamLine(line, s)).toBeNull();
		});

		it("returns null when block index not tracked in state", () => {
			const line = JSON.stringify({ type: "content_block_stop", index: 99 });
			expect(parseStreamLine(line, empty)).toBeNull();
		});
	});

	describe("message_delta", () => {
		it("returns usage event with token counts", () => {
			const line = JSON.stringify({ type: "message_delta", usage: { input_tokens: 100, output_tokens: 250 } });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "usage", inputTokens: 100, outputTokens: 250 });
		});

		it("defaults missing token counts to 0", () => {
			const line = JSON.stringify({ type: "message_delta", usage: {} });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "usage", inputTokens: 0, outputTokens: 0 });
		});

		it("returns null when usage is missing", () => {
			const line = JSON.stringify({ type: "message_delta" });
			expect(parseStreamLine(line, empty)).toBeNull();
		});
	});

	describe("message_stop", () => {
		it("returns done event", () => {
			const line = JSON.stringify({ type: "message_stop" });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "done" });
		});
	});

	describe("error", () => {
		it("returns error event with message", () => {
			const line = JSON.stringify({ type: "error", error: { message: "Rate limit exceeded" } });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "error", message: "Rate limit exceeded" });
		});

		it("returns Unknown error when error object is missing", () => {
			const line = JSON.stringify({ type: "error" });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "error", message: "Unknown error" });
		});

		it("returns Unknown error when message field is missing", () => {
			const line = JSON.stringify({ type: "error", error: {} });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "error", message: "Unknown error" });
		});
	});

	describe("Claude CLI format", () => {
		it("parses assistant message with text content", () => {
			const line = JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Hello!" }] } });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "text", text: "Hello!" });
		});

		it("parses assistant message with thinking content", () => {
			const line = JSON.stringify({ type: "assistant", message: { content: [{ type: "thinking", thinking: "Let me think..." }] } });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "thinking", text: "Let me think..." });
		});

		it("parses assistant message with tool_use content", () => {
			const line = JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id: "toolu_1", name: "Read" }] } });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "tool-start", id: "toolu_1", name: "Read" });
		});

		it("returns null for system init event", () => {
			const line = JSON.stringify({ type: "system", subtype: "init", session_id: "abc" });
			expect(parseStreamLine(line, empty)).toBeNull();
		});

		it("returns null for rate_limit_event", () => {
			const line = JSON.stringify({ type: "rate_limit_event", rate_limit_info: {} });
			expect(parseStreamLine(line, empty)).toBeNull();
		});

		it("parses result success with usage as usage event", () => {
			const line = JSON.stringify({ type: "result", subtype: "success", result: "Hello!", usage: { input_tokens: 100, output_tokens: 5 } });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "usage", inputTokens: 100, outputTokens: 5 });
		});

		it("parses result success without usage as done event", () => {
			const line = JSON.stringify({ type: "result", subtype: "success", result: "Hello!" });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "done" });
		});

		it("parses result error as error event", () => {
			const line = JSON.stringify({ type: "result", subtype: "error", is_error: true, result: "Something went wrong" });
			expect(parseStreamLine(line, empty)).toEqual({ kind: "error", message: "Something went wrong" });
		});

		it("returns null for assistant with empty content", () => {
			const line = JSON.stringify({ type: "assistant", message: { content: [] } });
			expect(parseStreamLine(line, empty)).toBeNull();
		});

		it("returns null for assistant without message", () => {
			const line = JSON.stringify({ type: "assistant" });
			expect(parseStreamLine(line, empty)).toBeNull();
		});
	});
});

// ── updateStreamState ────────────────────────────────────────────────

describe("updateStreamState", () => {
	it("tracks thinking block start", () => {
		const line = JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "thinking" } });
		const next = updateStreamState(createStreamState(), line);
		expect(next.activeBlocks.get(0)).toEqual({ type: "thinking" });
	});

	it("tracks tool block start with id", () => {
		const line = JSON.stringify({
			type: "content_block_start",
			index: 1,
			content_block: { type: "tool_use", id: "tool_xyz", name: "Read" },
		});
		const next = updateStreamState(createStreamState(), line);
		expect(next.activeBlocks.get(1)).toEqual({ type: "tool", id: "tool_xyz" });
	});

	it("tracks text block start", () => {
		const line = JSON.stringify({ type: "content_block_start", index: 2, content_block: { type: "text" } });
		const next = updateStreamState(createStreamState(), line);
		expect(next.activeBlocks.get(2)).toEqual({ type: "text" });
	});

	it("removes block on stop", () => {
		const startLine = JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "thinking" } });
		const stopLine = JSON.stringify({ type: "content_block_stop", index: 0 });
		const s1 = updateStreamState(createStreamState(), startLine);
		const s2 = updateStreamState(s1, stopLine);
		expect(s2.activeBlocks.has(0)).toBe(false);
	});

	it("handles multiple concurrent blocks", () => {
		const thinkLine = JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "thinking" } });
		const toolLine = JSON.stringify({
			type: "content_block_start",
			index: 1,
			content_block: { type: "tool_use", id: "tool_multi", name: "Grep" },
		});
		const textLine = JSON.stringify({ type: "content_block_start", index: 2, content_block: { type: "text" } });
		let s = createStreamState();
		s = updateStreamState(s, thinkLine);
		s = updateStreamState(s, toolLine);
		s = updateStreamState(s, textLine);
		expect(s.activeBlocks.size).toBe(3);
		expect(s.activeBlocks.get(0)).toEqual({ type: "thinking" });
		expect(s.activeBlocks.get(1)).toEqual({ type: "tool", id: "tool_multi" });
		expect(s.activeBlocks.get(2)).toEqual({ type: "text" });
	});

	it("ignores non-block events (e.g. message_start)", () => {
		const line = JSON.stringify({ type: "message_start", message: {} });
		const s = createStreamState();
		const next = updateStreamState(s, line);
		expect(next.activeBlocks.size).toBe(0);
	});

	it("ignores invalid JSON", () => {
		const s = createStreamState();
		const next = updateStreamState(s, "not-valid-json");
		expect(next).toBe(s);
	});

	it("returns same state reference for unrecognised event types", () => {
		const s = createStreamState();
		const next = updateStreamState(s, JSON.stringify({ type: "ping" }));
		expect(next).toBe(s);
	});

	it("ignores content_block_start when content_block is missing", () => {
		const s = createStreamState();
		const line = JSON.stringify({ type: "content_block_start", index: 0 });
		const next = updateStreamState(s, line);
		expect(next).toBe(s);
	});
});
