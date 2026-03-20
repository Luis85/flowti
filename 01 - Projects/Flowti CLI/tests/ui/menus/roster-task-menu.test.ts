import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	printHeader: vi.fn(), RESET: "", DIM: "", GREEN: "", RED: "", CYAN: "", BOLD: "",
}));
vi.mock("../../../src/domain/agents/agent-store.js", () => ({
	getProjectAgents: vi.fn(() => []),
	readSystemPrompt: vi.fn(() => null),
}));
vi.mock("../../../src/ui/displays/agents-display.js", () => ({
	renderAgentList: vi.fn(),
}));
vi.mock("../../../src/domain/iterations/iteration-store.js", () => ({
	findCurrentIteration: vi.fn(() => null),
	iterationsDir: vi.fn(() => "/project/docs/iterations"),
}));
vi.mock("../../../src/domain/agents/brief-store.js", () => ({
	findBrief: vi.fn(() => null),
	saveBrief: vi.fn(() => "/briefs/test.md"),
	appendTask: vi.fn(() => true),
	generateBrief: vi.fn(() => "# Brief"),
}));
vi.mock("../../../src/domain/agents/agent-state.js", () => ({
	readAgentState: vi.fn(() => ({ name: "Test", status: "idle", tasks: [], briefs: [] })),
	writeAgentState: vi.fn(),
	addTask: vi.fn((state: unknown) => state),
}));

import { rosterTaskInteractive, getTasksForPhase } from "../../../src/ui/menus/roster-task-menu.js";
import type { RosterTaskOptions } from "../../../src/ui/menus/roster-task-menu.js";
import { getProjectAgents } from "../../../src/domain/agents/agent-store.js";
import { findCurrentIteration } from "../../../src/domain/iterations/iteration-store.js";
import { findBrief, saveBrief, appendTask, generateBrief } from "../../../src/domain/agents/brief-store.js";
import type { RosterTaskDeps } from "../../../src/ui/menus/roster-task-menu.js";

function makeDeps(answers: string[] = []): RosterTaskDeps {
	let idx = 0;
	return {
		disk: { existsSync: vi.fn(() => false), readdirSync: vi.fn(() => []) } as unknown as RosterTaskDeps["disk"],
		paths: { join: (...p: string[]) => p.join("/"), resolve: (...p: string[]) => p.join("/") } as unknown as RosterTaskDeps["paths"],
		input: { ask: vi.fn(async () => answers[idx++] ?? ""), waitForEnter: vi.fn(async () => {}) },
		log: vi.fn(),
		clock: { now: () => new Date(), iso: () => "2026-03-14", ms: () => 0, safeIso: () => "2026-03-14" },
		shell: { check: vi.fn(() => false) } as unknown as RosterTaskDeps["shell"],
		processRunner: {
			spawn: vi.fn(() => ({
				onEvent: vi.fn(() => () => {}),
				result: Promise.resolve({ text: "", thinking: "", exitCode: 0 }),
				kill: vi.fn(),
			})),
		} as unknown as RosterTaskDeps["processRunner"],
		providerRegistry: {
			register: vi.fn(),
			get: vi.fn(),
			list: vi.fn(() => [{ name: "anthropic", capabilities: () => ({}), execute: vi.fn() }]),
			select: vi.fn(),
		},
	} as unknown as RosterTaskDeps;
}

function makeOpts(): RosterTaskOptions {
	return {
		projectPath: "/project", iterationsConfig: undefined,
		roster: ["Dev"], vaultRoot: "/vault", agentsConfig: undefined, template: undefined,
	};
}

const activeIteration = {
	name: "S1", number: 1, startDate: "", endDate: "", goal: "Go", capacity: "",
	description: "", status: "in-progress", file: "f.md", agents: [], resources: [],
	capacities: [], scopeItems: [],
};

const devAgent = { name: "Dev", agentType: "ai" as const, description: "", skills: [], tools: [], roles: [], file: "dev.md" };

beforeEach(() => { vi.clearAllMocks(); });

