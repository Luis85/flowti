import { describe, it, expect, vi } from "vitest";
import {
	renderBriefGenerated, renderAgentSpawned,
	renderStreamEvent, renderSessionList, renderAgentComplete,
} from "../../../src/ui/displays/agent-run-display.js";
import type { ThinkingDisplay } from "../../../src/ui/displays/agent-run-display.js";
import type { AgentStreamEvent } from "../../../src/domain/agents/agent-stream.js";
import type { AgentSession } from "../../../src/domain/agents/agent-session.js";

function capture(): { log: (msg?: string) => void; lines: string[] } {
	const lines: string[] = [];
	return { log: (msg?: string) => lines.push(msg ?? ""), lines };
}

describe("renderBriefGenerated", () => {
	it("includes file path and agent name", () => {
		const { log, lines } = capture();
		renderBriefGenerated("/iter/briefs/dev-brief.md", "Dev", log);
		const output = lines.join("\n");
		expect(output).toContain("/iter/briefs/dev-brief.md");
		expect(output).toContain("Dev");
	});

	it("shows manual run command hint", () => {
		const { log, lines } = capture();
		renderBriefGenerated("/brief.md", "Agent", log);
		expect(lines.join("\n")).toContain("--print");
	});
});

describe("renderAgentSpawned", () => {
	it("includes agent name and session ID", () => {
		const { log, lines } = capture();
		renderAgentSpawned("Architect", "session-42", log);
		const output = lines.join("\n");
		expect(output).toContain("Architect");
		expect(output).toContain("session-42");
	});
});

describe("renderStreamEvent", () => {
	it("renders thinking event in full mode", () => {
		const { log, lines } = capture();
		const event: AgentStreamEvent = { kind: "thinking", text: "reasoning here" };
		renderStreamEvent(event, "full", log);
		expect(lines.join("\n")).toContain("reasoning here");
	});

	it("renders thinking event in indicator mode (shows indicator, not text)", () => {
		const { log, lines } = capture();
		const event: AgentStreamEvent = { kind: "thinking", text: "reasoning here" };
		renderStreamEvent(event, "indicator", log);
		const output = lines.join("\n");
		expect(output).toContain("thinking...");
		expect(output).not.toContain("reasoning here");
	});

	it("suppresses thinking event in hidden mode", () => {
		const { log, lines } = capture();
		const event: AgentStreamEvent = { kind: "thinking", text: "reasoning here" };
		renderStreamEvent(event, "hidden", log);
		expect(lines).toHaveLength(0);
	});

	it("renders text event", () => {
		const { log, lines } = capture();
		const event: AgentStreamEvent = { kind: "text", text: "hello world" };
		renderStreamEvent(event, "hidden", log);
		expect(lines.join("\n")).toContain("hello world");
	});

	it("renders tool-start event with tool name", () => {
		const { log, lines } = capture();
		const event: AgentStreamEvent = { kind: "tool-start", id: "t1", name: "Bash" };
		renderStreamEvent(event, "hidden", log);
		expect(lines.join("\n")).toContain("Bash");
	});

	it("renders tool-input event with short json inline", () => {
		const { log, lines } = capture();
		const event: AgentStreamEvent = { kind: "tool-input", index: 0, json: '{"cmd":"ls"}' };
		renderStreamEvent(event, "hidden", log);
		expect(lines.join("\n")).toContain('{"cmd":"ls"}');
	});

	it("truncates long tool-input json", () => {
		const { log, lines } = capture();
		const longJson = "x".repeat(100);
		const event: AgentStreamEvent = { kind: "tool-input", index: 0, json: longJson };
		renderStreamEvent(event, "hidden", log);
		expect(lines.join("\n")).toContain("...");
	});

	it("renders tool-end event", () => {
		const { log, lines } = capture();
		const event: AgentStreamEvent = { kind: "tool-end", id: "t1" };
		renderStreamEvent(event, "hidden", log);
		expect(lines.join("\n")).toContain("done");
	});

	it("renders error event with message", () => {
		const { log, lines } = capture();
		const event: AgentStreamEvent = { kind: "error", message: "something failed" };
		renderStreamEvent(event, "hidden", log);
		expect(lines.join("\n")).toContain("something failed");
	});

	it("renders usage event with token counts", () => {
		const { log, lines } = capture();
		const event: AgentStreamEvent = { kind: "usage", inputTokens: 100, outputTokens: 50 };
		renderStreamEvent(event, "hidden", log);
		const output = lines.join("\n");
		expect(output).toContain("100");
		expect(output).toContain("50");
	});

	it("renders done event", () => {
		const { log, lines } = capture();
		const event: AgentStreamEvent = { kind: "done" };
		renderStreamEvent(event, "hidden", log);
		expect(lines.join("\n")).toContain("Agent finished");
	});

	it("all event kinds produce distinct output", () => {
		const modes: ThinkingDisplay[] = ["full", "indicator", "hidden"];
		const thinkingMode: ThinkingDisplay = "full";
		const events: AgentStreamEvent[] = [
			{ kind: "thinking", text: "t" },
			{ kind: "text", text: "hello" },
			{ kind: "tool-start", id: "i1", name: "MyTool" },
			{ kind: "tool-input", index: 0, json: "{}" },
			{ kind: "tool-end", id: "i1" },
			{ kind: "error", message: "err" },
			{ kind: "usage", inputTokens: 10, outputTokens: 5 },
			{ kind: "done" },
		];
		expect(modes).toBeDefined(); // modes variable used to avoid lint warning
		const outputs = events.map((e) => {
			const { log, lines } = capture();
			renderStreamEvent(e, thinkingMode, log);
			return lines.join("\n");
		});
		// Each non-empty output should differ from others (or be empty for hidden thinking)
		const nonEmpty = outputs.filter((o) => o.length > 0);
		const unique = new Set(nonEmpty);
		expect(unique.size).toBe(nonEmpty.length);
	});
});

describe("renderAgentComplete", () => {
	it("shows agent name and status", () => {
		const session: AgentSession = {
			id: "s1", agentName: "Dev", iterationNumber: 5, status: "completed",
			startedAt: "2026-03-15", briefRef: "ref.md", outputLines: ["line1", "line2"],
		};
		const { log, lines } = capture();
		renderAgentComplete(session, log);
		const output = lines.join("\n");
		expect(output).toContain("Dev");
		expect(output).toContain("completed");
		expect(output).toContain("2 lines");
	});
});

describe("renderSessionList", () => {
	it("shows all sessions with status", () => {
		const sessions: AgentSession[] = [
			{ id: "s1", agentName: "Dev", iterationNumber: 5, status: "completed", startedAt: "2026-03-15", briefRef: "a.md", outputLines: [] },
			{ id: "s2", agentName: "QA", iterationNumber: 5, status: "running", startedAt: "2026-03-15", briefRef: "b.md", outputLines: [] },
		];
		const { log, lines } = capture();
		renderSessionList(sessions, log);
		const output = lines.join("\n");
		expect(output).toContain("Dev");
		expect(output).toContain("QA");
		expect(output).toContain("completed");
		expect(output).toContain("running");
	});

	it("shows empty message when no sessions", () => {
		const { log, lines } = capture();
		renderSessionList([], log);
		expect(lines.join("\n")).toContain("No agent sessions");
	});
});
