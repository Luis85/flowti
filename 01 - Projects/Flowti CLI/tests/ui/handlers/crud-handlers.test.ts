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
	VAULT_ROOT: "/mock-vault", CLI_PROJECT: "/mock/cli", cliConfig: { agents: { dir: "agents" } }, PROJECTS_DIR: "/mock/projects", AGENTS_DIR: "/mock-vault/agents",
}));
vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-01-01T00:00:00.000Z", ms: () => 0, now: () => new Date("2026-01-01"), safeIso: () => "2026-01-01T00-00-00" },
}));
vi.mock("../../../src/infrastructure/deps.js", () => ({
	createDefaultDeps: vi.fn(() => ({ disk: {}, paths: {}, shell: {}, clock: {}, log: vi.fn() })),
}));

// ── Domain / UI mocks for CRUD ──────────────────────────────────────
vi.mock("../../../src/domain/raid/raid-store.js", () => ({
	listRAIDItems: vi.fn(() => []),
	createRAIDItem: vi.fn(),
	updateRAIDStatus: vi.fn(),
}));
vi.mock("../../../src/ui/displays/raid-display.js", () => ({
	renderRAIDList: vi.fn(),
	renderRAIDAdded: vi.fn(),
	renderRAIDUpdated: vi.fn(),
}));
vi.mock("../../../src/ui/menus/raid-menu.js", () => ({
	addRAIDInteractive: vi.fn(),
	updateStatusInteractive: vi.fn(),
}));
vi.mock("../../../src/domain/capa/capa-store.js", () => ({
	listCAPAItems: vi.fn(() => []),
}));
vi.mock("../../../src/ui/displays/capa-display.js", () => ({
	renderCAPAList: vi.fn(),
}));
vi.mock("../../../src/ui/menus/capa-menu.js", () => ({
	addCAPAInteractive: vi.fn(),
	updateStatusInteractive: vi.fn(),
}));
vi.mock("../../../src/domain/deliverables/deliverable-store.js", () => ({
	listDeliverables: vi.fn(() => []),
}));
vi.mock("../../../src/ui/displays/deliverables-display.js", () => ({
	renderDeliverableList: vi.fn(),
}));
vi.mock("../../../src/ui/menus/deliverables-menu.js", () => ({
	addDeliverableInteractive: vi.fn(),
	updateStatusInteractive: vi.fn(),
}));
vi.mock("../../../src/domain/resources/resource-store.js", () => ({
	listResources: vi.fn(() => []),
}));
vi.mock("../../../src/domain/resources/resource-analysis.js", () => ({
	analyzeFinancials: vi.fn(() => ({})),
}));
vi.mock("../../../src/ui/displays/resources-display.js", () => ({
	renderResourceList: vi.fn(),
	renderFinancialSummary: vi.fn(),
}));
vi.mock("../../../src/ui/menus/resources-menu.js", () => ({
	addResourceInteractive: vi.fn(),
}));
vi.mock("../../../src/domain/timelog/timelog-store.js", () => ({
	listTimeLogEntries: vi.fn(() => []),
	summarizeTimeLog: vi.fn(() => ({})),
}));
vi.mock("../../../src/ui/displays/timelog-display.js", () => ({
	renderTimeLogList: vi.fn(),
	renderTimeLogSummary: vi.fn(),
}));
vi.mock("../../../src/ui/menus/timelog-menu.js", () => ({
	logTimeInteractive: vi.fn(),
}));
vi.mock("../../../src/domain/iterations/iteration-store.js", () => ({
	listIterations: vi.fn(() => []),
}));
vi.mock("../../../src/ui/displays/iterations-display.js", () => ({
	renderIterationList: vi.fn(),
}));
vi.mock("../../../src/ui/menus/iterations-menu.js", () => ({
	addIterationInteractive: vi.fn(() => false),
	advanceIterationInteractive: vi.fn(),
	showCurrentIteration: vi.fn(),
	addAgentInteractive: vi.fn(),
	addResourceInteractive: vi.fn(),
	addEstimationInteractive: vi.fn(),
	addScopeItemInteractive: vi.fn(),
	addNoteInteractive: vi.fn(),
	editScopeInteractive: vi.fn(),
	removeScopeInteractive: vi.fn(),
	toggleScopeInteractive: vi.fn(),
	editDescriptionInteractive: vi.fn(),
	editNameInteractive: vi.fn(),
	editGoalInteractive: vi.fn(),
	editDatesInteractive: vi.fn(),
}));
vi.mock("../../../src/ui/menus/iterations-scope-menu.js", () => ({
	addScopeItemInteractive: vi.fn(),
}));
vi.mock("../../../src/domain/agents/agent-store.js", () => ({
	getProjectAgents: vi.fn(() => []),
	listAgents: vi.fn(() => []),
	findAgent: vi.fn(() => null),
	readSystemPrompt: vi.fn(() => null),
}));
vi.mock("../../../src/ui/handlers/iteration-template-loader.js", () => ({
	loadIterationTemplate: vi.fn(() => ({
		entityType: "iteration", states: ["new", "planned", "ready", "in-progress", "in-review", "done", "cancelled"],
		transitions: { "new": ["planned", "cancelled"], "planned": ["ready", "cancelled"], "ready": ["in-progress", "cancelled"], "in-progress": ["in-review", "cancelled"], "in-review": ["done", "cancelled"], "done": [], "cancelled": [] },
		initialState: "new", terminalStates: ["done", "cancelled"],
	})),
}));

