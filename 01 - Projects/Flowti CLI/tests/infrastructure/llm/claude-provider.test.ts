import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../src/infrastructure/shell.js", () => ({ shell: {} }));
vi.mock("../../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { createClaudeProvider, type ClaudeProviderDeps } from "../../../src/infrastructure/llm/claude-provider.js";
import type { LLMRequest, LLMSessionRequest } from "../../../src/domain/agents/llm-types.js";

type MockDeps = ReturnType<typeof makeDeps>;
function asDeps(deps: MockDeps): ClaudeProviderDeps {
	return deps as unknown as ClaudeProviderDeps;
}

function makeDeps() {
	const outputCallbacks: Array<(line: string) => void> = [];
	const mockProc = {
		waitForExit: vi.fn(() => Promise.resolve(0)),
		onOutput: vi.fn((cb: (line: string) => void) => { outputCallbacks.push(cb); return () => {}; }),
		kill: vi.fn(),
		writeStdin: vi.fn(),
		running: true,
		output: [],
		waitForOutput: vi.fn(),
	};
	return {
		disk: { writeFileSync: vi.fn(), unlinkSync: vi.fn() },
		paths: { join: vi.fn((...a: string[]) => a.join("/")), resolve: vi.fn((...a: string[]) => a.join("/")) },
		clock: { ms: vi.fn(() => 1234) },
		shell: { spawnBackground: vi.fn(() => mockProc) },
		log: vi.fn(),
		_mockProc: mockProc,
		_outputCallbacks: outputCallbacks,
	};
}

describe("createClaudeProvider", () => {
	it("has name 'anthropic'", () => {
		const provider = createClaudeProvider(asDeps(makeDeps()));
		expect(provider.name).toBe("anthropic");
	});

	it("reports full capabilities", () => {
		const provider = createClaudeProvider(asDeps(makeDeps()));
		const caps = provider.capabilities();
		expect(caps.streaming).toBe(true);
		expect(caps.thinking).toBe(true);
		expect(caps.toolUse).toBe(true);
		expect(caps.structuredOutput).toBe(true);
	});

	it("execute spawns claude with stream-json flags", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(asDeps(deps));
		const request: LLMRequest = { prompt: { message: "hello" } };
		provider.execute(request);
		expect(deps.shell.spawnBackground).toHaveBeenCalledWith(
			expect.stringContaining("claude"),
			undefined,
		);
		const cmd = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
		expect(cmd).toContain("--output-format");
		expect(cmd).toContain("stream-json");
	});

	it("execute writes prompt to temp file", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(asDeps(deps));
		provider.execute({ prompt: { message: "hello world" } });
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.stringContaining(".flowti-prompt-"),
			expect.any(String),
			"utf-8",
		);
	});

	it("execute includes --allowedTools when tools provided", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(asDeps(deps));
		provider.execute({ prompt: { message: "hello" }, tools: ["Bash", "Read"] });
		const cmd = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
		expect(cmd).toContain("--allowedTools");
		expect(cmd).toContain("Bash,Read");
	});

	it("execute passes cwd when provided", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(asDeps(deps));
		provider.execute({ prompt: { message: "hello" }, cwd: "/work" });
		expect(deps.shell.spawnBackground).toHaveBeenCalledWith(expect.any(String), { cwd: "/work" });
	});

	it("result accumulates text events", async () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(asDeps(deps));
		const proc = provider.execute({ prompt: { message: "hello" } });
		for (const cb of deps._outputCallbacks) {
			cb(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Hi!" }] } }));
		}
		const result = await proc.result;
		expect(result.text).toBe("Hi!");
		expect(result.exitCode).toBe(0);
	});

	it("emits events to subscribers", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(asDeps(deps));
		const proc = provider.execute({ prompt: { message: "hello" } });
		const events: unknown[] = [];
		proc.onEvent((e) => events.push(e));
		for (const cb of deps._outputCallbacks) {
			cb(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Hi!" }] } }));
		}
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({ kind: "text", text: "Hi!" });
	});

	it("uses pre-formatted prompt when envelope is message-only", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(asDeps(deps));
		provider.execute({ prompt: { message: "pre-built prompt string" } });
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.any(String),
			"pre-built prompt string",
			"utf-8",
		);
	});

	it("uses formatPrompt when envelope has identity", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(asDeps(deps));
		provider.execute({ prompt: { message: "hello", identity: { name: "Bot" } } });
		const written = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(written).toContain("You are **Bot**");
	});

	describe("createSession", () => {
		it("reports persistentSession capability", () => {
			const provider = createClaudeProvider(asDeps(makeDeps()));
			expect(provider.capabilities().persistentSession).toBe(true);
		});

		it("first send spawns claude -p with stream-json and dangerously-skip-permissions", () => {
			const deps = makeDeps();
			const provider = createClaudeProvider(asDeps(deps));
			const session = provider.createSession!({ cwd: "/work" });
			const proc = session.send("hello");
			expect(proc).toHaveProperty("result");
			expect(proc).toHaveProperty("onEvent");
			expect(deps.shell.spawnBackground).toHaveBeenCalled();
			const cmd = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
			expect(cmd).toContain("-p");
			expect(cmd).toContain("--output-format");
			expect(cmd).toContain("stream-json");
			expect(cmd).toContain("--dangerously-skip-permissions");
			expect(cmd).not.toContain("--resume");
		});

		it("second send includes --resume with captured session_id", async () => {
			const deps = makeDeps();
			const provider = createClaudeProvider(asDeps(deps));
			const session = provider.createSession!({});

			// First send — emit system event with session_id
			session.send("hello");
			for (const cb of deps._outputCallbacks) {
				cb(JSON.stringify({ type: "system", subtype: "init", session_id: "sess-abc" }));
				cb(JSON.stringify({ type: "result", subtype: "success" }));
			}
			// Wait for first result to resolve
			await new Promise((r) => setTimeout(r, 10));

			// Second send should include --resume
			session.send("follow up");
			const cmd = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
			expect(cmd).toContain("--resume");
			expect(cmd).toContain("sess-abc");
		});

		it("send resolves on process exit with accumulated text", async () => {
			const deps = makeDeps();
			const provider = createClaudeProvider(asDeps(deps));
			const session = provider.createSession!({});
			const proc = session.send("hello");

			for (const cb of deps._outputCallbacks) {
				cb(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Hi!" }] } }));
			}

			const result = await proc.result;
			expect(result.text).toBe("Hi!");
			expect(result.exitCode).toBe(0);
		});

		it("kill sets alive to false", () => {
			const deps = makeDeps();
			const provider = createClaudeProvider(asDeps(deps));
			const session = provider.createSession!({});
			expect(session.alive).toBe(true);
			session.kill();
			expect(session.alive).toBe(false);
		});
	});
});
