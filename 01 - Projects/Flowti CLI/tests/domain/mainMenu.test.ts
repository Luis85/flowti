import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../mocks/mock-shell.js";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../src/domain/make/make.js", () => ({
	menu: vi.fn(() => "main"),
}));

vi.mock("../../src/domain/make/component/component-list.js", () => ({
	componentListMenu: vi.fn(() => "main"),
}));

vi.mock("../../src/domain/publish/project-publish.js", () => ({
	publishMenu: vi.fn(() => "main"),
}));

vi.mock("../../src/domain/review/project-review.js", () => ({
	reviewMenu: vi.fn(() => "main"),
}));

vi.mock("../../src/domain/info/info.js", () => ({
	showInfo: vi.fn(),
}));

vi.mock("../../src/ui/help.js", () => ({
	showHelp: vi.fn(),
}));

vi.mock("../../src/domain/capture/capture.js", () => ({
	captureIdea: vi.fn(() => "main"),
	captureNote: vi.fn(() => "main"),
	captureBug: vi.fn(() => "main"),
}));

vi.mock("../../src/domain/knowledgebase/knowledgebase.js", () => ({
	knowledgebaseMenu: vi.fn(() => "main"),
	isKnowledgebaseAvailable: vi.fn(() => true),
}));

vi.mock("../../src/domain/health/health.js", () => ({
	collectHealth: vi.fn(() => ({})),
	displayHealth: vi.fn(),
}));

vi.mock("../../src/domain/events/events.js", () => ({
	eventCatalogMenu: vi.fn(() => "main"),
}));

vi.mock("../../src/domain/reports/cli/generate-build-report.js", () => ({
	buildWithReport: vi.fn(),
}));

vi.mock("../../src/domain/reports/report-runner.js", () => ({
	runAllReports: vi.fn(() => ({ generators: [], totalDurationMs: 0, passed: 0, failed: 0 })),
}));

vi.mock("../../src/domain/reports/generator-registry.js", () => ({
	runGenerator: vi.fn(() => ({ success: true, outputPath: "", metrics: {} })),
	hasGenerator: vi.fn(() => true),
}));

vi.mock("../../src/domain/reports/reference-registry.js", () => ({
	runReference: vi.fn(() => ({ success: true, outputPath: "", metrics: {} })),
	hasReference: vi.fn(() => true),
}));

vi.mock("../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../src/infrastructure/state.js", () => ({
	getSelectedProject: vi.fn(),
}));

vi.mock("../../src/domain/project/project-config.js", () => ({
	initializeProject: vi.fn(),
	getReportsDir: vi.fn(() => "/projects/my-project/reports"),
}));

vi.mock("../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(), askYesNo: vi.fn(), waitForEnter: vi.fn(() => Promise.resolve()) },
}));

vi.mock("../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

vi.mock("../../src/infrastructure/types.js", async () => {
	return {};
});

// ── Imports (after mocks) ────────────────────────────────────────────

import * as shellMod from "../../src/infrastructure/shell.js";
import { getSelectedProject } from "../../src/infrastructure/state.js";
import { initializeProject } from "../../src/domain/project/project-config.js";
import { buildProjectDetailMenu } from "../../src/ui/mainMenu.js";
import { showInfo } from "../../src/domain/info/info.js";
import { showHelp } from "../../src/ui/help.js";
import { buildWithReport } from "../../src/domain/reports/cli/generate-build-report.js";
import { isKnowledgebaseAvailable } from "../../src/domain/knowledgebase/knowledgebase.js";
import { runMenu } from "../../src/infrastructure/menu.js";
import type { MenuItem, MenuSeparator, MenuEntry } from "../../src/infrastructure/types.js";

const mockGetSelected = vi.mocked(getSelectedProject);
const mockInitProject = vi.mocked(initializeProject);
const mockRunMenu = vi.mocked(runMenu);

// ── Helpers ──────────────────────────────────────────────────────────

function isMenuItem(entry: MenuEntry): entry is MenuItem {
	return !("separator" in entry);
}

function findItem(entries: MenuEntry[], key: string): MenuItem | undefined {
	return entries.filter(isMenuItem).find((e) => e.key === key);
}

// ── Tests ────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.clearAllMocks();
});

