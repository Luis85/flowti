// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigCatalogHandler } from "../../../src/infrastructure/handlers/project-config-handler.js";
import type { IProjectService, ProjectDetailElement } from "../../../src/domain/projects/types.js";
import type { ConfigCatalogHandlerDeps } from "../../../src/infrastructure/handlers/project-config-handler.js";

/* ── Shared helpers ──────────────────────────────────────────────────────────── */

function mockService(): IProjectService {
	return {
		listProjects: vi.fn(async () => []),
		getProject: vi.fn(async () => ({
			name: "Alpha",
			type: "typescript",
			hasNote: true,
			notePath: "/projects/Alpha/Alpha.md",
			projectPath: "/projects/Alpha",
			hasSitemap: false,
			hasCanvas: false,
			canvasChanged: false,
			storybook: { installed: true, framework: "react", running: false, url: null, pid: null, hasStaticBuild: false },
		})),
		installStorybook: vi.fn(async () => ({ ok: true })),
		startStorybook: vi.fn(async () => ({ ok: true, url: "http://localhost:6006", pid: 123 })),
		stopStorybook: vi.fn(async () => ({ ok: true })),
		buildStorybook: vi.fn(async () => ({ ok: true, outputDir: "/path" })),
		scaffoldStorybook: vi.fn(async () => ({ ok: true, filesCreated: 5 })),
		importMarkdownSitemap: vi.fn(async () => ({ ok: true })),
		saveMarkdownSourceConfig: vi.fn(async () => ({ ok: true })),
		cleanStorybook: vi.fn(async () => ({ ok: true })),
		importCanvasSitemap: vi.fn(async () => ({ ok: true })),
		previewStorybook: vi.fn(async () => ({ ok: true, url: "http://localhost:6007" })),
		openStorybookUrl: vi.fn(async () => ({ ok: true })),
		stopPreview: vi.fn(async () => ({ ok: true })),
		generateSitemapCanvas: vi.fn(async () => ({ ok: true })),
		importFromGit: vi.fn(async () => ({ ok: true })),
		detectProject: vi.fn(async () => ({ ok: true, type: "typescript" })),
		bootstrapProject: vi.fn(async () => ({ ok: true })),
		createEmptyProject: vi.fn(async () => ({ ok: true })),
		getHealth: vi.fn(async () => ({ ok: true, score: { overall: 85, grade: "B", categories: { tests: 90, coverage: 80, build: 100, lint: 70, security: 90, git: 80 } } })),
		getTodos: vi.fn(async () => ({ items: [], exists: false })),
		addTodo: vi.fn(async () => ({ ok: true })),
		toggleTodo: vi.fn(async () => ({ ok: true })),
		deleteTodo: vi.fn(async () => ({ ok: true })),
		listEntities: vi.fn(async () => []),
		createEntity: vi.fn(async () => ({ ok: true })),
		getReportGenerators: vi.fn(async () => []),
		runReport: vi.fn(async () => ({ ok: true })),
		runAllReports: vi.fn(async () => ({ ok: true })),
		listComponents: vi.fn(async () => []),
		listVaultAgents: vi.fn(async () => []),
		saveTeamRoster: vi.fn(async () => ({ ok: true })),
		createAgentFromRole: vi.fn(async () => ({ ok: true })),
	};
}

function mockElement(): ProjectDetailElement {
	const el = document.createElement("div") as unknown as ProjectDetailElement;
	el.projectName = "";
	el.projectType = "";
	el.hasNote = false;
	el.notePath = "";
	el.projects = [];
	el.searchQuery = "";
	el.cliConnected = false;
	el.storybook = { installed: false, framework: null, running: false, url: null, pid: null, hasStaticBuild: false };
	el.storybookBusy = false;
	el.storybookBusyLabel = "";
	el.storybookOutput = [];
	el.storybookError = "";
	el.components = [];
	el.projectHubBusy = false;
	el.projectHubBusyLabel = "";
	el.projectHubOutput = [];
	el.projectHubError = "";
	el.actionSuccess = "";
	el.statusMessage = "";
	el.config = undefined;
	el.hasSitemap = false;
	el.hasMarkdownSource = false;
	el.hasCanvas = false;
	el.canvasChanged = false;
	el.canvasPreset = "";
	el.brief = undefined;
	el.showScaffoldModal = false;
	el.showGitModal = false;
	el.gitModalMode = "submodule";
	el.showNamePrompt = false;
	el.gitImportStep = "form";
	el.gitImportError = "";
	el.gitImportOutputLines = [];
	el.gitImportDetected = null;
	el.configSaveStatus = "";
	el.configSourcePath = "";
	el.healthScore = null;
	el.healthError = "";
	el.todos = [];
	el.todosExist = false;
	el.catalogEntities = [];
	el.reportGenerators = [];
	el.reportNodeStates = {};
	el.reportOutput = [];
	el.reportBusy = false;
	el.roleSlots = [];
	el.vaultAgents = [];
	el.agentCreationContext = null;
	return el;
}

