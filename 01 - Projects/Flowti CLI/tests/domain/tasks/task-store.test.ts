import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", BOLD: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", BG_RED: "", BG_GREEN: "", BG_YELLOW: "" }));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { taskStore } from "../../../src/domain/tasks/task-store.js";

function makeDeps(files: Record<string, string> = {}) {
	const store: Record<string, string> = { ...files };
	const dirs = new Set<string>();
	for (const key of Object.keys(files)) {
		const parts = key.split("/");
		for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
	}
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in store || dirs.has(p)),
			readFileSync: vi.fn((p: string) => store[p] ?? ""),
			writeFileSync: vi.fn((p: string, c: string) => { store[p] = c; }),
			mkdirSync: vi.fn(),
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
	});

	describe("updateField", () => {
		it("updates task status field", () => {
			const deps = makeDeps({ "/proj/docs/tasks/task-001.md": TASK_MD });
			const result = taskStore.updateField(deps, "/proj", "task-001", "status", "assigned");
			expect(result).toBe(true);
		});
	});

	describe("countCompletedByAgent", () => {
		it("returns 0 when no completed tasks", () => {
			const deps = makeDeps();
			expect(taskStore.countCompletedByAgent(deps, "/proj", "auditor")).toBe(0);
		});

		it("counts completed tasks for specific agent", () => {
			const completedMd = TASK_MD.replace("status: pending", "status: completed");
			const otherMd = TASK_MD.replace("id: task-001", "id: task-002")
				.replace("assignee: auditor", "assignee: builder")
				.replace("status: pending", "status: completed");
			const deps = makeDeps({
				"/proj/docs/tasks/task-001.md": completedMd,
				"/proj/docs/tasks/task-002.md": otherMd,
			});
			expect(taskStore.countCompletedByAgent(deps, "/proj", "auditor")).toBe(1);
		});
	});
});
