import { describe, it, expect } from "vitest";
import { buildIndex, matchEvent, getActiveOrders } from "../../../src/domain/tasks/standing-order-index.js";
import type { TaskSummary } from "../../../src/domain/tasks/task-types.js";

function makeTask(overrides: Partial<TaskSummary> = {}): TaskSummary {
	return {
		id: "so-001",
		type: "standing-order",
		title: "Watch inbox",
		assignee: "auditor",
		creator: "director",
		priority: "normal",
		trustTier: "auto",
		status: "assigned",
		reward: { xp: 10, coin: 5 },
		tags: ["watch:inbox:file-created"],
		createdAt: "2026-03-21T10:00:00Z",
		file: "/proj/docs/tasks/so-001.md",
		...overrides,
	};
}

describe("standing-order-index", () => {
	describe("buildIndex", () => {
		it("indexes standing orders with watch tags", () => {
			const index = buildIndex([makeTask()]);
			expect(index.orders).toHaveLength(1);
			expect(index.orders[0].watchFolder).toBe("inbox");
			expect(index.orders[0].watchEvent).toBe("file-created");
		});

		it("skips non-standing-order tasks", () => {
			const index = buildIndex([makeTask({ type: "one-off" })]);
			expect(index.orders).toHaveLength(0);
		});

		it("skips standing orders without watch tags", () => {
			const index = buildIndex([makeTask({ tags: ["other"] })]);
			expect(index.orders).toHaveLength(0);
		});

		it("skips completed standing orders", () => {
			const index = buildIndex([makeTask({ status: "completed" })]);
			expect(index.orders).toHaveLength(0);
		});

		it("includes in-progress standing orders", () => {
			const index = buildIndex([makeTask({ status: "in-progress" })]);
			expect(index.orders).toHaveLength(1);
		});
	});

	describe("matchEvent", () => {
		it("matches exact folder and event", () => {
			const index = buildIndex([makeTask()]);
			const matches = matchEvent(index, { folder: "inbox", type: "file-created" });
			expect(matches).toHaveLength(1);
		});

		it("does not match wrong folder", () => {
			const index = buildIndex([makeTask()]);
			const matches = matchEvent(index, { folder: "archive", type: "file-created" });
			expect(matches).toHaveLength(0);
		});

		it("wildcard folder matches any folder", () => {
			const index = buildIndex([makeTask({ tags: ["watch:*:file-created"] })]);
			const matches = matchEvent(index, { folder: "anything", type: "file-created" });
			expect(matches).toHaveLength(1);
		});
	});

	describe("getActiveOrders", () => {
		it("returns orders for specific agent", () => {
			const index = buildIndex([
				makeTask({ id: "so-001", assignee: "auditor" }),
				makeTask({ id: "so-002", assignee: "builder" }),
			]);
			const orders = getActiveOrders(index, "auditor");
			expect(orders).toHaveLength(1);
			expect(orders[0].taskId).toBe("so-001");
		});

		it("returns empty for unknown agent", () => {
			const index = buildIndex([makeTask()]);
			const orders = getActiveOrders(index, "unknown");
			expect(orders).toHaveLength(0);
		});
	});
});
