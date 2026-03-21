import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", BOLD: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", BG_RED: "", BG_GREEN: "", BG_YELLOW: "" }));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { taskStore } from "../../../src/domain/tasks/task-store.js";

function makeDeps(files: Record<string, string> = {}) {
	const store: Record<string, string> = { ...files };
	const dirs = new Set<string>();
	function addDirsFor(key: string): void {
		const parts = key.split("/");
		for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
	}
	for (const key of Object.keys(files)) addDirsFor(key);
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in store || dirs.has(p)),
			readFileSync: vi.fn((p: string) => store[p] ?? ""),
			writeFileSync: vi.fn((p: string, c: string) => { store[p] = c; addDirsFor(p); }),
			mkdirSync: vi.fn((p: string) => { dirs.add(p); }),
			readdirSync: vi.fn((dir: string) => {
				const prefix = dir.endsWith("/") ? dir : dir + "/";
				return Object.keys(store)
					.filter(k => k.startsWith(prefix) && !k.slice(prefix.length).includes("/"))
					.map(k => k.slice(prefix.length));
			}),
			unlinkSync: vi.fn((p: string) => { delete store[p]; }),
		},
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			resolve: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string, ext?: string) => {
				const b = p.split("/").pop()!;
				return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b;
			},
			relative: (from: string, to: string) => to,
			extname: (p: string) => {
				const dot = p.lastIndexOf(".");
				return dot >= 0 ? p.slice(dot) : "";
			},
		},
		clock: { now: () => Date.now(), iso: () => "2026-03-21T10:00:00Z", ms: () => Date.now(), safeIso: () => "2026-03-21T10-00-00" },
	} as unknown as Parameters<typeof taskStore.list>[0];
}

const TASK_MD = `---
type: Task
id: task-001
taskType: one-off
title: Tag inbox notes
assignee: auditor
creator: director
priority: normal
trustTier: review
status: pending
rewardXp: 50
rewardCoin: 25
tags: [inbox, tagging]
createdAt: 2026-03-21T10:00:00Z
---

# Tag inbox notes

Review all notes in the inbox and apply project labels.
`;

