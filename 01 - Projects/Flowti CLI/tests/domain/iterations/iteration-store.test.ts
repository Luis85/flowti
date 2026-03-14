import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/document.js", () => {
	return {
		Document: {
			create: () => {
				const doc = {
					mergeFrontmatter: () => doc,
					setFrontmatter: () => doc,
					setRawFrontmatter: () => doc,
					addBlank: () => doc,
					heading: () => doc,
					text: () => doc,
					table: () => doc,
					list: () => doc,
					save: vi.fn(),
				};
				return doc;
			},
			wikilink: (t: string) => `[[${t}]]`,
		},
	};
});

vi.mock("../../../src/infrastructure/frontmatter.js", () => ({
	parseFrontmatterStrings: vi.fn((content: string) => {
		const fm: Record<string, string> = {};
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (match) {
			for (const line of match[1].split("\n")) {
				const kv = line.match(/^([\w]+):\s*(.*)$/);
				if (kv) fm[kv[1]] = kv[2];
			}
		}
		return fm;
	}),
	parseFrontmatterContent: vi.fn((content: string) => {
		const fm: Record<string, unknown> = {};
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (match) {
			for (const line of match[1].split("\n")) {
				const kv = line.match(/^([\w]+):\s*(.*)$/);
				if (kv) fm[kv[1]] = kv[2];
			}
		}
		return fm;
	}),
}));

import {
	iterationsDir, nextIterationNumber, listIterations,
	findCurrentIteration, findIteration, createIteration, transitionIteration,
	closeIteration, attachAgent, addResource, addCapacity, listAgents, computeEndDate,
	addScopeItem, addNote,
} from "../../../src/domain/iterations/iteration-store.js";
import { loadTemplate } from "../../../src/domain/lifecycle/lifecycle-engine.js";
import type { LifecycleTemplate } from "../../../src/domain/lifecycle/lifecycle-types.js";

const mockDisk = {
	existsSync: vi.fn(() => false),
	readFileSync: vi.fn(() => ""),
	writeFileSync: vi.fn(),
	readdirSync: vi.fn(() => [] as string[]),
	mkdirSync: vi.fn(),
};

const mockPaths = {
	join: (...args: string[]) => args.join("/"),
};

const mockClock = {
	iso: () => "2026-03-15T00:00:00.000Z",
};

const deps = { disk: mockDisk as never, paths: mockPaths as never, clock: mockClock as never };

const iterationLifecycle: LifecycleTemplate = loadTemplate({
	entityType: "iteration",
	initialState: "new",
	terminalStates: ["done", "cancelled"],
	states: {
		new: { label: "New", transitions: ["planned", "cancelled"] },
		planned: { label: "Planned", transitions: ["ready", "cancelled"] },
		ready: { label: "Ready", transitions: ["in-progress", "cancelled"] },
		"in-progress": { label: "In Progress", transitions: ["in-review", "cancelled"] },
		"in-review": { label: "In Review", transitions: ["done", "cancelled"] },
		done: { label: "Done", transitions: [] },
		cancelled: { label: "Cancelled", transitions: [] },
	},
	gates: {
		new: [{ id: "has-goal", label: "Goal defined" }],
		planned: [{ id: "has-scope", label: "Scope items exist" }, { id: "has-dates", label: "Dates set" }],
		ready: [{ id: "has-resources", label: "Resources assigned" }],
		"in-progress": [{ id: "scope-progress", label: "Work started" }],
		"in-review": [{ id: "all-scope-done", label: "All scope items completed" }],
	},
})!;

