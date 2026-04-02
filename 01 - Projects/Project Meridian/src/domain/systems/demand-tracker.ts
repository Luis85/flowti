export interface ConsumptionEvent {
	itemId: string;
	quantity: number;
	tick: number;
}

export interface DemandTracker {
	windowSize: number;
	events: Map<string, ConsumptionEvent[]>;
}

export function createDemandTracker(windowSize: number): DemandTracker {
	return { windowSize, events: new Map() };
}

export function recordConsumption(
	tracker: DemandTracker,
	itemId: string,
	quantity: number,
	tick: number,
): void {
	const list = tracker.events.get(itemId) ?? [];
	list.push({ itemId, quantity, tick });
	const cutoff = tick - tracker.windowSize;
	tracker.events.set(itemId, list.filter(e => e.tick >= cutoff));
}

export function getDemandRate(
	tracker: DemandTracker,
	itemId: string,
	currentTick: number,
): number {
	const list = tracker.events.get(itemId) ?? [];
	const cutoff = currentTick - tracker.windowSize;
	const inWindow = list.filter(e => e.tick >= cutoff);
	tracker.events.set(itemId, inWindow);
	return inWindow.reduce((sum, e) => sum + e.quantity, 0);
}
