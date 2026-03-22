import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../src/infrastructure/shell.js", () => ({ shell: {} }));
vi.mock("../../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { createCursorProvider } from "../../../src/infrastructure/llm/cursor-provider.js";

function makeDeps() {
	const outputCallbacks: Array<(line: string) => void> = [];
	const mockProc = {
		waitForExit: vi.fn(() => Promise.resolve(0)),
		onOutput: vi.fn((cb: (line: string) => void) => { outputCallbacks.push(cb); return () => {}; }),
		kill: vi.fn(),
		running: true,
		output: [],
		waitForOutput: vi.fn(),
		writeStdin: vi.fn(),
	};
	return {
		disk: { writeFileSync: vi.fn(), unlinkSync: vi.fn() } as never,
		paths: { join: vi.fn((...a: string[]) => a.join("/")), resolve: vi.fn((...a: string[]) => a.join("/")) } as never,
		clock: { ms: vi.fn(() => 5678) } as never,
		shell: { spawnBackground: vi.fn(() => mockProc) } as never,
		log: vi.fn(),
		_mockProc: mockProc,
		_outputCallbacks: outputCallbacks,
	};
}

describe("createCursorProvider", () => {
	it("has name 'cursor'", () => {
		const provider = createCursorProvider(makeDeps());
		expect(provider.name).toBe("cursor");
	});

	it("reports capabilities without thinking", () => {
		const caps = createCursorProvider(makeDeps()).capabilities();
		expect(caps.streaming).toBe(true);
		expect(caps.thinking).toBe(false);
		expect(caps.toolUse).toBe(true);
		expect(caps.structuredOutput).toBe(true);
	});

	it("spawns cursor binary with --print --json flags", () => {
		const deps = makeDeps();
		createCursorProvider(deps).execute({ prompt: { message: "hello" } });
		const cmd = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
		expect(cmd).toContain("cursor");
		expect(cmd).toContain("--print");
		expect(cmd).toContain("--json");
	});

	it("accumulates text from output lines", async () => {
		const deps = makeDeps();
		const proc = createCursorProvider(deps).execute({ prompt: { message: "hello" } });
		for (const cb of deps._outputCallbacks) {
			cb("Hello from Cursor!");
		}
		const result = await proc.result;
		expect(result.text).toBe("Hello from Cursor!");
	});

	describe("createSession", () => {
		it("reports persistentSession capability", () => {
			const caps = createCursorProvider(makeDeps()).capabilities();
			expect(caps.persistentSession).toBe(true);
		});

		it("spawns agent (not claude) without -p flag, with stdin: true, with --force --trust", () => {
			const deps = makeDeps();
			const provider = createCursorProvider(deps);
			provider.createSession!({ cwd: "/work" });
			const cmd = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
			expect(cmd).toMatch(/^agent\b/);
			expect(cmd).not.toContain("claude");
			const args = cmd.split(" ");
			expect(args).not.toContain("-p");
			expect(cmd).toContain("--force");
			expect(cmd).toContain("--trust");
			const opts = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[0][1] as { stdin?: boolean; cwd?: string };
			expect(opts.stdin).toBe(true);
		});

		it("send writes message to stdin and returns LLMProcess", () => {
			const deps = makeDeps();
			const provider = createCursorProvider(deps);
			const session = provider.createSession!({ cwd: "/work" });
			const proc = session.send("hello");
			expect(deps._mockProc.writeStdin).toHaveBeenCalledWith("hello\n");
			expect(proc).toHaveProperty("onEvent");
			expect(proc).toHaveProperty("result");
			expect(proc).toHaveProperty("kill");
		});

		it("kill sets alive to false", () => {
			const deps = makeDeps();
			const provider = createCursorProvider(deps);
			const session = provider.createSession!({ cwd: "/work" });
			expect(session.alive).toBe(true);
			session.kill();
			expect(session.alive).toBe(false);
			expect(deps._mockProc.kill).toHaveBeenCalled();
		});
	});
});
