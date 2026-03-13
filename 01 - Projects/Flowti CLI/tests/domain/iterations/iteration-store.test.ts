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
	findCurrentIteration, createIteration, startIteration,
	closeIteration, attachAgent, addResource, addCapacity, listAgents, computeEndDate,
	addScopeItem, addNote, advanceToReview,
} from "../../../src/domain/iterations/iteration-store.js";

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
		const existing = [
			{ number: 1 } as never,
			{ number: 3 } as never,
		];
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

	it("finds in-review iteration", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["iteration-001-plan.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: Review Sprint\nnumber: 1\nstartDate: 2026-03-10\nendDate: 2026-03-20\ngoal: Review\nstatus: in-review\n---",
		);

		const result = findCurrentIteration(deps, "/project");
		expect(result).not.toBeNull();
		expect(result!.status).toBe("in-review");
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

	it("returns null when all iterations are completed", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["iteration-001-plan.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: Past Sprint\nnumber: 1\nstartDate: 2026-01-01\nendDate: 2026-01-14\ngoal: Done\nstatus: completed\n---",
		);

		expect(findCurrentIteration(deps, "/project")).toBeNull();
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
});

describe("startIteration", () => {
	it("updates plan status to in-progress", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue("---\nstatus: planned\n---\nBody");

		const result = startIteration(deps, "/project", 1);

		expect(result).toBe(true);
		const written = mockDisk.writeFileSync.mock.calls[0][1] as string;
		expect(written).toContain("status: in-progress");
	});

	it("returns false when plan does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);

		expect(startIteration(deps, "/project", 99)).toBe(false);
	});
});

describe("advanceToReview", () => {
	it("updates plan status to in-review", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue("---\nstatus: in-progress\n---\nBody");

		const result = advanceToReview(deps, "/project", 1);

		expect(result).toBe(true);
		const written = mockDisk.writeFileSync.mock.calls[0][1] as string;
		expect(written).toContain("status: in-review");
	});

	it("returns false when plan does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);

		expect(advanceToReview(deps, "/project", 99)).toBe(false);
	});
});

describe("closeIteration", () => {
	it("marks plan as completed and creates report file", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: Sprint 1\nnumber: 1\nstartDate: 2026-03-01\nendDate: 2026-03-14\ngoal: Build MVP\nstatus: active\n---\nBody",
		);

		const result = closeIteration(deps, "/project", 1);

		expect(result).toBe(true);
		const planWrite = mockDisk.writeFileSync.mock.calls.find(
			(c: unknown[]) => (c[0] as string).includes("-plan.md"),
		);
		expect(planWrite).toBeDefined();
		expect(planWrite![1]).toContain("status: completed");
	});

	it("returns false when plan does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);

		expect(closeIteration(deps, "/project", 99)).toBe(false);
	});
});

describe("attachAgent", () => {
	it("appends agent to plan file", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue("---\nstatus: active\n---\nBody");

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
		mockDisk.readFileSync.mockReturnValue("---\nstatus: active\n---\nBody");

		const result = addResource(deps, "/project", 1, { name: "Luis", role: "Dev Lead", allocation: "80%" });

		expect(result).toBe(true);
		expect(mockDisk.writeFileSync).toHaveBeenCalled();
	});
});

describe("addCapacity", () => {
	it("appends capacity to plan file", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue("---\nstatus: active\n---\nBody");

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
			"---\nstatus: active\n---\n\n## Scope Items\n\n<!-- List requirements and work items for this iteration. -->\n\n## Notes\n",
		);

		const result = addScopeItem(deps, "/project", 1, "Implement login flow");

		expect(result).toBe(true);
		const written = mockDisk.writeFileSync.mock.calls[0][1] as string;
		expect(written).toContain("- Implement login flow");
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
			"---\nstatus: active\n---\n\n## Notes\n\n<!-- Track progress and decisions during the iteration. -->\n",
		);

		const result = addNote(deps, "/project", 1, "Kicked off sprint planning");

		expect(result).toBe(true);
		const written = mockDisk.writeFileSync.mock.calls[0][1] as string;
		expect(written).toContain("- **2026-03-15** — Kicked off sprint planning");
		expect(written).not.toContain("<!-- Track progress");
	});
});
