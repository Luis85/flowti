import type { StandingOrderPayload, StandingOrderRule } from "./task-types.js";

export type { StandingOrderRule };

export interface IndexedOrder {
	readonly taskId: string;
	readonly assignee: string;
	readonly watchFolder: string;
	readonly watchEvent: string;
	readonly rules: readonly StandingOrderRule[];
}

export interface StandingOrderIndex {
	readonly orders: readonly IndexedOrder[];
}

interface IndexableTask {
	readonly id: string;
	readonly type: string;
	readonly status: string;
	readonly assignee?: string;
	readonly standingOrder?: StandingOrderPayload;
}

export function buildIndex(tasks: IndexableTask[]): StandingOrderIndex {
	const orders: IndexedOrder[] = [];

	for (const task of tasks) {
		if (task.type !== "standing-order") continue;
		if (task.status !== "assigned") continue;
		if (!task.standingOrder) continue;

		orders.push({
			taskId: task.id,
			assignee: task.assignee ?? "",
			watchFolder: task.standingOrder.watch.folder,
			watchEvent: task.standingOrder.watch.event,
			rules: task.standingOrder.rules,
		});
	}

	return { orders };
}

export function matchEvent(
	index: StandingOrderIndex,
	event: { folder: string; type: string },
): IndexedOrder[] {
	return index.orders.filter(
		(o) =>
			event.folder.startsWith(o.watchFolder) &&
			o.watchEvent === event.type,
	);
}

export function getActiveOrders(
	index: StandingOrderIndex,
	agentName: string,
): IndexedOrder[] {
	return index.orders.filter((o) => o.assignee === agentName);
}
