import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Infrastructure mocks ────────────────────────────────────────────
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), readdirSync: vi.fn(() => []), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: { join: (...args: string[]) => args.join("/"), resolve: (...args: string[]) => args.join("/"), basename: (p: string) => p.split("/").pop() ?? "", sep: "/" },
}));
vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0), runSilent: vi.fn(), runCapture: vi.fn(() => ""), runCaptureStatus: vi.fn(() => ({ exitCode: 0, output: "" })) },
}));
vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(() => ""), askYesNo: vi.fn(() => true), waitForEnter: vi.fn() },
}));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "", printHeader: vi.fn(),
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock-vault", CLI_PROJECT: "/mock/cli", cliConfig: {}, PROJECTS_DIR: "/mock/projects",
}));
vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-01-01T00:00:00.000Z", ms: () => 0, now: () => new Date("2026-01-01"), safeIso: () => "2026-01-01T00-00-00" },
}));
vi.mock("../../../src/infrastructure/deps.js", () => ({
	createDefaultDeps: vi.fn(() => ({ disk: {}, paths: {}, shell: {}, clock: {}, log: vi.fn() })),
}));

// ── Domain / UI mocks ───────────────────────────────────────────────
vi.mock("../../../src/domain/project/project-config.js", () => ({
	getReportsDir: vi.fn(() => "/project/reports"),
	getReportsOutputDir: vi.fn(() => "/project/reports"),
}));
vi.mock("../../../src/domain/make/make-service.js", () => ({
	getAvailableTemplates: vi.fn(() => ["journey", "component"]),
}));
vi.mock("../../../src/ui/menus/component-makers-menu.js", () => ({ componentMenu: vi.fn() }));
vi.mock("../../../src/ui/menus/make-makers.js", () => ({ makeJourney: vi.fn() }));
vi.mock("../../../src/ui/help.js", () => ({ showHelp: vi.fn() }));
vi.mock("../../../src/domain/reports/generator-registry.js", () => ({ runGenerator: vi.fn() }));
vi.mock("../../../src/domain/reports/pipeline/report-runner.js", () => ({ runAllReports: vi.fn() }));
vi.mock("../../../src/domain/reports/export/html-export.js", () => ({ exportReportToHtml: vi.fn(() => ({ title: "Test", outputPath: "/out.html" })) }));
vi.mock("../../../src/ui/menus/report-archive-menu.js", () => ({ browseArchive: vi.fn() }));
vi.mock("../../../src/domain/reports/pipeline/doc-runner.js", () => ({ runAllDocs: vi.fn() }));
vi.mock("../../../src/domain/project/project-deps.js", () => ({ buildDependencyGraph: vi.fn(() => []) }));
vi.mock("../../../src/ui/displays/deps-display.js", () => ({ displayDependencyGraph: vi.fn() }));
vi.mock("../../../src/domain/devtools/self-update.js", () => ({ rebuildCli: vi.fn() }));
vi.mock("../../../src/infrastructure/menu.js", () => ({ runMenu: vi.fn() }));
vi.mock("../../../src/domain/reports/cli/report-service.js", () => ({
	ReportService: class { reportsDir = "/project/reports"; },
}));

// ── Imports ─────────────────────────────────────────────────────────
import { HandlerRegistry } from "../../../src/infrastructure/handler-registry.js";
import { registerToolingHandlers } from "../../../src/ui/handlers/tooling-handlers.js";
import { input } from "../../../src/infrastructure/input.js";
import { shell } from "../../../src/infrastructure/shell.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { log } from "../../../src/infrastructure/logger.js";
import { getAvailableTemplates } from "../../../src/domain/make/make-service.js";
import { showHelp } from "../../../src/ui/help.js";
import { runAllReports } from "../../../src/domain/reports/pipeline/report-runner.js";
import { exportReportToHtml } from "../../../src/domain/reports/export/html-export.js";
import { browseArchive } from "../../../src/ui/menus/report-archive-menu.js";
import { runAllDocs } from "../../../src/domain/reports/pipeline/doc-runner.js";
import { buildDependencyGraph } from "../../../src/domain/project/project-deps.js";
import { displayDependencyGraph } from "../../../src/ui/displays/deps-display.js";
import { rebuildCli } from "../../../src/domain/devtools/self-update.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { componentMenu } from "../../../src/ui/menus/component-makers-menu.js";
import { makeJourney } from "../../../src/ui/menus/make-makers.js";

import type { RouterContext } from "../../../src/infrastructure/sitemap-types.js";

// ── Helpers ─────────────────────────────────────────────────────────

