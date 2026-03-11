import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../mocks/mock-shell.js";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../src/domain/reports/report-runner.js", () => ({
	runAllReports: vi.fn(() => ({ generators: [], totalDurationMs: 0, passed: 0, failed: 0 })),
}));

vi.mock("../../src/domain/reports/generator-registry.js", () => ({
	runGenerator: vi.fn(() => ({ success: true, outputPath: "", metrics: {} })),
	runReference: vi.fn(() => ({ success: true, outputPath: "" })),
}));

vi.mock("../../src/ui/menus/report-archive-menu.js", () => ({
	browseArchive: vi.fn(() => "main"),
}));

vi.mock("../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../src/infrastructure/input.js", () => ({
	input: { waitForEnter: vi.fn(() => Promise.resolve()) },
}));

vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", GREEN: "", RED: "",
}));

const mockDefaultDeps = { disk: {}, paths: {}, clock: {}, log: () => {} };
vi.mock("../../src/infrastructure/deps.js", () => ({
	createDefaultDeps: () => mockDefaultDeps,
}));

// ── Imports (after mocks) ────────────────────────────────────────────

import * as shellMod from "../../src/infrastructure/shell.js";
import { buildReportsSubmenu, buildDocsSubmenu, buildNpmScriptsSubmenu } from "../../src/ui/menu-builders.js";
import { runAllReports } from "../../src/domain/reports/report-runner.js";
import { runGenerator } from "../../src/domain/reports/generator-registry.js";
import { runReference } from "../../src/domain/reports/generator-registry.js";
import { browseArchive } from "../../src/ui/menus/report-archive-menu.js";
import type { MenuItem, MenuEntry } from "../../src/infrastructure/types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function isMenuItem(entry: MenuEntry): entry is MenuItem {
	return !("separator" in entry);
}

function findItem(entries: MenuEntry[], key: string): MenuItem | undefined {
	return entries.filter(isMenuItem).find((e) => e.key === key);
}

function findByLabel(entries: MenuEntry[], label: string): MenuItem | undefined {
	return entries.filter(isMenuItem).find((e) => e.label === label);
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ── buildReportsSubmenu ──────────────────────────────────────────────

describe("buildReportsSubmenu", () => {
	it("includes Run All when generators are provided", () => {
		const items = buildReportsSubmenu(
			[{ id: "test", label: "Test" }], "/proj", "/proj/reports",
		);
		expect(findByLabel(items, "Run All Reports")).toBeDefined();
	});

	it("omits Run All when no generators", () => {
		const items = buildReportsSubmenu([], "/proj", "/proj/reports");
		expect(findByLabel(items, "Run All Reports")).toBeUndefined();
	});

	it("Run All action calls runAllReports with generators and path", async () => {
		const gens = [{ id: "test", label: "Test" }];
		const items = buildReportsSubmenu(gens, "/proj", "/proj/reports");
		const runAll = findByLabel(items, "Run All Reports")!;
		const result = await runAll.action();
		expect(runAllReports).toHaveBeenCalledWith(gens, "/proj", expect.anything());
		expect(result).toBe("main");
	});

	it("lists individual generators with offset keys", () => {
		const gens = [
			{ id: "test", label: "Test Report" },
			{ id: "coverage", label: "Coverage" },
		];
		const items = buildReportsSubmenu(gens, "/proj", "/proj/reports");
		// Run All = key "1", generators start at "2"
		expect(findItem(items, "2")!.label).toBe("Test Report");
		expect(findItem(items, "3")!.label).toBe("Coverage");
	});

	it("generator keys start at 1 when no Run All", () => {
		const items = buildReportsSubmenu([], "/proj", "/proj/reports");
		// No Run All, so first items are Export to HTML and Browse Archive
		const menuItems = items.filter(isMenuItem);
		expect(menuItems[0].label).toBe("Export to HTML");
		expect(menuItems[1].label).toBe("Browse Archive");
	});

	it("generator with id calls runGenerator", async () => {
		const items = buildReportsSubmenu(
			[{ id: "test", label: "Test" }], "/proj", "/proj/reports",
		);
		const gen = findByLabel(items, "Test")!;
		await gen.action();
		expect(runGenerator).toHaveBeenCalledWith("test", "/proj", mockDefaultDeps);
	});

	it("generator with command calls shell.run", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const items = buildReportsSubmenu(
			[{ command: "npm run custom", label: "Custom" }], "/proj", "/proj/reports",
		);
		const gen = findByLabel(items, "Custom")!;
		await gen.action();
		expect(sh.calls[0].cmd).toBe("npm run custom");
	});

	it("includes Browse Archive item with reportsDir", () => {
		const items = buildReportsSubmenu([], "/proj", "/proj/reports");
		const archive = findByLabel(items, "Browse Archive")!;
		archive.action();
		expect(browseArchive).toHaveBeenCalledWith("/proj/reports");
	});

	it("includes Back item returning 'main'", () => {
		const items = buildReportsSubmenu([], "/proj", "/proj/reports");
		const back = findItem(items, "b")!;
		expect(back.action()).toBe("main");
	});

	it("includes separators", () => {
		const items = buildReportsSubmenu([], "/proj", "/proj/reports");
		const seps = items.filter((e) => "separator" in e);
		expect(seps.length).toBeGreaterThanOrEqual(2);
	});
});