const lifecycleWithTasks: LifecycleTemplate = loadTemplate({
	entityType: "iteration",
	initialState: "new",
	terminalStates: ["done", "cancelled"],
	states: {
		new: { label: "New", transitions: ["planned", "cancelled"] },
		planned: { label: "Planned", transitions: ["ready", "cancelled"] },
		ready: { label: "Ready", transitions: ["in-progress", "cancelled"] },
		"in-progress": { label: "In Progress", transitions: ["in-review", "cancelled"] },
		"in-review": { label: "In Review", transitions: ["done", "cancelled"] },
		done: { label: "Done", transitions: [] },
		cancelled: { label: "Cancelled", transitions: [] },
	},
	gates: {
		new: [{ id: "has-goal", label: "Goal defined" }],
		planned: [{ id: "has-scope", label: "Scope items exist" }, { id: "has-dates", label: "Dates set" }],
		ready: [{ id: "has-resources", label: "Resources assigned" }],
		"in-progress": [{ id: "scope-progress", label: "Work started" }],
		"in-review": [{ id: "all-scope-done", label: "All scope items completed" }],
	},
	tasks: {
		new: ["Refine goal", "Identify scope"],
		planned: ["Break scope into tasks"],
	},
})!;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("iterationsDir", () => {
	it("returns default directory", () => {
		expect(iterationsDir(deps, "/project")).toBe("/project/docs/iterations");
	});

	it("respects config dir", () => {
		expect(iterationsDir(deps, "/project", { dir: "custom/iters" })).toBe("/project/custom/iters");
	});
});

describe("nextIterationNumber", () => {
	it("returns 1 for empty list", () => {
		expect(nextIterationNumber([])).toBe(1);
	});

	it("increments from highest existing number", () => {
		const existing = [{ number: 1 } as never, { number: 3 } as never];
		expect(nextIterationNumber(existing)).toBe(4);
	});
});

describe("listIterations", () => {
	it("returns empty array when directory does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(listIterations(deps, "/project")).toEqual([]);
	});

	it("lists only plan files", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["iteration-001-plan.md", "iteration-001-report.md", "other.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: Sprint 1\nnumber: 1\nstartDate: 2026-03-01\nendDate: 2026-03-14\ngoal: Build MVP\nstatus: planned\n---\nBody",
		);

		const result = listIterations(deps, "/project");

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Sprint 1");
		expect(result[0].number).toBe(1);
		expect(result[0].status).toBe("planned");
	});

	it("normalizes legacy completed status to done", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["iteration-001-plan.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: Old Sprint\nnumber: 1\nstartDate: 2026-01-01\nendDate: 2026-01-14\ngoal: Done\nstatus: completed\n---\nBody",
		);

		const result = listIterations(deps, "/project");
		expect(result[0].status).toBe("done");
	});
});

describe("findCurrentIteration", () => {
	it("returns null when no iterations exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(findCurrentIteration(deps, "/project")).toBeNull();
	});

	it("finds in-progress iteration", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["iteration-001-plan.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: Current Sprint\nnumber: 1\nstartDate: 2026-03-10\nendDate: 2026-03-20\ngoal: Active\nstatus: in-progress\n---",
		);

		const result = findCurrentIteration(deps, "/project");
		expect(result).not.toBeNull();
		expect(result!.name).toBe("Current Sprint");
	});

	it("finds new iteration", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["iteration-001-plan.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: Fresh Sprint\nnumber: 1\nstartDate: 2026-03-10\nendDate: 2026-03-20\ngoal: New\nstatus: new\n---",
		);

		const result = findCurrentIteration(deps, "/project");
		expect(result).not.toBeNull();
		expect(result!.status).toBe("new");
	});

	it("finds ready iteration", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["iteration-001-plan.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: Ready Sprint\nnumber: 1\nstartDate: 2026-03-10\nendDate: 2026-03-20\ngoal: Ready\nstatus: ready\n---",
		);

		const result = findCurrentIteration(deps, "/project");
		expect(result).not.toBeNull();
		expect(result!.status).toBe("ready");
	});

	it("finds planned iteration", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["iteration-001-plan.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: Planned Sprint\nnumber: 1\nstartDate: 2026-03-10\nendDate: 2026-03-20\ngoal: Plan\nstatus: planned\n---",
		);

		const result = findCurrentIteration(deps, "/project");
		expect(result).not.toBeNull();
		expect(result!.status).toBe("planned");
	});

	it("returns null when all iterations are done", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["iteration-001-plan.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: Past Sprint\nnumber: 1\nstartDate: 2026-01-01\nendDate: 2026-01-14\ngoal: Done\nstatus: done\n---",
		);

		expect(findCurrentIteration(deps, "/project")).toBeNull();
	});

	it("returns null when legacy completed status is normalized", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["iteration-001-plan.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: Past Sprint\nnumber: 1\nstartDate: 2026-01-01\nendDate: 2026-01-14\ngoal: Done\nstatus: completed\n---",
		);

		expect(findCurrentIteration(deps, "/project")).toBeNull();
	});
});