function mockCtx(config: Record<string, unknown> = {}): RouterContext {
	return {
		project: {
			config: {
				management: { raid: {}, deliverables: {}, capa: {} },
				reports: { generators: [] },
				docs: { references: [], generators: [] },
				...config,
			},
			path: "/project",
			scripts: { build: "npm run build", test: "npm test", lint: "npm run lint", check: "npm run check" },
		},
	} as RouterContext;
}

function noProjectCtx(): RouterContext {
	return { project: undefined } as unknown as RouterContext;
}

// ── Suite ───────────────────────────────────────────────────────────

describe("registerToolingHandlers", () => {
	let registry: HandlerRegistry;

	beforeEach(() => {
		vi.clearAllMocks();
		registry = new HandlerRegistry();
		registerToolingHandlers(registry);
	});

	// ── Registration ────────────────────────────────────────────────

	describe("registration", () => {
		it("registers all expected list providers", () => {
			expect(registry.hasListProvider("make:templates")).toBe(true);
			expect(registry.hasListProvider("reports:generators")).toBe(true);
			expect(registry.hasListProvider("docs:references")).toBe(true);
			expect(registry.hasListProvider("docs:generators")).toBe(true);
		});

		it("registers all expected actions", () => {
			const expectedActions = [
				"make:help", "reports:run-all", "reports:export-html", "reports:browse",
				"docs:update-refs", "docs:dependencies",
				"devtools:check", "devtools:lint", "devtools:reload", "devtools:console",
				"devtools:rebuild", "devtools:npm-scripts",
			];
			for (const id of expectedActions) {
				expect(registry.hasAction(id)).toBe(true);
			}
		});
	});

	// ── make:templates ──────────────────────────────────────────────

	describe("make:templates", () => {
		it("returns empty array when no project", () => {
			const provider = registry.getListProvider("make:templates");
			const result = provider(noProjectCtx());
			expect(result).toEqual([]);
		});

		it("returns menu entries for available templates", () => {
			const provider = registry.getListProvider("make:templates");
			const result = provider(mockCtx());
			expect(result).toHaveLength(2);
			expect(result[0].label).toBe("New E2E Journey");
			expect(result[0].key).toBe("1");
			expect(result[1].label).toBe("Add Component");
			expect(result[1].key).toBe("2");
		});

		it("calls getAvailableTemplates with project path", () => {
			const provider = registry.getListProvider("make:templates");
			provider(mockCtx());
			expect(getAvailableTemplates).toHaveBeenCalledWith("/project", expect.objectContaining({}));
		});

		it("journey template action calls makeJourney", async () => {
			const provider = registry.getListProvider("make:templates");
			const entries = provider(mockCtx());
			await entries[0].action!();
			expect(makeJourney).toHaveBeenCalledWith("/project");
		});

		it("component template action calls componentMenu", async () => {
			const provider = registry.getListProvider("make:templates");
			const entries = provider(mockCtx());
			await entries[1].action!();
			expect(componentMenu).toHaveBeenCalledWith("/project");
		});

		it("handles unknown template IDs gracefully", () => {
			vi.mocked(getAvailableTemplates).mockReturnValueOnce(["unknown" as "journey"]);
			const provider = registry.getListProvider("make:templates");
			const entries = provider(mockCtx());
			expect(entries).toHaveLength(1);
			expect(entries[0].label).toBe("unknown");
		});
	});

	// ── make:help ───────────────────────────────────────────────────

	describe("make:help", () => {
		it("shows help and waits for enter", async () => {
			const handler = registry.getAction("make:help");
			const result = await handler(mockCtx());
			expect(showHelp).toHaveBeenCalledWith("make");
			expect(input.waitForEnter).toHaveBeenCalled();
			expect(result).toBeUndefined();
		});
	});

	// ── reports:generators ──────────────────────────────────────────

	describe("reports:generators", () => {
		it("returns empty array when no project", () => {
			const provider = registry.getListProvider("reports:generators");
			expect(provider(noProjectCtx())).toEqual([]);
		});

		it("returns empty array when no generators configured", () => {
			const provider = registry.getListProvider("reports:generators");
			expect(provider(mockCtx())).toEqual([]);
		});

		it("returns menu entries for configured generators", () => {
			const ctx = mockCtx({
				reports: { generators: [{ id: "test-gen", label: "Test Report" }] },
			});
			const provider = registry.getListProvider("reports:generators");
			const entries = provider(ctx);
			expect(entries).toHaveLength(1);
			expect(entries[0].label).toBe("Test Report");
			expect(entries[0].key).toBe("2");
		});

		it("generator with id calls runGenerator", async () => {
			const { runGenerator } = await import("../../../src/domain/reports/generator-registry.js");
			const ctx = mockCtx({
				reports: { generators: [{ id: "coverage", label: "Coverage" }] },
			});
			const provider = registry.getListProvider("reports:generators");
			const entries = provider(ctx);
			await entries[0].action!();
			expect(runGenerator).toHaveBeenCalledWith("coverage", "/project", expect.objectContaining({}));
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("generator with command calls shell.run", async () => {
			const ctx = mockCtx({
				reports: { generators: [{ command: "node gen.js", label: "Custom" }] },
			});
			const provider = registry.getListProvider("reports:generators");
			const entries = provider(ctx);
			await entries[0].action!();
			expect(shell.run).toHaveBeenCalledWith("node gen.js", expect.objectContaining({ cwd: "/project" }));
		});
	});

	// ── reports:run-all ─────────────────────────────────────────────

	describe("reports:run-all", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("reports:run-all");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("logs message when no generators configured", async () => {
			const handler = registry.getAction("reports:run-all");
			await handler(mockCtx());
			expect(log).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("calls runAllReports when generators are configured", async () => {
			const ctx = mockCtx({
				reports: { generators: [{ id: "cov", label: "Coverage" }] },
			});
			const handler = registry.getAction("reports:run-all");
			await handler(ctx);
			expect(runAllReports).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── reports:export-html ─────────────────────────────────────────

	describe("reports:export-html", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("reports:export-html");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("logs message when no report files found", async () => {
			vi.mocked(disk.readdirSync).mockReturnValueOnce([]);
			const handler = registry.getAction("reports:export-html");
			await handler(mockCtx());
			expect(log).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("exports each .md file and logs results", async () => {
			vi.mocked(disk.readdirSync).mockReturnValueOnce(["report1.md", "report2.md", "readme.txt"]);
			const handler = registry.getAction("reports:export-html");
			await handler(mockCtx());
			expect(exportReportToHtml).toHaveBeenCalledTimes(2);
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── reports:browse ──────────────────────────────────────────────

	describe("reports:browse", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("reports:browse");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls browseArchive with reports dir", async () => {
			const handler = registry.getAction("reports:browse");
			await handler(mockCtx());
			expect(browseArchive).toHaveBeenCalledWith("/project/reports");
		});
	});

	// ── docs:references ─────────────────────────────────────────────

	describe("docs:references", () => {
		it("returns empty array when no project", () => {
			const provider = registry.getListProvider("docs:references");
			expect(provider(noProjectCtx())).toEqual([]);
		});

		it("returns empty array when no references configured", () => {
			const provider = registry.getListProvider("docs:references");
			expect(provider(mockCtx())).toEqual([]);
		});

		it("returns entries for configured references", () => {
			const ctx = mockCtx({
				docs: { references: [{ label: "API Docs" }], generators: [] },
			});
			const provider = registry.getListProvider("docs:references");
			const entries = provider(ctx);
			expect(entries).toHaveLength(1);
			expect(entries[0].label).toBe("Open API Docs");
			expect(entries[0].key).toBe("2");
		});

		it("reference action reads file when it exists", async () => {
			vi.mocked(disk.existsSync).mockReturnValueOnce(true);
			vi.mocked(disk.readFileSync).mockReturnValueOnce("# API Reference");
			const ctx = mockCtx({
				docs: { references: [{ label: "API" }], generators: [] },
			});
			const provider = registry.getListProvider("docs:references");
			const entries = provider(ctx);
			await entries[0].action!();
			expect(disk.readFileSync).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("reference action logs not found when file missing", async () => {
			vi.mocked(disk.existsSync).mockReturnValueOnce(false);
			const ctx = mockCtx({
				docs: { references: [{ label: "Missing" }], generators: [] },
			});
			const provider = registry.getListProvider("docs:references");
			const entries = provider(ctx);
			await entries[0].action!();
			expect(log).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── docs:generators ─────────────────────────────────────────────

	describe("docs:generators", () => {
		it("returns empty array when no project", () => {
			const provider = registry.getListProvider("docs:generators");
			expect(provider(noProjectCtx())).toEqual([]);
		});

		it("returns empty array when no generators configured", () => {
			const provider = registry.getListProvider("docs:generators");
			expect(provider(mockCtx())).toEqual([]);
		});

		it("returns entries with keys starting at 20", () => {
			const ctx = mockCtx({
				docs: { references: [], generators: [{ label: "TypeDoc", command: "npm run typedoc" }] },
			});
			const provider = registry.getListProvider("docs:generators");
			const entries = provider(ctx);
			expect(entries).toHaveLength(1);
			expect(entries[0].key).toBe("20");
			expect(entries[0].label).toBe("TypeDoc");
		});

		it("generator action runs shell command", async () => {
			const ctx = mockCtx({
				docs: { references: [], generators: [{ label: "TypeDoc", command: "npm run typedoc" }] },
			});
			const provider = registry.getListProvider("docs:generators");
			const entries = provider(ctx);
			await entries[0].action!();
			expect(shell.run).toHaveBeenCalledWith("npm run typedoc", expect.objectContaining({ cwd: "/project" }));
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── docs:update-refs ────────────────────────────────────────────

	describe("docs:update-refs", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("docs:update-refs");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("logs message when no references configured", async () => {
			const handler = registry.getAction("docs:update-refs");
			await handler(mockCtx());
			expect(log).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("calls runAllDocs when references are configured", async () => {
			const ctx = mockCtx({
				docs: { references: [{ label: "API", command: "gen-api" }], generators: [] },
			});
			const handler = registry.getAction("docs:update-refs");
			await handler(ctx);
			expect(runAllDocs).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── docs:dependencies ───────────────────────────────────────────

	describe("docs:dependencies", () => {
		it("builds and displays dependency graph", async () => {
			const handler = registry.getAction("docs:dependencies");
			await handler(mockCtx());
			expect(buildDependencyGraph).toHaveBeenCalledWith("/mock/projects", expect.objectContaining({}));
			expect(displayDependencyGraph).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── devtools:check ──────────────────────────────────────────────

	describe("devtools:check", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("devtools:check");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("runs npm run check when check script exists", async () => {
			const handler = registry.getAction("devtools:check");
			await handler(mockCtx());
			expect(shell.run).toHaveBeenCalledWith("npm run check", expect.objectContaining({ cwd: "/project" }));
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("falls back to tsc --noEmit when no check script", async () => {
			const ctx = mockCtx();
			(ctx.project as Record<string, unknown>).scripts = {};
			const handler = registry.getAction("devtools:check");
			await handler(ctx);
			expect(shell.run).toHaveBeenCalledWith("npx tsc --noEmit", expect.objectContaining({ cwd: "/project" }));
		});
	});

	// ── devtools:lint ───────────────────────────────────────────────

	describe("devtools:lint", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("devtools:lint");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("runs npm run lint when lint script exists", async () => {
			const handler = registry.getAction("devtools:lint");
			await handler(mockCtx());
			expect(shell.run).toHaveBeenCalledWith("npm run lint", expect.objectContaining({ cwd: "/project" }));
		});

		it("falls back to npx eslint when no lint script", async () => {
			const ctx = mockCtx();
			(ctx.project as Record<string, unknown>).scripts = {};
			const handler = registry.getAction("devtools:lint");
			await handler(ctx);
			expect(shell.run).toHaveBeenCalledWith("npx eslint src/", expect.objectContaining({ cwd: "/project" }));
		});
	});

	// ── devtools:reload ─────────────────────────────────────────────

	describe("devtools:reload", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("devtools:reload");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("runs cli-reload script", async () => {
			const handler = registry.getAction("devtools:reload");
			await handler(mockCtx());
			expect(shell.run).toHaveBeenCalledWith("node scripts/cli-reload.mjs", expect.objectContaining({ cwd: "/project" }));
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── devtools:console ────────────────────────────────────────────

	describe("devtools:console", () => {
		it("runs obsidian dev:console", async () => {
			const handler = registry.getAction("devtools:console");
			await handler(mockCtx());
			expect(shell.runCaptureStatus).toHaveBeenCalledWith("obsidian dev:console");
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("enables debug mode when debugger not attached", async () => {
			vi.mocked(shell.runCaptureStatus).mockReturnValueOnce({ exitCode: 1, output: "Debugger not attached" });
			const handler = registry.getAction("devtools:console");
			await handler(mockCtx());
			expect(shell.run).toHaveBeenCalledWith("obsidian dev:debug on", expect.objectContaining({}));
			expect(shell.run).toHaveBeenCalledWith("obsidian dev:console", expect.objectContaining({}));
		});
	});

	// ── devtools:rebuild ────────────────────────────────────────────

	describe("devtools:rebuild", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("devtools:rebuild");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls rebuildCli with project path", async () => {
			const handler = registry.getAction("devtools:rebuild");
			await handler(mockCtx());
			expect(rebuildCli).toHaveBeenCalledWith("/project", expect.objectContaining({}));
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── devtools:npm-scripts ────────────────────────────────────────

	describe("devtools:npm-scripts", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("devtools:npm-scripts");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("logs message when no scripts found", async () => {
			const ctx = mockCtx();
			(ctx.project as Record<string, unknown>).scripts = {};
			const handler = registry.getAction("devtools:npm-scripts");
			await handler(ctx);
			expect(log).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("calls runMenu with script entries", async () => {
			const handler = registry.getAction("devtools:npm-scripts");
			await handler(mockCtx());
			expect(runMenu).toHaveBeenCalledWith("npm scripts", expect.arrayContaining([
				expect.objectContaining({ label: "npm run build" }),
			]));
		});
	});
});
