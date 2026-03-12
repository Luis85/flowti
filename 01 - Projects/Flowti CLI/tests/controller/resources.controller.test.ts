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
}));

// Mock domain modules
vi.mock("../../src/domain/resources/resource-store.js", () => ({
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
vi.mock("../../src/ui/resources-display.js", () => ({
	renderResourceList: vi.fn(),
	renderFinancialSummary: vi.fn(),
	renderResourceAdded: vi.fn(),
}));
vi.mock("../../src/ui/common-renderers.js", () => ({
	renderError: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/resources.controller.js";
import { initializeDeps } from "../../src/infrastructure/request-response.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { shell } from "../../src/infrastructure/shell.js";
import { log } from "../../src/infrastructure/logger.js";
import { listResources, createResourceFile } from "../../src/domain/resources/resource-store.js";
import { analyzeFinancials } from "../../src/domain/resources/resource-analysis.js";
import { renderError } from "../../src/ui/common-renderers.js";

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
			clock: { iso: () => "", now: () => new Date(), ms: () => 0, safeIso: () => "" },
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
		});
	});

	describe("resources:list", () => {
		it("returns list of resources for a project", () => {
			commands["resources:list"]({}, [], "resources:list", mockProject);
			expect(listResources).toHaveBeenCalledWith(expect.any(Object), "/project", undefined);
		});

		it("does nothing without a project", () => {
			commands["resources:list"]({}, [], "resources:list", undefined);
			expect(listResources).not.toHaveBeenCalled();
		});
	});

	describe("resources:add", () => {
		it("creates a resource with valid flags", () => {
			commands["resources:add"](
				{ name: "Jane Doe", type: "human" },
				[], "resources:add", mockProject,
			);
			expect(createResourceFile).toHaveBeenCalledWith(
				expect.any(Object), "/project",
				expect.objectContaining({ name: "Jane Doe", resourceType: "human" }),
				undefined,
			);
		});

		it("returns error when --name is missing", () => {
			commands["resources:add"]({}, [], "resources:add", mockProject);
			expect(renderError).toHaveBeenCalledWith(expect.objectContaining({ error: "Missing --name flag." }));
			expect(createResourceFile).not.toHaveBeenCalled();
		});

		it("returns error for invalid type", () => {
			commands["resources:add"]({ name: "Bad", type: "invalid" }, [], "resources:add", mockProject);
			expect(renderError).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Invalid type") }));
		});

		it("does nothing without a project", () => {
			commands["resources:add"]({ name: "Test" }, [], "resources:add", undefined);
			expect(createResourceFile).not.toHaveBeenCalled();
		});
	});

	describe("resources:summary", () => {
		it("returns financial summary for a project", () => {
			commands["resources:summary"]({}, [], "resources:summary", mockProject);
			expect(listResources).toHaveBeenCalledWith(expect.any(Object), "/project", undefined);
			expect(analyzeFinancials).toHaveBeenCalled();
		});

		it("does nothing without a project", () => {
			commands["resources:summary"]({}, [], "resources:summary", undefined);
			expect(listResources).not.toHaveBeenCalled();
		});
	});
});