// ── Imports ─────────────────────────────────────────────────────────
import { HandlerRegistry } from "../../../src/infrastructure/handler-registry.js";
import { registerCrudHandlers } from "../../../src/ui/handlers/crud-handlers.js";
import { input } from "../../../src/infrastructure/input.js";
import { listRAIDItems } from "../../../src/domain/raid/raid-store.js";
import { renderRAIDList } from "../../../src/ui/displays/raid-display.js";
import { addRAIDInteractive, updateStatusInteractive as updateRAIDStatus } from "../../../src/ui/menus/raid-menu.js";
import { listCAPAItems } from "../../../src/domain/capa/capa-store.js";
import { renderCAPAList } from "../../../src/ui/displays/capa-display.js";
import { addCAPAInteractive, updateStatusInteractive as updateCAPAStatus } from "../../../src/ui/menus/capa-menu.js";
import { listDeliverables } from "../../../src/domain/deliverables/deliverable-store.js";
import { renderDeliverableList } from "../../../src/ui/displays/deliverables-display.js";
import { addDeliverableInteractive, updateStatusInteractive as updateDeliverableStatus } from "../../../src/ui/menus/deliverables-menu.js";
import { listResources } from "../../../src/domain/resources/resource-store.js";
import { analyzeFinancials } from "../../../src/domain/resources/resource-analysis.js";
import { renderResourceList, renderFinancialSummary } from "../../../src/ui/displays/resources-display.js";
import { addResourceInteractive } from "../../../src/ui/menus/resources-menu.js";
import { listTimeLogEntries, summarizeTimeLog } from "../../../src/domain/timelog/timelog-store.js";
import { renderTimeLogList, renderTimeLogSummary } from "../../../src/ui/displays/timelog-display.js";
import { logTimeInteractive } from "../../../src/ui/menus/timelog-menu.js";
import { listIterations } from "../../../src/domain/iterations/iteration-store.js";
import { renderIterationList } from "../../../src/ui/displays/iterations-display.js";
import {
	addIterationInteractive, advanceIterationInteractive,
	showCurrentIteration, addAgentInteractive,
	addResourceInteractive as addIterResourceInteractive, addEstimationInteractive,
	addNoteInteractive,
} from "../../../src/ui/menus/iterations-menu.js";
import { addScopeItemInteractive } from "../../../src/ui/menus/iterations-scope-menu.js";
import { loadIterationTemplate } from "../../../src/ui/handlers/iteration-template-loader.js";

import type { RouterContext } from "../../../src/infrastructure/sitemap-types.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { clock } from "../../../src/infrastructure/clock.js";

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
};

