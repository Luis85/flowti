/**
 * mock-presets.ts — Reusable vi.mock() factory presets for infrastructure modules.
 *
 * These return the shape expected by vi.mock() factories. Use inside vi.hoisted()
 * to avoid hoisting issues, or inline in vi.mock() factory functions.
 *
 * Usage:
 *   import { mockDisk, mockShellPreset, mockUiPreset, mockLoggerPreset, mockPathsPreset, mockProcPreset } from "../../mocks/mock-presets.js";
 *
 *   // Option A: inline
 *   vi.mock("../../src/infrastructure/filesystem.js", () => mockDisk());
 *
 *   // Option B: vi.hoisted (when you need the mock reference for assertions)
 *   const { mocks } = vi.hoisted(() => {
 *     const d = mockDisk();
 *     return { mocks: d };
 *   });
 *   vi.mock("../../src/infrastructure/filesystem.js", () => mocks);
 *
 * For rich in-memory implementations (with state), use:
 *   - createMockFs()   from ./mock-fs.ts
 *   - createMockShell() from ./mock-shell.ts
 *   - createMockClock() from ./mock-clock.ts
 *   - createMockProc()  from ./mock-proc.ts
 */

import { vi, type Mock } from "vitest";

// ── Filesystem ──────────────────────────────────────────────────────

type MockFn = Mock<(...args: unknown[]) => unknown>;

export interface DiskPreset {
	disk: {
		existsSync: MockFn;
		readFileSync: MockFn;
		writeFileSync: MockFn;
		mkdirSync: MockFn;
		readdirSync: MockFn;
		copyFileSync: MockFn;
		rmSync: MockFn;
		unlinkSync: MockFn;
		statSync: MockFn;
	};
}

export function mockDisk(overrides: Partial<DiskPreset["disk"]> = {}): DiskPreset {
	return {
		disk: {
			existsSync: vi.fn(() => false),
			readFileSync: vi.fn(() => ""),
			writeFileSync: vi.fn(),
			mkdirSync: vi.fn(),
			readdirSync: vi.fn(() => []),
			copyFileSync: vi.fn(),
			rmSync: vi.fn(),
			unlinkSync: vi.fn(),
			statSync: vi.fn(() => ({ size: 0, isFile: () => true, isDirectory: () => false })),
			...overrides,
		},
	};
}

/** Minimal disk mock — all methods are no-ops. For tests that don't touch the filesystem. */
export function mockDiskEmpty(): { disk: Record<string, never> } {
	return { disk: {} as Record<string, never> };
}

// ── Shell ───────────────────────────────────────────────────────────

export interface ShellPreset {
	shell: {
		run: MockFn;
		runSilent: MockFn;
		check: MockFn;
		runCapture: MockFn;
		execFile: MockFn;
		runCaptureStatus: MockFn;
		runCaptureDetailed: MockFn;
		spawnBackground: MockFn;
		runAsync: MockFn;
		runParallel: MockFn;
	};
}

export function mockShellPreset(overrides: Partial<ShellPreset["shell"]> = {}): ShellPreset {
	return {
		shell: {
			run: vi.fn(() => 0),
			runSilent: vi.fn(() => null),
			check: vi.fn(() => true),
			runCapture: vi.fn(() => ""),
			execFile: vi.fn(() => null),
			runCaptureStatus: vi.fn(() => ({ output: "", exitCode: 0 })),
			runCaptureDetailed: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0 })),
			spawnBackground: vi.fn(() => ({ running: false, output: [], onOutput: () => () => {}, kill: () => {}, waitForOutput: () => Promise.resolve(null), waitForExit: () => Promise.resolve(0) })),
			runAsync: vi.fn(async () => ({ output: "", exitCode: 0 })),
			runParallel: vi.fn(async () => []),
			...overrides,
		},
	};
}

/** Minimal shell mock — all methods are no-ops. */
export function mockShellEmpty(): { shell: Record<string, never> } {
	return { shell: {} as Record<string, never> };
}

// ── UI (ANSI constants + helpers) ───────────────────────────────────

export function mockUiPreset() {
	return {
		RESET: "", BOLD: "", DIM: "", UNDERLINE: "",
		GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "",
		printHeader: vi.fn(),
		printSection: vi.fn(),
		printDivider: vi.fn(),
	};
}

// ── Logger ──────────────────────────────────────────────────────────

export function mockLoggerPreset() {
	return { log: vi.fn() };
}

// ── Paths ───────────────────────────────────────────────────────────

export function mockPathsPreset() {
	return {
		paths: {
			join: (...args: string[]) => args.join("/"),
			resolve: (...args: string[]) => args.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string) => p.split("/").pop() ?? "",
			relative: (_from: string, to: string) => to,
			isAbsolute: (p: string) => p.startsWith("/"),
			extname: (p: string) => { const i = p.lastIndexOf("."); return i > 0 ? p.slice(i) : ""; },
		},
	};
}

// ── Process ─────────────────────────────────────────────────────────

export function mockProcPreset(overrides: { argv?: string[]; cwd?: string; env?: Record<string, string | undefined> } = {}) {
	return {
		proc: {
			exit: vi.fn(),
			argv: () => overrides.argv ?? [],
			cwd: () => overrides.cwd ?? "/mock/cwd",
			env: () => overrides.env ?? {},
		},
	};
}

// ── Config ──────────────────────────────────────────────────────────

export function mockConfigPreset(overrides: Record<string, unknown> = {}) {
	return {
		PLUGIN_ROOT: "/mock/plugin",
		VAULT_ROOT: "/mock/vault",
		cliConfig: {},
		...overrides,
	};
}

// ── Input ───────────────────────────────────────────────────────────

export function mockInputPreset() {
	return {
		input: {
			ask: vi.fn(() => ""),
			confirm: vi.fn(() => false),
			select: vi.fn(() => ""),
		},
	};
}

// ── Menu ────────────────────────────────────────────────────────────

export function mockMenuPreset() {
	return {
		runMenu: vi.fn(),
	};
}

// ── Clock ───────────────────────────────────────────────────────────

export function mockClockPreset(iso: string = "2025-06-15T10:30:00.000Z") {
	const ts = new Date(iso).getTime();
	return {
		clock: {
			now: () => new Date(ts),
			ms: () => ts,
			iso: () => iso,
			safeIso: () => iso.replace(/:/g, "-"),
		},
	};
}
