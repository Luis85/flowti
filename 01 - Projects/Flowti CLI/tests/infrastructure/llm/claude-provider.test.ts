import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../src/infrastructure/shell.js", () => ({ shell: {} }));
vi.mock("../../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { createClaudeProvider } from "../../../src/infrastructure/llm/claude-provider.js";
import type { LLMRequest, LLMSessionRequest } from "../../../src/domain/agents/llm-types.js";

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
		disk: { writeFileSync: vi.fn(), unlinkSync: vi.fn() } as never,
		paths: { join: vi.fn((...a: string[]) => a.join("/")), resolve: vi.fn((...a: string[]) => a.join("/")) } as never,
		clock: { ms: vi.fn(() => 1234) } as never,
		shell: { spawnBackground: vi.fn(() => mockProc) } as never,
		log: vi.fn(),
		_mockProc: mockProc,
		_outputCallbacks: outputCallbacks,
	};
}

describe("createClaudeProvider", () => {
	it("has name 'anthropic'", () => {
		const provider = createClaudeProvider(makeDeps());
		expect(provider.name).toBe("anthropic");
	});

	it("reports full capabilities", () => {
		const provider = createClaudeProvider(makeDeps());
		const caps = provider.capabilities();
		expect(caps.streaming).toBe(true);
		expect(caps.thinking).toBe(true);
		expect(caps.toolUse).toBe(true);
		expect(caps.structuredOutput).toBe(true);
	});

	it("execute spawns claude with stream-json flags", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
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
		const provider = createClaudeProvider(deps);
		provider.execute({ prompt: { message: "hello world" } });
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.stringContaining(".flowti-prompt-"),
			expect.any(String),
			"utf-8",
		);
	});

	it("execute includes --allowedTools when tools provided", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
		provider.execute({ prompt: { message: "hello" }, tools: ["Bash", "Read"] });
		const cmd = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
		expect(cmd).toContain("--allowedTools");
		expect(cmd).toContain("Bash,Read");
	});

	it("execute passes cwd when provided", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
		provider.execute({ prompt: { message: "hello" }, cwd: "/work" });
		expect(deps.shell.spawnBackground).toHaveBeenCalledWith(expect.any(String), { cwd: "/work" });
	});

	it("result accumulates text events", async () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
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
		const provider = createClaudeProvider(deps);
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
		const provider = createClaudeProvider(deps);
		provider.execute({ prompt: { message: "pre-built prompt string" } });
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.any(String),
			"pre-built prompt string",
			"utf-8",
		);
	});

	it("uses formatPrompt when envelope has identity", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
		provider.execute({ prompt: { message: "hello", identity: { name: "Bot" } } });
		const written = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(written).toContain("You are **Bot**");
	});

	describe("createSession", () => {
		it("reports persistentSession capability", () => {
			const provider = createClaudeProvider(makeDeps());
			expect(provider.capabilities().persistentSession).toBe(true);
		});

		it("spawns claude without -p flag, with stdin true and --dangerously-skip-permissions", () => {
			const deps = makeDeps();
			const provider = createClaudeProvider(deps);
			const request: LLMSessionRequest = { cwd: "/work" };
			provider.createSession!(request);
			expect(deps.shell.spawnBackground).toHaveBeenCalledWith(
				expect.any(String),
				{ cwd: "/work", stdin: true },
			);
			const cmd = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
			expect(cmd).toContain("--dangerously-skip-permissions");
			expect(cmd).toContain("--output-format");
			expect(cmd).toContain("stream-json");
			const parts = cmd.split(" ");
			expect(parts).not.toContain("-p");
		});

		it("send writes message to stdin and returns LLMProcess", () => {
			const deps = makeDeps();
			const provider = createClaudeProvider(deps);
			const session = provider.createSession!({});
			const proc = session.send("hello");
			expect(deps._mockProc.writeStdin).toHaveBeenCalledWith("hello\n");
			expect(proc).toHaveProperty("result");
			expect(proc).toHaveProperty("onEvent");
			expect(proc).toHaveProperty("kill");
		});

		it("send resolves on done event", async () => {
			const deps = makeDeps();
			const provider = createClaudeProvider(deps);
			const session = provider.createSession!({});
			const proc = session.send("hello");

			for (const cb of deps._outputCallbacks) {
				cb(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Hi!" }] } }));
				cb(JSON.stringify({ type: "result", subtype: "success" }));
			}

			const result = await proc.result;
			expect(result.text).toBe("Hi!");
			expect(result.exitCode).toBe(0);
		});

		it("kill sets alive to false", () => {
			const deps = makeDeps();
			deps._mockProc.running = true;
			const provider = createClaudeProvider(deps);
			const session = provider.createSession!({});
			expect(session.alive).toBe(true);
			session.kill();
			expect(session.alive).toBe(false);
			expect(deps._mockProc.kill).toHaveBeenCalled();
		});
	});
});
