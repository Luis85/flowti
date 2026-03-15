/**
 * lifecycle.controller.test.ts — Tests for lifecycle management commands.
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
vi.mock("../../src/domain/lifecycle/lifecycle-store.js", () => ({
	listLifecycleItems: vi.fn(() => [
		{ name: "Feature A", entityType: "feature", state: "development" },
		{ name: "Project B", entityType: "project", state: "planning" },
	]),
	readLifecycleItem: vi.fn(() => ({
		name: "Feature A",
		entityType: "feature",
		state: "development",
		transitions: [],
	})),
	createLifecycleFile: vi.fn(() => "/project/lifecycle/feature-a.md"),
	transitionLifecycleItem: vi.fn(() => ({
		success: true,
		from: "planning",
		to: "development",
		name: "Feature A",
	})),
	getLifecycleHistory: vi.fn(() => [
		{ from: "planning", to: "development", reason: "Ready", date: "2026-01-01" },
	]),
}));
vi.mock("../../src/ui/displays/lifecycle-display.js", () => ({
	renderLifecycleStatus: vi.fn(),
	renderLifecycleList: vi.fn(),
	renderTransitionResult: vi.fn(),
	renderTransitionHistory: vi.fn(),
	renderLifecycleCreated: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/lifecycle.controller.js";
import { initializeDeps } from "../../src/infrastructure/request-response.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { shell } from "../../src/infrastructure/shell.js";
import { log } from "../../src/infrastructure/logger.js";
import { listLifecycleItems, readLifecycleItem, createLifecycleFile, transitionLifecycleItem, getLifecycleHistory } from "../../src/domain/lifecycle/lifecycle-store.js";
import { renderError } from "../../src/ui/renderers/common-renderers.js";

const mockProject = {
	name: "test",
	path: "/project",
	config: { name: "test", reports: { generators: [] } },
	scripts: {},
	pkg: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("lifecycle.controller", () => {
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

	describe("lifecycle:list", () => {
		it("returns list of lifecycle items for a project", () => {
			commands["lifecycle:list"]({}, [], "lifecycle:list", mockProject);
			expect(listLifecycleItems).toHaveBeenCalledWith(expect.any(Object), "/project", undefined);
		});

		it("does nothing without a project", () => {
			commands["lifecycle:list"]({}, [], "lifecycle:list", undefined);
			expect(listLifecycleItems).not.toHaveBeenCalled();
		});

		it("passes type filter from flags", () => {
			commands["lifecycle:list"]({ type: "feature" }, [], "lifecycle:list", mockProject);
			expect(listLifecycleItems).toHaveBeenCalled();
		});
	});

	describe("lifecycle:status", () => {
		it("returns status for a named item", () => {
			commands["lifecycle:status"]({ name: "Feature A" }, [], "lifecycle:status", mockProject);
			expect(readLifecycleItem).toHaveBeenCalledWith(expect.any(Object), "/project", "Feature A", undefined);
		});

		it("returns error when --name is missing", () => {
			commands["lifecycle:status"]({}, [], "lifecycle:status", mockProject);
			expect(renderError).toHaveBeenCalledWith(expect.objectContaining({ error: "Missing --name flag." }), expect.any(Function));
		});

		it("returns error when item is not found", () => {
			vi.mocked(readLifecycleItem).mockReturnValue(undefined as never);
			commands["lifecycle:status"]({ name: "Missing" }, [], "lifecycle:status", mockProject);
			expect(renderError).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("not found") }), expect.any(Function));
		});
	});

	describe("lifecycle:transition", () => {
		it("transitions an item to a new state", () => {
			commands["lifecycle:transition"](
				{ name: "Feature A", to: "development", reason: "Ready" },
				[], "lifecycle:transition", mockProject,
			);
			expect(transitionLifecycleItem).toHaveBeenCalledWith(
				expect.any(Object), "/project", "Feature A", "development", "Ready", undefined,
			);
		});

		it("returns error when --name or --to is missing", () => {
			commands["lifecycle:transition"]({ name: "Feature A" }, [], "lifecycle:transition", mockProject);
			expect(renderError).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Missing") }), expect.any(Function));
		});

		it("returns error when --reason is missing", () => {
			commands["lifecycle:transition"]({ name: "Feature A", to: "development" }, [], "lifecycle:transition", mockProject);
			expect(renderError).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("--reason") }), expect.any(Function));
		});
	});

	describe("lifecycle:history", () => {
		it("returns transition history for a named item", () => {
			commands["lifecycle:history"]({ name: "Feature A" }, [], "lifecycle:history", mockProject);
			expect(getLifecycleHistory).toHaveBeenCalledWith(expect.any(Object), "/project", "Feature A", undefined);
		});

		it("returns error when --name is missing", () => {
			commands["lifecycle:history"]({}, [], "lifecycle:history", mockProject);
			expect(renderError).toHaveBeenCalledWith(expect.objectContaining({ error: "Missing --name flag." }), expect.any(Function));
		});
	});

	describe("lifecycle:create", () => {
		it("creates a lifecycle file for a valid entity", () => {
			commands["lifecycle:create"](
				{ name: "New Feature", type: "feature" },
				[], "lifecycle:create", mockProject,
			);
			expect(createLifecycleFile).toHaveBeenCalledWith(
				expect.any(Object), "/project", "feature", "New Feature", undefined, undefined,
			);
		});

		it("returns error when --name is missing", () => {
			commands["lifecycle:create"]({ type: "feature" }, [], "lifecycle:create", mockProject);
			expect(renderError).toHaveBeenCalledWith(expect.objectContaining({ error: "Missing --name flag." }), expect.any(Function));
		});

		it("returns error for invalid entity type", () => {
			commands["lifecycle:create"]({ name: "Bad", type: "invalid" }, [], "lifecycle:create", mockProject);
			expect(renderError).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Invalid type") }), expect.any(Function));
		});
	});
});