function mockCtx(config: Record<string, unknown> = {}): RouterContext {
	return {
		deps: mockDeps,
		project: {
			config: {
				management: { raid: {}, deliverables: {}, capa: {}, resources: {}, timelog: {}, iterations: {} },
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

describe("registerCrudHandlers", () => {
	let registry: HandlerRegistry;

	beforeEach(() => {
		vi.clearAllMocks();
		registry = new HandlerRegistry();
		registerCrudHandlers(registry);
	});

	// ── Registration ────────────────────────────────────────────────

	describe("registration", () => {
		it("registers all expected CRUD actions", () => {
			const expectedActions = [
				"raid:list", "raid:add-risk", "raid:add-assumption", "raid:add-issue",
				"raid:add-dependency", "raid:add-decision", "raid:update-status",
				"capa:list", "capa:add-corrective", "capa:add-preventive", "capa:update-status",
				"deliverables:list", "deliverables:add", "deliverables:update-status",
				"resources:list", "resources:add-human", "resources:add-material",
				"resources:add-role", "resources:add-budget", "resources:financials",
				"timelog:list", "timelog:add", "timelog:summary",
				"iteration:list", "iteration:create", "iteration:advance", "iteration:current",
				"iteration:plan-ahead", "iteration:browse",
				"iteration:add-agent", "iteration:add-resource",
				"iteration:add-estimation", "iteration:add-scope", "iteration:add-note",
				"iteration:edit-scope", "iteration:remove-scope", "iteration:toggle-scope",
				"iteration:edit-description", "iteration:edit-name", "iteration:edit-goal", "iteration:edit-dates",
			];
			for (const id of expectedActions) {
				expect(registry.hasAction(id)).toBe(true);
			}
		});
	});

	// ── RAID handlers ───────────────────────────────────────────────

	describe("raid:list", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("raid:list");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("lists and renders RAID items", async () => {
			const handler = registry.getAction("raid:list");
			await handler(mockCtx());
			expect(listRAIDItems).toHaveBeenCalled();
			expect(renderRAIDList).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("raid:list");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("raid:add-risk", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("raid:add-risk");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addRAIDInteractive with 'risk' type", async () => {
			const handler = registry.getAction("raid:add-risk");
			await handler(mockCtx());
			expect(addRAIDInteractive).toHaveBeenCalledWith("risk", "/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	describe("raid:add-assumption", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("raid:add-assumption");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addRAIDInteractive with 'assumption' type", async () => {
			const handler = registry.getAction("raid:add-assumption");
			await handler(mockCtx());
			expect(addRAIDInteractive).toHaveBeenCalledWith("assumption", "/project", expect.anything(), mockDeps);
		});
	});

	describe("raid:add-issue", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("raid:add-issue");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addRAIDInteractive with 'issue' type", async () => {
			const handler = registry.getAction("raid:add-issue");
			await handler(mockCtx());
			expect(addRAIDInteractive).toHaveBeenCalledWith("issue", "/project", expect.anything(), mockDeps);
		});
	});

	describe("raid:add-dependency", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("raid:add-dependency");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addRAIDInteractive with 'dependency' type", async () => {
			const handler = registry.getAction("raid:add-dependency");
			await handler(mockCtx());
			expect(addRAIDInteractive).toHaveBeenCalledWith("dependency", "/project", expect.anything(), mockDeps);
		});
	});

	describe("raid:add-decision", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("raid:add-decision");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addRAIDInteractive with 'decision' type", async () => {
			const handler = registry.getAction("raid:add-decision");
			await handler(mockCtx());
			expect(addRAIDInteractive).toHaveBeenCalledWith("decision", "/project", expect.anything(), mockDeps);
		});
	});

	describe("raid:update-status", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("raid:update-status");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls updateStatusInteractive", async () => {
			const handler = registry.getAction("raid:update-status");
			await handler(mockCtx());
			expect(updateRAIDStatus).toHaveBeenCalledWith("/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── CAPA handlers ───────────────────────────────────────────────

	describe("capa:list", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("capa:list");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("lists and renders CAPA items", async () => {
			const handler = registry.getAction("capa:list");
			await handler(mockCtx());
			expect(listCAPAItems).toHaveBeenCalled();
			expect(renderCAPAList).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("capa:list");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("capa:add-corrective", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("capa:add-corrective");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addCAPAInteractive with 'corrective' type", async () => {
			const handler = registry.getAction("capa:add-corrective");
			await handler(mockCtx());
			expect(addCAPAInteractive).toHaveBeenCalledWith("corrective", "/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	describe("capa:add-preventive", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("capa:add-preventive");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addCAPAInteractive with 'preventive' type", async () => {
			const handler = registry.getAction("capa:add-preventive");
			await handler(mockCtx());
			expect(addCAPAInteractive).toHaveBeenCalledWith("preventive", "/project", expect.anything(), mockDeps);
		});
	});

	describe("capa:update-status", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("capa:update-status");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls updateStatusInteractive", async () => {
			const handler = registry.getAction("capa:update-status");
			await handler(mockCtx());
			expect(updateCAPAStatus).toHaveBeenCalledWith("/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── Deliverables handlers ───────────────────────────────────────

	describe("deliverables:list", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("deliverables:list");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("lists and renders deliverables", async () => {
			const handler = registry.getAction("deliverables:list");
			await handler(mockCtx());
			expect(listDeliverables).toHaveBeenCalled();
			expect(renderDeliverableList).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("deliverables:list");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("deliverables:add", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("deliverables:add");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addDeliverableInteractive", async () => {
			const handler = registry.getAction("deliverables:add");
			await handler(mockCtx());
			expect(addDeliverableInteractive).toHaveBeenCalledWith("/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	describe("deliverables:update-status", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("deliverables:update-status");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls updateStatusInteractive", async () => {
			const handler = registry.getAction("deliverables:update-status");
			await handler(mockCtx());
			expect(updateDeliverableStatus).toHaveBeenCalledWith("/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── Resources handlers ──────────────────────────────────────────

	describe("resources:list", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("resources:list");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("lists and renders resources", async () => {
			const handler = registry.getAction("resources:list");
			await handler(mockCtx());
			expect(listResources).toHaveBeenCalled();
			expect(renderResourceList).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("resources:list");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("resources:add-human", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("resources:add-human");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addResourceInteractive with 'human' type", async () => {
			const handler = registry.getAction("resources:add-human");
			await handler(mockCtx());
			expect(addResourceInteractive).toHaveBeenCalledWith("/project", "human", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	describe("resources:add-material", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("resources:add-material");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addResourceInteractive with 'material' type", async () => {
			const handler = registry.getAction("resources:add-material");
			await handler(mockCtx());
			expect(addResourceInteractive).toHaveBeenCalledWith("/project", "material", expect.anything(), mockDeps);
		});
	});

	describe("resources:add-role", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("resources:add-role");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addResourceInteractive with 'role' type", async () => {
			const handler = registry.getAction("resources:add-role");
			await handler(mockCtx());
			expect(addResourceInteractive).toHaveBeenCalledWith("/project", "role", expect.anything(), mockDeps);
		});
	});

	describe("resources:add-budget", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("resources:add-budget");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls addResourceInteractive with 'budget' type", async () => {
			const handler = registry.getAction("resources:add-budget");
			await handler(mockCtx());
			expect(addResourceInteractive).toHaveBeenCalledWith("/project", "budget", expect.anything(), mockDeps);
		});
	});

	describe("resources:financials", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("resources:financials");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("analyzes and renders financial summary", async () => {
			const handler = registry.getAction("resources:financials");
			await handler(mockCtx());
			expect(listResources).toHaveBeenCalled();
			expect(analyzeFinancials).toHaveBeenCalled();
			expect(renderFinancialSummary).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("resources:financials");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	// ── Timelog handlers ────────────────────────────────────────────

	describe("timelog:list", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("timelog:list");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("lists and renders time log entries", async () => {
			const handler = registry.getAction("timelog:list");
			await handler(mockCtx());
			expect(listTimeLogEntries).toHaveBeenCalled();
			expect(renderTimeLogList).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("timelog:list");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("timelog:add", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("timelog:add");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls logTimeInteractive", async () => {
			const handler = registry.getAction("timelog:add");
			await handler(mockCtx());
			expect(logTimeInteractive).toHaveBeenCalledWith("/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("timelog:add");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("timelog:summary", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("timelog:summary");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("summarizes and renders time log", async () => {
			const handler = registry.getAction("timelog:summary");
			await handler(mockCtx());
			expect(listTimeLogEntries).toHaveBeenCalled();
			expect(summarizeTimeLog).toHaveBeenCalled();
			expect(renderTimeLogSummary).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("timelog:summary");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	// ── Iteration handlers ─────────────────────────────────────────

	describe("iteration:list", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("iteration:list");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls the correct function", async () => {
			const handler = registry.getAction("iteration:list");
			await handler(mockCtx());
			expect(listIterations).toHaveBeenCalled();
			expect(renderIterationList).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' on success", async () => {
			const handler = registry.getAction("iteration:list");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});
	});

	describe("iteration:create", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("iteration:create");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls the correct function", async () => {
			const handler = registry.getAction("iteration:create");
			await handler(mockCtx());
			expect(loadIterationTemplate).toHaveBeenCalled();
			expect(addIterationInteractive).toHaveBeenCalledWith("/project", expect.anything(), mockDeps, expect.anything());
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("returns 'main' when not created", async () => {
			vi.mocked(addIterationInteractive).mockResolvedValueOnce(false);
			const handler = registry.getAction("iteration:create");
			const result = await handler(mockCtx());
			expect(result).toBe("main");
		});

		it("returns 'navigate:iteration-detail' when created", async () => {
			vi.mocked(addIterationInteractive).mockResolvedValueOnce(true);
			const handler = registry.getAction("iteration:create");
			const result = await handler(mockCtx());
			expect(result).toBe("navigate:iteration-detail");
		});
	});

	describe("iteration:advance", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("iteration:advance");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("loads template and calls advanceIterationInteractive", async () => {
			const handler = registry.getAction("iteration:advance");
			await handler(mockCtx());
			expect(loadIterationTemplate).toHaveBeenCalled();
			expect(advanceIterationInteractive).toHaveBeenCalledWith("/project", expect.anything(), expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("navigates back to iteration-detail on success", async () => {
			const handler = registry.getAction("iteration:advance");
			const result = await handler(mockCtx());
			expect(result).toBe("navigate:iteration-detail");
		});

		it("shows error when template cannot be loaded", async () => {
			vi.mocked(loadIterationTemplate).mockReturnValueOnce(null);
			const handler = registry.getAction("iteration:advance");
			const result = await handler(mockCtx());
			expect(result).toBe("navigate:iteration-detail");
			expect(advanceIterationInteractive).not.toHaveBeenCalled();
		});
	});

	describe("iteration:current", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("iteration:current");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls the correct function", async () => {
			const handler = registry.getAction("iteration:current");
			await handler(mockCtx());
			expect(showCurrentIteration).toHaveBeenCalledWith("/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("navigates back to iteration-detail", async () => {
			const handler = registry.getAction("iteration:current");
			const result = await handler(mockCtx());
			expect(result).toBe("navigate:iteration-detail");
		});
	});


	describe("iteration:add-agent", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("iteration:add-agent");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls the correct function with vault agents path", async () => {
			const handler = registry.getAction("iteration:add-agent");
			await handler(mockCtx());
			expect(addAgentInteractive).toHaveBeenCalledWith("/project", expect.anything(), mockDeps, {
				agentsBasePath: "/mock-vault", agentsConfig: { dir: "agents" },
			});
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("navigates back to iteration-detail", async () => {
			const handler = registry.getAction("iteration:add-agent");
			const result = await handler(mockCtx());
			expect(result).toBe("navigate:iteration-detail");
		});
	});

	describe("iteration:add-resource", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("iteration:add-resource");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls the correct function", async () => {
			const handler = registry.getAction("iteration:add-resource");
			await handler(mockCtx());
			expect(addIterResourceInteractive).toHaveBeenCalledWith("/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("navigates back to iteration-detail", async () => {
			const handler = registry.getAction("iteration:add-resource");
			const result = await handler(mockCtx());
			expect(result).toBe("navigate:iteration-detail");
		});
	});

	describe("iteration:add-estimation", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("iteration:add-estimation");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls the correct function", async () => {
			const handler = registry.getAction("iteration:add-estimation");
			await handler(mockCtx());
			expect(addEstimationInteractive).toHaveBeenCalledWith("/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("navigates back to iteration-detail", async () => {
			const handler = registry.getAction("iteration:add-estimation");
			const result = await handler(mockCtx());
			expect(result).toBe("navigate:iteration-detail");
		});
	});

	describe("iteration:add-scope", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("iteration:add-scope");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls the correct function with recommendations", async () => {
			const handler = registry.getAction("iteration:add-scope");
			await handler(mockCtx());
			expect(addScopeItemInteractive).toHaveBeenCalledWith("/project", expect.anything(), mockDeps, expect.objectContaining({ recommendations: expect.any(Array) }));
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("navigates back to iteration-detail", async () => {
			const handler = registry.getAction("iteration:add-scope");
			const result = await handler(mockCtx());
			expect(result).toBe("navigate:iteration-detail");
		});
	});

	describe("iteration:add-note", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("iteration:add-note");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls the correct function", async () => {
			const handler = registry.getAction("iteration:add-note");
			await handler(mockCtx());
			expect(addNoteInteractive).toHaveBeenCalledWith("/project", expect.anything(), mockDeps);
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("navigates back to iteration-detail", async () => {
			const handler = registry.getAction("iteration:add-note");
			const result = await handler(mockCtx());
			expect(result).toBe("navigate:iteration-detail");
		});
	});

});
