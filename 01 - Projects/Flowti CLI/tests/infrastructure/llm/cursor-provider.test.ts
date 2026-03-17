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
});
