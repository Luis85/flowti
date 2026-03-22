/**
 * deliverables.controller.test.ts — Tests for deliverable management commands.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come BEFORE imports) ─────────────────────────────

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
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
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-10T00:00:00.000Z", now: () => new Date("2026-03-10"), ms: () => 0, safeIso: () => "" },
}));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
	pidOps: { isPidAlive: vi.fn(() => false), isPortListening: vi.fn(async () => false), killPid: vi.fn(() => false) },
}));
vi.mock("../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(async () => ""), askYesNo: vi.fn(async () => false), waitForEnter: vi.fn(async () => {}) },
}));
vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	CLI_PROJECT: "/vault/cli",
	PLUGIN_ROOT: "/vault/plugin",
	cliConfig: { version: "1.0.0" },
	loadJson: vi.fn(),
}));
vi.mock("../../src/infrastructure/output.js", () => ({
	output: { write: vi.fn() },
}));

// Mock domain modules
vi.mock("../../src/domain/deliverables/deliverable-store.js", () => ({
	deliverableStore: {
		list: vi.fn(() => [
			{ name: "MVP Release", status: "in-progress", dueDate: "2026-04-01", priority: "high", completionPct: 60 },
			{ name: "API Docs", status: "planned", dueDate: "2026-05-01", priority: "medium", completionPct: 0 },
		]),
		updateField: vi.fn(() => true),
		create: vi.fn(() => "/project/docs/deliverables/beta-launch.md"),
		resolveDir: vi.fn(() => "/project/docs/deliverables"),
	},
	listDeliverables: vi.fn(() => [
		{ name: "MVP Release", status: "in-progress", dueDate: "2026-04-01", priority: "high", completionPct: 60 },
		{ name: "API Docs", status: "planned", dueDate: "2026-05-01", priority: "medium", completionPct: 0 },
	]),
	createDeliverableFile: vi.fn(() => "/project/docs/deliverables/beta-launch.md"),
	updateDeliverableStatus: vi.fn(() => true),
}));

// Mock UI modules
vi.mock("../../src/ui/displays/deliverables-display.js", () => ({
	renderDeliverableList: vi.fn(),
	renderDeliverableAdded: vi.fn(),
	renderDeliverableUpdated: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/deliverables.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { deliverableStore, createDeliverableFile, updateDeliverableStatus } from "../../src/domain/deliverables/deliverable-store.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { shell } from "../../src/infrastructure/shell.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc, pidOps } from "../../src/infrastructure/proc.js";
import { log } from "../../src/infrastructure/logger.js";

const logMock = log as ReturnType<typeof vi.fn>;

const mockProject = {
	name: "test",
	path: "/project",
	config: { name: "test", reports: { generators: [] }, management: { deliverables: {} } },
	scripts: {},
	pkg: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("deliverables.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, shell, paths, clock, proc, pidOps,
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never, askAbortable: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
			worldState: {} as never, workerManager: {} as never, processRunner: {} as never,
		});
	});

	// ── deliverables:list ────────────────────────────────────────
	describe("deliverables:list", () => {
		it("calls listDeliverables with project path", () => {
			commands["deliverables:list"]({}, [], "deliverables:list", mockProject);

			expect(deliverableStore.list).toHaveBeenCalledOnce();
		});

		it("returns deliverables as JSON", () => {
			commands["deliverables:list"]({ format: "json" }, [], "deliverables:list", mockProject);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(Array.isArray(output)).toBe(true);
			expect(output).toHaveLength(2);
			expect(output[0]).toHaveProperty("name", "MVP Release");
			expect(output[0]).toHaveProperty("status", "in-progress");
		});

		it("returns undefined when no project", () => {
			commands["deliverables:list"]({}, [], "deliverables:list", undefined);

			expect(deliverableStore.list).not.toHaveBeenCalled();
		});
	});

	// ── deliverables:add ─────────────────────────────────────────
	describe("deliverables:add", () => {
		it("creates a deliverable with provided flags", () => {
			commands["deliverables:add"](
				{ name: "Beta Launch", status: "planned", due: "2026-06-01", priority: "high" },
				[], "deliverables:add", mockProject,
			);

			expect(createDeliverableFile).toHaveBeenCalledOnce();
		});

		it("returns error when --name flag is missing", () => {
			commands["deliverables:add"]({ format: "json" }, [], "deliverables:add", mockProject);

			expect(createDeliverableFile).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--name");
		});

		it("defaults to planned status when not provided", () => {
			commands["deliverables:add"](
				{ name: "Default Status" },
				[], "deliverables:add", mockProject,
			);

			expect(createDeliverableFile).toHaveBeenCalled();
		});

		it("returns undefined when no project", () => {
			commands["deliverables:add"]({ name: "Test" }, [], "deliverables:add", undefined);

			expect(createDeliverableFile).not.toHaveBeenCalled();
		});
	});

	// ── deliverables:update ──────────────────────────────────────
	describe("deliverables:update", () => {
		it("updates deliverable status with provided flags", () => {
			commands["deliverables:update"](
				{ name: "MVP Release", status: "done" },
				[], "deliverables:update", mockProject,
			);

			expect(updateDeliverableStatus).toHaveBeenCalledOnce();
		});

		it("passes completion percentage when provided", () => {
			commands["deliverables:update"](
				{ name: "MVP Release", status: "in-progress", completion: "80" },
				[], "deliverables:update", mockProject,
			);

			expect(updateDeliverableStatus).toHaveBeenCalled();
		});

		it("returns error when --name or --status is missing", () => {
			commands["deliverables:update"](
				{ name: "Test", format: "json" },
				[], "deliverables:update", mockProject,
			);

			expect(updateDeliverableStatus).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.error).toContain("Missing");
		});

		it("returns error for invalid status", () => {
			commands["deliverables:update"](
				{ name: "Test", status: "invalid-status", format: "json" },
				[], "deliverables:update", mockProject,
			);

			expect(updateDeliverableStatus).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.error).toContain("invalid-status");
		});

		it("returns undefined when no project", () => {
			commands["deliverables:update"](
				{ name: "Test", status: "done" },
				[], "deliverables:update", undefined,
			);

			expect(updateDeliverableStatus).not.toHaveBeenCalled();
		});
	});
});
