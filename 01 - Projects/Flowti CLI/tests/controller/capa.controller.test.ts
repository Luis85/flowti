/**
 * capa.controller.test.ts — Tests for CAPA management commands.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come BEFORE imports) ─────────────────────────────

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
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
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-10T00:00:00.000Z", now: () => new Date("2026-03-10"), ms: () => 0, safeIso: () => "" },
}));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
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
vi.mock("../../src/domain/capa/capa-store.js", () => ({
	listCAPAItems: vi.fn(() => [
		{ id: "CAPA-001", name: "Process Failure", type: "corrective", status: "open", severity: "high" },
		{ id: "CAPA-002", name: "Risk Mitigation", type: "preventive", status: "investigating", severity: "medium" },
	]),
	createCAPAItem: vi.fn(() => "/project/docs/capa/CAPA-003.md"),
	updateCAPAStatus: vi.fn(() => true),
	nextCapaId: vi.fn(() => "CAPA-003"),
}));

// Mock UI modules
vi.mock("../../src/ui/capa-display.js", () => ({
	renderCAPAList: vi.fn(),
	renderCAPAAdded: vi.fn(),
	renderCAPAUpdated: vi.fn(),
}));
vi.mock("../../src/ui/common-renderers.js", () => ({
	renderError: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/capa.controller.js";
import { initializeDeps } from "../../src/infrastructure/request-response.js";
import { listCAPAItems, createCAPAItem, updateCAPAStatus } from "../../src/domain/capa/capa-store.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { shell } from "../../src/infrastructure/shell.js";
import { clock } from "../../src/infrastructure/clock.js";
import { proc } from "../../src/infrastructure/proc.js";
import { log } from "../../src/infrastructure/logger.js";

const logMock = log as ReturnType<typeof vi.fn>;

const mockProject = {
	name: "test",
	path: "/project",
	config: { name: "test", reports: { generators: [] }, management: { capa: {} } },
	scripts: {},
	pkg: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("capa.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, shell, paths, clock, proc,
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
		});
	});

	// ── capa:list ────────────────────────────────────────────────
	describe("capa:list", () => {
		it("calls listCAPAItems with project path", () => {
			commands["capa:list"]({}, [], "capa:list", mockProject);

			expect(listCAPAItems).toHaveBeenCalledOnce();
			expect(listCAPAItems).toHaveBeenCalledWith(
				expect.any(Object), "/project", mockProject.config.management.capa,
			);
		});

		it("returns CAPA items as JSON", () => {
			commands["capa:list"]({ format: "json" }, [], "capa:list", mockProject);

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(Array.isArray(output)).toBe(true);
			expect(output).toHaveLength(2);
			expect(output[0]).toHaveProperty("id", "CAPA-001");
		});

		it("returns undefined when no project", () => {
			commands["capa:list"]({}, [], "capa:list", undefined);

			expect(listCAPAItems).not.toHaveBeenCalled();
		});
	});

	// ── capa:add ─────────────────────────────────────────────────
	describe("capa:add", () => {
		it("creates a CAPA item with provided flags", () => {
			commands["capa:add"](
				{ name: "Process Failure", "capa-type": "corrective", severity: "high" },
				[], "capa:add", mockProject,
			);

			expect(createCAPAItem).toHaveBeenCalledOnce();
			expect(createCAPAItem).toHaveBeenCalledWith(
				expect.any(Object), "/project",
				expect.objectContaining({
					name: "Process Failure",
					capaType: "corrective",
					severity: "high",
					status: "open",
				}),
				mockProject.config.management.capa,
			);
		});

		it("returns error when --name flag is missing", () => {
			commands["capa:add"]({ format: "json" }, [], "capa:add", mockProject);

			expect(createCAPAItem).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("error");
			expect(output.error).toContain("--name");
		});

		it("returns error for invalid capa-type", () => {
			commands["capa:add"](
				{ name: "Test", "capa-type": "invalid", format: "json" },
				[], "capa:add", mockProject,
			);

			expect(createCAPAItem).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.error).toContain("invalid");
		});

		it("defaults to corrective type when capa-type is not provided", () => {
			commands["capa:add"](
				{ name: "Default Type" },
				[], "capa:add", mockProject,
			);

			expect(createCAPAItem).toHaveBeenCalledWith(
				expect.any(Object), "/project",
				expect.objectContaining({ capaType: "corrective" }),
				mockProject.config.management.capa,
			);
		});

		it("returns undefined when no project", () => {
			commands["capa:add"]({ name: "Test" }, [], "capa:add", undefined);

			expect(createCAPAItem).not.toHaveBeenCalled();
		});
	});

	// ── capa:update ──────────────────────────────────────────────
	describe("capa:update", () => {
		it("updates CAPA status with provided flags", () => {
			commands["capa:update"](
				{ name: "Process Failure", status: "investigating" },
				[], "capa:update", mockProject,
			);

			expect(updateCAPAStatus).toHaveBeenCalledOnce();
			expect(updateCAPAStatus).toHaveBeenCalledWith(
				expect.any(Object), "/project",
				"Process Failure", "investigating",
				mockProject.config.management.capa,
			);
		});

		it("returns error when --name or --status is missing", () => {
			commands["capa:update"](
				{ name: "Test", format: "json" },
				[], "capa:update", mockProject,
			);

			expect(updateCAPAStatus).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.error).toContain("--name");
		});

		it("returns error for invalid status", () => {
			commands["capa:update"](
				{ name: "Test", status: "invalid-status", format: "json" },
				[], "capa:update", mockProject,
			);

			expect(updateCAPAStatus).not.toHaveBeenCalled();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output.error).toContain("invalid-status");
		});

		it("returns undefined when no project", () => {
			commands["capa:update"](
				{ name: "Test", status: "closed" },
				[], "capa:update", undefined,
			);

			expect(updateCAPAStatus).not.toHaveBeenCalled();
		});
	});
});
