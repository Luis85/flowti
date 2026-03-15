import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Infrastructure mocks ────────────────────────────────────────────
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), readdirSync: vi.fn(() => []), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
	watchFile: vi.fn(() => ({ close: vi.fn() })),
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
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "", printHeader: vi.fn(), clearScreen: vi.fn(),
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
vi.mock("../../../src/infrastructure/state.js", () => ({
	getSelectedProject: vi.fn(() => null),
}));
vi.mock("../../../src/domain/project/project-config.js", () => ({
	initializeProject: vi.fn(() => null),
}));
vi.mock("../../../src/domain/project/project.js", () => ({
	listProjects: vi.fn(() => []),
}));
vi.mock("../../../src/domain/knowledgebase/knowledgebase.js", () => ({
	isKnowledgebaseAvailable: vi.fn(() => false),
}));
vi.mock("../../../src/domain/health/health.js", () => ({
	collectHealth: vi.fn(() => ({ score: 100, checks: [] })),
}));
vi.mock("../../../src/ui/displays/health-display.js", () => ({
	displayHealth: vi.fn(),
}));
vi.mock("../../../src/ui/help.js", () => ({
	showHelp: vi.fn(),
}));
vi.mock("../../../src/ui/displays/info-display.js", () => ({
	showInfo: vi.fn(),
}));
vi.mock("../../../src/ui/renderers/project-status-banner.js", () => ({
	printProjectStatusBanner: vi.fn(),
}));
vi.mock("../../../src/domain/reports/cli/generate-build-report.js", () => ({
	buildWithReport: vi.fn(),
}));
vi.mock("../../../src/domain/iterations/iteration-store.js", () => ({
	findCurrentIteration: vi.fn(() => null),
}));

// ── Sub-handler registration mocks ──────────────────────────────────
vi.mock("../../../src/ui/handlers/crud-handlers.js", () => ({
	registerCrudHandlers: vi.fn(),
}));
vi.mock("../../../src/ui/handlers/extensibility-handlers.js", () => ({
	registerExtensibilityHandlers: vi.fn(),
}));
vi.mock("../../../src/ui/handlers/development-handlers.js", () => ({
	registerDevelopmentHandlers: vi.fn(),
}));
vi.mock("../../../src/ui/handlers/pipeline-handlers.js", () => ({
	registerPipelineHandlers: vi.fn(),
}));
vi.mock("../../../src/ui/handlers/tooling-handlers.js", () => ({
	registerToolingHandlers: vi.fn(),
}));
vi.mock("../../../src/ui/handlers/component-handlers.js", () => ({
	registerComponentHandlers: vi.fn(),
}));

// ── Dynamic import mocks ────────────────────────────────────────────
vi.mock("../../../src/ui/handlers/start-handlers.js", () => ({
	openProjectHandler: vi.fn(() => "main"),
	createProjectHandler: vi.fn(() => "main"),
}));
vi.mock("../../../src/ui/menus/capture-menu.js", () => ({
	captureIdea: vi.fn(() => "main"),
	captureNote: vi.fn(() => "main"),
	captureBug: vi.fn(() => "main"),
}));
vi.mock("../../../src/ui/menus/component-list-menu.js", () => ({
	componentListMenu: vi.fn(() => "main"),
	listProjectComponents: vi.fn(() => []),
}));
vi.mock("../../../src/ui/menus/knowledgebase-menu.js", () => ({
	knowledgebaseMenu: vi.fn(() => "main"),
}));
vi.mock("../../../src/ui/menus/component-detail-menu.js", () => ({
	componentDetailMenu: vi.fn(() => "main"),
}));
vi.mock("../../../src/ui/menus/iteration-detail-menu.js", () => ({
	iterationDetailMenu: vi.fn(() => "main"),
	resolveCurrentIterationNumber: vi.fn(() => null),
	resolveIterationNumber: vi.fn(() => null),
}));