describe("rosterTaskInteractive", () => {
	it("shows message when no active iteration", async () => {
		const deps = makeDeps();
		vi.mocked(findCurrentIteration).mockReturnValue(null);
		await rosterTaskInteractive(makeOpts(), deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No active iteration"));
	});

	it("shows message when no agents on roster", async () => {
		const deps = makeDeps();
		vi.mocked(findCurrentIteration).mockReturnValue(activeIteration);
		vi.mocked(getProjectAgents).mockReturnValue([]);
		await rosterTaskInteractive(makeOpts(), deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No agents"));
	});

	it("appends task to existing brief for current phase", async () => {
		const deps = makeDeps(["1", "Build the widget"]);
		vi.mocked(findCurrentIteration).mockReturnValue(activeIteration);
		vi.mocked(getProjectAgents).mockReturnValue([devAgent]);
		vi.mocked(findBrief).mockReturnValue({ agentName: "Dev", iterationNumber: 1, phase: "in-progress", status: "open", file: "iteration-001-dev--in-progress.md" });

		await rosterTaskInteractive(makeOpts(), deps);

		expect(appendTask).toHaveBeenCalledWith(deps, "/project/docs/iterations", 1, "Dev", "in-progress", "Build the widget");
		expect(saveBrief).not.toHaveBeenCalled();
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Task assigned"));
	});

	it("creates brief when none exists for current phase, then appends task", async () => {
		const deps = makeDeps(["1", "Design the API"]);
		vi.mocked(findCurrentIteration).mockReturnValue(activeIteration);
		vi.mocked(getProjectAgents).mockReturnValue([devAgent]);
		vi.mocked(findBrief).mockReturnValue(null);

		await rosterTaskInteractive(makeOpts(), deps);

		expect(generateBrief).toHaveBeenCalledWith(expect.objectContaining({ agentName: "Dev" }));
		expect(saveBrief).toHaveBeenCalledWith(deps, "/project/docs/iterations", 1, "Dev", "in-progress", "# Brief");
		expect(appendTask).toHaveBeenCalledWith(deps, "/project/docs/iterations", 1, "Dev", "in-progress", "Design the API");
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Task assigned"));
	});

	it("cancels when no agent selected", async () => {
		const deps = makeDeps([""]);
		vi.mocked(findCurrentIteration).mockReturnValue(activeIteration);
		vi.mocked(getProjectAgents).mockReturnValue([devAgent]);

		await rosterTaskInteractive(makeOpts(), deps);
		expect(appendTask).not.toHaveBeenCalled();
	});

	it("cancels when no task entered", async () => {
		const deps = makeDeps(["1", ""]);
		vi.mocked(findCurrentIteration).mockReturnValue(activeIteration);
		vi.mocked(getProjectAgents).mockReturnValue([devAgent]);

		await rosterTaskInteractive(makeOpts(), deps);
		expect(appendTask).not.toHaveBeenCalled();
	});

	it("shows error for unrecognized agent", async () => {
		const deps = makeDeps(["Unknown"]);
		vi.mocked(findCurrentIteration).mockReturnValue(activeIteration);
		vi.mocked(getProjectAgents).mockReturnValue([devAgent]);

		await rosterTaskInteractive(makeOpts(), deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("not found"));
	});

	it("picks a suggested task by number", async () => {
		const agentWithTasks = {
			...devAgent,
			suggestedTasks: [
				{ name: "Implement features", phases: ["in-progress"] },
				{ name: "Code review", phases: ["in-review"] },
			],
		};
		const deps = makeDeps(["1", "1"]);
		vi.mocked(findCurrentIteration).mockReturnValue(activeIteration);
		vi.mocked(getProjectAgents).mockReturnValue([agentWithTasks]);
		vi.mocked(findBrief).mockReturnValue({ agentName: "Dev", iterationNumber: 1, phase: "in-progress", status: "open", file: "f.md" });

		await rosterTaskInteractive(makeOpts(), deps);

		expect(appendTask).toHaveBeenCalledWith(deps, "/project/docs/iterations", 1, "Dev", "in-progress", "Implement features");
	});

	it("picks custom task when 'c' selected", async () => {
		const agentWithTasks = {
			...devAgent,
			suggestedTasks: [{ name: "Implement features", phases: [] }],
		};
		const deps = makeDeps(["1", "c", "My custom task"]);
		vi.mocked(findCurrentIteration).mockReturnValue(activeIteration);
		vi.mocked(getProjectAgents).mockReturnValue([agentWithTasks]);
		vi.mocked(findBrief).mockReturnValue({ agentName: "Dev", iterationNumber: 1, phase: "in-progress", status: "open", file: "f.md" });

		await rosterTaskInteractive(makeOpts(), deps);

		expect(appendTask).toHaveBeenCalledWith(deps, "/project/docs/iterations", 1, "Dev", "in-progress", "My custom task");
	});
});

describe("getTasksForPhase", () => {
	it("returns empty array for undefined tasks", () => {
		expect(getTasksForPhase(undefined, "in-progress")).toEqual([]);
	});

	it("returns empty array for empty tasks", () => {
		expect(getTasksForPhase([], "in-progress")).toEqual([]);
	});

	it("returns tasks matching the current phase", () => {
		const tasks = [
			{ name: "Implement", phases: ["in-progress"] },
			{ name: "Review", phases: ["in-review"] },
			{ name: "Plan", phases: ["planned"] },
		];
		const result = getTasksForPhase(tasks, "in-progress");
		expect(result).toEqual([{ name: "Implement", phases: ["in-progress"] }]);
	});

	it("returns tasks with empty phases (always relevant)", () => {
		const tasks = [
			{ name: "General help", phases: [] },
			{ name: "Review", phases: ["in-review"] },
		];
		const result = getTasksForPhase(tasks, "in-progress");
		expect(result).toEqual([{ name: "General help", phases: [] }]);
	});

	it("returns tasks matching any of multiple phases", () => {
		const tasks = [
			{ name: "Plan architecture", phases: ["planned", "ready"] },
		];
		expect(getTasksForPhase(tasks, "planned")).toHaveLength(1);
		expect(getTasksForPhase(tasks, "ready")).toHaveLength(1);
		expect(getTasksForPhase(tasks, "in-progress")).toHaveLength(0);
	});
});
