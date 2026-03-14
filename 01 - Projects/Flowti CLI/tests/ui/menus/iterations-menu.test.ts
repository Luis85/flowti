import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/infrastructure/menu.js", () => ({ runMenu: vi.fn() }));
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), readdirSync: vi.fn(() => []), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		relative: (from: string, to: string) => to.replace(from + "/", ""),
		resolve: (...args: string[]) => args.join("/"),
	},
}));
vi.mock("../../../src/domain/iterations/iteration-store.js", () => ({
	listIterations: vi.fn(() => []),
	createIteration: vi.fn(),
	transitionIteration: vi.fn(() => ({ success: true, from: "new", to: "planned" })),
	closeIteration: vi.fn(() => ({ success: true, from: "in-review", to: "done" })),
	findCurrentIteration: vi.fn(),
	nextIterationNumber: vi.fn(() => 1),
	computeEndDate: vi.fn(() => "2026-03-28"),
	attachAgent: vi.fn(),
	addResource: vi.fn(),
	addCapacity: vi.fn(),
	addScopeItem: vi.fn(),
	addNote: vi.fn(),
	updateName: vi.fn(() => true),
	updateGoal: vi.fn(() => true),
	updateStartDate: vi.fn(() => true),
	updateEndDate: vi.fn(() => true),
	updateDescription: vi.fn(),
	editScopeItem: vi.fn(),
	removeScopeItem: vi.fn(),
	toggleScopeItem: vi.fn(),
}));
vi.mock("../../../src/domain/lifecycle/lifecycle-engine.js", () => ({
	getValidTransitions: vi.fn(() => ["planned"]),
}));
vi.mock("../../../src/ui/displays/iterations-display.js", () => ({
	renderIterationCreated: vi.fn(),
	renderIterationStarted: vi.fn(),
	renderIterationClosed: vi.fn(),
	renderIterationDetail: vi.fn(),
	renderAgentAttached: vi.fn(),
	renderResourceAdded: vi.fn(),
	renderCapacityAdded: vi.fn(),
	renderIterationAdvanced: vi.fn(),
	renderAdvanceResult: vi.fn(),
	renderGateResults: vi.fn(),
	renderScopeItems: vi.fn(),
}));

import { printHeader } from "../../../src/infrastructure/ui.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import {
	listIterations, createIteration, transitionIteration, closeIteration,
	findCurrentIteration, nextIterationNumber, computeEndDate,
	attachAgent, addResource, addCapacity, addScopeItem, addNote,
	updateName, updateGoal, updateStartDate, updateEndDate,
	updateDescription, editScopeItem, removeScopeItem, toggleScopeItem,
} from "../../../src/domain/iterations/iteration-store.js";
import { getValidTransitions } from "../../../src/domain/lifecycle/lifecycle-engine.js";
import {
	renderIterationCreated, renderIterationClosed,
	renderIterationDetail, renderAgentAttached, renderResourceAdded,
	renderCapacityAdded, renderAdvanceResult,
} from "../../../src/ui/displays/iterations-display.js";
import {
	addIterationInteractive, advanceIterationInteractive,
	showCurrentIteration, attachAgentInteractive, addResourceInteractive,
	addCapacityInteractive, addScopeItemInteractive,
	addNoteInteractive, editDescriptionInteractive,
	editNameInteractive, editGoalInteractive, editDatesInteractive,
	editScopeInteractive, removeScopeInteractive, toggleScopeInteractive,
} from "../../../src/ui/menus/iterations-menu.js";
import type { IterationSummary } from "../../../src/domain/iterations/iteration-types.js";
import type { IterationsConfig } from "../../../src/infrastructure/types.js";
import type { LifecycleTemplate } from "../../../src/domain/lifecycle/lifecycle-types.js";
import type { MenuDeps } from "../../../src/infrastructure/deps.js";