function makeDeps(overrides?: Partial<ConfigCatalogHandlerDeps>): ConfigCatalogHandlerDeps {
	const el = overrides?.el ?? mockElement();
	const controller = new AbortController();
	return {
		el,
		signal: overrides?.signal ?? controller.signal,
		projectService: overrides?.projectService ?? mockService(),
		getCurrentProject: overrides?.getCurrentProject ?? (() => "Alpha"),
		startProjectHubWork: overrides?.startProjectHubWork ?? vi.fn(),
		appendProjectHubLog: overrides?.appendProjectHubLog ?? vi.fn(),
		endProjectHubWork: overrides?.endProjectHubWork ?? vi.fn(),
		openNote: overrides?.openNote ?? vi.fn(),
		pickFolder: overrides?.pickFolder ?? vi.fn(async () => null),
	};
}

/* ── Tests ───────────────────────────────────────────────────────────────────── */

describe("ConfigCatalogHandler", () => {
	let el: ProjectDetailElement;
	let service: IProjectService;
	let deps: ConfigCatalogHandlerDeps;

	beforeEach(() => {
		el = mockElement();
		service = mockService();
		deps = makeDeps({ el, projectService: service });
	});

	/* ── config-save ─────────────────────────────────────────────────────── */

	describe("config-save", () => {
		it("calls saveMarkdownSourceConfig with correct config shape", async () => {
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("config-save", {
				detail: { path: "components", strategy: "flat", requiredFields: ["name", "category"] },
			}));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.saveMarkdownSourceConfig).toHaveBeenCalledWith(
				"Alpha",
				{ path: "components", strategy: "flat", requiredFields: ["name", "category"] },
				expect.any(Function),
			);
			expect(deps.startProjectHubWork).toHaveBeenCalledWith("Saving markdown source config…");
		});

		it("is skipped when projectHubBusy is true", async () => {
			el.projectHubBusy = true;
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("config-save", {
				detail: { path: "x", strategy: "flat", requiredFields: [] },
			}));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.saveMarkdownSourceConfig).not.toHaveBeenCalled();
		});

		it("sets configSaveStatus on success", async () => {
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("config-save", {
				detail: { path: "x", strategy: "flat", requiredFields: [] },
			}));
			await new Promise((r) => setTimeout(r, 10));
			expect(el.configSaveStatus).toBe("Saved");
		});

		it("sets configSaveStatus on failure", async () => {
			(service.saveMarkdownSourceConfig as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "nope" });
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("config-save", {
				detail: { path: "x", strategy: "flat", requiredFields: [] },
			}));
			await new Promise((r) => setTimeout(r, 10));
			expect(el.configSaveStatus).toBe("nope");
		});
	});

	/* ── config-browse-folder ────────────────────────────────────────────── */

	describe("config-browse-folder", () => {
		it("sets configSourcePath when folder is picked", async () => {
			const pickFolder = vi.fn(async () => "/picked/folder");
			const browseDeps = makeDeps({ el, projectService: service, pickFolder });
			new ConfigCatalogHandler(browseDeps);
			el.dispatchEvent(new CustomEvent("config-browse-folder"));
			await new Promise((r) => setTimeout(r, 10));
			expect(el.configSourcePath).toBe("/picked/folder");
		});

		it("does nothing when pickFolder returns null", async () => {
			const pickFolder = vi.fn(async () => null);
			const browseDeps = makeDeps({ el, projectService: service, pickFolder });
			new ConfigCatalogHandler(browseDeps);
			el.dispatchEvent(new CustomEvent("config-browse-folder"));
			await new Promise((r) => setTimeout(r, 10));
			expect(el.configSourcePath).toBe("");
		});
	});

	/* ── canvas-generate ─────────────────────────────────────────────────── */

	describe("canvas-generate", () => {
		it("calls generateSitemapCanvas with preset", async () => {
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("canvas-generate", { detail: { preset: "full" } }));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.generateSitemapCanvas).toHaveBeenCalledWith(
				"Alpha", expect.any(Function), { preset: "full", force: true },
			);
			expect(deps.startProjectHubWork).toHaveBeenCalledWith("Generating sitemap canvas…");
		});

		it("calls openNote without preset (no generation)", async () => {
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("canvas-generate", { detail: {} }));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.generateSitemapCanvas).not.toHaveBeenCalled();
			expect(deps.openNote).toHaveBeenCalledWith("01 - Projects/Alpha/sitemap.canvas");
		});

		it("opens canvas after successful generation", async () => {
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("canvas-generate", { detail: { preset: "basic" } }));
			await new Promise((r) => setTimeout(r, 10));
			expect(deps.openNote).toHaveBeenCalledWith("01 - Projects/Alpha/sitemap.canvas");
		});

		it("is skipped when projectHubBusy is true", async () => {
			el.projectHubBusy = true;
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("canvas-generate", { detail: { preset: "full" } }));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.generateSitemapCanvas).not.toHaveBeenCalled();
		});
	});

	/* ── canvas-merge ────────────────────────────────────────────────────── */

	describe("canvas-merge", () => {
		it("calls importCanvasSitemap with merge option", async () => {
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("canvas-merge"));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.importCanvasSitemap).toHaveBeenCalledWith(
				"Alpha", expect.any(Function), { merge: true },
			);
		});
	});

	/* ── canvas-open ─────────────────────────────────────────────────────── */

	describe("canvas-open", () => {
		it("calls openNote with sitemap canvas path", () => {
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("canvas-open"));
			expect(deps.openNote).toHaveBeenCalledWith("01 - Projects/Alpha/sitemap.canvas");
		});
	});

	/* ── health-refresh ──────────────────────────────────────────────────── */

	describe("health-refresh", () => {
		it("calls getHealth and sets healthScore", async () => {
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("health-refresh"));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.getHealth).toHaveBeenCalledWith("Alpha");
			expect(el.healthScore).toEqual({
				overall: 85, grade: "B",
				categories: { tests: 90, coverage: 80, build: 100, lint: 70, security: 90, git: 80 },
			});
			expect(el.healthError).toBe("");
		});

		it("sets healthError on failure", async () => {
			(service.getHealth as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "fail" });
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("health-refresh"));
			await new Promise((r) => setTimeout(r, 10));
			expect(el.healthError).toBe("fail");
		});
	});

	/* ── todo-add ────────────────────────────────────────────────────────── */

	describe("todo-add", () => {
		it("calls addTodo then refreshes todos", async () => {
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("todo-add", { detail: { text: "Buy milk" } }));
			await new Promise((r) => setTimeout(r, 20));
			expect(service.addTodo).toHaveBeenCalledWith("Alpha", "Buy milk");
			expect(service.getTodos).toHaveBeenCalledWith("Alpha");
		});
	});

	/* ── todo-toggle ─────────────────────────────────────────────────────── */

	describe("todo-toggle", () => {
		it("calls toggleTodo then refreshes", async () => {
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("todo-toggle", { detail: { index: 2 } }));
			await new Promise((r) => setTimeout(r, 20));
			expect(service.toggleTodo).toHaveBeenCalledWith("Alpha", 2);
			expect(service.getTodos).toHaveBeenCalled();
		});
	});

	/* ── todo-delete ─────────────────────────────────────────────────────── */

	describe("todo-delete", () => {
		it("calls deleteTodo then refreshes", async () => {
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("todo-delete", { detail: { index: 0 } }));
			await new Promise((r) => setTimeout(r, 20));
			expect(service.deleteTodo).toHaveBeenCalledWith("Alpha", 0);
			expect(service.getTodos).toHaveBeenCalled();
		});
	});

	/* ── catalog-entity-create ───────────────────────────────────────────── */

	describe("catalog-entity-create", () => {
		it("calls createEntity then listEntities on success", async () => {
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("catalog-entity-create", {
				detail: { entityType: "domains", definition: { name: "auth", description: "Authentication" } },
			}));
			await new Promise((r) => setTimeout(r, 20));
			expect(service.createEntity).toHaveBeenCalledWith("Alpha", "domains", { name: "auth", description: "Authentication" });
			expect(service.listEntities).toHaveBeenCalledWith("Alpha", "domains");
		});
	});

	/* ── catalog-list-refresh ────────────────────────────────────────────── */

	describe("catalog-list-refresh", () => {
		it("calls listEntities and sets catalogEntities", async () => {
			const entities = [{ name: "core", description: "Core domain" }];
			(service.listEntities as ReturnType<typeof vi.fn>).mockResolvedValue(entities);
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("catalog-list-refresh", { detail: { entityType: "domains" } }));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.listEntities).toHaveBeenCalledWith("Alpha", "domains");
			expect(el.catalogEntities).toEqual(entities);
		});
	});

	/* ── report-run ──────────────────────────────────────────────────────── */

	describe("report-run", () => {
		it("calls runReport with generator id", async () => {
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("report-run", { detail: { generatorId: "coverage" } }));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.runReport).toHaveBeenCalledWith("Alpha", "coverage", expect.any(Function));
			expect(el.reportBusy).toBe(false); // should be false after completion
		});

		it("sets reportNodeStates to running then passed", async () => {
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("report-run", { detail: { generatorId: "lint" } }));
			// Immediately after dispatch, the state should be set to running
			expect((el.reportNodeStates as Record<string, string>)["lint"]).toBe("running");
			await new Promise((r) => setTimeout(r, 10));
			expect((el.reportNodeStates as Record<string, string>)["lint"]).toBe("passed");
		});

		it("sets reportNodeStates to failed when runReport fails", async () => {
			(service.runReport as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("report-run", { detail: { generatorId: "lint" } }));
			await new Promise((r) => setTimeout(r, 10));
			expect((el.reportNodeStates as Record<string, string>)["lint"]).toBe("failed");
		});
	});

	/* ── report-run-all ──────────────────────────────────────────────────── */

	describe("report-run-all", () => {
		it("calls runAllReports", async () => {
			el.reportGenerators = [{ id: "coverage" }, { id: "lint" }] as ProjectDetailElement["reportGenerators"];
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("report-run-all"));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.runAllReports).toHaveBeenCalledWith("Alpha", expect.any(Function));
			expect(el.reportBusy).toBe(false);
		});

		it("sets all generator states to running initially", () => {
			el.reportGenerators = [{ id: "a" }, { id: "b" }] as ProjectDetailElement["reportGenerators"];
			new ConfigCatalogHandler(deps);
			el.dispatchEvent(new CustomEvent("report-run-all"));
			expect((el.reportNodeStates as Record<string, string>)["a"]).toBe("running");
			expect((el.reportNodeStates as Record<string, string>)["b"]).toBe("running");
		});
	});

	/* ── abort signal ────────────────────────────────────────────────────── */

	describe("abort signal", () => {
		it("signal checks prevent element writes after abort", async () => {
			const controller = new AbortController();
			const abortDeps = makeDeps({ el, projectService: service, signal: controller.signal });
			new ConfigCatalogHandler(abortDeps);
			controller.abort();

			el.dispatchEvent(new CustomEvent("health-refresh"));
			el.dispatchEvent(new CustomEvent("config-save", {
				detail: { path: "x", strategy: "flat", requiredFields: [] },
			}));
			await new Promise((r) => setTimeout(r, 10));

			// Listeners are removed by { signal } — service never called
			expect(service.getHealth).not.toHaveBeenCalled();
			expect(service.saveMarkdownSourceConfig).not.toHaveBeenCalled();
		});
	});
});
