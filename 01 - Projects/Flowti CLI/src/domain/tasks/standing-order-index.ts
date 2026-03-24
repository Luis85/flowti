import type { TaskSummary, StandingOrderRule } from "./task-types.js";
import type { TaskEntry } from "./task-dispatcher-types.js";

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

/** Convert matched standing orders into TaskEntry objects for the dispatcher. */
export function buildEntriesFromMatches(
	matches: readonly IndexedOrder[],
	clock: { ms(): number },
): TaskEntry[] {
	const now = clock.ms();
	return matches.map((order, i) => ({
		taskId: `so-${now}-${i}`,
		title: `Standing order: ${order.watchEvent} on ${order.watchFolder}`,
		priority: "normal" as const,
		requiredCapabilities: [],
		requiredAgentTier: "supervised" as const,
		taskTrustTier: "auto" as const,
		reward: { xp: 10, coin: 5 },
		submittedAt: now,
		source: "standing-order" as const,
		targetAgent: order.assignee || undefined,
		retryCount: 0,
		tags: [],
		type: "standing-order",
	}));
}
