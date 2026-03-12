/**
 * raid.controller.test.ts — Tests for RAID log management commands.
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
vi.mock("../../src/domain/raid/raid-store.js", () => ({
	listRAIDItems: vi.fn(() => [
		{ name: "DB Migration Risk", itemType: "risk", status: "open", severity: "high" },
		{ name: "API Assumption", itemType: "assumption", status: "accepted", severity: "medium" },
	]),
	createRAIDItem: vi.fn(() => "/project/raid/db-migration-risk.md"),
	updateRAIDStatus: vi.fn(() => true),
}));
vi.mock("../../src/ui/raid-display.js", () => ({
	renderRAIDList: vi.fn(),
	renderRAIDAdded: vi.fn(),
	renderRAIDUpdated: vi.fn(),
}));
vi.mock("../../src/ui/common-renderers.js", () => ({
	renderError: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/raid.controller.js";
import { initializeDeps } from "../../src/infrastructure/request-response.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { shell } from "../../src/infrastructure/shell.js";
import { log } from "../../src/infrastructure/logger.js";
import { listRAIDItems, createRAIDItem, updateRAIDStatus } from "../../src/domain/raid/raid-store.js";
import { renderError } from "../../src/ui/common-renderers.js";

const mockProject = {
	name: "test",
	path: "/project",
	config: { name: "test", reports: { generators: [] } },
	scripts: {},
	pkg: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("raid.controller", () => {
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

	describe("raid:list", () => {
		it("returns list of RAID items for a project", () => {
			commands["raid:list"]({}, [], "raid:list", mockProject);
			expect(listRAIDItems).toHaveBeenCalledWith(expect.any(Object), "/project", undefined);
		});

		it("does nothing without a project", () => {
			commands["raid:list"]({}, [], "raid:list", undefined);
			expect(listRAIDItems).not.toHaveBeenCalled();
		});
	});

	describe("raid:add", () => {
		it("creates a RAID item with valid flags", () => {
			commands["raid:add"](
				{ name: "DB Migration Risk", "item-type": "risk", severity: "high" },
				[], "raid:add", mockProject,
			);
			expect(createRAIDItem).toHaveBeenCalledWith(
				expect.any(Object), "/project",
				expect.objectContaining({ name: "DB Migration Risk", itemType: "risk", status: "open", severity: "high" }),
				undefined,
			);
		});

		it("returns error when --name is missing", () => {
			commands["raid:add"]({}, [], "raid:add", mockProject);
			expect(renderError).toHaveBeenCalledWith(expect.objectContaining({ error: "Missing --name flag." }));
			expect(createRAIDItem).not.toHaveBeenCalled();
		});

		it("returns error for invalid item-type", () => {
			commands["raid:add"]({ name: "Bad", "item-type": "invalid" }, [], "raid:add", mockProject);
			expect(renderError).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Invalid item-type") }));
		});

		it("does nothing without a project", () => {
			commands["raid:add"]({ name: "Test" }, [], "raid:add", undefined);
			expect(createRAIDItem).not.toHaveBeenCalled();
		});
	});

	describe("raid:update", () => {
		it("updates RAID item status with valid flags", () => {
			commands["raid:update"](
				{ name: "DB Migration Risk", status: "mitigated" },
				[], "raid:update", mockProject,
			);
			expect(updateRAIDStatus).toHaveBeenCalledWith(
				expect.any(Object), "/project", "DB Migration Risk", "mitigated", undefined,
			);
		});

		it("returns error when --name or --status is missing", () => {
			commands["raid:update"]({ name: "Test" }, [], "raid:update", mockProject);
			expect(renderError).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Missing") }));
		});

		it("returns error for invalid status", () => {
			commands["raid:update"]({ name: "Test", status: "invalid" }, [], "raid:update", mockProject);
			expect(renderError).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Invalid status") }));
		});
	});
});
