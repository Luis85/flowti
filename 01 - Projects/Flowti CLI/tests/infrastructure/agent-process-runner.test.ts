import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/shell.js", () => ({ shell: {} }));
vi.mock("../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { createProcessRunner, type ProcessRunnerDeps } from "../../src/infrastructure/agent-process-runner.js";
import type { AgentSummary } from "../../src/domain/agents/agent-types.js";

function makeDeps() {
	const outputCallbacks: Array<(line: string) => void> = [];
	const mockProc = {
		waitForExit: vi.fn(() => new Promise<number>((resolve) => { setTimeout(() => resolve(0), 10); })),
		onOutput: vi.fn((cb: (line: string) => void) => { outputCallbacks.push(cb); return () => {}; }),
		kill: vi.fn(),
		running: true,
		output: [],
		waitForOutput: vi.fn(),
	};
	return {
		disk: { writeFileSync: vi.fn(), unlinkSync: vi.fn(), existsSync: vi.fn(() => true), mkdirSync: vi.fn() },
		paths: { join: vi.fn((...a: string[]) => a.join("/")), resolve: vi.fn((...a: string[]) => a.join("/")) },
		clock: { ms: vi.fn(() => 1234), iso: vi.fn(() => "2026-03-15T12:00:00Z") },
		shell: { spawnBackground: vi.fn(() => mockProc) },
		log: vi.fn(),
		_mockProc: mockProc,
		_outputCallbacks: outputCallbacks,
	};
}

function asDeps(deps: ReturnType<typeof makeDeps>): ProcessRunnerDeps {
	return deps as unknown as ProcessRunnerDeps;
}

function makeAgent(overrides?: Partial<AgentSummary>): AgentSummary {
	return { name: "Bob", agentType: "ai", description: "", skills: [], tools: [], roles: [], file: "bob.md", ...overrides };
}

describe("createProcessRunner", () => {
	it("spawn creates a process and returns AgentProcess", () => {
		const deps = makeDeps();
		const runner = createProcessRunner(asDeps(deps), undefined);
		const proc = runner.spawn(makeAgent(), "Hello");
		expect(proc).toHaveProperty("onEvent");
		expect(proc).toHaveProperty("result");
		expect(proc).toHaveProperty("kill");
	});

	it("writes prompt to temp file", () => {
		const deps = makeDeps();
		const runner = createProcessRunner(asDeps(deps), undefined);
		runner.spawn(makeAgent(), "Hello world");
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.stringContaining(".flowti-prompt-"),
			"Hello world",
			"utf-8",
		);
	});

	it("spawns claude binary by default", () => {
		const deps = makeDeps();
		const runner = createProcessRunner(asDeps(deps), undefined);
		runner.spawn(makeAgent(), "Hello");
		expect(deps.shell.spawnBackground).toHaveBeenCalledWith(
			expect.stringContaining("claude"),
			undefined,
		);
	});

	it("result resolves with text and exit code", async () => {
		const deps = makeDeps();
		const runner = createProcessRunner(asDeps(deps), undefined);
		const proc = runner.spawn(makeAgent(), "Hello");
		// Simulate text output via CLI format
		for (const cb of deps._outputCallbacks) {
			cb(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Hi there!" }] } }));
		}
		const result = await proc.result;
		expect(result.exitCode).toBe(0);
		expect(result.text).toBe("Hi there!");
	});

	it("collects thinking text from stream events", async () => {
		const deps = makeDeps();
		const runner = createProcessRunner(asDeps(deps), undefined);
		const proc = runner.spawn(makeAgent(), "Hello");
		for (const cb of deps._outputCallbacks) {
			cb(JSON.stringify({ type: "assistant", message: { content: [{ type: "thinking", thinking: "Let me think..." }] } }));
			cb(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Done." }] } }));
		}
		const result = await proc.result;
		expect(result.thinking).toBe("Let me think...");
		expect(result.text).toBe("Done.");
	});

	it("kill stops the process", () => {
		const deps = makeDeps();
		const runner = createProcessRunner(asDeps(deps), undefined);
		const proc = runner.spawn(makeAgent(), "Hello");
		proc.kill();
		expect(deps._mockProc.kill).toHaveBeenCalled();
	});

	it("cleans up temp file after kill", () => {
		const deps = makeDeps();
		const runner = createProcessRunner(asDeps(deps), undefined);
		const proc = runner.spawn(makeAgent(), "Hello");
		proc.kill();
		expect(deps.disk.unlinkSync).toHaveBeenCalledWith(
			expect.stringContaining(".flowti-prompt-"),
		);
	});

	it("cleans up temp file after result resolves", async () => {
		const deps = makeDeps();
		const runner = createProcessRunner(asDeps(deps), undefined);
		const proc = runner.spawn(makeAgent(), "Hello");
		await proc.result;
		expect(deps.disk.unlinkSync).toHaveBeenCalledWith(
			expect.stringContaining(".flowti-prompt-"),
		);
	});

	it("onEvent notifies subscribers of stream events", () => {
		const deps = makeDeps();
		const runner = createProcessRunner(asDeps(deps), undefined);
		const proc = runner.spawn(makeAgent(), "Hello");
		const events: unknown[] = [];
		proc.onEvent((e) => events.push(e));
		for (const cb of deps._outputCallbacks) {
			cb(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Hi" }] } }));
		}
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({ kind: "text", text: "Hi" });
	});

	it("unsubscribe stops notifications", () => {
		const deps = makeDeps();
		const runner = createProcessRunner(asDeps(deps), undefined);
		const proc = runner.spawn(makeAgent(), "Hello");
		const events: unknown[] = [];
		const unsub = proc.onEvent((e) => events.push(e));
		unsub();
		for (const cb of deps._outputCallbacks) {
			cb(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Hi" }] } }));
		}
		expect(events).toHaveLength(0);
	});

	it("includes allowedTools in spawn command", () => {
		const deps = makeDeps();
		const runner = createProcessRunner(asDeps(deps), undefined);
		const agent = makeAgent({ ai: { allowedTools: ["Read", "Write"] } });
		runner.spawn(agent, "Hello");
		const cmd = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
		expect(cmd).toContain("--allowedTools");
		expect(cmd).toContain("Read,Write");
	});

	it("uses configured provider binary", () => {
		const deps = makeDeps();
		const runner = createProcessRunner(asDeps(deps), { provider: "cursor" });
		runner.spawn(makeAgent(), "Hello");
		const cmd = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
		expect(cmd).toContain("agent");
	});

	it("agent-level provider overrides global provider", () => {
		const deps = makeDeps();
		const runner = createProcessRunner(asDeps(deps), { provider: "anthropic" });
		const agent = makeAgent({ ai: { provider: "cursor" } });
		runner.spawn(agent, "Hello");
		const cmd = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
		expect(cmd).toContain("agent");
	});

	it("returns exitCode 1 when process rejects", async () => {
		const deps = makeDeps();
		deps._mockProc.waitForExit.mockReturnValue(Promise.reject(new Error("timeout")));
		const runner = createProcessRunner(asDeps(deps), undefined);
		const proc = runner.spawn(makeAgent(), "Hello");
		const result = await proc.result;
		expect(result.exitCode).toBe(1);
		expect(result.text).toBe("");
	});

	it("generates unique temp file names per spawn", () => {
		const deps = makeDeps();
		let counter = 0;
		(deps.clock.ms as ReturnType<typeof vi.fn>).mockImplementation(() => ++counter);
		const runner = createProcessRunner(asDeps(deps), undefined);
		runner.spawn(makeAgent(), "Hello");
		runner.spawn(makeAgent(), "World");
		const calls = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
		expect(calls[0][0]).not.toBe(calls[1][0]);
	});

	it("ignores invalid JSON lines without crashing", () => {
		const deps = makeDeps();
		const runner = createProcessRunner(asDeps(deps), undefined);
		const proc = runner.spawn(makeAgent(), "Hello");
		const events: unknown[] = [];
		proc.onEvent((e) => events.push(e));
		for (const cb of deps._outputCallbacks) {
			cb("not valid json");
			cb("");
		}
		expect(events).toHaveLength(0);
	});

	it("delegates to registry when provided", () => {
		const deps = makeDeps();
		const mockExecute = vi.fn(() => ({
			onEvent: () => () => {},
			result: Promise.resolve({ text: "from registry", thinking: "", exitCode: 0 }),
			kill: vi.fn(),
		}));
		const mockProvider = {
			name: "anthropic",
			capabilities: () => ({ streaming: true, thinking: true, toolUse: true, structuredOutput: true }),
			execute: mockExecute,
		};
		const mockRegistry = {
			register: vi.fn(),
			get: vi.fn(),
			list: vi.fn(() => []),
			select: vi.fn(() => ({ provider: mockProvider, reason: "configured" as const })),
		};
		const runner = createProcessRunner(asDeps(deps), undefined, mockRegistry);
		runner.spawn(makeAgent(), "Hello");
		expect(mockRegistry.select).toHaveBeenCalledWith(
			expect.objectContaining({ taskType: "conversation", required: { streaming: true } }),
		);
		expect(mockExecute).toHaveBeenCalledWith(
			expect.objectContaining({ prompt: { message: "Hello" } }),
		);
		expect(deps.shell.spawnBackground).not.toHaveBeenCalled();
	});

	// ── acquireSession ──────────────────────────────────────────────

	it("acquireSession returns null when no registry", () => {
		const runner = createProcessRunner(makeDeps(), undefined);
		const result = runner.acquireSession!(makeAgent());
		expect(result).toBeNull();
	});

	it("acquireSession returns session when provider supports persistentSession", () => {
		const mockSession = { send: vi.fn(), kill: vi.fn(), alive: true };
		const mockProvider = {
			name: "test",
			capabilities: () => ({ streaming: true, thinking: false, toolUse: false, structuredOutput: false, persistentSession: true }),
			execute: vi.fn(),
			createSession: vi.fn(() => mockSession),
		};
		const registry = { register: vi.fn(), get: vi.fn(), list: vi.fn(), select: vi.fn(() => ({ provider: mockProvider, reason: "configured" as const })) };
		const runner = createProcessRunner(makeDeps(), undefined, registry);
		const result = runner.acquireSession!(makeAgent());
		expect(result).toBe(mockSession);
		expect(mockProvider.createSession).toHaveBeenCalled();
	});

	it("acquireSession returns null when provider lacks persistentSession", () => {
		const mockProvider = {
			name: "test",
			capabilities: () => ({ streaming: true, thinking: false, toolUse: false, structuredOutput: false, persistentSession: false }),
			execute: vi.fn(),
		};
		const registry = { register: vi.fn(), get: vi.fn(), list: vi.fn(), select: vi.fn(() => ({ provider: mockProvider, reason: "configured" as const })) };
		const runner = createProcessRunner(makeDeps(), undefined, registry);
		const result = runner.acquireSession!(makeAgent());
		expect(result).toBeNull();
	});

	it("acquireSession returns null when provider has no createSession method", () => {
		const mockProvider = {
			name: "test",
			capabilities: () => ({ streaming: true, thinking: false, toolUse: false, structuredOutput: false, persistentSession: true }),
			execute: vi.fn(),
		};
		const registry = { register: vi.fn(), get: vi.fn(), list: vi.fn(), select: vi.fn(() => ({ provider: mockProvider, reason: "configured" as const })) };
		const runner = createProcessRunner(makeDeps(), undefined, registry);
		const result = runner.acquireSession!(makeAgent());
		expect(result).toBeNull();
	});
});