describe("buildProjectDetailMenu", () => {
	describe("fallback menu (no selected project)", () => {
		it("returns fallback menu when no project is selected", () => {
			mockGetSelected.mockReturnValue(null);

			const items = buildProjectDetailMenu();
			const menuItems = items.filter(isMenuItem);

			expect(menuItems.some((m) => m.key === "i")).toBe(true);
			expect(menuItems.some((m) => m.key === "?")).toBe(true);
			expect(menuItems.some((m) => m.key === "b")).toBe(true);
			expect(menuItems.some((m) => m.key === "q")).toBe(true);
		});

		it("fallback Info action calls showInfo and returns 'main'", () => {
			mockGetSelected.mockReturnValue(null);
			const items = buildProjectDetailMenu();
			const info = findItem(items, "i")!;
			const result = info.action();
			expect(showInfo).toHaveBeenCalled();
			expect(result).toBe("main");
		});

		it("fallback Help action calls showHelp and returns 'main'", () => {
			mockGetSelected.mockReturnValue(null);
			const items = buildProjectDetailMenu();
			const help = findItem(items, "?")!;
			const result = help.action();
			expect(showHelp).toHaveBeenCalledWith("main");
			expect(result).toBe("main");
		});

		it("fallback Back returns 'start'", () => {
			mockGetSelected.mockReturnValue(null);
			const items = buildProjectDetailMenu();
			const back = findItem(items, "b")!;
			expect(back.action()).toBe("start");
		});

		it("fallback Quit returns 'quit'", () => {
			mockGetSelected.mockReturnValue(null);
			const items = buildProjectDetailMenu();
			const quit = findItem(items, "q")!;
			expect(quit.action()).toBe("quit");
		});
	});

	describe("project detail menu", () => {
		function setupProject(overrides: {
			tools?: Record<string, string>;
			scripts?: Record<string, string>;
			reports?: Record<string, unknown>;
			docs?: Record<string, unknown>;
			review?: Record<string, unknown>;
			publish?: Record<string, unknown>;
			components?: unknown;
		} = {}) {
			mockGetSelected.mockReturnValue("my-project");
			const ctx = {
				path: "/projects/my-project",
				pkg: { name: "my-project", scripts: overrides.scripts ?? {} },
				config: {
					name: "my-project",
					tools: overrides.tools ?? {},
					reports: overrides.reports,
					docs: overrides.docs,
					review: overrides.review,
					publish: overrides.publish,
					components: overrides.components,
				},
				scripts: overrides.scripts ?? {},
			};
			mockInitProject.mockReturnValue(ctx as ReturnType<typeof initializeProject>);
			return ctx;
		}

		// ── Capture section (keys 1-3) ──────────────────────────────

		it("includes Capture Idea, Capture Note, Capture Bug items", () => {
			setupProject();
			const items = buildProjectDetailMenu();
			expect(findItem(items, "1")!.label).toBe("Capture Idea");
			expect(findItem(items, "2")!.label).toBe("Capture Note");
			expect(findItem(items, "3")!.label).toBe("Capture Bug");
		});

		// ── Core workflow (keys 4-8) ────────────────────────────────

		it("includes Make, Build, Review, Publish, Reports items", () => {
			setupProject();
			const items = buildProjectDetailMenu();
			expect(findItem(items, "4")!.label).toBe("Make");
			expect(findItem(items, "5")!.label).toBe("Build");
			expect(findItem(items, "6")!.label).toBe("Review");
			expect(findItem(items, "7")!.label).toBe("Publish");
			expect(findItem(items, "8")!.label).toBe("Reporting");
		});

		it("Build is disabled when no build tool is mapped", () => {
			setupProject({ tools: {} });
			const items = buildProjectDetailMenu();
			const build = findItem(items, "5")!;
			expect(build.disabled).toBe(true);
			expect(build.action()).toBe("main");
		});

		it("Build calls buildWithReport when build tool is mapped", async () => {
			setupProject({ tools: { build: "npm run build" } });
			const items = buildProjectDetailMenu();
			const build = findItem(items, "5")!;
			expect(build.disabled).toBeUndefined();
			const result = await build.action();
			expect(buildWithReport).toHaveBeenCalledWith("npm run build", "/projects/my-project");
			expect(result).toBe("main");
		});

		// ── Project management section ──────────────────────────────

		it("Npm Scripts is no longer in the main menu (moved to Dev Tools)", () => {
			setupProject({ scripts: { test: "vitest" } });
			const items = buildProjectDetailMenu();
			const scripts = findItem(items, "n");
			expect(scripts).toBeUndefined();
		});

		// ── Reports submenu ─────────────────────────────────────────

		it("Reports submenu includes Run All when generators are configured", async () => {
			setupProject({ reports: { generators: [{ id: "test", label: "Test" }] } });
			const items = buildProjectDetailMenu();
			const reports = findItem(items, "8")!;

			await reports.action();

			const submenuItems = (mockRunMenu.mock.calls[0][1] as MenuEntry[]).filter(isMenuItem);
			expect(submenuItems.some((m) => m.label === "Run All Reports")).toBe(true);
		});

		it("Reports submenu omits Run All when no generators", async () => {
			setupProject({ reports: {} });
			const items = buildProjectDetailMenu();
			const reports = findItem(items, "8")!;

			await reports.action();

			const submenuItems = (mockRunMenu.mock.calls[0][1] as MenuEntry[]).filter(isMenuItem);
			expect(submenuItems.some((m) => m.label === "Run All Reports")).toBe(false);
		});

		it("Reports submenu includes individual generators", async () => {
			setupProject({
				reports: {
					generators: [
						{ id: "test", label: "Test Report" },
						{ id: "coverage", label: "Coverage" },
					],
				},
			});
			const items = buildProjectDetailMenu();
			const reports = findItem(items, "8")!;

			await reports.action();

			const submenuItems = (mockRunMenu.mock.calls[0][1] as MenuEntry[]).filter(isMenuItem);
			expect(submenuItems.some((m) => m.label === "Test Report")).toBe(true);
			expect(submenuItems.some((m) => m.label === "Coverage")).toBe(true);
		});

		it("Reports generator key offsets by 2 when Run All present", async () => {
			const sh = createMockShell();
			Object.assign(shellMod, { shell: sh });
			setupProject({
				reports: {
					generators: [{ id: "test", label: "Test" }],
				},
			});
			const items = buildProjectDetailMenu();
			await findItem(items, "8")!.action();

			const submenuItems = (mockRunMenu.mock.calls[0][1] as MenuEntry[]).filter(isMenuItem);
			const runAll = submenuItems.find((m) => m.label === "Run All Reports")!;
			expect(runAll.key).toBe("1");
			const testReport = submenuItems.find((m) => m.label === "Test")!;
			expect(testReport.key).toBe("2");
		});

		it("Reports Run All action calls runAllReports", async () => {
			setupProject({
				reports: {
					generators: [{ id: "test", label: "Test" }],
				},
			});
			const items = buildProjectDetailMenu();
			await findItem(items, "8")!.action();

			const submenuItems = (mockRunMenu.mock.calls[0][1] as MenuEntry[]).filter(isMenuItem);
			const runAll = submenuItems.find((m) => m.label === "Run All Reports")!;
			runAll.action();

			const { runAllReports } = await import("../../src/domain/reports/report-runner.js");
			expect(runAllReports).toHaveBeenCalledWith(
				[{ id: "test", label: "Test" }],
				expect.any(String),
			);
		});

		// ── Documentation submenu ───────────────────────────────────

		it("Update Documentation is always available even without docs config", async () => {
			setupProject({ docs: undefined });
			const items = buildProjectDetailMenu();
			const docs = findItem(items, "d")!;
			expect(docs.disabled).toBeUndefined();

			await docs.action();

			const submenuItems = (mockRunMenu.mock.calls[0][1] as MenuEntry[]).filter(isMenuItem);
			expect(submenuItems.some((m) => m.label === "Update All")).toBe(true);
			expect(submenuItems.some((m) => m.label === "Entity Reference")).toBe(true);
		});

		it("Update Documentation always shows Update All as first item", async () => {
			setupProject({ docs: { allCommand: "npm run docs:all" } });
			const items = buildProjectDetailMenu();
			await findItem(items, "d")!.action();

			const submenuItems = (mockRunMenu.mock.calls[0][1] as MenuEntry[]).filter(isMenuItem);
			expect(submenuItems[0].label).toBe("Update All");
			expect(submenuItems[0].key).toBe("1");
		});

		it("Update Documentation with generators lists them after Update All", async () => {
			setupProject({
				docs: {
					generators: [{ label: "API Docs", command: "npm run docs:api" }],
				},
			});
			const items = buildProjectDetailMenu();
			await findItem(items, "d")!.action();

			const submenuItems = (mockRunMenu.mock.calls[0][1] as MenuEntry[]).filter(isMenuItem);
			expect(submenuItems.some((m) => m.label === "API Docs")).toBe(true);
		});

		it("Update Documentation config generator key offsets after Update All", async () => {
			setupProject({
				docs: {
					allCommand: "npm run docs:all",
					generators: [{ label: "API", command: "npm run docs:api" }],
				},
			});
			const items = buildProjectDetailMenu();
			await findItem(items, "d")!.action();

			const submenuItems = (mockRunMenu.mock.calls[0][1] as MenuEntry[]).filter(isMenuItem);
			const gen = submenuItems.find((m) => m.label === "API")!;
			expect(gen.key).toBe("2");
		});

		it("Update Documentation includes CLI Reference and Entity Reference as built-in generators", async () => {
			setupProject({
				docs: {
					generators: [{ label: "API", command: "npm run docs:api" }],
				},
			});
			const items = buildProjectDetailMenu();
			await findItem(items, "d")!.action();

			const submenuItems = (mockRunMenu.mock.calls[0][1] as MenuEntry[]).filter(isMenuItem);
			const cliRef = submenuItems.find((m) => m.label === "CLI Reference")!;
			const entityRef = submenuItems.find((m) => m.label === "Entity Reference")!;
			expect(cliRef).toBeDefined();
			expect(cliRef.key).toBe("3");
			expect(entityRef).toBeDefined();
			expect(entityRef.key).toBe("4");
		});

		// ── Knowledgebase ───────────────────────────────────────────

		it("Knowledgebase disabled evaluator calls isKnowledgebaseAvailable", () => {
			vi.mocked(isKnowledgebaseAvailable).mockReturnValue(false);
			setupProject();
			const items = buildProjectDetailMenu();
			const kb = findItem(items, "k")!;
			const disabledFn = kb.disabled as () => boolean;
			expect(disabledFn()).toBe(true);
		});

		// ── Advanced tools section ──────────────────────────────────

		it("includes Components, Events, Dependencies, Dev Tools items", () => {
			setupProject();
			const items = buildProjectDetailMenu();
			expect(findItem(items, "c")!.label).toBe("Components");
			expect(findItem(items, "e")!.label).toBe("Events");
			expect(findItem(items, "g")!.label).toBe("Dependencies");
			expect(findItem(items, "t")!.label).toBe("Dev Tools");
			expect(findItem(items, "s")).toBeUndefined();
			expect(findItem(items, "x")).toBeUndefined();
		});

		// ── Health ──────────────────────────────────────────────────

		it("includes Health item with key 'h'", () => {
			setupProject();
			const items = buildProjectDetailMenu();
			const health = findItem(items, "h")!;
			expect(health.label).toBe("Health");
		});

		// ── Navigation ──────────────────────────────────────────────

		it("includes Info, Help, Back, Quit navigation items", () => {
			setupProject();
			const items = buildProjectDetailMenu();
			expect(findItem(items, "i")!.label).toBe("Info");
			expect(findItem(items, "?")!.label).toBe("Help");
			expect(findItem(items, "b")!.label).toContain("Back");
			expect(findItem(items, "q")!.label).toBe("Quit");
		});

		it("Info action calls showInfo and returns 'main'", async () => {
			setupProject();
			const items = buildProjectDetailMenu();
			const result = await findItem(items, "i")!.action();
			expect(showInfo).toHaveBeenCalled();
			expect(result).toBe("main");
		});

		it("Help action calls showHelp and returns 'main'", () => {
			setupProject();
			const items = buildProjectDetailMenu();
			const result = findItem(items, "?")!.action();
			expect(showHelp).toHaveBeenCalledWith("main");
			expect(result).toBe("main");
		});

		it("includes separators in the menu", () => {
			setupProject();
			const items = buildProjectDetailMenu();
			const separators = items.filter((e): e is MenuSeparator => "separator" in e);
			expect(separators.length).toBeGreaterThanOrEqual(2);
		});
	});
});
