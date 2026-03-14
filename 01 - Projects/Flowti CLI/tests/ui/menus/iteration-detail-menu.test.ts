import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/infrastructure/menu.js", () => ({ runMenu: vi.fn() }));
vi.mock("../../../src/domain/iterations/iteration-store.js", () => ({
	listIterations: vi.fn(() => []),
	findCurrentIteration: vi.fn(),
}));
vi.mock("../../../src/ui/displays/iterations-display.js", () => ({
	renderIterationDetail: vi.fn(),
	renderGateStatus: vi.fn(),
}));
vi.mock("../../../src/domain/lifecycle/lifecycle-engine.js", () => ({
	getValidTransitions: vi.fn(() => []),
	getGates: vi.fn(() => []),
}));
vi.mock("../../../src/domain/iterations/iteration-gates.js", () => ({
	makeGateEvaluator: vi.fn(() => () => ({ gateId: "test", passed: true })),
}));

import { runMenu } from "../../../src/infrastructure/menu.js";
import { listIterations, findCurrentIteration } from "../../../src/domain/iterations/iteration-store.js";
import { renderIterationDetail, renderGateStatus } from "../../../src/ui/displays/iterations-display.js";
import { getValidTransitions, getGates } from "../../../src/domain/lifecycle/lifecycle-engine.js";
import { iterationDetailMenu, resolveCurrentIterationNumber, resolveIterationNumber } from "../../../src/ui/menus/iteration-detail-menu.js";
import type { MenuDeps } from "../../../src/infrastructure/deps.js";
import type { IterationSummary } from "../../../src/domain/iterations/iteration-types.js";
import type { IterationsConfig, MenuEntry } from "../../../src/infrastructure/types.js";
import type { LifecycleTemplate } from "../../../src/domain/lifecycle/lifecycle-types.js";

const mockRunMenu = vi.mocked(runMenu);
const mockListIterations = vi.mocked(listIterations);
const mockFindCurrent = vi.mocked(findCurrentIteration);
const mockRenderDetail = vi.mocked(renderIterationDetail);

const PROJECT_PATH = "/projects/my-project";
const CONFIG: IterationsConfig = { durationDays: 14 };

function makeDeps(overrides: Partial<MenuDeps> = {}): MenuDeps {
	return {
		disk: {} as any,
		paths: {
			join: (...args: string[]) => args.join("/"),
			relative: (from: string, to: string) => to.replace(from + "/", ""),
			resolve: (...args: string[]) => args.join("/"),
		} as any,
		clock: { now: () => 0, ms: () => 0, iso: () => "2026-03-14T00:00:00.000Z", safeIso: () => "2026-03-14T000000" },
		input: {
			ask: vi.fn(),
			askYesNo: vi.fn(),
			waitForEnter: vi.fn(),
			select: vi.fn(),
		},
		log: vi.fn(),
		...overrides,
	} as any;
}

