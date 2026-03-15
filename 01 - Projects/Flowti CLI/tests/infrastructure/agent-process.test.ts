import { describe, it, expect, vi } from "vitest";
import { checkClaudeInstalled, writeBriefToFile, launchAgent } from "../../src/infrastructure/agent-process.js";
import type { AgentProcessDeps } from "../../src/infrastructure/agent-process.js";
import type { AgentStreamEvent } from "../../src/domain/agents/agent-stream.js";
import type { AgentRunSpec } from "../../src/domain/agents/agent-runner.js";
import type { BackgroundProcess } from "../../src/infrastructure/types.js";

function makeMockProcess(): BackgroundProcess {
	const listeners = new Set<(line: string) => void>();
	return {
		waitForOutput: vi.fn(() => Promise.resolve("done")),
		onOutput: vi.fn((cb: (line: string) => void) => {
			listeners.add(cb);
			return () => listeners.delete(cb);
		}),
		kill: vi.fn(),
		running: true,
		output: [],
	};
}

function makeDeps(mockProcess?: BackgroundProcess): AgentProcessDeps {
	const files: Record<string, string> = {};
	return {
		disk: {
			writeFileSync: vi.fn((p: string, c: string) => { files[p] = c; }),
			existsSync: vi.fn((p: string) => files[p] !== undefined),
			readFileSync: vi.fn((p: string) => files[p] ?? ""),
		} as unknown as AgentProcessDeps["disk"],
		shell: {
			check: vi.fn(() => true),
			spawnBackground: vi.fn(() => mockProcess ?? makeMockProcess()),
		} as unknown as AgentProcessDeps["shell"],
		paths: {
			join: (...parts: string[]) => parts.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		} as unknown as AgentProcessDeps["paths"],
		clock: {
			iso: vi.fn(() => "2026-03-15T10:00:00.000Z"),
		} as unknown as AgentProcessDeps["clock"],
		log: vi.fn(),
	};
}

function makeSpec(): AgentRunSpec {
	return {
		command: "claude",
		args: ["--print"],
		env: {},
		workingDir: "/project",
		briefPath: "/brief.md",
	};
}

describe("checkClaudeInstalled", () => {
	it("returns true when shell.check succeeds", () => {
		const deps = makeDeps();
		expect(checkClaudeInstalled(deps)).toBe(true);
	});

	it("returns false when shell.check fails", () => {
		const deps = makeDeps();
		(deps.shell.check as ReturnType<typeof vi.fn>).mockReturnValue(false);
		expect(checkClaudeInstalled(deps)).toBe(false);
	});
});

describe("writeBriefToFile", () => {
	it("writes content and returns path", () => {
		const deps = makeDeps();
		const path = writeBriefToFile(deps, "/iter/briefs", "# Brief content", "Software Architect");
		expect(path).toBe("/iter/briefs/software-architect-brief.md");
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(path, "# Brief content", "utf-8");
	});
});

describe("launchAgent", () => {
	it("calls shell.spawnBackground with correct command from spec", () => {
		const deps = makeDeps();
		const spec = makeSpec();
		launchAgent(deps, spec, "session-1");
		expect(deps.shell.spawnBackground).toHaveBeenCalledWith(
			'claude --print < /brief.md',
			{ cwd: "/project", env: undefined },
		);
	});

	it("returns handle with sessionId", () => {
		const deps = makeDeps();
		const handle = launchAgent(deps, makeSpec(), "session-42");
		expect(handle.sessionId).toBe("session-42");
	});

	it("subscribe receives parsed events from NDJSON output", () => {
		const mockProc = makeMockProcess();
		const deps = makeDeps(mockProc);
		const handle = launchAgent(deps, makeSpec(), "s1");
		const events: AgentStreamEvent[] = [];
		handle.subscribe((e) => events.push(e));
		// Simulate the onOutput callback with a valid NDJSON error line
		const cb = (mockProc.onOutput as ReturnType<typeof vi.fn>).mock.calls[0][0];
		cb(JSON.stringify({ type: "error", error: { message: "something broke" } }));
		expect(events).toHaveLength(1);
		expect(events[0].kind).toBe("error");
		expect((events[0] as { kind: "error"; message: string }).message).toBe("something broke");
	});

	it("subscribe receives text events from NDJSON output", () => {
		const mockProc = makeMockProcess();
		const deps = makeDeps(mockProc);
		const handle = launchAgent(deps, makeSpec(), "s1");
		const events: AgentStreamEvent[] = [];
		handle.subscribe((e) => events.push(e));
		const cb = (mockProc.onOutput as ReturnType<typeof vi.fn>).mock.calls[0][0];
		// First start a text block so the delta has context
		cb(JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text" } }));
		cb(JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "hello" } }));
		expect(events.some((e) => e.kind === "text")).toBe(true);
		const textEvent = events.find((e) => e.kind === "text") as { kind: "text"; text: string } | undefined;
		expect(textEvent?.text).toBe("hello");
	});

	it("non-JSON output lines are silently ignored", () => {
		const mockProc = makeMockProcess();
		const deps = makeDeps(mockProc);
		const handle = launchAgent(deps, makeSpec(), "s1");
		const events: AgentStreamEvent[] = [];
		handle.subscribe((e) => events.push(e));
		const cb = (mockProc.onOutput as ReturnType<typeof vi.fn>).mock.calls[0][0];
		cb("not json at all");
		expect(events).toHaveLength(0);
	});

	it("unsubscribe stops receiving events", () => {
		const mockProc = makeMockProcess();
		const deps = makeDeps(mockProc);
		const handle = launchAgent(deps, makeSpec(), "s1");
		const events: AgentStreamEvent[] = [];
		const unsub = handle.subscribe((e) => events.push(e));
		unsub();
		const cb = (mockProc.onOutput as ReturnType<typeof vi.fn>).mock.calls[0][0];
		cb(JSON.stringify({ type: "message_stop" }));
		expect(events).toHaveLength(0);
	});

	it("stop calls process.kill", () => {
		const mockProc = makeMockProcess();
		const deps = makeDeps(mockProc);
		const handle = launchAgent(deps, makeSpec(), "s1");
		handle.stop();
		expect(mockProc.kill).toHaveBeenCalled();
	});
});