const mockListIterations = vi.mocked(listIterations);
const mockCreateIteration = vi.mocked(createIteration);
const mockTransitionIteration = vi.mocked(transitionIteration);
const mockCloseIteration = vi.mocked(closeIteration);
const mockFindCurrent = vi.mocked(findCurrentIteration);
const mockNextNumber = vi.mocked(nextIterationNumber);
const mockGetValidTransitions = vi.mocked(getValidTransitions);
const mockComputeEnd = vi.mocked(computeEndDate);
const mockAttachAgent = vi.mocked(attachAgent);
const mockAddResource = vi.mocked(addResource);
const mockAddCapacity = vi.mocked(addCapacity);
const mockAddScopeItem = vi.mocked(addScopeItem);
const mockAddNote = vi.mocked(addNote);
const mockUpdateDescription = vi.mocked(updateDescription);
const mockEditScopeItem = vi.mocked(editScopeItem);
const mockRemoveScopeItem = vi.mocked(removeScopeItem);
const mockToggleScopeItem = vi.mocked(toggleScopeItem);
const mockRenderCreated = vi.mocked(renderIterationCreated);
const mockRenderClosed = vi.mocked(renderIterationClosed);
const mockRenderDetail = vi.mocked(renderIterationDetail);
const mockRenderAgentAttached = vi.mocked(renderAgentAttached);
const mockRenderResourceAdded = vi.mocked(renderResourceAdded);
const mockRenderCapacityAdded = vi.mocked(renderCapacityAdded);
const mockRenderAdvanceResult = vi.mocked(renderAdvanceResult);
const mockDisk = vi.mocked(disk);

const PROJECT = "/projects/my-project";
const CONFIG: IterationsConfig = { durationDays: 14 };