describe("findIteration", () => {
	it("returns null when no iterations exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(findIteration(deps, "/project", 1)).toBeNull();
	});

	it("finds iteration by number", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["iteration-001-plan.md", "iteration-002-plan.md"]);
		mockDisk.readFileSync
			.mockReturnValueOnce("---\nname: Sprint 1\nnumber: 1\nstartDate: 2026-03-01\nendDate: 2026-03-14\ngoal: First\nstatus: done\n---")
			.mockReturnValueOnce("---\nname: Sprint 1\nnumber: 1\nstartDate: 2026-03-01\nendDate: 2026-03-14\ngoal: First\nstatus: done\n---")
			.mockReturnValueOnce("---\nname: Sprint 2\nnumber: 2\nstartDate: 2026-03-15\nendDate: 2026-03-28\ngoal: Second\nstatus: new\n---")
			.mockReturnValueOnce("---\nname: Sprint 2\nnumber: 2\nstartDate: 2026-03-15\nendDate: 2026-03-28\ngoal: Second\nstatus: new\n---");

		const result = findIteration(deps, "/project", 2);
		expect(result).not.toBeNull();
		expect(result!.name).toBe("Sprint 2");
		expect(result!.number).toBe(2);
	});

	it("returns null when number not found", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["iteration-001-plan.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: Sprint 1\nnumber: 1\nstartDate: 2026-03-01\nendDate: 2026-03-14\ngoal: First\nstatus: new\n---",
		);

		expect(findIteration(deps, "/project", 99)).toBeNull();
	});
});

describe("createIteration", () => {
	it("returns null if plan file already exists", () => {
		mockDisk.existsSync.mockReturnValue(true);
		const result = createIteration(deps, "/project", {
			name: "Sprint 1", number: 1, startDate: "2026-03-01", endDate: "2026-03-14", goal: "Build MVP",
		});
		expect(result).toBeNull();
	});

	it("creates only the plan file", () => {
		mockDisk.existsSync.mockReturnValue(false);
		const result = createIteration(deps, "/project", {
			name: "Sprint 1", number: 1, startDate: "2026-03-01", endDate: "2026-03-14", goal: "Build MVP",
		});
		expect(result).toBe("/project/docs/iterations/iteration-001-plan.md");
		expect(mockDisk.mkdirSync).toHaveBeenCalled();
	});

	it("injects initial-state entry tasks when template provided", () => {
		// existsSync: false for initial "does file exist?" check, then true for appendToSection
		mockDisk.existsSync.mockReturnValueOnce(false).mockReturnValue(true);
		// After buildPlanDocument writes, appendToSection reads back
		const planContent = "---\nname: Sprint 1\n---\n\n## Scope Items\n\n<!-- No items yet -->\n";
		mockDisk.readFileSync.mockReturnValue(planContent);
		const result = createIteration(deps, "/project", {
			name: "Sprint 1", number: 1, startDate: "2026-03-01", endDate: "2026-03-14", goal: "Build MVP",
		}, undefined, lifecycleWithTasks);
		expect(result).not.toBeNull();
		const writes = mockDisk.writeFileSync.mock.calls;
		const scopeWrites = writes.filter((c: unknown[]) => (c[1] as string).includes("[ ] Refine goal") || (c[1] as string).includes("[ ] Identify scope"));
		expect(scopeWrites.length).toBeGreaterThanOrEqual(1);
	});

	it("does not inject tasks when no template provided", () => {
		mockDisk.existsSync.mockReturnValue(false);
		createIteration(deps, "/project", {
			name: "Sprint 1", number: 1, startDate: "2026-03-01", endDate: "2026-03-14", goal: "Build MVP",
		});
		const writes = mockDisk.writeFileSync.mock.calls;
		const scopeWrites = writes.filter((c: unknown[]) => (c[1] as string).includes("[ ] Refine goal"));
		expect(scopeWrites).toHaveLength(0);
	});
});