// ── Imports ─────────────────────────────────────────────────────────
import { HandlerRegistry } from "../../../src/infrastructure/handler-registry.js";
import { registerAllHandlers } from "../../../src/ui/handlers/register-handlers.js";
import { registerCrudHandlers } from "../../../src/ui/handlers/crud-handlers.js";
import { registerExtensibilityHandlers } from "../../../src/ui/handlers/extensibility-handlers.js";
import { registerDevelopmentHandlers } from "../../../src/ui/handlers/development-handlers.js";
import { registerPipelineHandlers } from "../../../src/ui/handlers/pipeline-handlers.js";
import { registerToolingHandlers } from "../../../src/ui/handlers/tooling-handlers.js";
import { registerComponentHandlers } from "../../../src/ui/handlers/component-handlers.js";
import { getSelectedProject } from "../../../src/infrastructure/state.js";
import { listProjects } from "../../../src/domain/project/project.js";
import { initializeProject } from "../../../src/domain/project/project-config.js";
import { isKnowledgebaseAvailable } from "../../../src/domain/knowledgebase/knowledgebase.js";
import { collectHealth } from "../../../src/domain/health/health.js";
import { displayHealth } from "../../../src/ui/displays/health-display.js";
import { showHelp } from "../../../src/ui/help.js";
import { showInfo } from "../../../src/ui/displays/info-display.js";
import { buildWithReport } from "../../../src/domain/reports/cli/generate-build-report.js";
import { findCurrentIteration } from "../../../src/domain/iterations/iteration-store.js";
import { input } from "../../../src/infrastructure/input.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { clock } from "../../../src/infrastructure/clock.js";
import { clearScreen } from "../../../src/infrastructure/ui.js";

import type { RouterContext } from "../../../src/infrastructure/sitemap-types.js";

// ── Helpers ─────────────────────────────────────────────────────────

const mockDeps = {
	disk,
	paths: { join: (...args: string[]) => args.join("/"), resolve: (...args: string[]) => args.join("/"), basename: (p: string) => p.split("/").pop() ?? "", sep: "/" },
	clock,
	input,
	log: vi.fn(),
	warn: vi.fn(),
	shell: { run: vi.fn(() => 0), runSilent: vi.fn(), runCapture: vi.fn(() => ""), runCaptureStatus: vi.fn(() => ({ exitCode: 0, output: "" })) },
	proc: { exit: vi.fn(), argv: [] },
	bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
	agentShell: { talk: vi.fn(), dispatch: vi.fn(), getActiveDispatch: vi.fn(() => null), reconcileStaleAgents: vi.fn(() => ({ recovered: [] })) },
};

function mockCtx(overrides: Partial<RouterContext> = {}): RouterContext {
	return {
		deps: mockDeps,
		project: {
			config: {
				name: "Test Project",
				management: { raid: {}, deliverables: {}, capa: {}, resources: {}, timelog: {}, iterations: {} },
				reports: { generators: [] },
				docs: { references: [], generators: [] },
				build: { commands: { fast: "npm run build" } },
				components: {},
			},
			path: "/project",
			pkg: { name: "test-project", version: "1.0.0" },
			scripts: { build: "npm run build", test: "npm test", lint: "npm run lint", check: "npm run check" },
		},
		...overrides,
	} as RouterContext;
}

function noProjectCtx(): RouterContext {
	return { deps: mockDeps, project: undefined } as unknown as RouterContext;
}

// ── Suite ───────────────────────────────────────────────────────────

