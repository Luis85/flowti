/**
 * mock-deps.ts — Test helper for creating a full CliDeps with mocks.
 *
 * Usage:
 *   const deps = createTestDeps();
 *   const deps = createTestDeps({ files: { "/a.txt": "hello" } });
 */

import type { CliDeps } from "../../src/infrastructure/deps.js";
import type { IInput, IPaths } from "../../src/infrastructure/types.js";
import { createMockFs } from "./mock-fs.js";
import { createMockShell } from "./mock-shell.js";
import { createMockClock } from "./mock-clock.js";
import { createMockProc } from "./mock-proc.js";
import type { MockShellOptions } from "./mock-shell.js";
import type { MockProcOptions } from "./mock-proc.js";
import { vi } from "vitest";

export interface TestDepsOptions {
	files?: Record<string, string>;
	shell?: MockShellOptions;
	clock?: string;
	proc?: MockProcOptions;
}

function createMockPaths(): IPaths {
	return {
		join: (...segments: string[]) => segments.join("/"),
		resolve: (...segments: string[]) => segments.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
		basename: (p: string, ext?: string) => { const b = p.split("/").pop() ?? p; return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; },
		relative: (_from: string, to: string) => to,
		extname: (p: string) => { const m = p.match(/\.[^.]+$/); return m ? m[0] : ""; },
		isAbsolute: (p: string) => p.startsWith("/"),
		sep: "/",
	};
}

function createMockInput(): IInput {
	return {
		ask: vi.fn(async (_q: string, defaultValue = "") => defaultValue),
		askYesNo: vi.fn(async () => false),
		waitForEnter: vi.fn(async () => {}),
	};
}

export function createTestDeps(opts: TestDepsOptions = {}): CliDeps {
	return {
		disk: createMockFs(opts.files),
		shell: createMockShell(opts.shell),
		paths: createMockPaths(),
		clock: createMockClock(opts.clock),
		proc: createMockProc(opts.proc),
		input: createMockInput(),
		log: vi.fn(),
		warn: vi.fn(),
	};
}
