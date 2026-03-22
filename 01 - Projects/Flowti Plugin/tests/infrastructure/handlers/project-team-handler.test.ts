// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TeamHandler } from "../../../src/infrastructure/handlers/project-team-handler.js";
import type { IProjectService, ProjectDetailElement } from "../../../src/domain/projects/types.js";
import type { TeamHandlerDeps } from "../../../src/infrastructure/handlers/project-team-handler.js";

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

function makeDeps(overrides?: Partial<TeamHandlerDeps>): TeamHandlerDeps {
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
	};
}

/* ── Tests ───────────────────────────────────────────────────────────────────── */

describe("TeamHandler", () => {
	let el: ProjectDetailElement;
	let service: IProjectService;
	let deps: TeamHandlerDeps;

	beforeEach(() => {
		el = mockElement();
		service = mockService();
		deps = makeDeps({ el, projectService: service });
	});

	/* ── team-roster-save ────────────────────────────────────────────────── */

	describe("team-roster-save", () => {
		it("calls saveTeamRoster with slots", async () => {
			const slots = [{ roleId: "dev", agentName: "Alice" }];
			new TeamHandler(deps);
			el.dispatchEvent(new CustomEvent("team-roster-save", { detail: { slots } }));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.saveTeamRoster).toHaveBeenCalledWith("Alpha", slots, expect.any(Function));
			expect(deps.startProjectHubWork).toHaveBeenCalledWith("Saving team roster");
			expect(deps.endProjectHubWork).toHaveBeenCalledWith({ ok: true });
		});

		it("is skipped when projectHubBusy is true", async () => {
			el.projectHubBusy = true;
			new TeamHandler(deps);
			el.dispatchEvent(new CustomEvent("team-roster-save", { detail: { slots: [] } }));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.saveTeamRoster).not.toHaveBeenCalled();
		});
	});

	/* ── team-create-agent ───────────────────────────────────────────────── */

	describe("team-create-agent", () => {
		it("calls createAgentFromRole with roleId and agentName", async () => {
			new TeamHandler(deps);
			el.dispatchEvent(new CustomEvent("team-create-agent", {
				detail: { roleId: "qa", agentName: "Tester" },
			}));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.createAgentFromRole).toHaveBeenCalledWith(
				"Alpha", "qa", "Tester", expect.any(Function), undefined,
			);
			expect(deps.startProjectHubWork).toHaveBeenCalledWith('Saving agent "Tester"…');
		});

		it("sets agentCreationContext during creation and clears it after", async () => {
			new TeamHandler(deps);
			el.dispatchEvent(new CustomEvent("team-create-agent", {
				detail: { roleId: "dev", agentName: "Builder" },
			}));
			// Context is set synchronously
			expect(el.agentCreationContext).toEqual({ roleId: "dev", agentName: "Builder" });
			await new Promise((r) => setTimeout(r, 10));
			// Context is cleared in finally
			expect(el.agentCreationContext).toBe(null);
		});

		it("is skipped when projectHubBusy is true", async () => {
			el.projectHubBusy = true;
			new TeamHandler(deps);
			el.dispatchEvent(new CustomEvent("team-create-agent", {
				detail: { roleId: "dev", agentName: "X" },
			}));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.createAgentFromRole).not.toHaveBeenCalled();
		});

		it("passes slots when provided", async () => {
			const slots = [{ roleId: "dev", agentName: "Alice" }];
			new TeamHandler(deps);
			el.dispatchEvent(new CustomEvent("team-create-agent", {
				detail: { roleId: "dev", agentName: "Alice", slots },
			}));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.createAgentFromRole).toHaveBeenCalledWith(
				"Alpha", "dev", "Alice", expect.any(Function), slots,
			);
		});
	});

	/* ── team-refresh-agents ─────────────────────────────────────────────── */

	describe("team-refresh-agents", () => {
		it("calls listVaultAgents and sets el.vaultAgents", async () => {
			const agents = [{ name: "Agent1", role: "dev" }];
			(service.listVaultAgents as ReturnType<typeof vi.fn>).mockResolvedValue(agents);
			new TeamHandler(deps);
			el.dispatchEvent(new CustomEvent("team-refresh-agents"));
			await new Promise((r) => setTimeout(r, 10));
			expect(service.listVaultAgents).toHaveBeenCalled();
			expect(el.vaultAgents).toEqual(agents);
		});
	});

	/* ── team-roster-error ───────────────────────────────────────────────── */

	describe("team-roster-error", () => {
		beforeEach(() => { vi.useFakeTimers(); });
		afterEach(() => { vi.useRealTimers(); });

		it("sets statusMessage from event detail", () => {
			new TeamHandler(deps);
			el.dispatchEvent(new CustomEvent("team-roster-error", {
				detail: { message: "Invalid roster data" },
			}));
			expect(el.statusMessage).toBe("Invalid roster data");
		});

		it("uses default message when detail.message is missing", () => {
			new TeamHandler(deps);
			el.dispatchEvent(new CustomEvent("team-roster-error", { detail: {} }));
			expect(el.statusMessage).toBe("Team roster error");
		});

		it("auto-clears statusMessage after 5000ms", () => {
			new TeamHandler(deps);
			el.dispatchEvent(new CustomEvent("team-roster-error", {
				detail: { message: "Oops" },
			}));
			expect(el.statusMessage).toBe("Oops");
			vi.advanceTimersByTime(5000);
			expect(el.statusMessage).toBe("");
		});

		it("does not clear statusMessage if it was changed externally", () => {
			new TeamHandler(deps);
			el.dispatchEvent(new CustomEvent("team-roster-error", {
				detail: { message: "First" },
			}));
			el.statusMessage = "Different";
			vi.advanceTimersByTime(5000);
			expect(el.statusMessage).toBe("Different");
		});
	});

	/* ── abort signal ────────────────────────────────────────────────────── */

	describe("abort signal", () => {
		it("events are no-ops after abort", async () => {
			const controller = new AbortController();
			const abortDeps = makeDeps({ el, projectService: service, signal: controller.signal });
			new TeamHandler(abortDeps);
			controller.abort();

			el.dispatchEvent(new CustomEvent("team-roster-save", { detail: { slots: [] } }));
			el.dispatchEvent(new CustomEvent("team-create-agent", {
				detail: { roleId: "dev", agentName: "X" },
			}));
			el.dispatchEvent(new CustomEvent("team-refresh-agents"));
			await new Promise((r) => setTimeout(r, 10));

			expect(service.saveTeamRoster).not.toHaveBeenCalled();
			expect(service.createAgentFromRole).not.toHaveBeenCalled();
			expect(service.listVaultAgents).not.toHaveBeenCalled();
		});

		it("team-roster-error is a no-op after abort", () => {
			const controller = new AbortController();
			const abortDeps = makeDeps({ el, projectService: service, signal: controller.signal });
			new TeamHandler(abortDeps);
			controller.abort();

			el.dispatchEvent(new CustomEvent("team-roster-error", {
				detail: { message: "should not appear" },
			}));
			expect(el.statusMessage).toBe("");
		});
	});
});