describe("registerAllHandlers", () => {
	let registry: HandlerRegistry;

	beforeEach(() => {
		vi.clearAllMocks();
		registry = new HandlerRegistry();
		registerAllHandlers(registry);
	});

	// ── Sub-handler delegation ──────────────────────────────────────

	describe("sub-handler delegation", () => {
		it("calls registerCrudHandlers", () => {
			expect(registerCrudHandlers).toHaveBeenCalledWith(registry);
		});

		it("calls registerExtensibilityHandlers", () => {
			expect(registerExtensibilityHandlers).toHaveBeenCalledWith(registry);
		});

		it("calls registerDevelopmentHandlers", () => {
			expect(registerDevelopmentHandlers).toHaveBeenCalledWith(registry);
		});

		it("calls registerPipelineHandlers", () => {
			expect(registerPipelineHandlers).toHaveBeenCalledWith(registry);
		});

		it("calls registerToolingHandlers", () => {
			expect(registerToolingHandlers).toHaveBeenCalledWith(registry);
		});

		it("calls registerComponentHandlers", () => {
			expect(registerComponentHandlers).toHaveBeenCalledWith(registry);
		});
	});

	// ── Registration ────────────────────────────────────────────────

	describe("registration", () => {
		it("registers all expected beforeRender handlers", () => {
			const expected = ["start:banner", "project:banner"];
			for (const id of expected) {
				expect(registry.hasBeforeRender(id)).toBe(true);
			}
		});

		it("registers all expected condition handlers", () => {
			const expected = [
				"no-project-selected",
				"knowledgebase:available",
				"readme:exists",
				"iteration:running",
				"iteration:not-running",
				"iteration:not-planned",
				"iteration:cannot-advance",
			];
			for (const id of expected) {
				expect(registry.hasCondition(id)).toBe(true);
			}
		});

		it("registers all expected action handlers", () => {
			const expected = [
				"project:open", "project:create",
				"capture:idea", "capture:note", "capture:bug",
				"build:interactive", "health:show",
				"help:main", "info:show", "readme:show",
			];
			for (const id of expected) {
				expect(registry.hasAction(id)).toBe(true);
			}
		});

		it("registers all expected view handlers", () => {
			const expected = ["components", "knowledgebase", "component-detail", "iteration-detail"];
			for (const id of expected) {
				expect(registry.hasView(id)).toBe(true);
			}
		});
	});

	// ── BeforeRender handlers ───────────────────────────────────────

	describe("start:banner", () => {
		it("logs current project when one is selected", () => {
			vi.mocked(getSelectedProject).mockReturnValue("My Project");
			const handler = registry.getBeforeRender("start:banner");
			handler(mockCtx());
			expect(mockDeps.log).toHaveBeenCalled();
		});

		it("logs 'no projects yet' when none exist and none selected", () => {
			vi.mocked(getSelectedProject).mockReturnValue(null);
			vi.mocked(listProjects).mockReturnValue([]);
			const handler = registry.getBeforeRender("start:banner");
			handler(mockCtx());
			expect(mockDeps.log).toHaveBeenCalled();
		});

		it("does not log when projects exist but none selected", () => {
			vi.mocked(getSelectedProject).mockReturnValue(null);
			vi.mocked(listProjects).mockReturnValue(["Proj A"]);
			const handler = registry.getBeforeRender("start:banner");
			handler(mockCtx());
			expect(mockDeps.log).not.toHaveBeenCalled();
		});
	});

	describe("project:banner", () => {
		it("clears the screen", () => {
			const handler = registry.getBeforeRender("project:banner");
			handler(mockCtx());
			expect(clearScreen).toHaveBeenCalled();
		});

		it("logs project name when project is selected and initialized", () => {
			vi.mocked(getSelectedProject).mockReturnValue("My Project");
			vi.mocked(initializeProject).mockReturnValue({
				config: { name: "My Project" },
				path: "/project",
				pkg: { name: "my-project", version: "1.0.0" },
				scripts: {},
			} as ReturnType<typeof initializeProject>);
			const handler = registry.getBeforeRender("project:banner");
			handler(mockCtx());
			expect(mockDeps.log).toHaveBeenCalled();
		});

		it("logs fallback when no project is initialized", () => {
			vi.mocked(getSelectedProject).mockReturnValue("Unknown");
			vi.mocked(initializeProject).mockReturnValue(null);
			const handler = registry.getBeforeRender("project:banner");
			handler(mockCtx());
			expect(mockDeps.log).toHaveBeenCalled();
		});

		it("logs fallback when no project is selected", () => {
			vi.mocked(getSelectedProject).mockReturnValue(null);
			const handler = registry.getBeforeRender("project:banner");
			handler(mockCtx());
			expect(mockDeps.log).toHaveBeenCalled();
		});
	});

	// ── Condition handlers ──────────────────────────────────────────

	describe("no-project-selected", () => {
		it("returns true when no project is selected", () => {
			vi.mocked(getSelectedProject).mockReturnValue(null);
			const handler = registry.getCondition("no-project-selected");
			expect(handler(mockCtx())).toBe(true);
		});

		it("returns false when a project is selected", () => {
			vi.mocked(getSelectedProject).mockReturnValue("My Project");
			const handler = registry.getCondition("no-project-selected");
			expect(handler(mockCtx())).toBe(false);
		});
	});

	describe("knowledgebase:available", () => {
		it("returns true when knowledgebase is NOT available (hides item)", () => {
			vi.mocked(isKnowledgebaseAvailable).mockReturnValue(false);
			const handler = registry.getCondition("knowledgebase:available");
			expect(handler(mockCtx())).toBe(true);
		});

		it("returns false when knowledgebase IS available", () => {
			vi.mocked(isKnowledgebaseAvailable).mockReturnValue(true);
			const handler = registry.getCondition("knowledgebase:available");
			expect(handler(mockCtx())).toBe(false);
		});
	});

	describe("readme:exists", () => {
		it("returns true when no project context", () => {
			const handler = registry.getCondition("readme:exists");
			expect(handler(noProjectCtx())).toBe(true);
		});

		it("returns true when README.md does not exist", () => {
			vi.mocked(disk.existsSync).mockReturnValue(false);
			const handler = registry.getCondition("readme:exists");
			expect(handler(mockCtx())).toBe(true);
		});

		it("returns false when README.md exists", () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);
			const handler = registry.getCondition("readme:exists");
			expect(handler(mockCtx())).toBe(false);
		});
	});

	describe("iteration:running", () => {
		it("returns false when no project context", () => {
			const handler = registry.getCondition("iteration:running");
			expect(handler(noProjectCtx())).toBe(false);
		});

		it("returns true when a current iteration exists", () => {
			vi.mocked(findCurrentIteration).mockReturnValue({ name: "Sprint 1", status: "in-progress" } as ReturnType<typeof findCurrentIteration>);
			const handler = registry.getCondition("iteration:running");
			expect(handler(mockCtx())).toBe(true);
		});

		it("returns false when no current iteration", () => {
			vi.mocked(findCurrentIteration).mockReturnValue(null);
			const handler = registry.getCondition("iteration:running");
			expect(handler(mockCtx())).toBe(false);
		});
	});

	describe("iteration:not-running", () => {
		it("returns true when no project context", () => {
			const handler = registry.getCondition("iteration:not-running");
			expect(handler(noProjectCtx())).toBe(true);
		});

		it("returns false when a current iteration exists", () => {
			vi.mocked(findCurrentIteration).mockReturnValue({ name: "Sprint 1", status: "in-progress" } as ReturnType<typeof findCurrentIteration>);
			const handler = registry.getCondition("iteration:not-running");
			expect(handler(mockCtx())).toBe(false);
		});

		it("returns true when no current iteration", () => {
			vi.mocked(findCurrentIteration).mockReturnValue(null);
			const handler = registry.getCondition("iteration:not-running");
			expect(handler(mockCtx())).toBe(true);
		});
	});

	describe("iteration:not-planned", () => {
		it("returns true when no project context", () => {
			const handler = registry.getCondition("iteration:not-planned");
			expect(handler(noProjectCtx())).toBe(true);
		});

		it("returns true when no current iteration", () => {
			vi.mocked(findCurrentIteration).mockReturnValue(null);
			const handler = registry.getCondition("iteration:not-planned");
			expect(handler(mockCtx())).toBe(true);
		});

		it("returns false when current iteration is planned", () => {
			vi.mocked(findCurrentIteration).mockReturnValue({ name: "Sprint 1", status: "planned" } as ReturnType<typeof findCurrentIteration>);
			const handler = registry.getCondition("iteration:not-planned");
			expect(handler(mockCtx())).toBe(false);
		});

		it("returns true when current iteration is not planned", () => {
			vi.mocked(findCurrentIteration).mockReturnValue({ name: "Sprint 1", status: "in-progress" } as ReturnType<typeof findCurrentIteration>);
			const handler = registry.getCondition("iteration:not-planned");
			expect(handler(mockCtx())).toBe(true);
		});
	});

	describe("iteration:cannot-advance", () => {
		it("returns true when no project context", () => {
			const handler = registry.getCondition("iteration:cannot-advance");
			expect(handler(noProjectCtx())).toBe(true);
		});

		it("returns true when no current iteration", () => {
			vi.mocked(findCurrentIteration).mockReturnValue(null);
			const handler = registry.getCondition("iteration:cannot-advance");
			expect(handler(mockCtx())).toBe(true);
		});

		it("returns true when iteration is done", () => {
			vi.mocked(findCurrentIteration).mockReturnValue({ name: "Sprint 1", status: "done" } as ReturnType<typeof findCurrentIteration>);
			const handler = registry.getCondition("iteration:cannot-advance");
			expect(handler(mockCtx())).toBe(true);
		});

		it("returns true when iteration is cancelled", () => {
			vi.mocked(findCurrentIteration).mockReturnValue({ name: "Sprint 1", status: "cancelled" } as ReturnType<typeof findCurrentIteration>);
			const handler = registry.getCondition("iteration:cannot-advance");
			expect(handler(mockCtx())).toBe(true);
		});

		it("returns false when iteration is in-progress", () => {
			vi.mocked(findCurrentIteration).mockReturnValue({ name: "Sprint 1", status: "in-progress" } as ReturnType<typeof findCurrentIteration>);
			const handler = registry.getCondition("iteration:cannot-advance");
			expect(handler(mockCtx())).toBe(false);
		});
	});

	// ── Action handlers ─────────────────────────────────────────────

	describe("project:open", () => {
		it("calls openProjectHandler", async () => {
			const handler = registry.getAction("project:open");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("project:create", () => {
		it("calls createProjectHandler", async () => {
			const handler = registry.getAction("project:create");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("capture:idea", () => {
		it("calls captureIdea", async () => {
			const handler = registry.getAction("capture:idea");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("capture:note", () => {
		it("calls captureNote", async () => {
			const handler = registry.getAction("capture:note");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("capture:bug", () => {
		it("calls captureBug", async () => {
			const handler = registry.getAction("capture:bug");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("build:interactive", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("build:interactive");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("returns undefined when no fast build command", async () => {
			const handler = registry.getAction("build:interactive");
			const ctx = mockCtx({ project: { config: { build: {} }, path: "/project", scripts: {} } as RouterContext["project"] });
			expect(await handler(ctx)).toBeUndefined();
		});

		it("calls buildWithReport and returns 'main'", async () => {
			const handler = registry.getAction("build:interactive");
			const result = await handler(mockCtx());
			expect(buildWithReport).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
			expect(result).toBe("main");
		});
	});

	describe("health:show", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("health:show");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("collects and displays health", async () => {
			const handler = registry.getAction("health:show");
			const result = await handler(mockCtx());
			expect(collectHealth).toHaveBeenCalled();
			expect(displayHealth).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
			expect(result).toBe("main");
		});
	});

	describe("help:main", () => {
		it("shows help and returns 'main'", async () => {
			const handler = registry.getAction("help:main");
			const result = await handler(mockCtx());
			expect(showHelp).toHaveBeenCalledWith("main", mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
			expect(result).toBe("main");
		});
	});

	describe("info:show", () => {
		it("shows info and returns 'main'", async () => {
			const handler = registry.getAction("info:show");
			const result = await handler(mockCtx());
			expect(showInfo).toHaveBeenCalledWith(mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
			expect(result).toBe("main");
		});
	});

	describe("readme:show", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("readme:show");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("returns undefined when README.md does not exist", async () => {
			vi.mocked(disk.existsSync).mockReturnValue(false);
			const handler = registry.getAction("readme:show");
			expect(await handler(mockCtx())).toBeUndefined();
		});

		it("reads and logs README content when it exists", async () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);
			vi.mocked(disk.readFileSync).mockReturnValue("# Hello");
			const handler = registry.getAction("readme:show");
			const result = await handler(mockCtx());
			expect(disk.readFileSync).toHaveBeenCalled();
			expect(mockDeps.log).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
			expect(result).toBe("main");
		});
	});

	// ── View handlers ───────────────────────────────────────────────

	describe("components", () => {
		it("returns 'main' when no project", async () => {
			const handler = registry.getView("components");
			expect(await handler(noProjectCtx())).toBe("main");
		});

		it("calls componentListMenu with project context", async () => {
			const { componentListMenu } = await import("../../../src/ui/menus/component-list-menu.js");
			const handler = registry.getView("components");
			await handler(mockCtx());
			expect(componentListMenu).toHaveBeenCalled();
		});
	});

	describe("knowledgebase", () => {
		it("calls knowledgebaseMenu", async () => {
			const { knowledgebaseMenu } = await import("../../../src/ui/menus/knowledgebase-menu.js");
			const handler = registry.getView("knowledgebase");
			await handler(mockCtx());
			expect(knowledgebaseMenu).toHaveBeenCalledWith(mockDeps);
		});
	});

	describe("component-detail", () => {
		it("returns 'main' when no project", async () => {
			const handler = registry.getView("component-detail");
			expect(await handler(noProjectCtx())).toBe("main");
		});

		it("returns 'main' when no componentName param", async () => {
			const handler = registry.getView("component-detail");
			expect(await handler(mockCtx())).toBe("main");
		});

		it("returns 'main' when component not found", async () => {
			const { listProjectComponents } = await import("../../../src/ui/menus/component-list-menu.js");
			vi.mocked(listProjectComponents).mockReturnValue([]);
			const handler = registry.getView("component-detail");
			const ctx = mockCtx({ params: { componentName: "missing" } });
			expect(await handler(ctx)).toBe("main");
		});

		it("calls componentDetailMenu when component is found", async () => {
			const { listProjectComponents } = await import("../../../src/ui/menus/component-list-menu.js");
			const { componentDetailMenu } = await import("../../../src/ui/menus/component-detail-menu.js");
			const comp = { name: "Button", path: "/project/src/Button" };
			vi.mocked(listProjectComponents).mockReturnValue([comp] as ReturnType<typeof listProjectComponents>);
			const handler = registry.getView("component-detail");
			const ctx = mockCtx({ params: { componentName: "Button" } });
			await handler(ctx);
			expect(componentDetailMenu).toHaveBeenCalled();
		});
	});

	describe("iteration-detail", () => {
		it("returns 'main' when no project", async () => {
			const handler = registry.getView("iteration-detail");
			expect(await handler(noProjectCtx())).toBe("main");
		});

		it("returns 'main' when no iteration number resolved", async () => {
			const { resolveIterationNumber } = await import("../../../src/ui/menus/iteration-detail-menu.js");
			vi.mocked(resolveIterationNumber).mockReturnValue(null);
			const handler = registry.getView("iteration-detail");
			expect(await handler(mockCtx())).toBe("main");
		});

		it("calls iterationDetailMenu when iteration number is resolved", async () => {
			const { resolveIterationNumber, iterationDetailMenu } = await import("../../../src/ui/menus/iteration-detail-menu.js");
			vi.mocked(resolveIterationNumber).mockReturnValue(3);
			const handler = registry.getView("iteration-detail");
			await handler(mockCtx());
			expect(iterationDetailMenu).toHaveBeenCalled();
		});

		it("passes params.iterationNumber to resolveIterationNumber", async () => {
			const { resolveIterationNumber } = await import("../../../src/ui/menus/iteration-detail-menu.js");
			vi.mocked(resolveIterationNumber).mockReturnValue(5);
			const handler = registry.getView("iteration-detail");
			const ctx = mockCtx();
			ctx.params = { iterationNumber: 5 };
			await handler(ctx);
			expect(resolveIterationNumber).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), 5);
		});
	});
});
