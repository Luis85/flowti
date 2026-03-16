import { describe, it, expect } from "vitest";
import { parseSSEMessage, parseAgentAction } from "../../src/data/event-stream.js";

describe("parseSSEMessage", () => {
	it("extracts event type and data from SSE message", () => {
		const raw = "event: agent-action\ndata: {\"id\":\"1\"}";
		const result = parseSSEMessage(raw);
		expect(result).toEqual({ event: "agent-action", data: "{\"id\":\"1\"}" });
	});

	it("handles message with only data line", () => {
		const raw = "data: {\"id\":\"1\"}";
		const result = parseSSEMessage(raw);
		expect(result).toEqual({ event: "message", data: "{\"id\":\"1\"}" });
	});

	it("returns null for empty string", () => {
		expect(parseSSEMessage("")).toBeNull();
	});

	it("returns null for comment-only lines", () => {
		expect(parseSSEMessage(": this is a comment")).toBeNull();
	});

	it("handles multiple data lines by concatenating", () => {
		const raw = "event: update\ndata: line1\ndata: line2";
		const result = parseSSEMessage(raw);
		expect(result).toEqual({ event: "update", data: "line1\nline2" });
	});
});

describe("parseAgentAction", () => {
	it("parses valid JSON into AgentAction", () => {
		const json = JSON.stringify({
			id: "1",
			agentName: "Bob",
			timestamp: "2026-01-01T00:00:00Z",
			type: "thinking",
			data: { thought: "hmm" },
		});
		const result = parseAgentAction(json);
		expect(result).not.toBeNull();
		expect(result?.agentName).toBe("Bob");
		expect(result?.type).toBe("thinking");
	});

	it("returns null for invalid JSON", () => {
		expect(parseAgentAction("not json")).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(parseAgentAction("")).toBeNull();
	});
});
