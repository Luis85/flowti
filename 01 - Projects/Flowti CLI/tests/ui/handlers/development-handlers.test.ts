import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Infrastructure mocks ────────────────────────────────────────────
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), readdirSync: vi.fn(() => []), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: { join: (...args: string[]) => args.join("/"), resolve: (...args: string[]) => args.join("/"), basename: (p: string) => p.split("/").pop() ?? "", relative: (from: string, to: string) => to, sep: "/" },
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

// ── Domain / UI mocks for Development handlers ─────────────────────

const mockListEventsInteractive = vi.fn();
const mockAddEventInteractive = vi.fn();
vi.mock("../../../src/ui/menus/event-catalog-menu.js", () => ({
	listEventsInteractive: (...args: unknown[]) => mockListEventsInteractive(...args),
	addEventInteractive: (...args: unknown[]) => mockAddEventInteractive(...args),
}));

const mockSaveEventFlowDoc = vi.fn(() => "/project/docs/event-flow.md");
vi.mock("../../../src/domain/events/event-flow.js", () => ({
	saveEventFlowDoc: (...args: unknown[]) => mockSaveEventFlowDoc(...args),
}));

const mockLifecycleStatusMenu = vi.fn(() => "main");
vi.mock("../../../src/ui/menus/lifecycle-menu.js", () => ({
	lifecycleStatusMenu: (...args: unknown[]) => mockLifecycleStatusMenu(...args),
}));

const mockNestedItemsMenu = vi.fn(() => "main");
vi.mock("../../../src/ui/menus/nested-lifecycle-menu.js", () => ({
	nestedItemsMenu: (...args: unknown[]) => mockNestedItemsMenu(...args),
}));

const mockListRequirements = vi.fn(() => []);
vi.mock("../../../src/domain/requirements/requirement-store.js", () => ({
	listRequirements: (...args: unknown[]) => mockListRequirements(...args),
}));

const mockRenderRequirementList = vi.fn();
vi.mock("../../../src/ui/displays/requirements-display.js", () => ({
	renderRequirementList: (...args: unknown[]) => mockRenderRequirementList(...args),
}));

const mockAddRequirementInteractive = vi.fn();
const mockAddUseCaseInteractive = vi.fn();
const mockAddUserStoryInteractive = vi.fn();
const mockUpdateStatusInteractive = vi.fn();
vi.mock("../../../src/ui/menus/requirements-menu.js", () => ({
	addRequirementInteractive: (...args: unknown[]) => mockAddRequirementInteractive(...args),
	addUseCaseInteractive: (...args: unknown[]) => mockAddUseCaseInteractive(...args),
	addUserStoryInteractive: (...args: unknown[]) => mockAddUserStoryInteractive(...args),
	updateStatusInteractive: (...args: unknown[]) => mockUpdateStatusInteractive(...args),
}));

// ── Imports ─────────────────────────────────────────────────────────
import { HandlerRegistry } from "../../../src/infrastructure/handler-registry.js";
import { registerDevelopmentHandlers } from "../../../src/ui/handlers/development-handlers.js";
import { input } from "../../../src/infrastructure/input.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { clock } from "../../../src/infrastructure/clock.js";

import type { RouterContext } from "../../../src/infrastructure/sitemap-types.js";

// ── Helpers ─────────────────────────────────────────────────────────

const mockDeps = {
	disk,
	paths: { join: (...args: string[]) => args.join("/"), resolve: (...args: string[]) => args.join("/"), basename: (p: string) => p.split("/").pop() ?? "", relative: (from: string, to: string) => to, sep: "/" },
	clock,
	input,
	log: vi.fn(),
	warn: vi.fn(),
	shell: { run: vi.fn(() => 0), runSilent: vi.fn(), runCapture: vi.fn(() => ""), runCaptureStatus: vi.fn(() => ({ exitCode: 0, output: "" })) },
	proc: { exit: vi.fn(), argv: [] },
	bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
};