describe("transitionIteration", () => {
	const planContent = (status: string, goal = "Build MVP", scope = "") =>
		`---\nname: Sprint 1\nnumber: 1\nstartDate: 2026-03-01\nendDate: 2026-03-14\ngoal: ${goal}\nstatus: ${status}\n---\n${scope}\n## Transition History\n\n| Date | From | To | Reason |\n|---|---|---|---|`;

	it("transitions new → planned when gates pass", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(planContent("new", "Build MVP"));

		const result = transitionIteration(deps, "/project", 1, "planned", "Planning complete", iterationLifecycle);

		expect(result.success).toBe(true);
		expect(result.from).toBe("new");
		expect(result.to).toBe("planned");
		expect(result.gateResults).toBeDefined();
	});

	it("fails transition when gate fails", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(planContent("new", ""));

		const result = transitionIteration(deps, "/project", 1, "planned", "Try", iterationLifecycle);

		expect(result.success).toBe(false);
		expect(result.error).toContain("Gates failed");
		expect(result.gateResults).toBeDefined();
		expect(result.gateResults!.some((g) => g.gateId === "has-goal" && !g.passed)).toBe(true);
	});

	it("fails for invalid transition", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(planContent("new"));

		const result = transitionIteration(deps, "/project", 1, "in-progress", "Skip", iterationLifecycle);

		expect(result.success).toBe(false);
		expect(result.error).toContain("Cannot transition");
	});

	it("appends transition history on success", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(planContent("new", "Build MVP"));

		transitionIteration(deps, "/project", 1, "planned", "Ready to plan", iterationLifecycle);

		const writes = mockDisk.writeFileSync.mock.calls;
		const historyWrite = writes.find((c: unknown[]) => (c[1] as string).includes("| 2026-03-15 | new | planned |"));
		expect(historyWrite).toBeDefined();
	});

	it("returns error when plan file not found", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = transitionIteration(deps, "/project", 1, "planned", "Try", iterationLifecycle);

		expect(result.success).toBe(false);
		expect(result.error).toContain("Plan file not found");
	});

	it("injects entry tasks for the target state on transition", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(planContent("new", "Build MVP", "## Scope Items\n\n<!-- No items yet -->\n"));

		transitionIteration(deps, "/project", 1, "planned", "Ready to plan", lifecycleWithTasks);

		const writes = mockDisk.writeFileSync.mock.calls;
		const taskWrite = writes.find((c: unknown[]) => (c[1] as string).includes("[ ] Break scope into tasks"));
		expect(taskWrite).toBeDefined();
	});

	it("does not inject tasks when target state has none", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(planContent("new", "Build MVP"));

		const writesBefore = mockDisk.writeFileSync.mock.calls.length;
		transitionIteration(deps, "/project", 1, "planned", "Ready to plan", iterationLifecycle);

		// Only status update + history writes, no task injection
		const writes = mockDisk.writeFileSync.mock.calls.slice(writesBefore);
		const taskWrite = writes.find((c: unknown[]) => (c[1] as string).includes("[ ] Break scope"));
		expect(taskWrite).toBeUndefined();
	});

	it("transitions to cancelled without gates", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(planContent("new", ""));

		const result = transitionIteration(deps, "/project", 1, "cancelled", "Abandoned", iterationLifecycle);

		expect(result.success).toBe(true);
	});
});