function makeIteration(overrides: Partial<IterationSummary> = {}): IterationSummary {
	return {
		name: "Sprint 1",
		number: 1,
		startDate: "2026-03-14",
		endDate: "2026-03-28",
		goal: "Deliver MVP",
		capacity: "40",
		description: "",
		status: "in-progress",
		file: "iterations/sprint-1.md",
		agents: [],
		resources: [],
		capacities: [],
		scopeItems: [],
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ── iterationDetailMenu ─────────────────────────────────────────────

describe("iterationDetailMenu", () => {
	it("returns 'main' when iteration not found", async () => {
		mockListIterations.mockReturnValue([]);

		const result = await iterationDetailMenu(PROJECT_PATH, 99, CONFIG, undefined, makeDeps());

		expect(result).toBe("main");
		expect(mockRunMenu).not.toHaveBeenCalled();
		expect(mockRenderDetail).not.toHaveBeenCalled();
	});

	it("renders detail and runs menu when iteration found", async () => {
		const deps = makeDeps();
		const iteration = makeIteration();
		mockListIterations.mockReturnValue([iteration]);
		mockRunMenu.mockResolvedValue("main");

		await iterationDetailMenu(PROJECT_PATH, 1, CONFIG, undefined, deps);

		expect(mockRunMenu).toHaveBeenCalledTimes(1);
		const [title, , options] = mockRunMenu.mock.calls[0];
		expect(title).toBe("#1 — Sprint 1");
		// renderIterationDetail is called via beforeMenu
		expect(options?.beforeMenu).toBeDefined();
		(options as any).beforeMenu();
		expect(mockRenderDetail).toHaveBeenCalledWith(iteration, deps.log);
	});

	it("adds back item when no dataSourceEntries provided", async () => {
		const iteration = makeIteration();
		mockListIterations.mockReturnValue([iteration]);
		mockRunMenu.mockResolvedValue("main");

		await iterationDetailMenu(PROJECT_PATH, 1, CONFIG, undefined, makeDeps());

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items).toHaveLength(1);
		expect(items[0].label).toBe("Back");
		expect(await (items[0] as any).action()).toBe("main");
	});

	it("uses _actions from dataSourceEntries when provided", async () => {
		const iteration = makeIteration();
		mockListIterations.mockReturnValue([iteration]);
		mockRunMenu.mockResolvedValue("main");

		const action1: MenuEntry = { key: "1", label: "Planning", action: () => "main" as const };
		const action2: MenuEntry = { key: "b", label: "Back", action: () => "main" as const };
		const slots: Readonly<Record<string, readonly MenuEntry[]>> = {
			"_actions": [action1, action2],
		};

		await iterationDetailMenu(PROJECT_PATH, 1, CONFIG, slots, makeDeps());

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items).toHaveLength(2);
		expect(items[0].label).toBe("Planning");
		expect(items[1].label).toBe("Back");
	});

	it("falls back to Back entry when dataSourceEntries has no _actions", async () => {
		const iteration = makeIteration();
		mockListIterations.mockReturnValue([iteration]);
		mockRunMenu.mockResolvedValue("main");

		const slots: Readonly<Record<string, readonly MenuEntry[]>> = {};

		await iterationDetailMenu(PROJECT_PATH, 1, CONFIG, slots, makeDeps());

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items).toHaveLength(1);
		expect(items[0].label).toBe("Back");
	});

	it("passes config to listIterations", async () => {
		const deps = makeDeps();
		mockListIterations.mockReturnValue([]);

		await iterationDetailMenu(PROJECT_PATH, 1, CONFIG, undefined, deps);

		expect(mockListIterations).toHaveBeenCalledWith(deps, PROJECT_PATH, CONFIG);
	});

	it("works with undefined config", async () => {
		const deps = makeDeps();
		mockListIterations.mockReturnValue([]);

		await iterationDetailMenu(PROJECT_PATH, 1, undefined, undefined, deps);

		expect(mockListIterations).toHaveBeenCalledWith(deps, PROJECT_PATH, undefined);
	});
});

// ── resolveCurrentIterationNumber ───────────────────────────────────

describe("resolveCurrentIterationNumber", () => {
	it("returns iteration number when current iteration exists", () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration({ number: 3 }));

		const result = resolveCurrentIterationNumber(PROJECT_PATH, CONFIG, deps);

		expect(result).toBe(3);
		expect(mockFindCurrent).toHaveBeenCalledWith(deps, PROJECT_PATH, CONFIG);
	});

	it("returns null when no current iteration", () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(null);

		const result = resolveCurrentIterationNumber(PROJECT_PATH, CONFIG, deps);

		expect(result).toBeNull();
	});

	it("returns null when config is undefined", () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(null);

		const result = resolveCurrentIterationNumber(PROJECT_PATH, undefined, deps);

		expect(result).toBeNull();
		expect(mockFindCurrent).toHaveBeenCalledWith(deps, PROJECT_PATH, undefined);
	});
});

// ── resolveIterationNumber ──────────────────────────────────────────

