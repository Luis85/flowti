import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/domain/reports/pipeline/report-runner.js", () => ({
	runAllReports: vi.fn(),
}));
vi.mock("../../src/domain/reports/generator-registry.js", () => ({
	runGenerator: vi.fn(),
	runReference: vi.fn(() => ({ success: true, outputPath: "" })),
}));
vi.mock("../../src/ui/menus/report-archive-menu.js", () => ({
	browseArchive: vi.fn(),
}));
vi.mock("../../src/domain/reports/export/html-export.js", () => ({
	exportReportToHtml: vi.fn(),
}));
vi.mock("../../src/domain/reports/cli/report-service.js", () => ({
	ReportService: vi.fn().mockImplementation(() => ({
		reportsDir: "/mock/reports",
	})),
}));
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: { readdirSync: vi.fn(() => []), existsSync: vi.fn(() => false) },
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: { join: (...parts: string[]) => parts.join("/"), resolve: (...parts: string[]) => parts.join("/") },
}));
vi.mock("../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../mocks/mock-presets.js");
	return mockShellPreset();
});
vi.mock("../../src/infrastructure/input.js", () => ({
	input: { waitForEnter: vi.fn() },
}));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));
vi.mock("../../src/domain/project/project-deps.js", () => ({
	buildDependencyGraph: vi.fn(() => ({})),
}));
vi.mock("../../src/ui/deps-display.js", () => ({
	displayDependencyGraph: vi.fn(),
}));
vi.mock("../../src/ui/export-submenu.js", () => ({
	buildExportSubmenu: vi.fn(() => []),
	buildScaffoldSubmenu: vi.fn(() => []),
}));

import {
	buildReportsSubmenu,
	buildDocsSubmenu,
	buildNpmScriptsSubmenu,
	buildDepsSubmenu,
	buildDevToolsSubmenu,
} from "../../src/ui/menu-builders.js";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("buildReportsSubmenu", () => {
	it("returns Run All Reports entry when generators are provided", () => {
		const items = buildReportsSubmenu(
			[{ id: "test", label: "Test Report" }],
			"/project",
			"/reports",
		);
		expect(items[0].label).toBe("Run All Reports");
	});

	it("includes per-generator entries", () => {
		const items = buildReportsSubmenu(
			[{ id: "test", label: "Test Report" }, { id: "coverage", label: "Coverage Report" }],
			"/project",
			"/reports",
		);
		const labels = items.filter(i => "label" in i).map(i => i.label);
		expect(labels).toContain("Test Report");
		expect(labels).toContain("Coverage Report");
	});

	it("includes Export to HTML and Browse Archive entries", () => {
		const items = buildReportsSubmenu([], "/project", "/reports");
		const labels = items.filter(i => "label" in i).map(i => i.label);
		expect(labels).toContain("Export to HTML");
		expect(labels).toContain("Browse Archive");
	});

	it("includes Back entry", () => {
		const items = buildReportsSubmenu([], "/project", "/reports");
		const back = items.find(i => "label" in i && i.label === "Back");
		expect(back).toBeDefined();
	});

	it("handles generator with command instead of id", async () => {
		const items = buildReportsSubmenu(
			[{ label: "Custom Report", command: "node report.js" }],
			"/project",
			"/reports",
		);
		const entry = items.find(i => "label" in i && i.label === "Custom Report");
		expect(entry).toBeDefined();
	});
});

describe("buildDocsSubmenu", () => {
	const refs = [
		{ id: "cli-reference", label: "CLI Reference" },
		{ id: "entity-reference", label: "Entity Reference" },
	];

	it("includes Update References entry when references are configured", () => {
		const items = buildDocsSubmenu([], refs, "/project");
		expect(items[0].label).toBe("Update References");
	});

	it("includes Open entries for each reference", () => {
		const items = buildDocsSubmenu([], refs, "/project");
		const labels = items.filter(i => "label" in i).map(i => i.label);
		expect(labels).toContain("Open CLI Reference");
		expect(labels).toContain("Open Entity Reference");
	});

	it("includes config generators", () => {
		const items = buildDocsSubmenu(
			[{ label: "API Docs", command: "npm run docs:api" }],
			refs,
			"/project",
		);
		const labels = items.filter(i => "label" in i).map(i => i.label);
		expect(labels).toContain("API Docs");
	});

	it("includes Back entry", () => {
		const items = buildDocsSubmenu([], refs, "/project");
		const back = items.find(i => "label" in i && i.label === "Back");
		expect(back).toBeDefined();
	});

	it("shows Events, Dependencies, and Back when no references and no generators", () => {
		const items = buildDocsSubmenu([], [], "/project");
		const labels = items.filter(i => "label" in i).map(i => i.label);
		expect(labels).toEqual(["Events", "Dependencies", "Back"]);
	});
});

describe("buildNpmScriptsSubmenu", () => {
	it("creates entry for each script", () => {
		const items = buildNpmScriptsSubmenu("/project", { build: "tsc", test: "vitest" });
		const labels = items.filter(i => "label" in i).map(i => i.label);
		expect(labels).toContain("npm run build");
		expect(labels).toContain("npm run test");
	});

	it("includes Back entry", () => {
		const items = buildNpmScriptsSubmenu("/project", {});
		const back = items.find(i => "label" in i && i.label === "Back");
		expect(back).toBeDefined();
	});
});

describe("buildDepsSubmenu", () => {
	it("includes Show Dependency Graph entry", () => {
		const items = buildDepsSubmenu("/project");
		expect(items[0].label).toBe("Show Dependency Graph");
	});

	it("includes Back entry", () => {
		const items = buildDepsSubmenu("/project");
		const back = items.find(i => "label" in i && i.label === "Back");
		expect(back).toBeDefined();
	});
});

describe("buildDevToolsSubmenu", () => {
	it("includes Type Check, Lint, Reload, Dev Console entries", () => {
		const items = buildDevToolsSubmenu("/project", {});
		const labels = items.filter(i => "label" in i).map(i => i.label);
		expect(labels).toContain("Type Check + Lint");
		expect(labels).toContain("Lint Only");
		expect(labels).toContain("Reload Plugin");
		expect(labels).toContain("Dev Console");
	});

	it("includes Rebuild CLI entry", () => {
		const items = buildDevToolsSubmenu("/project", {});
		const labels = items.filter(i => "label" in i).map(i => i.label);
		expect(labels).toContain("Rebuild CLI");
	});

	it("includes Npm Scripts entry", () => {
		const items = buildDevToolsSubmenu("/project", { test: "vitest" });
		const labels = items.filter(i => "label" in i).map(i => i.label);
		expect(labels).toContain("Npm Scripts");
	});

	it("uses npm run check when scripts.check exists", async () => {
		const items = buildDevToolsSubmenu("/project", { check: "npm run check" });
		const entry = items.find(i => "label" in i && i.label === "Type Check + Lint");
		expect(entry).toBeDefined();
	});
});
