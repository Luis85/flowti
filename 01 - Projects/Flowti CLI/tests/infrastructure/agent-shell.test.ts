import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/shell.js", () => ({ shell: {} }));
vi.mock("../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));

import { resolveProvider, createAgentShell } from "../../src/infrastructure/agent-shell.js";
import type { ShellBaseDeps } from "../../src/infrastructure/agent-shell.js";
import type { AgentSummary } from "../../src/domain/agents/agent-types.js";
import type { BackgroundProcess } from "../../src/infrastructure/types.js";

// ── resolveProvider tests ───────────────────────────────────────────

describe("resolveProvider", () => {
	it("defaults to anthropic when no config", () => {
		const p = resolveProvider();
		expect(p.binary).toBe("claude");
		expect(p.streamArgs).toContain("stream-json");
	});

	it("uses agent override over global default", () => {
		const p = resolveProvider("anthropic", "cursor");
		expect(p.binary).toBe("cursor");
	});

	it("uses global default when no agent override", () => {
		const p = resolveProvider("cursor");
		expect(p.binary).toBe("cursor");
	});

	it("unknown provider uses provider string as binary", () => {
		const p = resolveProvider("ollama");
		expect(p.binary).toBe("ollama");
	});

	it("anthropic includes verbose and stream-json flags", () => {
		const p = resolveProvider("anthropic");
		expect(p.streamArgs).toContain("-p");
		expect(p.streamArgs).toContain("--output-format");
		expect(p.streamArgs).toContain("stream-json");
		expect(p.streamArgs).toContain("--verbose");
	});

	it("cursor includes print and json flags", () => {
		const p = resolveProvider("cursor");
		expect(p.streamArgs).toContain("--print");
		expect(p.streamArgs).toContain("--json");
	});

	it("all providers have textArgs with --print", () => {
		expect(resolveProvider("anthropic").textArgs).toContain("--print");
		expect(resolveProvider("cursor").textArgs).toContain("--print");
		expect(resolveProvider("custom").textArgs).toContain("--print");
	});
});

// ── createAgentShell tests ──────────────────────────────────────────

function createMockDeps(): ShellBaseDeps {
	const outputCallbacks: Array<(line: string) => void> = [];
	const exitResolvers: Array<(code: number) => void> = [];

	const mockProc: BackgroundProcess = {
		waitForOutput: vi.fn().mockResolvedValue(null),
		waitForExit: vi.fn(() => new Promise<number>((resolve) => { exitResolvers.push(resolve); })),
		onOutput: vi.fn((cb: (line: string) => void) => { outputCallbacks.push(cb); return () => {}; }),
		kill: vi.fn(),
		get running() { return true; },
		output: [],
	};

	return {
		disk: {
			readFileSync: vi.fn().mockReturnValue("{}"),
			writeFileSync: vi.fn(),
			existsSync: vi.fn().mockReturnValue(true),
			mkdirSync: vi.fn(),
			readdirSync: vi.fn().mockReturnValue([]),
			copyFileSync: vi.fn(),
			rmSync: vi.fn(),
			unlinkSync: vi.fn(),
			statSync: vi.fn(),
		} as never,
		paths: {
			join: vi.fn((...args: string[]) => args.join("/")),
			resolve: vi.fn((...args: string[]) => args.join("/")),
			dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/")),
			basename: vi.fn((p: string) => p.split("/").pop() ?? ""),
			relative: vi.fn((_from: string, to: string) => to),
			extname: vi.fn((p: string) => { const m = p.match(/\.[^.]+$/); return m ? m[0] : ""; }),
			isAbsolute: vi.fn(() => true),
			sep: "/",
		} as never,
		clock: {
			now: vi.fn(() => new Date()),
			ms: vi.fn(() => 1234567890),
			iso: vi.fn(() => "2026-03-15T12:00:00Z"),
			safeIso: vi.fn(() => "2026-03-15T12-00-00Z"),
		} as never,
		shell: {
			spawnBackground: vi.fn(() => mockProc),
			check: vi.fn().mockReturnValue(true),
		} as never,
		log: vi.fn(),
	};
}

function createMockAgent(overrides?: Partial<AgentSummary>): AgentSummary {
	return {
		name: "bobby",
		agentType: "ai",
		description: "Test agent",
		skills: [],
		tools: [],
		roles: [],
		file: "docs/agents/bobby.md",
		...overrides,
	};
}

describe("createAgentShell", () => {
	let deps: ShellBaseDeps;

	beforeEach(() => {
		deps = createMockDeps();
	});

	describe("getActiveDispatch", () => {
		it("returns null for idle agent", () => {
			const shell = createAgentShell(deps, undefined, "/vault");
			expect(shell.getActiveDispatch("bobby")).toBeNull();
		});
	});

	describe("talk", () => {
		it("returns a TalkSession with onEvent, result, and detach", () => {
			const shell = createAgentShell(deps, undefined, "/vault");
			const agent = createMockAgent();
			const session = shell.talk(agent, "hello");
			expect(session).toHaveProperty("onEvent");
			expect(session).toHaveProperty("result");
			expect(session).toHaveProperty("detach");
		});

		it("writes prompt to temp file", () => {
			const shell = createAgentShell(deps, undefined, "/vault");
			const agent = createMockAgent();
			shell.talk(agent, "test prompt");
			expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining(".flowti-talk-"),
				"test prompt",
				"utf-8",
			);
		});

		it("spawns correct binary", () => {
			const shell = createAgentShell(deps, undefined, "/vault");
			const agent = createMockAgent();
			shell.talk(agent, "hello");
			expect(deps.shell.spawnBackground).toHaveBeenCalledWith(
				expect.stringContaining("claude"),
			);
		});

		it("uses provider override from agent config", () => {
			const shell = createAgentShell(deps, undefined, "/vault");
			const agent = createMockAgent({ ai: { provider: "cursor" } });
			shell.talk(agent, "hello");
			expect(deps.shell.spawnBackground).toHaveBeenCalledWith(
				expect.stringContaining("cursor"),
			);
		});

		it("uses global provider from config", () => {
			const shell = createAgentShell(deps, { provider: "cursor" }, "/vault");
			const agent = createMockAgent();
			shell.talk(agent, "hello");
			expect(deps.shell.spawnBackground).toHaveBeenCalledWith(
				expect.stringContaining("cursor"),
			);
		});
	});

	describe("dispatch", () => {
		it("returns a DispatchHandle with correct properties", () => {
			const shell = createAgentShell(deps, undefined, "/vault");
			const agent = createMockAgent();
			const handle = shell.dispatch(agent, "/path/to/brief.md", "do the thing");
			expect(handle.sessionId).toContain("dispatch-");
			expect(handle.agentName).toBe("bobby");
			expect(handle.task).toBe("do the thing");
			expect(handle.running).toBe(true);
			expect(handle).toHaveProperty("onEvent");
			expect(handle).toHaveProperty("stop");
		});

		it("registers in activeDispatches synchronously", () => {
			const shell = createAgentShell(deps, undefined, "/vault");
			const agent = createMockAgent();
			shell.dispatch(agent, "/path/to/brief.md", "task");
			expect(shell.getActiveDispatch("bobby")).not.toBeNull();
			expect(shell.getActiveDispatch("bobby")!.task).toBe("task");
		});

		it("spawns correct binary with brief path", () => {
			const shell = createAgentShell(deps, undefined, "/vault");
			const agent = createMockAgent();
			shell.dispatch(agent, "/brief.md", "task");
			expect(deps.shell.spawnBackground).toHaveBeenCalledWith(
				expect.stringMatching(/claude.*< \/brief\.md/),
			);
		});

		it("multiple dispatches for different agents", () => {
			const shell = createAgentShell(deps, undefined, "/vault");
			shell.dispatch(createMockAgent({ name: "alice" }), "/b1.md", "task1");
			shell.dispatch(createMockAgent({ name: "bob" }), "/b2.md", "task2");
			expect(shell.getActiveDispatch("alice")!.task).toBe("task1");
			expect(shell.getActiveDispatch("bob")!.task).toBe("task2");
		});
	});
});
