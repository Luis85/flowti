// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectGitHandler } from "../../../src/infrastructure/handlers/project-git-handler.js";
import type { IProjectService, ProjectDetailElement } from "../../../src/domain/projects/types.js";
import type { GitImportHandlerDeps } from "../../../src/infrastructure/handlers/project-git-handler.js";

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

function makeDeps(overrides?: Partial<GitImportHandlerDeps>): GitImportHandlerDeps {
	const el = overrides?.el ?? mockElement();
	const controller = new AbortController();
	return {
		el,
		signal: overrides?.signal ?? controller.signal,
		projectService: overrides?.projectService ?? mockService(),
		getCurrentProject: overrides?.getCurrentProject ?? (() => "Alpha"),
		loadProject: overrides?.loadProject ?? vi.fn(async () => {}),
		loadProjectList: overrides?.loadProjectList ?? vi.fn(async () => {}),
		startProjectHubWork: overrides?.startProjectHubWork ?? vi.fn(),
		appendProjectHubLog: overrides?.appendProjectHubLog ?? vi.fn(),
		endProjectHubWork: overrides?.endProjectHubWork ?? vi.fn(),
		createNote: overrides?.createNote ?? vi.fn(async () => {}),
	};
}

/* ── Tests ───────────────────────────────────────────────────────────────────── */