describe("taskStore", () => {
	describe("list", () => {
		it("returns empty array when dir missing", () => {
			const deps = makeDeps();
			expect(taskStore.list(deps, "/proj")).toEqual([]);
		});

		it("parses task from markdown file", () => {
			const deps = makeDeps({ "/proj/docs/tasks/task-001.md": TASK_MD });
			const tasks = taskStore.list(deps, "/proj");
			expect(tasks).toHaveLength(1);
			expect(tasks[0].id).toBe("task-001");
			expect(tasks[0].title).toBe("Tag inbox notes");
			expect(tasks[0].type).toBe("one-off");
			expect(tasks[0].assignee).toBe("auditor");
			expect(tasks[0].status).toBe("pending");
			expect(tasks[0].reward).toEqual({ xp: 50, coin: 25 });
		});

		it("skips files that are not type: Task", () => {
			const nonTaskMd = TASK_MD.replace("type: Task", "type: Agent");
			const deps = makeDeps({ "/proj/docs/tasks/not-a-task.md": nonTaskMd });
			expect(taskStore.list(deps, "/proj")).toEqual([]);
		});

		it("skips files with no frontmatter", () => {
			const deps = makeDeps({ "/proj/docs/tasks/empty.md": "# Just a heading\n\nNo frontmatter here." });
			expect(taskStore.list(deps, "/proj")).toEqual([]);
		});

		it("parses tags array correctly", () => {
			const deps = makeDeps({ "/proj/docs/tasks/task-001.md": TASK_MD });
			const tasks = taskStore.list(deps, "/proj");
			expect(tasks[0].tags).toEqual(["inbox", "tagging"]);
		});

		it("defaults missing optional fields", () => {
			const minimalMd = `---
type: Task
id: task-min
taskType: one-off
title: Minimal task
creator: director
priority: normal
trustTier: auto
status: pending
rewardXp: 0
rewardCoin: 0
tags: []
createdAt: 2026-03-21T09:00:00Z
---

# Minimal task
`;
			const deps = makeDeps({ "/proj/docs/tasks/task-min.md": minimalMd });
			const tasks = taskStore.list(deps, "/proj");
			expect(tasks[0].assignee).toBe("");
			expect(tasks[0].completedAt).toBe("");
			expect(tasks[0].journeyId).toBe("");
			expect(tasks[0].tags).toEqual([]);
		});

		it("sorts tasks by createdAt descending", () => {
			const olderMd = TASK_MD.replace("task-001", "task-older").replace("2026-03-21T10:00:00Z", "2026-03-20T10:00:00Z");
			const newerMd = TASK_MD.replace("task-001", "task-newer").replace("2026-03-21T10:00:00Z", "2026-03-21T12:00:00Z");
			const deps = makeDeps({
				"/proj/docs/tasks/task-older.md": olderMd,
				"/proj/docs/tasks/task-newer.md": newerMd,
			});
			const tasks = taskStore.list(deps, "/proj");
			expect(tasks[0].id).toBe("task-newer");
			expect(tasks[1].id).toBe("task-older");
		});

		it("includes file path in summary", () => {
			const deps = makeDeps({ "/proj/docs/tasks/task-001.md": TASK_MD });
			const tasks = taskStore.list(deps, "/proj");
			expect(tasks[0].file).toBe("/proj/docs/tasks/task-001.md");
		});
	});

	describe("read", () => {
		it("returns task by id", () => {
			const deps = makeDeps({ "/proj/docs/tasks/task-001.md": TASK_MD });
			const task = taskStore.read(deps, "/proj", "task-001");
			expect(task).toBeDefined();
			expect(task?.id).toBe("task-001");
		});

		it("returns undefined for unknown id", () => {
			const deps = makeDeps({ "/proj/docs/tasks/task-001.md": TASK_MD });
			expect(taskStore.read(deps, "/proj", "no-such-task")).toBeUndefined();
		});
	});

	describe("create", () => {
		it("writes task markdown file", () => {
			const deps = makeDeps();
			const path = taskStore.create(deps, "/proj", {
				id: "task-002",
				type: "one-off",
				title: "Create project notes",
				creator: "director",
				priority: "normal",
				trustTier: "auto",
				status: "pending",
				reward: { xp: 30, coin: 15 },
				tags: ["project"],
				createdAt: "2026-03-21T11:00:00Z",
			});
			expect(path).toContain("task-002");
			expect(deps.disk.writeFileSync).toHaveBeenCalled();
		});

		it("creates directory if needed", () => {
			const deps = makeDeps();
			taskStore.create(deps, "/proj", {
				id: "task-003",
				type: "standing-order",
				title: "Daily standup",
				creator: "manager",
				priority: "high",
				trustTier: "review",
				status: "pending",
				reward: { xp: 10, coin: 5 },
				tags: [],
				createdAt: "2026-03-21T08:00:00Z",
			});
			expect(deps.disk.mkdirSync).toHaveBeenCalledWith(expect.stringContaining("docs/tasks"), { recursive: true });
		});

		it("roundtrips reward fields through create + list", () => {
			const deps = makeDeps();
			taskStore.create(deps, "/proj", {
				id: "task-004",
				type: "one-off",
				title: "Reward task",
				creator: "director",
				priority: "urgent",
				trustTier: "manual",
				status: "pending",
				reward: { xp: 100, coin: 50 },
				tags: ["reward"],
				createdAt: "2026-03-21T10:00:00Z",
			});
			const tasks = taskStore.list(deps, "/proj");
			expect(tasks[0].reward).toEqual({ xp: 100, coin: 50 });
		});

		it("includes optional fields when provided", () => {
			const deps = makeDeps();
			taskStore.create(deps, "/proj", {
				id: "task-005",
				type: "delegated",
				title: "Delegated task",
				assignee: "agent-x",
				creator: "director",
				priority: "normal",
				trustTier: "review",
				status: "assigned",
				reward: { xp: 20, coin: 10 },
				tags: [],
				createdAt: "2026-03-21T10:00:00Z",
				completedAt: "2026-03-21T11:00:00Z",
				journeyId: "journey-1",
			});
			const tasks = taskStore.list(deps, "/proj");
			expect(tasks[0].assignee).toBe("agent-x");
			expect(tasks[0].completedAt).toBe("2026-03-21T11:00:00Z");
			expect(tasks[0].journeyId).toBe("journey-1");
		});
	});

	describe("updateField", () => {
		it("updates task status field", () => {
			const deps = makeDeps({ "/proj/docs/tasks/task-001.md": TASK_MD });
			const result = taskStore.updateField(deps, "/proj", "task-001", "status", "assigned");
			expect(result).toBe(true);
		});

		it("returns false when task file does not exist", () => {
			const deps = makeDeps();
			const result = taskStore.updateField(deps, "/proj", "no-such-task", "status", "assigned");
			expect(result).toBe(false);
		});

		it("persists the updated field value", () => {
			const deps = makeDeps({ "/proj/docs/tasks/task-001.md": TASK_MD });
			taskStore.updateField(deps, "/proj", "task-001", "status", "in-progress");
			expect(deps.disk.writeFileSync).toHaveBeenCalled();
		});
	});

	describe("remove", () => {
		it("deletes an existing task file", () => {
			const deps = makeDeps({ "/proj/docs/tasks/task-001.md": TASK_MD });
			taskStore.remove(deps, "/proj", "task-001");
			expect(deps.disk.unlinkSync).toHaveBeenCalledWith("/proj/docs/tasks/task-001.md");
		});

		it("does nothing when task file does not exist", () => {
			const deps = makeDeps();
			taskStore.remove(deps, "/proj", "no-such-task");
			expect(deps.disk.unlinkSync).not.toHaveBeenCalled();
		});

		it("removes task from list after deletion", () => {
			const deps = makeDeps({ "/proj/docs/tasks/task-001.md": TASK_MD });
			taskStore.remove(deps, "/proj", "task-001");
			expect(taskStore.list(deps, "/proj")).toEqual([]);
		});
	});
});
