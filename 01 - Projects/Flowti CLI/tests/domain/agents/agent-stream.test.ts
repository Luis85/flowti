import { describe, it, expect } from "vitest";
import {
	createStreamState,
	parseStreamEvents,
	parseStreamLine,
	updateStreamState,
	appendAssistantTextSkipFullDuplicate,
} from "../../../src/domain/agents/agent-stream.js";

describe("parseStreamEvents", () => {
	it("parses Claude assistant text", () => {
		const state = createStreamState();
		const line = JSON.stringify({
			type: "assistant",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "Hello" }],
			},
		});
		const evs = parseStreamEvents(line, state);
		expect(evs).toEqual([{ kind: "text", text: "Hello" }]);
	});

	it("parses Cursor tool_call started as tool-start + tool-input", () => {
		const state = createStreamState();
		const line = JSON.stringify({
			type: "tool_call",
			subtype: "started",
			call_id: "call-1",
			tool_call: { readToolCall: { args: { path: "README.md" } } },
			session_id: "s",
		});
		const evs = parseStreamEvents(line, state);
		expect(evs).toEqual([
			{ kind: "tool-start", id: "call-1", name: "Read" },
			{ kind: "tool-input", index: 0, json: JSON.stringify({ path: "README.md", file_path: "README.md" }) },
		]);
	});

	it("parses Cursor tool_call completed as tool-end", () => {
		const state = createStreamState();
		const line = JSON.stringify({
			type: "tool_call",
			subtype: "completed",
			call_id: "call-1",
			tool_call: { readToolCall: { args: { path: "README.md" } } },
		});
		expect(parseStreamEvents(line, state)).toEqual([{ kind: "tool-end", id: "call-1" }]);
	});

	it("maps Cursor writeToolCall to Write + path args", () => {
		const state = createStreamState();
		const line = JSON.stringify({
			type: "tool_call",
			subtype: "started",
			call_id: "w1",
			tool_call: {
				writeToolCall: { args: { path: "out.txt", fileText: "hi" } },
			},
		});
		const evs = parseStreamEvents(line, state);
		expect(evs[0]).toEqual({ kind: "tool-start", id: "w1", name: "Write" });
		expect(JSON.parse((evs[1] as { json: string }).json)).toMatchObject({
			path: "out.txt",
			file_path: "out.txt",
			fileText: "hi",
		});
	});

	it("ignores Cursor user and system lines", () => {
		const state = createStreamState();
		expect(parseStreamEvents(JSON.stringify({ type: "user", message: {} }), state)).toEqual([]);
		expect(
			parseStreamEvents(JSON.stringify({ type: "system", subtype: "init", session_id: "x" }), state),
		).toEqual([]);
	});

	it("parseStreamLine returns first event only", () => {
		const state = createStreamState();
		const line = JSON.stringify({
			type: "tool_call",
			subtype: "started",
			call_id: "c",
			tool_call: { readToolCall: { args: { path: "p" } } },
		});
		expect(parseStreamLine(line, state)?.kind).toBe("tool-start");
	});
});

describe("appendAssistantTextSkipFullDuplicate", () => {
	it("appends normal chunks", () => {
		const b: string[] = [];
		appendAssistantTextSkipFullDuplicate(b, "Hello");
		appendAssistantTextSkipFullDuplicate(b, " world");
		expect(b.join("")).toBe("Hello world");
	});

	it("skips chunk that repeats entire buffer (Cursor duplicate full line)", () => {
		const b: string[] = [];
		appendAssistantTextSkipFullDuplicate(b, "Same full reply.");
		appendAssistantTextSkipFullDuplicate(b, "Same full reply.");
		expect(b).toEqual(["Same full reply."]);
	});
});

describe("updateStreamState + parseStreamEvents", () => {
	it("still parses API-style content_block_delta after state update", () => {
		let state = createStreamState();
		const start = JSON.stringify({
			type: "content_block_start",
			index: 0,
			content_block: { type: "text" },
		});
		state = updateStreamState(state, start);
		const delta = JSON.stringify({
			type: "content_block_delta",
			index: 0,
			delta: { type: "text_delta", text: "x" },
		});
		state = updateStreamState(state, delta);
		const evs = parseStreamEvents(delta, state);
		expect(evs.some((e) => e.kind === "text" && e.text === "x")).toBe(true);
	});
});
