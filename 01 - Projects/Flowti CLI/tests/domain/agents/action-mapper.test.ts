import { describe, it, expect } from "vitest";
import { mapStreamEventToAction } from "../../../src/domain/agents/action-mapper.js";
import type { AgentStreamEvent } from "../../../src/domain/agents/agent-stream.js";

const ts = "2026-03-15T12:00:00Z";
const clock = { now: () => new Date(), ms: () => 1234, iso: () => ts, safeIso: () => ts };

describe("mapStreamEventToAction", () => {
	it("maps thinking event", () => {
		const event: AgentStreamEvent = { kind: "thinking", text: "Let me consider..." };
		const action = mapStreamEventToAction("Bob", event, clock);
		expect(action).not.toBeNull();
		expect(action!.type).toBe("thinking");
		expect(action!.agentName).toBe("Bob");
	});

	it("maps text event to speaking", () => {
		const event: AgentStreamEvent = { kind: "text", text: "Hello!" };
		const action = mapStreamEventToAction("Bob", event, clock);
		expect(action!.type).toBe("speaking");
		expect(action!.data.text).toBe("Hello!");
	});

	it("maps tool-start to using-tool", () => {
		const event: AgentStreamEvent = { kind: "tool-start", id: "t1", name: "Edit" };
		const action = mapStreamEventToAction("Bob", event, clock);
		expect(action!.type).toBe("using-tool");
		expect(action!.data.tool).toBe("Edit");
	});

	it("maps tool-end to tool-complete", () => {
		const event: AgentStreamEvent = { kind: "tool-end", id: "t1" };
		const action = mapStreamEventToAction("Bob", event, clock);
		expect(action!.type).toBe("tool-complete");
	});

	it("maps error event", () => {
		const event: AgentStreamEvent = { kind: "error", message: "Something broke" };
		const action = mapStreamEventToAction("Bob", event, clock);
		expect(action!.type).toBe("error");
		expect(action!.data.message).toBe("Something broke");
	});

	it("returns null for done event", () => {
		const event: AgentStreamEvent = { kind: "done" };
		expect(mapStreamEventToAction("Bob", event, clock)).toBeNull();
	});

	it("returns null for usage event", () => {
		const event: AgentStreamEvent = { kind: "usage", inputTokens: 100, outputTokens: 50 };
		expect(mapStreamEventToAction("Bob", event, clock)).toBeNull();
	});

	it("includes unique id and timestamp", () => {
		const event: AgentStreamEvent = { kind: "text", text: "Hi" };
		const a1 = mapStreamEventToAction("Bob", event, clock);
		const a2 = mapStreamEventToAction("Bob", event, clock);
		expect(a1!.id).not.toBe(a2!.id);
		expect(a1!.timestamp).toBe(ts);
	});
});