// ── buildDocsSubmenu ─────────────────────────────────────────────────

describe("buildDocsSubmenu", () => {
	it("always includes Update All as key 1", () => {
		const items = buildDocsSubmenu([], undefined, "/proj");
		const updateAll = findItem(items, "1")!;
		expect(updateAll.label).toBe("Update All");
	});

	it("Update All runs allCommand when provided", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const items = buildDocsSubmenu([], "npm run docs:all", "/proj");
		findItem(items, "1")!.action();
		expect(sh.calls.some((c) => c.cmd === "npm run docs:all")).toBe(true);
	});

	it("Update All runs config generators", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const gens = [{ label: "API", command: "npm run docs:api" }];
		const items = buildDocsSubmenu(gens, undefined, "/proj");
		findItem(items, "1")!.action();
		expect(sh.calls.some((c) => c.cmd === "npm run docs:api")).toBe(true);
	});

	it("Update All runs built-in reference generators", () => {
		const items = buildDocsSubmenu([], undefined, "/proj");
		findItem(items, "1")!.action();
		expect(runReference).toHaveBeenCalledWith("cli-reference", "/proj", mockDefaultDeps);
		expect(runReference).toHaveBeenCalledWith("entity-reference", "/proj", mockDefaultDeps);
	});

	it("lists config generators after separator", () => {
		const gens = [{ label: "API Docs", command: "npm run docs:api" }];
		const items = buildDocsSubmenu(gens, undefined, "/proj");
		expect(findByLabel(items, "API Docs")).toBeDefined();
	});

	it("config generator keys start at 2", () => {
		const gens = [{ label: "API", command: "npm run docs:api" }];
		const items = buildDocsSubmenu(gens, undefined, "/proj");
		expect(findItem(items, "2")!.label).toBe("API");
	});

	it("includes CLI Reference and Entity Reference as built-in items", () => {
		const items = buildDocsSubmenu([], undefined, "/proj");
		expect(findByLabel(items, "CLI Reference")).toBeDefined();
		expect(findByLabel(items, "Entity Reference")).toBeDefined();
	});

	it("built-in doc action calls runReference", () => {
		const items = buildDocsSubmenu([], undefined, "/proj");
		findByLabel(items, "CLI Reference")!.action();
		expect(runReference).toHaveBeenCalledWith("cli-reference", "/proj", mockDefaultDeps);
	});

	it("includes Back item", () => {
		const items = buildDocsSubmenu([], undefined, "/proj");
		const back = findItem(items, "b")!;
		expect(back.action()).toBe("main");
	});

	it("key numbering is sequential across config + built-in generators", () => {
		const gens = [{ label: "API", command: "cmd" }];
		const items = buildDocsSubmenu(gens, undefined, "/proj");
		// 1=Update All, 2=API, 3=CLI Reference, 4=Entity Reference
		expect(findItem(items, "3")!.label).toBe("CLI Reference");
		expect(findItem(items, "4")!.label).toBe("Entity Reference");
	});
});

// ── buildNpmScriptsSubmenu ───────────────────────────────────────────

describe("buildNpmScriptsSubmenu", () => {
	it("creates an item for each script", () => {
		const items = buildNpmScriptsSubmenu("/proj", { test: "vitest", lint: "eslint ." });
		expect(findByLabel(items, "npm run test")).toBeDefined();
		expect(findByLabel(items, "npm run lint")).toBeDefined();
	});

	it("script keys are sequential starting at 1", () => {
		const items = buildNpmScriptsSubmenu("/proj", { test: "vitest", lint: "eslint ." });
		expect(findItem(items, "1")!.label).toBe("npm run test");
		expect(findItem(items, "2")!.label).toBe("npm run lint");
	});

	it("script action runs the command via shell", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const items = buildNpmScriptsSubmenu("/proj", { test: "vitest" });
		findByLabel(items, "npm run test")!.action();
		expect(sh.calls[0].cmd).toBe("npm run test");
		expect(sh.calls[0].opts).toEqual({ cwd: "/proj", label: "test" });
	});

	it("script action returns undefined to stay in submenu", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const items = buildNpmScriptsSubmenu("/proj", { test: "vitest" });
		expect(findByLabel(items, "npm run test")!.action()).toBeUndefined();
	});

	it("returns empty scripts with just Back", () => {
		const items = buildNpmScriptsSubmenu("/proj", {});
		const menuItems = items.filter(isMenuItem);
		expect(menuItems.length).toBe(1);
		expect(menuItems[0].label).toBe("Back");
	});

	it("includes Back item returning 'main'", () => {
		const items = buildNpmScriptsSubmenu("/proj", { test: "vitest" });
		const back = findItem(items, "b")!;
		expect(back.action()).toBe("main");
	});
});
