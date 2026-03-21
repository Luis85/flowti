import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import {
	buildIndex,
	matchEvent,
	getActiveOrders,
} from "../../../src/domain/tasks/standing-order-index.js";
import type { IndexedOrder } from "../../../src/domain/tasks/standing-order-index.js";

const STANDING_ORDER_PAYLOAD = {
	watch: { folder: "notes/inbox", event: "file-created" },
	rules: [
		{ match: { extension: ".md" }, action: "tag", value: "inbox" },
	],
	schedule: "on-event" as const,
	runCount: 0,
};

function makeTask(overrides: Partial<{
	id: string;
	type: string;
	status: string;
	assignee: string;
	standingOrder: typeof STANDING_ORDER_PAYLOAD | undefined;
}> = {}) {
	return {
		id: "task-001",
		type: "standing-order",
		status: "assigned",
		assignee: "auditor",
		standingOrder: STANDING_ORDER_PAYLOAD,
		...overrides,
	};
}

describe("standing-order-index", () => {
	describe("buildIndex", () => {
		it("creates empty index from empty task list", () => {
			const index = buildIndex([]);
			expect(index.orders).toHaveLength(0);
		});

		it("includes standing orders with status assigned", () => {
			const index = buildIndex([makeTask()]);
			expect(index.orders).toHaveLength(1);
			expect(index.orders[0].taskId).toBe("task-001");
		});

		it("excludes tasks that are not standing-order type", () => {
			const index = buildIndex([makeTask({ type: "one-off" })]);
			expect(index.orders).toHaveLength(0);
		});

		it("excludes standing orders with status other than assigned", () => {
			const index = buildIndex([
				makeTask({ status: "pending" }),
				makeTask({ id: "task-002", status: "in-progress" }),
				makeTask({ id: "task-003", status: "completed" }),
			]);
			expect(index.orders).toHaveLength(0);
		});

		it("excludes standing orders without standingOrder payload", () => {
			const index = buildIndex([makeTask({ standingOrder: undefined })]);
			expect(index.orders).toHaveLength(0);
		});

		it("maps watch folder and event from payload", () => {
			const index = buildIndex([makeTask()]);
			expect(index.orders[0].watchFolder).toBe("notes/inbox");
			expect(index.orders[0].watchEvent).toBe("file-created");
		});

		it("maps assignee from task", () => {
			const index = buildIndex([makeTask({ assignee: "curator" })]);
			expect(index.orders[0].assignee).toBe("curator");
		});

		it("defaults assignee to empty string when not set", () => {
			const index = buildIndex([makeTask({ assignee: undefined })]);
			expect(index.orders[0].assignee).toBe("");
		});

		it("copies rules from payload", () => {
			const index = buildIndex([makeTask()]);
			expect(index.orders[0].rules).toHaveLength(1);
			expect(index.orders[0].rules[0].action).toBe("tag");
		});

		it("includes only assigned standing orders from a mixed list", () => {
			const tasks = [
				makeTask({ id: "so-assigned", type: "standing-order", status: "assigned" }),
				makeTask({ id: "so-pending", type: "standing-order", status: "pending" }),
				makeTask({ id: "oneoff", type: "one-off", status: "assigned" }),
				makeTask({ id: "so-assigned-2", type: "standing-order", status: "assigned", assignee: "curator" }),
			];
			const index = buildIndex(tasks);
			expect(index.orders).toHaveLength(2);
			const ids = index.orders.map((o) => o.taskId);
			expect(ids).toContain("so-assigned");
			expect(ids).toContain("so-assigned-2");
		});
	});

	describe("matchEvent", () => {
		it("returns matching orders for exact folder and event type", () => {
			const index = buildIndex([makeTask()]);
			const matches = matchEvent(index, { folder: "notes/inbox", type: "file-created" });
			expect(matches).toHaveLength(1);
			expect(matches[0].taskId).toBe("task-001");
		});

		it("matches on folder prefix", () => {
			const index = buildIndex([makeTask()]);
			const matches = matchEvent(index, { folder: "notes/inbox/subdir", type: "file-created" });
			expect(matches).toHaveLength(1);
		});

		it("returns empty for non-matching event type", () => {
			const index = buildIndex([makeTask()]);
			const matches = matchEvent(index, { folder: "notes/inbox", type: "file-deleted" });
			expect(matches).toHaveLength(0);
		});

		it("returns empty for non-matching folder", () => {
			const index = buildIndex([makeTask()]);
			const matches = matchEvent(index, { folder: "notes/archive", type: "file-created" });
			expect(matches).toHaveLength(0);
		});

		it("returns empty for empty index", () => {
			const index = buildIndex([]);
			const matches = matchEvent(index, { folder: "notes/inbox", type: "file-created" });
			expect(matches).toHaveLength(0);
		});

		it("returns multiple matching orders when more than one watch the same folder+event", () => {
			const tasks = [
				makeTask({ id: "task-001", assignee: "auditor" }),
				makeTask({ id: "task-002", assignee: "curator" }),
			];
			const index = buildIndex(tasks);
			const matches = matchEvent(index, { folder: "notes/inbox", type: "file-created" });
			expect(matches).toHaveLength(2);
		});
	});

	describe("getActiveOrders", () => {
		it("filters by agent name", () => {
			const tasks = [
				makeTask({ id: "task-001", assignee: "auditor" }),
				makeTask({ id: "task-002", assignee: "curator" }),
				makeTask({ id: "task-003", assignee: "auditor" }),
			];
			const index = buildIndex(tasks);
			const orders = getActiveOrders(index, "auditor");
			expect(orders).toHaveLength(2);
			expect(orders.every((o: IndexedOrder) => o.assignee === "auditor")).toBe(true);
		});

		it("returns empty when agent has no orders", () => {
			const index = buildIndex([makeTask({ assignee: "auditor" })]);
			expect(getActiveOrders(index, "no-such-agent")).toHaveLength(0);
		});

		it("returns empty for empty index", () => {
			const index = buildIndex([]);
			expect(getActiveOrders(index, "auditor")).toHaveLength(0);
		});
	});
});
