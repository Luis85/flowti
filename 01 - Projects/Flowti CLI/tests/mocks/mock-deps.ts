/**
 * mock-deps.ts — Test helper for creating a full CliDeps with mocks.
 *
 * Usage:
 *   const deps = createTestDeps();
 *   const deps = createTestDeps({ files: { "/a.txt": "hello" } });
 */

import type { CliDeps } from "../../src/infrastructure/deps.js";
import type { IInput, IPaths } from "../../src/infrastructure/types.js";
import type { IWorldStateManager } from "../../src/domain/agents/world-state-types.js";
import type { IWorkerManager, IAgentProcessRunner } from "../../src/domain/agents/worker-types.js";
import { createCliBus } from "../../src/infrastructure/event-bus.js";
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
		askAbortable: vi.fn(() => ({ promise: Promise.resolve(""), abort: vi.fn() })),
		askYesNo: vi.fn(async () => false),
		waitForEnter: vi.fn(async () => {}),
	};
}

function createMockWorldState(): IWorldStateManager {
	return {
		emitAction: vi.fn(),
		updateEntity: vi.fn(),
		getState: vi.fn(() => ({ version: 1 as const, updatedAt: "", entities: {}, permissions: {}, activityLog: [] })),
		getEntity: vi.fn(() => null),
		flush: vi.fn(),
		setActionCallback: vi.fn(),
	};
}

function createMockWorkerManager(): IWorkerManager {
	return {
		spawn: vi.fn(() => null),
		spawnAll: vi.fn(),
		stop: vi.fn(),
		stopAll: vi.fn(),
		getWorker: vi.fn(() => null),
		listWorkers: vi.fn(() => []),
		send: vi.fn(),
		dispatchWorldEvent: vi.fn(),
	};
}

function createMockProcessRunner(): IAgentProcessRunner {
	return {
		spawn: vi.fn(() => ({
			onEvent: vi.fn(),
			result: Promise.resolve({ text: "", thinking: "", exitCode: 0 }),
			kill: vi.fn(),
		})),
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
		bus: createCliBus(),
		log: vi.fn(),
		warn: vi.fn(),
		worldState: createMockWorldState(),
		workerManager: createMockWorkerManager(),
		processRunner: createMockProcessRunner(),
	};
}