function mockCtx(config: Record<string, unknown> = {}): RouterContext {
	return {
		deps: mockDeps,
		project: {
			config: {
				name: "TestProject",
				management: {
					raid: {}, deliverables: {}, capa: {}, resources: {}, timelog: {}, iterations: {},
					lifecycle: { featuresDir: "features", productsDir: "products" },
					requirements: {},
				},
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
	return { deps: mockDeps, project: undefined } as unknown as RouterContext;
}

// ── Suite ───────────────────────────────────────────────────────────

describe("registerDevelopmentHandlers", () => {
	let registry: HandlerRegistry;

	beforeEach(() => {
		vi.clearAllMocks();
		registry = new HandlerRegistry();
		registerDevelopmentHandlers(registry);
	});

	// ── Registration ────────────────────────────────────────────────

	describe("registration", () => {
		it("registers all expected development actions", () => {
			const expectedActions = [
				"events:list", "events:add", "events:flow",
				"lifecycle:project", "lifecycle:features", "lifecycle:products",
				"req:list", "req:add-functional", "req:add-nonfunctional",
				"req:add-constraint", "req:add-usecase", "req:add-userstory",
				"req:update-status",
			];
			for (const id of expectedActions) {
				expect(registry.hasAction(id)).toBe(true);
			}
		});
	});

	// ── Event Catalog handlers ──────────────────────────────────────

	describe("events:list", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("events:list");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls listEventsInteractive and waits for enter", async () => {
			const handler = registry.getAction("events:list");
			await handler(mockCtx());
			expect(mockListEventsInteractive).toHaveBeenCalledWith("/project", mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("events:list");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("events:add", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("events:add");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addEventInteractive and waits for enter", async () => {
			const handler = registry.getAction("events:add");
			await handler(mockCtx());
			expect(mockAddEventInteractive).toHaveBeenCalledWith("/project", mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("events:add");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("events:flow", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("events:flow");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls saveEventFlowDoc with deps and project path", async () => {
			const handler = registry.getAction("events:flow");
			await handler(mockCtx());
			expect(mockSaveEventFlowDoc).toHaveBeenCalledWith(
				expect.objectContaining({ disk: expect.anything(), paths: expect.anything(), clock: expect.anything() }),
				"/project",
			);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("logs the generated file path", async () => {
			const handler = registry.getAction("events:flow");
			await handler(mockCtx());
			expect(mockDeps.log).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("events:flow");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	// ── Lifecycle handlers ──────────────────────────────────────────

	describe("lifecycle:project", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("lifecycle:project");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls lifecycleStatusMenu with project path, name, and 'project' type", async () => {
			const handler = registry.getAction("lifecycle:project");
			await handler(mockCtx());
			expect(mockLifecycleStatusMenu).toHaveBeenCalledWith("/project", "TestProject", "project", mockDeps);
		});

		it("returns the menu result", async () => {
			mockLifecycleStatusMenu.mockReturnValueOnce("main");
			const handler = registry.getAction("lifecycle:project");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("lifecycle:features", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("lifecycle:features");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls nestedItemsMenu with 'feature' type and featuresDir", async () => {
			const handler = registry.getAction("lifecycle:features");
			await handler(mockCtx());
			expect(mockNestedItemsMenu).toHaveBeenCalledWith("/project", "feature", mockDeps, "features");
		});

		it("returns the menu result", async () => {
			mockNestedItemsMenu.mockReturnValueOnce("main");
			const handler = registry.getAction("lifecycle:features");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("lifecycle:products", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("lifecycle:products");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls nestedItemsMenu with 'product' type and productsDir", async () => {
			const handler = registry.getAction("lifecycle:products");
			await handler(mockCtx());
			expect(mockNestedItemsMenu).toHaveBeenCalledWith("/project", "product", mockDeps, "products");
		});

		it("returns the menu result", async () => {
			mockNestedItemsMenu.mockReturnValueOnce("main");
			const handler = registry.getAction("lifecycle:products");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	// ── Requirements handlers ───────────────────────────────────────

	describe("req:list", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("req:list");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("lists and renders requirements", async () => {
			const handler = registry.getAction("req:list");
			await handler(mockCtx());
			expect(mockListRequirements).toHaveBeenCalled();
			expect(mockRenderRequirementList).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("req:list");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("req:add-functional", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("req:add-functional");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addRequirementInteractive with 'functional' type", async () => {
			const handler = registry.getAction("req:add-functional");
			await handler(mockCtx());
			expect(mockAddRequirementInteractive).toHaveBeenCalledWith("functional", "/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("req:add-functional");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("req:add-nonfunctional", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("req:add-nonfunctional");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addRequirementInteractive with 'non-functional' type", async () => {
			const handler = registry.getAction("req:add-nonfunctional");
			await handler(mockCtx());
			expect(mockAddRequirementInteractive).toHaveBeenCalledWith("non-functional", "/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("req:add-nonfunctional");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("req:add-constraint", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("req:add-constraint");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addRequirementInteractive with 'constraint' type", async () => {
			const handler = registry.getAction("req:add-constraint");
			await handler(mockCtx());
			expect(mockAddRequirementInteractive).toHaveBeenCalledWith("constraint", "/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("req:add-constraint");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("req:add-usecase", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("req:add-usecase");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addUseCaseInteractive", async () => {
			const handler = registry.getAction("req:add-usecase");
			await handler(mockCtx());
			expect(mockAddUseCaseInteractive).toHaveBeenCalledWith("/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("req:add-usecase");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("req:add-userstory", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("req:add-userstory");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addUserStoryInteractive", async () => {
			const handler = registry.getAction("req:add-userstory");
			await handler(mockCtx());
			expect(mockAddUserStoryInteractive).toHaveBeenCalledWith("/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("req:add-userstory");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("req:update-status", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("req:update-status");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls updateStatusInteractive", async () => {
			const handler = registry.getAction("req:update-status");
			await handler(mockCtx());
			expect(mockUpdateStatusInteractive).toHaveBeenCalledWith("/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("req:update-status");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});
});