function makeDeps(overrides: Partial<MenuDeps> = {}): MenuDeps {
	return {
		disk,
		paths,
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

// ── addIterationInteractive ─────────────────────────────────────────

describe("addIterationInteractive", () => {
	it("returns false when name is empty", async () => {
		const deps = makeDeps();
		vi.mocked(deps.input.ask).mockResolvedValueOnce("");

		const result = await addIterationInteractive(PROJECT, CONFIG, deps);

		expect(result).toBe(false);
		expect(mockCreateIteration).not.toHaveBeenCalled();
	});

	it("creates iteration on happy path", async () => {
		const deps = makeDeps();
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("Sprint 1")   // name
			.mockResolvedValueOnce("Deliver MVP") // goal
			.mockResolvedValueOnce("2026-03-14")  // start date
			.mockResolvedValueOnce("2026-03-28")  // end date
			.mockResolvedValueOnce("40")          // capacity
			.mockResolvedValueOnce("First sprint"); // description
		mockListIterations.mockReturnValue([]);
		mockNextNumber.mockReturnValue(1);
		mockComputeEnd.mockReturnValue("2026-03-28");
		mockCreateIteration.mockReturnValue("/projects/my-project/iterations/sprint-1.md" as any);

		const result = await addIterationInteractive(PROJECT, CONFIG, deps);

		expect(result).toBe(true);
		expect(printHeader).toHaveBeenCalledWith("Add Iteration");
		expect(mockCreateIteration).toHaveBeenCalledWith(
			deps, PROJECT,
			expect.objectContaining({ name: "Sprint 1", number: 1, goal: "Deliver MVP" }),
			CONFIG,
		);
		expect(mockRenderCreated).toHaveBeenCalled();
	});

	it("returns false when end date is empty", async () => {
		const deps = makeDeps();
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("Sprint 1")   // name
			.mockResolvedValueOnce("Goal")        // goal
			.mockResolvedValueOnce("2026-03-14")  // start date
			.mockResolvedValueOnce("");            // end date empty
		mockListIterations.mockReturnValue([]);

		const result = await addIterationInteractive(PROJECT, CONFIG, deps);

		expect(result).toBe(false);
		expect(mockCreateIteration).not.toHaveBeenCalled();
	});

	it("returns false when createIteration returns falsy", async () => {
		const deps = makeDeps();
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("Sprint 1")
			.mockResolvedValueOnce("Goal")
			.mockResolvedValueOnce("2026-03-14")
			.mockResolvedValueOnce("2026-03-28")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("");
		mockListIterations.mockReturnValue([]);
		mockCreateIteration.mockReturnValue(undefined as any);

		const result = await addIterationInteractive(PROJECT, CONFIG, deps);

		expect(result).toBe(false);
		expect(mockRenderCreated).not.toHaveBeenCalled();
	});

	it("uses computeEndDate default when config has durationDays", async () => {
		const deps = makeDeps();
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("Sprint 1")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("2026-03-14")
			.mockResolvedValueOnce("2026-03-28")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("");
		mockListIterations.mockReturnValue([]);
		mockComputeEnd.mockReturnValue("2026-03-28");
		mockCreateIteration.mockReturnValue("/path/file.md" as any);

		await addIterationInteractive(PROJECT, CONFIG, deps);

		expect(mockComputeEnd).toHaveBeenCalledWith("2026-03-14", 14);
	});

	it("does not call computeEndDate when config is undefined", async () => {
		const deps = makeDeps();
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("Sprint 1")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("2026-03-14")
			.mockResolvedValueOnce("2026-03-28")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("");
		mockListIterations.mockReturnValue([]);
		mockCreateIteration.mockReturnValue("/path/file.md" as any);

		await addIterationInteractive(PROJECT, undefined, deps);

		expect(mockComputeEnd).not.toHaveBeenCalled();
	});
});

// ── advanceIterationInteractive ─────────────────────────────────────

const MOCK_TEMPLATE: LifecycleTemplate = {
	entityType: "iteration",
	states: ["new", "planned", "ready", "in-progress", "in-review", "done", "cancelled"],
	transitions: {
		"new": ["planned", "cancelled"], "planned": ["ready", "cancelled"],
		"ready": ["in-progress", "cancelled"], "in-progress": ["in-review", "cancelled"],
		"in-review": ["done", "cancelled"], "done": [], "cancelled": [],
	},
	initialState: "new",
	terminalStates: ["done", "cancelled"],
	labels: { "new": "New", "planned": "Planned", "ready": "Ready", "in-progress": "In Progress", "in-review": "In Review", "done": "Done", "cancelled": "Cancelled" },
};

describe("advanceIterationInteractive", () => {
	it("logs message when no active iteration", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(null);

		await advanceIterationInteractive(PROJECT, CONFIG, MOCK_TEMPLATE, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No active iteration"));
	});

	it("logs terminal state message when in done state", async () => {
		const deps = makeDeps();
		const done = makeIteration({ status: "done" });
		mockFindCurrent.mockReturnValue(done);
		mockGetValidTransitions.mockReturnValue([] as any);

		await advanceIterationInteractive(PROJECT, CONFIG, MOCK_TEMPLATE, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("terminal state"));
	});

	it("advances iteration on confirm", async () => {
		const deps = makeDeps();
		const current = makeIteration({ status: "new" });
		mockFindCurrent.mockReturnValue(current);
		mockGetValidTransitions.mockReturnValue(["planned", "cancelled"] as any);
		vi.mocked(deps.input.askYesNo).mockResolvedValue(true);
		mockTransitionIteration.mockReturnValue({ success: true, from: "new", to: "planned" } as any);

		await advanceIterationInteractive(PROJECT, CONFIG, MOCK_TEMPLATE, deps);

		expect(mockTransitionIteration).toHaveBeenCalled();
		expect(mockRenderAdvanceResult).toHaveBeenCalled();
	});

	it("does nothing when user declines", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration({ status: "new" }));
		mockGetValidTransitions.mockReturnValue(["planned", "cancelled"] as any);
		vi.mocked(deps.input.askYesNo).mockResolvedValue(false);

		await advanceIterationInteractive(PROJECT, CONFIG, MOCK_TEMPLATE, deps);

		expect(mockTransitionIteration).not.toHaveBeenCalled();
	});

	it("calls closeIteration when target is done", async () => {
		const deps = makeDeps();
		const current = makeIteration({ status: "in-review" });
		mockFindCurrent.mockReturnValue(current);
		mockGetValidTransitions.mockReturnValue(["done", "cancelled"] as any);
		vi.mocked(deps.input.askYesNo).mockResolvedValue(true);
		mockCloseIteration.mockReturnValue({ success: true, from: "in-review", to: "done" } as any);

		await advanceIterationInteractive(PROJECT, CONFIG, MOCK_TEMPLATE, deps);

		expect(mockCloseIteration).toHaveBeenCalled();
		expect(mockRenderClosed).toHaveBeenCalledWith("Sprint 1", deps.log);
	});
});

// ── showCurrentIteration ────────────────────────────────────────────

describe("showCurrentIteration", () => {
	it("renders detail when current iteration exists", async () => {
		const deps = makeDeps();
		const current = makeIteration();
		mockFindCurrent.mockReturnValue(current);

		await showCurrentIteration(PROJECT, CONFIG, deps);

		expect(mockRenderDetail).toHaveBeenCalledWith(current, deps.log);
	});

	it("offers to create when no current iteration", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(undefined);
		vi.mocked(deps.input.askYesNo).mockResolvedValue(false);

		await showCurrentIteration(PROJECT, CONFIG, deps);

		expect(deps.input.askYesNo).toHaveBeenCalledWith(expect.stringContaining("Create one"));
		expect(mockRenderDetail).not.toHaveBeenCalled();
	});

	it("invokes addIterationInteractive when user confirms creation", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(undefined);
		vi.mocked(deps.input.askYesNo).mockResolvedValue(true);
		// addIterationInteractive will ask for name — return empty to abort
		vi.mocked(deps.input.ask).mockResolvedValueOnce("");

		await showCurrentIteration(PROJECT, CONFIG, deps);

		expect(printHeader).toHaveBeenCalledWith("Add Iteration");
	});
});

