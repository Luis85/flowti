import type { TaskEntry } from "../../../src/domain/tasks/task-dispatcher-types.js";

export function makeTask(overrides: Partial<TaskEntry> = {}): TaskEntry {
	return {
		taskId: "task-001",
		title: "Test task",
		priority: "normal",
		requiredCapabilities: [],
		requiredAgentTier: "supervised",
		taskTrustTier: "auto",
		reward: { xp: 10, coin: 5 },
		submittedAt: 1000,
		source: "director",
		retryCount: 0,
		tags: [],
		type: "one-off",
		...overrides,
	};
}