describe("ProjectGitHandler", () => {
	let el: ProjectDetailElement;
	let service: IProjectService;
	let deps: GitImportHandlerDeps;

	beforeEach(() => {
		el = mockElement();
		service = mockService();
		deps = makeDeps({ el, projectService: service });
	});

	/* ── add-project ─────────────────────────────────────────────────────── */

	describe("add-project", () => {
		it("mode=empty sets showNamePrompt to true", () => {
			new ProjectGitHandler(deps);
			el.dispatchEvent(new CustomEvent("add-project", { detail: { mode: "empty" } }));
			expect(el.showNamePrompt).toBe(true);
			expect(el.showGitModal).toBe(false);
		});

		it("mode=submodule opens git modal in submodule mode", () => {
			new ProjectGitHandler(deps);
			el.dispatchEvent(new CustomEvent("add-project", { detail: { mode: "submodule" } }));
			expect(el.showGitModal).toBe(true);
			expect(el.gitModalMode).toBe("submodule");
			expect(el.gitImportStep).toBe("form");
			expect(el.gitImportError).toBe("");
			expect(el.gitImportOutputLines).toEqual([]);
			expect(el.gitImportDetected).toBe(null);
		});

		it("mode=template opens git modal in template mode", () => {
			new ProjectGitHandler(deps);
			el.dispatchEvent(new CustomEvent("add-project", { detail: { mode: "template" } }));
			expect(el.showGitModal).toBe(true);
			expect(el.gitModalMode).toBe("template");
		});
	});

	/* ── import-setup ────────────────────────────────────────────────────── */

	describe("import-setup", () => {
		it("calls importFromGit then detectProject on success", async () => {
			new ProjectGitHandler(deps);
			el.dispatchEvent(new CustomEvent("import-setup", {
				detail: { url: "https://github.com/x/y.git", name: "MyProject", mode: "submodule" },
			}));
			await new Promise((r) => setTimeout(r, 50));
			expect(service.importFromGit).toHaveBeenCalledWith(
				"https://github.com/x/y.git", "MyProject", "submodule", expect.any(Function),
			);
			expect(service.detectProject).toHaveBeenCalledWith("MyProject");
			expect(el.gitImportStep).toBe("detect");
		});

		it("sets gitImportError when importFromGit fails", async () => {
			(service.importFromGit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "bad url" });
			new ProjectGitHandler(deps);
			el.dispatchEvent(new CustomEvent("import-setup", {
				detail: { url: "bad", name: "X", mode: "submodule" },
			}));
			await new Promise((r) => setTimeout(r, 50));
			expect(el.gitImportError).toBe("bad url");
			expect(service.detectProject).not.toHaveBeenCalled();
		});

		it("calls startProjectHubWork and sets step to progress", () => {
			new ProjectGitHandler(deps);
			el.dispatchEvent(new CustomEvent("import-setup", {
				detail: { url: "https://github.com/x/y.git", name: "Z", mode: "template" },
			}));
			expect(deps.startProjectHubWork).toHaveBeenCalledWith("Cloning repository…");
			expect(el.gitImportStep).toBe("progress");
		});
	});

	/* ── wizard-configure ────────────────────────────────────────────────── */

	describe("wizard-configure", () => {
		it("calls bootstrapProject with correct args", async () => {
			new ProjectGitHandler(deps);
			el.dispatchEvent(new CustomEvent("wizard-configure", {
				detail: { name: "MyProj", buildCommand: "npm run build", testCommand: "npm test", lintCommand: "npx eslint .", framework: "react" },
			}));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.bootstrapProject).toHaveBeenCalledWith("MyProj", {
				build: "npm run build",
				test: "npm test",
				lint: "npx eslint .",
				storybook: "react",
			});
			expect(deps.startProjectHubWork).toHaveBeenCalledWith("Writing config…");
		});

		it("sets gitImportStep to done on success", async () => {
			new ProjectGitHandler(deps);
			el.dispatchEvent(new CustomEvent("wizard-configure", {
				detail: { name: "MyProj", buildCommand: "", testCommand: "", lintCommand: "" },
			}));
			await new Promise((r) => setTimeout(r, 10));
			expect(el.gitImportStep).toBe("done");
			expect(deps.endProjectHubWork).toHaveBeenCalledWith({ ok: true });
		});
	});

	/* ── wizard-open-project ─────────────────────────────────────────────── */

	describe("wizard-open-project", () => {
		it("closes modal and calls loadProject", async () => {
			new ProjectGitHandler(deps);
			el.showGitModal = true;
			el.dispatchEvent(new CustomEvent("wizard-open-project", { detail: { name: "Bravo" } }));
			await new Promise((r) => setTimeout(r, 10));
			expect(el.showGitModal).toBe(false);
			expect(deps.loadProject).toHaveBeenCalledWith("Bravo");
		});
	});

	/* ── import-cancel ───────────────────────────────────────────────────── */

	describe("import-cancel", () => {
		it("closes git modal", () => {
			new ProjectGitHandler(deps);
			el.showGitModal = true;
			el.dispatchEvent(new CustomEvent("import-cancel"));
			expect(el.showGitModal).toBe(false);
		});
	});

	/* ── create-empty-project ────────────────────────────────────────────── */

	describe("create-empty-project", () => {
		it("calls createEmptyProject, createNote, then loadProject", async () => {
			new ProjectGitHandler(deps);
			el.dispatchEvent(new CustomEvent("create-empty-project", { detail: { name: "NewProj" } }));
			await new Promise((r) => setTimeout(r, 50));
			expect(service.createEmptyProject).toHaveBeenCalledWith("NewProj", expect.any(Function));
			expect(deps.createNote).toHaveBeenCalledWith("NewProj");
			expect(deps.loadProject).toHaveBeenCalledWith("NewProj");
			expect(deps.startProjectHubWork).toHaveBeenCalledWith("Creating project…");
			expect(deps.appendProjectHubLog).toHaveBeenCalledWith("Creating project folder…");
			expect(deps.endProjectHubWork).toHaveBeenCalledWith({ ok: true });
		});

		it("does not call loadProject when createEmptyProject fails", async () => {
			(service.createEmptyProject as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "disk full" });
			new ProjectGitHandler(deps);
			el.dispatchEvent(new CustomEvent("create-empty-project", { detail: { name: "Fail" } }));
			await new Promise((r) => setTimeout(r, 50));
			expect(deps.endProjectHubWork).toHaveBeenCalledWith({ ok: false, error: "disk full" });
			expect(deps.loadProject).not.toHaveBeenCalled();
		});
	});

	/* ── abort signal ────────────────────────────────────────────────────── */

	describe("abort signal", () => {
		it("events are no-ops after abort", async () => {
			const controller = new AbortController();
			const abortDeps = makeDeps({ el, projectService: service, signal: controller.signal });
			new ProjectGitHandler(abortDeps);
			controller.abort();

			el.dispatchEvent(new CustomEvent("wizard-open-project", { detail: { name: "X" } }));
			el.dispatchEvent(new CustomEvent("import-cancel"));
			await new Promise((r) => setTimeout(r, 10));

			// signal-based removal means listeners are removed entirely
			expect(abortDeps.loadProject).not.toHaveBeenCalled();
			// showGitModal stays at its original value since listeners are removed
			expect(el.showGitModal).toBe(false);
		});

		it("import-setup aborts mid-flow when signal is aborted", async () => {
			const controller = new AbortController();
			const abortDeps = makeDeps({ el, projectService: service, signal: controller.signal });
			new ProjectGitHandler(abortDeps);

			// Abort before dispatching — listeners are auto-removed by { signal }
			controller.abort();
			el.dispatchEvent(new CustomEvent("import-setup", {
				detail: { url: "https://github.com/x/y.git", name: "Z", mode: "submodule" },
			}));
			await new Promise((r) => setTimeout(r, 30));
			expect(service.importFromGit).not.toHaveBeenCalled();
		});
	});
});