// ── attachAgentInteractive ──────────────────────────────────────────

describe("attachAgentInteractive", () => {
	it("logs message when no active iteration", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(undefined);

		await attachAgentInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No active iteration"));
	});

	it("logs message when agents folder does not exist", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		mockDisk.existsSync.mockReturnValue(false);

		await attachAgentInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No agents folder"));
	});

	it("logs message when no agent files found", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue([] as any);

		await attachAgentInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No agent files"));
	});

	it("attaches selected agent on happy path", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["reviewer.md", "planner.md"] as any);
		vi.mocked(deps.input.ask).mockResolvedValueOnce("2");
		mockAttachAgent.mockReturnValue(true as any);

		await attachAgentInteractive(PROJECT, CONFIG, deps);

		expect(mockAttachAgent).toHaveBeenCalledWith(
			deps, PROJECT, 1,
			{ name: "planner", file: "planner.md" },
			CONFIG,
		);
		expect(mockRenderAgentAttached).toHaveBeenCalledWith("planner", "Sprint 1", deps.log);
	});

	it("does nothing on invalid agent selection", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["agent.md"] as any);
		vi.mocked(deps.input.ask).mockResolvedValueOnce("0");

		await attachAgentInteractive(PROJECT, CONFIG, deps);

		expect(mockAttachAgent).not.toHaveBeenCalled();
	});
});

// ── addResourceInteractive ──────────────────────────────────────────

describe("addResourceInteractive", () => {
	it("logs message when no active iteration", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(undefined);

		await addResourceInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No active iteration"));
	});

	it("returns when name is empty", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask).mockResolvedValueOnce("");

		await addResourceInteractive(PROJECT, CONFIG, deps);

		expect(mockAddResource).not.toHaveBeenCalled();
	});

	it("adds resource on happy path", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("Alice")    // name
			.mockResolvedValueOnce("Dev")      // role
			.mockResolvedValueOnce("80%");     // allocation
		mockAddResource.mockReturnValue(true as any);

		await addResourceInteractive(PROJECT, CONFIG, deps);

		expect(mockAddResource).toHaveBeenCalledWith(
			deps, PROJECT, 1,
			{ name: "Alice", role: "Dev", allocation: "80%" },
			CONFIG,
		);
		expect(mockRenderResourceAdded).toHaveBeenCalledWith("Alice", "Sprint 1", deps.log);
	});

	it("omits optional fields when empty", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("Bob")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("");
		mockAddResource.mockReturnValue(true as any);

		await addResourceInteractive(PROJECT, CONFIG, deps);

		expect(mockAddResource).toHaveBeenCalledWith(
			deps, PROJECT, 1,
			{ name: "Bob", role: undefined, allocation: undefined },
			CONFIG,
		);
	});
});

// ── addCapacityInteractive ──────────────────────────────────────────

describe("addCapacityInteractive", () => {
	it("logs message when no active iteration", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(undefined);

		await addCapacityInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No active iteration"));
	});

	it("returns when label is empty", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask).mockResolvedValueOnce("");

		await addCapacityInteractive(PROJECT, CONFIG, deps);

		expect(mockAddCapacity).not.toHaveBeenCalled();
	});

	it("returns when value is empty", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("Story Points")
			.mockResolvedValueOnce("");

		await addCapacityInteractive(PROJECT, CONFIG, deps);

		expect(mockAddCapacity).not.toHaveBeenCalled();
	});

	it("adds capacity on happy path", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("Story Points")
			.mockResolvedValueOnce("40")
			.mockResolvedValueOnce("pts");
		mockAddCapacity.mockReturnValue(true as any);

		await addCapacityInteractive(PROJECT, CONFIG, deps);

		expect(mockAddCapacity).toHaveBeenCalledWith(
			deps, PROJECT, 1,
			{ label: "Story Points", value: "40", unit: "pts" },
			CONFIG,
		);
		expect(mockRenderCapacityAdded).toHaveBeenCalledWith("Story Points", "Sprint 1", deps.log);
	});

	it("omits unit when empty", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("Hours")
			.mockResolvedValueOnce("160")
			.mockResolvedValueOnce("");
		mockAddCapacity.mockReturnValue(true as any);

		await addCapacityInteractive(PROJECT, CONFIG, deps);

		expect(mockAddCapacity).toHaveBeenCalledWith(
			deps, PROJECT, 1,
			{ label: "Hours", value: "160", unit: undefined },
			CONFIG,
		);
	});
});

