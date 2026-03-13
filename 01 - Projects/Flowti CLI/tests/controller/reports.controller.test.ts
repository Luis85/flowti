/**
 * reports.controller.test.ts — Tests for the reports controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../mocks/mock-presets.js");
	return mockShellPreset();
});
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => "# Report\nlines: 100\n"),
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
		dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/")),
		basename: vi.fn((p: string) => p.split("/").pop() ?? p),
	},
}));
vi.mock("../../src/domain/reports/pipeline/report-runner.js", () => ({
	runAllReports: vi.fn(async () => ({ passed: 3, failed: 0, totalDurationMs: 42 })),
}));
vi.mock("../../src/domain/reports/pipeline/doc-runner.js", () => ({
	runAllDocs: vi.fn(async () => ({ passed: 0, failed: 0, totalDurationMs: 0 })),
}));
vi.mock("../../src/domain/reports/generator-registry.js", () => ({
	runGenerator: vi.fn(),
	hasGenerator: vi.fn(() => false),
}));
vi.mock("../../src/infrastructure/deps.js", () => ({
	createDefaultDeps: () => ({ disk: {}, paths: {}, clock: {}, log: () => {} }),
}));
vi.mock("../../src/domain/reports/cli/report-service.js", () => ({
	ReportService: class {
		reportsDir: string;
		constructor(projectPath: string, _deps?: unknown) {
			this.reportsDir = `${projectPath}/reports`;
		}
	},
}));
vi.mock("../../src/domain/reports/export/report-archive.js", () => ({
	discoverArchiveCategories: vi.fn(() => []),
}));
vi.mock("../../src/domain/reports/export/report-diff.js", () => ({
	diffReports: vi.fn(() => ({ deltas: [] })),
}));
vi.mock("../../src/domain/reports/export/html-export.js", () => ({
	exportReportToHtml: vi.fn(() => ({ title: "Test Report", outputPath: "/out/test.html" })),
}));
vi.mock("../../src/ui/displays/reports-display.js", () => ({
	renderNoGenerators: vi.fn(),
	renderAuditResult: vi.fn(),
	renderReportDiff: vi.fn(),
	renderHtmlExport: vi.fn(),
	renderUnknownReport: vi.fn(),
	renderReportRun: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderNoProject: vi.fn(),
	renderError: vi.fn(),
	renderShellCommand: vi.fn(),
	renderSuccess: vi.fn(),
}));

import { commands } from "../../src/controller/reports.controller.js";
import { initializeDeps } from "../../src/infrastructure/request-response.js";
import { runAllReports } from "../../src/domain/reports/pipeline/report-runner.js";
import { discoverArchiveCategories } from "../../src/domain/reports/export/report-archive.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { shell } from "../../src/infrastructure/shell.js";
import { log } from "../../src/infrastructure/logger.js";

const mockProject = {
	path: "/project",
	pkg: { name: "test", version: "1.0.0" },
	config: {
		name: "test",
		build: { commands: {} },
		test: { commands: {} },
		reports: { generators: [] },
		health: {},
	},
	scripts: {},
};

const mockProjectWithGenerators = {
	...mockProject,
	config: {
		...mockProject.config,
		reports: {
			generators: [
				{ id: "test", label: "Test Report" },
				{ id: "coverage", label: "Coverage Report" },
			],
		},
	},
};

describe("reports.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, shell, paths,
			clock: { iso: () => "", now: () => new Date(), ms: () => 0, safeIso: () => "" },
			proc: { exit: vi.fn() as never, argv: () => [], cwd: () => "/", env: () => ({}) },
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
		});
	});

	// ── reports (no generators) ───────────────────────────────────
	describe("reports", () => {
		it("returns noGenerators message when no generators configured", () => {
			// Synchronous return path — no generators means no await needed
			const result = commands["reports"]({}, [], "reports", mockProject);
			// The adapt wrapper calls handleResponse which calls renderNoGenerators
			// We verify indirectly: runAllReports should NOT be called
			expect(runAllReports).not.toHaveBeenCalled();
		});

		it("calls runAllReports when generators are configured", async () => {
			await commands["reports"]({}, [], "reports", mockProjectWithGenerators);
			expect(runAllReports).toHaveBeenCalled();
		});
	});

	// ── reports:audit ─────────────────────────────────────────────
	describe("reports:audit", () => {
		it("returns noGenerators when no generators configured", () => {
			commands["reports:audit"]({}, [], "reports:audit", mockProject);
			expect(runAllReports).not.toHaveBeenCalled();
		});

		it("calls runAllReports and returns audit result", async () => {
			await commands["reports:audit"]({}, [], "reports:audit", mockProjectWithGenerators);
			expect(runAllReports).toHaveBeenCalled();
		});
	});

	// ── reports:diff ──────────────────────────────────────────────
	describe("reports:diff", () => {
		it("returns noProject when no project provided", () => {
			commands["reports:diff"]({}, [], "reports:diff", undefined);
			// Should not throw — returns noProject response
		});

		it("returns no-archives message when no categories found", () => {
			vi.mocked(discoverArchiveCategories).mockReturnValue([]);
			commands["reports:diff"]({}, [], "reports:diff", mockProject);
			expect(discoverArchiveCategories).toHaveBeenCalled();
		});
	});

	// ── reports:html ──────────────────────────────────────────────
	describe("reports:html", () => {
		it("returns noProject when no project provided", () => {
			commands["reports:html"]({}, [], "reports:html", undefined);
			// Should not throw
		});

		it("returns no-reports message when no .md files found", () => {
			vi.mocked(disk.readdirSync).mockReturnValue([]);
			commands["reports:html"]({}, [], "reports:html", mockProject);
			// No error expected — renders "No report files found" message
		});

		it("exports HTML when .md files exist", () => {
			vi.mocked(disk.readdirSync).mockReturnValue(["test-report.md", "coverage-report.md"] as unknown as string[]);
			commands["reports:html"]({}, [], "reports:html", mockProject);
			expect(disk.readdirSync).toHaveBeenCalled();
		});
	});
});
