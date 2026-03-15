import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/shell.js", () => ({ shell: {} }));
vi.mock("../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));

import { writeInboxNote, writeSystemInboxNote } from "../../src/infrastructure/agent-inbox.js";
import type { ShellBaseDeps } from "../../src/infrastructure/agent-shell.js";

function createMockDeps(): ShellBaseDeps {
	return {
		disk: {
			readFileSync: vi.fn().mockReturnValue("{}"),
			writeFileSync: vi.fn(),
			existsSync: vi.fn().mockReturnValue(false),
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
			spawnBackground: vi.fn(),
			check: vi.fn().mockReturnValue(true),
		} as never,
		log: vi.fn(),
	};
}

beforeEach(() => { vi.clearAllMocks(); });

describe("writeInboxNote", () => {
	it("creates inbox directory if it does not exist", () => {
		const deps = createMockDeps();
		writeInboxNote(deps, "/vault", "alice", undefined, "build", "Hello world", "");
		expect(deps.disk.mkdirSync).toHaveBeenCalledWith(
			expect.stringContaining("inbox"),
			{ recursive: true },
		);
	});

	it("writes markdown file with agent name in slug", () => {
		const deps = createMockDeps();
		writeInboxNote(deps, "/vault", "alice", undefined, "build", "Hello world", "");
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.stringContaining("alice-1234567890.md"),
			expect.stringContaining("from: alice"),
			"utf-8",
		);
	});

	it("uses persona in slug when provided", () => {
		const deps = createMockDeps();
		writeInboxNote(deps, "/vault", "alice", "Wonder Woman", "build", "Hello", "");
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.stringContaining("wonder-woman-"),
			expect.stringContaining("persona: Wonder Woman"),
			"utf-8",
		);
	});

	it("includes task in frontmatter when provided", () => {
		const deps = createMockDeps();
		writeInboxNote(deps, "/vault", "alice", undefined, "deploy", "Done", "");
		const content = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(content).toContain("task: deploy");
	});

	it("includes thinking section when provided", () => {
		const deps = createMockDeps();
		writeInboxNote(deps, "/vault", "alice", undefined, "task", "response", "Deep thought");
		const content = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(content).toContain("## Thinking");
		expect(content).toContain("Deep thought");
	});

	it("omits thinking section when empty", () => {
		const deps = createMockDeps();
		writeInboxNote(deps, "/vault", "alice", undefined, "task", "response", "");
		const content = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(content).not.toContain("## Thinking");
	});
});

describe("writeSystemInboxNote", () => {
	it("creates inbox directory if it does not exist", () => {
		const deps = createMockDeps();
		writeSystemInboxNote(deps, "/vault", "bob", "System message");
		expect(deps.disk.mkdirSync).toHaveBeenCalledWith(
			expect.stringContaining("inbox"),
			{ recursive: true },
		);
	});

	it("writes system note with agent name", () => {
		const deps = createMockDeps();
		writeSystemInboxNote(deps, "/vault", "bob", "Process interrupted");
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.stringContaining("system-bob-"),
			expect.stringContaining("from: system"),
			"utf-8",
		);
	});

	it("includes message in content", () => {
		const deps = createMockDeps();
		writeSystemInboxNote(deps, "/vault", "bob", "Auto-dequeue stopped");
		const content = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(content).toContain("Auto-dequeue stopped");
	});

	it("includes status: message in frontmatter", () => {
		const deps = createMockDeps();
		writeSystemInboxNote(deps, "/vault", "bob", "test");
		const content = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(content).toContain("status: message");
	});
});