// ── addScopeItemInteractive ─────────────────────────────────────────

describe("addScopeItemInteractive", () => {
	it("logs message when no active iteration", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(undefined);

		await addScopeItemInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No active iteration"));
	});

	it("returns when item is empty", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask).mockResolvedValueOnce("");

		await addScopeItemInteractive(PROJECT, CONFIG, deps);

		expect(mockAddScopeItem).not.toHaveBeenCalled();
	});

	it("adds scope item on happy path", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask).mockResolvedValueOnce("Implement auth");
		mockAddScopeItem.mockReturnValue(true as any);

		await addScopeItemInteractive(PROJECT, CONFIG, deps);

		expect(mockAddScopeItem).toHaveBeenCalledWith(deps, PROJECT, 1, "Implement auth", CONFIG);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Added scope item"));
	});
});


// ── addNoteInteractive ──────────────────────────────────────────────

describe("addNoteInteractive", () => {
	it("logs message when no active iteration", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(undefined);

		await addNoteInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No active iteration"));
	});

	it("returns when note is empty", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask).mockResolvedValueOnce("");

		await addNoteInteractive(PROJECT, CONFIG, deps);

		expect(mockAddNote).not.toHaveBeenCalled();
	});

	it("adds note on happy path", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask).mockResolvedValueOnce("Blocked on API");
		mockAddNote.mockReturnValue(true as any);

		await addNoteInteractive(PROJECT, CONFIG, deps);

		expect(mockAddNote).toHaveBeenCalledWith(deps, PROJECT, 1, "Blocked on API", CONFIG);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Added note"));
	});
});

// ── editDescriptionInteractive ──────────────────────────────────────

describe("editDescriptionInteractive", () => {
	it("logs message when no active iteration", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(undefined);

		await editDescriptionInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No active iteration"));
	});

	it("returns when description is empty", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask).mockResolvedValueOnce("");

		await editDescriptionInteractive(PROJECT, CONFIG, deps);

		expect(mockUpdateDescription).not.toHaveBeenCalled();
	});

	it("updates description on happy path", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask).mockResolvedValueOnce("New description text");
		mockUpdateDescription.mockReturnValue(true as any);

		await editDescriptionInteractive(PROJECT, CONFIG, deps);

		expect(mockUpdateDescription).toHaveBeenCalledWith(deps, PROJECT, 1, "New description text", CONFIG);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Updated description"));
	});

	it("shows current description when it exists", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration({ description: "Existing desc" }));
		vi.mocked(deps.input.ask).mockResolvedValueOnce("Updated desc");
		mockUpdateDescription.mockReturnValue(true as any);

		await editDescriptionInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Existing desc"));
	});
});

// ── editNameInteractive ─────────────────────────────────────────────

const mockUpdateName = vi.mocked(updateName);
const mockUpdateGoal = vi.mocked(updateGoal);
const mockUpdateStartDate = vi.mocked(updateStartDate);
const mockUpdateEndDate = vi.mocked(updateEndDate);

describe("editNameInteractive", () => {
	it("logs message when no active iteration", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(null);

		await editNameInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No active iteration"));
	});

	it("updates name on happy path", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask).mockResolvedValueOnce("Sprint Alpha");

		await editNameInteractive(PROJECT, CONFIG, deps);

		expect(mockUpdateName).toHaveBeenCalledWith(deps, PROJECT, 1, "Sprint Alpha", CONFIG);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Renamed"));
	});

	it("does nothing when name is empty", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask).mockResolvedValueOnce("");

		await editNameInteractive(PROJECT, CONFIG, deps);

		expect(mockUpdateName).not.toHaveBeenCalled();
	});
});

// ── editGoalInteractive ─────────────────────────────────────────────

