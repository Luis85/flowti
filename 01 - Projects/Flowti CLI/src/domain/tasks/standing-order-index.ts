import type { TaskSummary, StandingOrderRule } from "./task-types.js";

export interface StandingOrderIndex {
	readonly orders: readonly IndexedOrder[];
}

export interface IndexedOrder {
	readonly taskId: string;
	readonly assignee: string;
	readonly watchFolder: string;
	readonly watchEvent: string;
	readonly rules: readonly StandingOrderRule[];
}

export function buildIndex(tasks: TaskSummary[]): StandingOrderIndex {
	const orders: IndexedOrder[] = [];
	for (const t of tasks) {
		if (t.type !== "standing-order") continue;
		if (t.status !== "assigned" && t.status !== "in-progress") continue;
		// Standing order watch config is encoded in tags: "watch:folder:event"
		const watchTag = t.tags.find(tag => tag.startsWith("watch:"));
		if (!watchTag) continue;
		const parts = watchTag.split(":");
		orders.push({
			taskId: t.id,
			assignee: t.assignee ?? "",
			watchFolder: parts[1] ?? "",
			watchEvent: parts[2] ?? "",
			rules: [],
		});
	}
	return { orders };
}

export function matchEvent(index: StandingOrderIndex, event: { folder: string; type: string }): IndexedOrder[] {
	return index.orders.filter(o =>
		(o.watchFolder === "*" || o.watchFolder === event.folder) &&
		(o.watchEvent === "*" || o.watchEvent === event.type)
	);
}

export function getActiveOrders(index: StandingOrderIndex, agentName: string): IndexedOrder[] {
	return index.orders.filter(o => o.assignee === agentName);
}