describe("closeIteration", () => {
	it("transitions to done and creates report", () => {
		const scope = "## Scope Items\n\n- [x] Done task\n";
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(
			`---\nname: Sprint 1\nnumber: 1\nstartDate: 2026-03-01\nendDate: 2026-03-14\ngoal: Build MVP\nstatus: in-review\n---\n${scope}\n## Transition History\n\n| Date | From | To | Reason |\n|---|---|---|---|`,
		);

		const result = closeIteration(deps, "/project", 1, iterationLifecycle);

		expect(result.success).toBe(true);
		expect(mockDisk.writeFileSync).toHaveBeenCalled();
	});

	it("fails when gates fail", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: Sprint 1\nnumber: 1\nstartDate: 2026-03-01\nendDate: 2026-03-14\ngoal: Build MVP\nstatus: in-review\n---\n## Scope Items\n\n- [ ] Undone task\n\n## Transition History\n\n| Date | From | To | Reason |\n|---|---|---|---|",
		);

		const result = closeIteration(deps, "/project", 1, iterationLifecycle);

		expect(result.success).toBe(false);
		expect(result.error).toContain("Gates failed");
	});

	it("returns error when plan file not found", () => {
		mockDisk.existsSync.mockReturnValue(false);
		const result = closeIteration(deps, "/project", 99, iterationLifecycle);
		expect(result.success).toBe(false);
	});
});

describe("attachAgent", () => {
	it("appends agent to plan file", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue("---\nstatus: new\n---\nBody");

		const result = attachAgent(deps, "/project", 1, { name: "CodeReview", file: "code-review.md" });

		expect(result).toBe(true);
		expect(mockDisk.writeFileSync).toHaveBeenCalled();
	});

	it("returns false when file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(attachAgent(deps, "/project", 1, { name: "Test", file: "test.md" })).toBe(false);
	});
});

describe("listAgents", () => {
	it("returns empty array when file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(listAgents(deps, "/project", 1)).toEqual([]);
	});
});

describe("addResource", () => {
	it("appends resource to plan file", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue("---\nstatus: new\n---\nBody");

		const result = addResource(deps, "/project", 1, { name: "Luis", role: "Dev Lead", allocation: "80%" });

		expect(result).toBe(true);
		expect(mockDisk.writeFileSync).toHaveBeenCalled();
	});
});

describe("addCapacity", () => {
	it("appends capacity to plan file", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue("---\nstatus: new\n---\nBody");

		const result = addCapacity(deps, "/project", 1, { label: "Story Points", value: "40", unit: "pts" });

		expect(result).toBe(true);
		expect(mockDisk.writeFileSync).toHaveBeenCalled();
	});
});

describe("computeEndDate", () => {
	it("adds duration days to start date", () => {
		expect(computeEndDate("2026-03-01", 14)).toBe("2026-03-15");
	});

	it("handles month boundaries", () => {
		expect(computeEndDate("2026-01-25", 10)).toBe("2026-02-04");
	});

	it("returns start date for invalid input", () => {
		expect(computeEndDate("not-a-date", 14)).toBe("not-a-date");
	});

	it("handles zero duration", () => {
		expect(computeEndDate("2026-06-01", 0)).toBe("2026-06-01");
	});
});

describe("addScopeItem", () => {
	it("appends item under Scope Items section", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(
			"---\nstatus: new\n---\n\n## Scope Items\n\n<!-- List requirements and work items for this iteration. -->\n\n## Notes\n",
		);

		const result = addScopeItem(deps, "/project", 1, "Implement login flow");

		expect(result).toBe(true);
		const written = mockDisk.writeFileSync.mock.calls[0][1] as string;
		expect(written).toContain("- [ ] Implement login flow");
		expect(written).not.toContain("<!-- List requirements");
	});

	it("returns false when file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(addScopeItem(deps, "/project", 1, "item")).toBe(false);
	});
});

describe("addNote", () => {
	it("appends dated note under Notes section", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(
			"---\nstatus: new\n---\n\n## Notes\n\n<!-- Track progress and decisions during the iteration. -->\n",
		);

		const result = addNote(deps, "/project", 1, "Kicked off sprint planning");

		expect(result).toBe(true);
		const written = mockDisk.writeFileSync.mock.calls[0][1] as string;
		expect(written).toContain("- **2026-03-15** — Kicked off sprint planning");
		expect(written).not.toContain("<!-- Track progress");
	});
});