describe("editGoalInteractive", () => {
	it("logs message when no active iteration", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(null);

		await editGoalInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No active iteration"));
	});

	it("updates goal on happy path", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration());
		vi.mocked(deps.input.ask).mockResolvedValueOnce("Ship v2");

		await editGoalInteractive(PROJECT, CONFIG, deps);

		expect(mockUpdateGoal).toHaveBeenCalledWith(deps, PROJECT, 1, "Ship v2", CONFIG);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Updated goal"));
	});
});

// ── editDatesInteractive ────────────────────────────────────────────

describe("editDatesInteractive", () => {
	it("logs message when no active iteration", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(null);

		await editDatesInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No active iteration"));
	});

	it("updates both dates when changed", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration({ startDate: "2026-03-01", endDate: "2026-03-14" }));
		vi.mocked(deps.input.ask).mockResolvedValueOnce("2026-03-05").mockResolvedValueOnce("2026-03-20");

		await editDatesInteractive(PROJECT, CONFIG, deps);

		expect(mockUpdateStartDate).toHaveBeenCalledWith(deps, PROJECT, 1, "2026-03-05", CONFIG);
		expect(mockUpdateEndDate).toHaveBeenCalledWith(deps, PROJECT, 1, "2026-03-20", CONFIG);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Updated dates"));
	});

	it("skips update when dates unchanged", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration({ startDate: "2026-03-01", endDate: "2026-03-14" }));
		vi.mocked(deps.input.ask).mockResolvedValueOnce("2026-03-01").mockResolvedValueOnce("2026-03-14");

		await editDatesInteractive(PROJECT, CONFIG, deps);

		expect(mockUpdateStartDate).not.toHaveBeenCalled();
		expect(mockUpdateEndDate).not.toHaveBeenCalled();
	});
});

// ── editScopeInteractive ────────────────────────────────────────────

describe("editScopeInteractive", () => {
	it("logs message when no active iteration", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(undefined);

		await editScopeInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No active iteration"));
	});

	it("logs message when no scope items", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration({ scopeItems: [] }));

		await editScopeInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No scope items"));
	});

	it("edits scope item on happy path", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration({ scopeItems: [{ text: "Old task", done: false }] }));
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("1")          // task number
			.mockResolvedValueOnce("New task");   // new text
		mockEditScopeItem.mockReturnValue(true as any);

		await editScopeInteractive(PROJECT, CONFIG, deps);

		expect(mockEditScopeItem).toHaveBeenCalledWith(deps, PROJECT, 1, 0, "New task", CONFIG);
	});
});

// ── removeScopeInteractive ──────────────────────────────────────────

describe("removeScopeInteractive", () => {
	it("logs message when no active iteration", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(undefined);

		await removeScopeInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No active iteration"));
	});

	it("removes scope item on confirm", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration({ scopeItems: [{ text: "Remove me", done: false }] }));
		vi.mocked(deps.input.ask).mockResolvedValueOnce("1");
		vi.mocked(deps.input.askYesNo).mockResolvedValue(true);
		mockRemoveScopeItem.mockReturnValue(true as any);

		await removeScopeInteractive(PROJECT, CONFIG, deps);

		expect(mockRemoveScopeItem).toHaveBeenCalledWith(deps, PROJECT, 1, 0, CONFIG);
	});

	it("does nothing when user declines", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration({ scopeItems: [{ text: "Keep me", done: false }] }));
		vi.mocked(deps.input.ask).mockResolvedValueOnce("1");
		vi.mocked(deps.input.askYesNo).mockResolvedValue(false);

		await removeScopeInteractive(PROJECT, CONFIG, deps);

		expect(mockRemoveScopeItem).not.toHaveBeenCalled();
	});
});

// ── toggleScopeInteractive ──────────────────────────────────────────

describe("toggleScopeInteractive", () => {
	it("logs message when no active iteration", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(undefined);

		await toggleScopeInteractive(PROJECT, CONFIG, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No active iteration"));
	});

	it("toggles scope item on happy path", async () => {
		const deps = makeDeps();
		mockFindCurrent.mockReturnValue(makeIteration({ scopeItems: [{ text: "Toggle me", done: false }] }));
		vi.mocked(deps.input.ask).mockResolvedValueOnce("1");
		mockToggleScopeItem.mockReturnValue(true as any);

		await toggleScopeInteractive(PROJECT, CONFIG, deps);

		expect(mockToggleScopeItem).toHaveBeenCalledWith(deps, PROJECT, 1, 0, CONFIG);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("checked"));
	});
});
