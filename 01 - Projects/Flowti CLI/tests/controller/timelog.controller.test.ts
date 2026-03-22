/**
 * timelog.controller.test.ts — Tests for time-log commands.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come BEFORE imports) ─────────────────────────────

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0) },
}));
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => ""),
		readdirSync: vi.fn(() => []),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: {
		join: vi.fn((...args: string[]) => args.join("/")),
		resolve: vi.fn((...args: string[]) => args.join("/")),
		relative: vi.fn((_a: string, b: string) => b),
		dirname: vi.fn((p: string) => p),
		basename: vi.fn((p: string) => p.split("/").pop() ?? p),
	},
}));
vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	CLI_PROJECT: "/vault/cli",
}));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
}));

// Mock domain modules
vi.mock("../../src/domain/timelog/timelog-store.js", () => ({
	timelogStore: {
		list: vi.fn(() => [
			{ date: "2026-01-15", person: "Jane", hours: 4, category: "development", task: "Implement feature" },
			{ date: "2026-01-15", person: "John", hours: 2, category: "review", task: "Code review" },
		]),
		create: vi.fn(() => "/project/timelog/2026-01-15-jane-implement-feature.md"),
		resolveDir: vi.fn(() => "/project/docs/timelog"),
	},
	listTimeLogEntries: vi.fn(() => [
		{ date: "2026-01-15", person: "Jane", hours: 4, category: "development", task: "Implement feature" },
		{ date: "2026-01-15", person: "John", hours: 2, category: "review", task: "Code review" },
	]),
	createTimeLogEntry: vi.fn(() => "/project/timelog/2026-01-15-jane-implement-feature.md"),
	summarizeTimeLog: vi.fn(() => ({
		totalHours: 6,
		byPerson: { Jane: 4, John: 2 },
		byCategory: { development: 4, review: 2 },
	})),
}));
vi.mock("../../src/ui/displays/timelog-display.js", () => ({
	renderTimeLogList: vi.fn(),
	renderTimeLogSummary: vi.fn(),
	renderTimeLogAdded: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/timelog.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { shell } from "../../src/infrastructure/shell.js";
import { log } from "../../src/infrastructure/logger.js";
import { timelogStore, createTimeLogEntry, summarizeTimeLog } from "../../src/domain/timelog/timelog-store.js";

const mockProject = {
	name: "test",
	path: "/project",
	config: { name: "test", reports: { generators: [] } },
	scripts: {},
	pkg: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("timelog.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, shell, paths,
			proc: { exit: vi.fn() as never, argv: () => [], cwd: () => "/", env: () => ({}) },
			clock: { iso: () => "2026-01-15T00:00:00.000Z", now: () => new Date(), ms: () => 0, safeIso: () => "" },
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never, askAbortable: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
			worldState: {} as never, workerManager: {} as never, processRunner: {} as never,
		});
	});

	describe("timelog:list", () => {
		it("returns list of time log entries for a project", () => {
			commands["timelog:list"]({}, [], "timelog:list", mockProject);
			expect(timelogStore.list).toHaveBeenCalled();
		});

		it("does nothing without a project", () => {
			commands["timelog:list"]({}, [], "timelog:list", undefined);
			expect(timelogStore.list).not.toHaveBeenCalled();
		});
	});

	describe("timelog:add", () => {
		it("creates a time log entry with valid flags", () => {
			commands["timelog:add"](
				{ person: "Jane", task: "Implement feature", hours: "4" },
				[], "timelog:add", mockProject,
			);
			expect(createTimeLogEntry).toHaveBeenCalled();
		});

		it("returns error when --person is missing", () => {
			commands["timelog:add"]({ task: "Test" }, [], "timelog:add", mockProject);
			expect(createTimeLogEntry).not.toHaveBeenCalled();
		});

		it("returns error when --task is missing", () => {
			commands["timelog:add"]({ person: "Jane" }, [], "timelog:add", mockProject);
			expect(createTimeLogEntry).not.toHaveBeenCalled();
		});

		it("does nothing without a project", () => {
			commands["timelog:add"]({ person: "Jane", task: "Test" }, [], "timelog:add", undefined);
			expect(createTimeLogEntry).not.toHaveBeenCalled();
		});
	});

	describe("timelog:summary", () => {
		it("returns time log summary for a project", () => {
			commands["timelog:summary"]({}, [], "timelog:summary", mockProject);
			expect(timelogStore.list).toHaveBeenCalled();
			expect(summarizeTimeLog).toHaveBeenCalled();
		});

		it("does nothing without a project", () => {
			commands["timelog:summary"]({}, [], "timelog:summary", undefined);
			expect(timelogStore.list).not.toHaveBeenCalled();
		});
	});
});
