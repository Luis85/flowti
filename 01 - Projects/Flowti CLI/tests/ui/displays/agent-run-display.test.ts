import { describe, it, expect, vi } from "vitest";
import {
	renderBriefGenerated, renderAgentSpawned,
	renderAgentOutput, renderSessionList, renderAgentComplete,
} from "../../../src/ui/displays/agent-run-display.js";
import type { AgentOutputEvent } from "../../../src/domain/agents/agent-runner.js";
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

	it("shows manual run command", () => {
		const { log, lines } = capture();
		renderBriefGenerated("/brief.md", "Agent", log);
		expect(lines.join("\n")).toContain("claude --print --prompt-file");
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

describe("renderAgentOutput", () => {
	it("formats progress events", () => {
		const { log, lines } = capture();
		renderAgentOutput({ kind: "progress", message: "step 1" }, log);
		expect(lines.join("\n")).toContain("step 1");
	});

	it("formats result events", () => {
		const { log, lines } = capture();
		renderAgentOutput({ kind: "result", content: "done" }, log);
		expect(lines.join("\n")).toContain("done");
	});

	it("formats error events", () => {
		const { log, lines } = capture();
		renderAgentOutput({ kind: "error", message: "failed" }, log);
		expect(lines.join("\n")).toContain("failed");
	});

	it("formats raw events", () => {
		const { log, lines } = capture();
		renderAgentOutput({ kind: "raw", line: "plain text" }, log);
		expect(lines.join("\n")).toContain("plain text");
	});

	it("formats each event kind differently", () => {
		const events: AgentOutputEvent[] = [
			{ kind: "progress", message: "step" },
			{ kind: "result", content: "ok" },
			{ kind: "error", message: "err" },
			{ kind: "raw", line: "txt" },
		];
		const outputs = events.map((e) => {
			const { log, lines } = capture();
			renderAgentOutput(e, log);
			return lines.join("\n");
		});
		const unique = new Set(outputs);
		expect(unique.size).toBe(4);
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