describe("resolveIterationNumber", () => {
	it("returns target number when iteration exists", () => {
		const deps = makeDeps();
		mockListIterations.mockReturnValue([
			makeIteration({ number: 1 }),
			makeIteration({ number: 2 }),
		]);

		const result = resolveIterationNumber(PROJECT_PATH, CONFIG, deps, 2);
		expect(result).toBe(2);
	});

	it("returns null when target number not found", () => {
		const deps = makeDeps();
		mockListIterations.mockReturnValue([makeIteration({ number: 1 })]);

		const result = resolveIterationNumber(PROJECT_PATH, CONFIG, deps, 99);
		expect(result).toBeNull();
	});

	it("falls back to current iteration when no target specified", () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration({ number: 3 }));

		const result = resolveIterationNumber(PROJECT_PATH, CONFIG, deps);
		expect(result).toBe(3);
	});

	it("returns null when no target and no current iteration", () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(null);

		const result = resolveIterationNumber(PROJECT_PATH, CONFIG, deps);
		expect(result).toBeNull();
	});
});

// ── Advance label and gate status ───────────────────────────────────

const mockTemplate: LifecycleTemplate = {
	entityType: "iteration", initialState: "new", terminalStates: ["done", "cancelled"],
	states: {
		new: { transitions: ["planned", "cancelled"] },
		planned: { transitions: ["ready", "cancelled"] },
		ready: { transitions: [] },
		done: { transitions: [] },
		cancelled: { transitions: [] },
	},
	labels: { planned: "Planned", ready: "Ready" },
};

describe("advance label with template", () => {
	it("shows target state in Advance label", async () => {
		const iteration = makeIteration({ status: "new" });
		mockListIterations.mockReturnValue([iteration]);
		mockRunMenu.mockResolvedValue("main");
		vi.mocked(getValidTransitions).mockReturnValue(["planned", "cancelled"]);

		const advanceAction: MenuEntry = { key: "a", label: "Advance", action: () => "main" as const };
		const slots: Readonly<Record<string, readonly MenuEntry[]>> = { _actions: [advanceAction] };

		await iterationDetailMenu(PROJECT_PATH, 1, CONFIG, slots, makeDeps(), mockTemplate);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items[0]).toHaveProperty("label", "Advance → Planned");
	});

	it("keeps plain Advance label when no valid transitions", async () => {
		const iteration = makeIteration({ status: "done" });
		mockListIterations.mockReturnValue([iteration]);
		mockRunMenu.mockResolvedValue("main");
		vi.mocked(getValidTransitions).mockReturnValue([]);

		const advanceAction: MenuEntry = { key: "a", label: "Advance", action: () => "main" as const };
		const slots: Readonly<Record<string, readonly MenuEntry[]>> = { _actions: [advanceAction] };

		await iterationDetailMenu(PROJECT_PATH, 1, CONFIG, slots, makeDeps(), mockTemplate);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items[0]).toHaveProperty("label", "Advance");
	});
});

describe("gate status display", () => {
	it("shows gate status when template has gates", async () => {
		const deps = makeDeps();
		const iteration = makeIteration({ status: "new" });
		mockListIterations.mockReturnValue([iteration]);
		mockRunMenu.mockResolvedValue("main");
		vi.mocked(getGates).mockReturnValue([{ id: "has-goal", label: "Goal defined" }]);

		await iterationDetailMenu(PROJECT_PATH, 1, CONFIG, undefined, deps, mockTemplate);

		const [, , options] = mockRunMenu.mock.calls[0];
		(options as any).beforeMenu();
		expect(renderGateStatus).toHaveBeenCalled();
	});

	it("does not show gate status when no gates for current state", async () => {
		const deps = makeDeps();
		const iteration = makeIteration({ status: "new" });
		mockListIterations.mockReturnValue([iteration]);
		mockRunMenu.mockResolvedValue("main");
		vi.mocked(getGates).mockReturnValue([]);

		await iterationDetailMenu(PROJECT_PATH, 1, CONFIG, undefined, deps, mockTemplate);

		const [, , options] = mockRunMenu.mock.calls[0];
		(options as any).beforeMenu();
		expect(renderGateStatus).not.toHaveBeenCalled();
	});

	it("does not show gate status when no template provided", async () => {
		const deps = makeDeps();
		const iteration = makeIteration({ status: "new" });
		mockListIterations.mockReturnValue([iteration]);
		mockRunMenu.mockResolvedValue("main");

		await iterationDetailMenu(PROJECT_PATH, 1, CONFIG, undefined, deps);

		const [, , options] = mockRunMenu.mock.calls[0];
		(options as any).beforeMenu();
		expect(renderGateStatus).not.toHaveBeenCalled();
	});
});
