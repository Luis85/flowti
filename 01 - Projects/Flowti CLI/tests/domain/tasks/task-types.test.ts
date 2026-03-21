import { describe, it, expect } from "vitest";
import type { TaskDefinition, TaskStatus, TaskType, StandingOrderPayload } from "../../../src/domain/tasks/task-types.js";

describe("task-types", () => {
	it("TaskDefinition accepts valid task", () => {
		const task: TaskDefinition = {
			id: "task-001",
			type: "one-off",
			title: "Tag inbox notes",
			creator: "director",
			priority: "normal",
			trustTier: "review",
			status: "pending",
			reward: { xp: 50, coin: 25 },
			tags: ["inbox"],
			createdAt: "2026-03-21T10:00:00Z",
		};
		expect(task.id).toBe("task-001");
		expect(task.type).toBe("one-off");
	});

	it("StandingOrderPayload accepts valid payload", () => {
		const payload: StandingOrderPayload = {
			watch: { folder: "00 - Inbox", event: "file-created" },
			rules: [{ match: { tags: { missing: ["project"] } }, action: "tag", value: "needs-triage" }],
			schedule: "on-event",
			runCount: 0,
		};
		expect(payload.watch.folder).toBe("00 - Inbox");
		expect(payload.runCount).toBe(0);
	});

	it("TaskStatus includes all lifecycle states", () => {
		const states: TaskStatus[] = ["proposed", "pending", "assigned", "in-progress", "review", "completed", "failed"];
		expect(states).toHaveLength(7);
	});

	it("TaskType includes all task types", () => {
		const types: TaskType[] = ["one-off", "standing-order", "delegated", "self-proposed"];
		expect(types).toHaveLength(4);
	});
});
