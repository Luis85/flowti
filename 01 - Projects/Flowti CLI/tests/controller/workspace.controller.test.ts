/**
 * workspace.controller.test.ts — Tests for workspace controller commands.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		readdirSync: vi.fn(() => []),
	},
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		relative: (_from: string, to: string) => to,
		isAbsolute: (p: string) => p.startsWith("/"),
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		basename: (p: string) => p.split("/").pop(),
	},
}));
vi.mock("../../src/infrastructure/shell.js", () => ({
	shell: {
		run: vi.fn(() => ""),
		runSilent: vi.fn(() => ""),
		runCapture: vi.fn(() => ({ stdout: "", stderr: "", code: 0 })),
		spawnBackground: vi.fn(),
	},
}));
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-15T00:00:00.000Z", now: () => new Date("2026-03-15"), ms: () => 0, safeIso: () => "" },
}));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
}));
vi.mock("../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(async () => ""), askYesNo: vi.fn(async () => false), waitForEnter: vi.fn(async () => {}) },
}));
vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));
vi.mock("../../src/ui/renderers/cli-event-renderer.js", () => ({ attachCliRenderer: vi.fn(() => () => {}) }));
import { commands } from "../../src/controller/workspace.controller.js";

describe("workspace controller", () => {
	it("exports workspace:list command", () => {
		expect(commands["workspace:list"]).toBeDefined();
	});

	it("exports workspace:provision command", () => {
		expect(commands["workspace:provision"]).toBeDefined();
	});

	it("exports workspace:collect command", () => {
		expect(commands["workspace:collect"]).toBeDefined();
	});

	it("exports workspace:dispose command", () => {
		expect(commands["workspace:dispose"]).toBeDefined();
	});

	it("exports workspace:prune command", () => {
		expect(commands["workspace:prune"]).toBeDefined();
	});

	it("exports workspace:inspect command", () => {
		expect(commands["workspace:inspect"]).toBeDefined();
	});
});
