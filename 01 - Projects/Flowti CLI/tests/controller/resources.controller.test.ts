/**
 * resources.controller.test.ts — Tests for project resource management commands.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come BEFORE imports) ─────────────────────────────

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../mocks/mock-presets.js");
	return mockShellPreset();
});
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
	pidOps: { isPidAlive: vi.fn(() => false), isPortListening: vi.fn(async () => false), killPid: vi.fn(() => false) },
}));

// Mock domain modules
vi.mock("../../src/domain/resources/resource-store.js", () => ({
	resourceStore: {
		list: vi.fn(() => [
			{ name: "Jane Doe", resourceType: "human", status: "active", price: 0, amount: 1 },
			{ name: "Cloud Budget", resourceType: "budget", status: "active", price: 1, amount: 5000 },
		]),
		create: vi.fn(() => "/project/resources/jane-doe.md"),
		resolveDir: vi.fn(() => "/project/docs/resources"),
	},
	listResources: vi.fn(() => [
		{ name: "Jane Doe", resourceType: "human", status: "active", price: 0, amount: 1 },
		{ name: "Cloud Budget", resourceType: "budget", status: "active", price: 1, amount: 5000 },
	]),
	createResourceFile: vi.fn(() => "/project/resources/jane-doe.md"),
}));
vi.mock("../../src/domain/resources/resource-analysis.js", () => ({
	analyzeFinancials: vi.fn(() => ({
		totalBudget: 5000,
		totalConsumed: 1200,
		remaining: 3800,
		byCategory: {},
	})),
}));
vi.mock("../../src/ui/displays/resources-display.js", () => ({
	renderResourceList: vi.fn(),
	renderFinancialSummary: vi.fn(),
	renderResourceAdded: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/resources.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { shell } from "../../src/infrastructure/shell.js";
import { log } from "../../src/infrastructure/logger.js";
import { resourceStore, createResourceFile } from "../../src/domain/resources/resource-store.js";
import { analyzeFinancials } from "../../src/domain/resources/resource-analysis.js";
import { renderError } from "../../src/ui/renderers/common-renderers.js";

const mockProject = {
	name: "test",
	path: "/project",
	config: { name: "test", reports: { generators: [] } },
	scripts: {},
	pkg: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("resources.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, shell, paths,
			proc: { exit: vi.fn() as never, argv: () => [], cwd: () => "/", env: () => ({}) },
			pidOps: { isPidAlive: vi.fn(() => false), isPortListening: vi.fn(async () => false), killPid: vi.fn(() => false) },
			clock: { iso: () => "", now: () => new Date(), ms: () => 0, safeIso: () => "" },
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never, askAbortable: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
			worldState: {} as never, workerManager: {} as never, processRunner: {} as never,
		});
	});

	describe("resources:list", () => {
		it("returns list of resources for a project", () => {
			commands["resources:list"]({}, [], "resources:list", mockProject);
			expect(resourceStore.list).toHaveBeenCalled();
		});

		it("does nothing without a project", () => {
			commands["resources:list"]({}, [], "resources:list", undefined);
			expect(resourceStore.list).not.toHaveBeenCalled();
		});
	});

	describe("resources:add", () => {
		it("creates a resource with valid flags", () => {
			commands["resources:add"](
				{ name: "Jane Doe", type: "human" },
				[], "resources:add", mockProject,
			);
			expect(createResourceFile).toHaveBeenCalled();
		});

		it("returns error when --name is missing", () => {
			commands["resources:add"]({}, [], "resources:add", mockProject);
			expect(createResourceFile).not.toHaveBeenCalled();
		});

		it("returns error for invalid type", () => {
			commands["resources:add"]({ name: "Bad", type: "invalid" }, [], "resources:add", mockProject);
			expect(createResourceFile).not.toHaveBeenCalled();
		});

		it("does nothing without a project", () => {
			commands["resources:add"]({ name: "Test" }, [], "resources:add", undefined);
			expect(createResourceFile).not.toHaveBeenCalled();
		});
	});

	describe("resources:summary", () => {
		it("returns financial summary for a project", () => {
			commands["resources:summary"]({}, [], "resources:summary", mockProject);
			expect(resourceStore.list).toHaveBeenCalled();
			expect(analyzeFinancials).toHaveBeenCalled();
		});

		it("does nothing without a project", () => {
			commands["resources:summary"]({}, [], "resources:summary", undefined);
			expect(resourceStore.list).not.toHaveBeenCalled();
		});
	});
});
