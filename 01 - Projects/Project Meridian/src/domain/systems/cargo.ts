import type { CargoState } from '../core/component-data.js';

export type { CargoState } from '../core/component-data.js';

// ── Supply Route Planning ────────────────────────────────────────────────

export interface SupplyRoute {
	sourceId: string;
	destinationId: string;
	itemId: string;
	waypoints: string[];
}

export interface FacilityData {
	id: string;
	output?: { item_id: string };
	input?: { item_id: string } | null;
	region: string;
}

/** BFS shortest path length between two regions. Returns 0 if same region. */
function calculateHops(
	fromRegion: string,
	toRegion: string,
	regionGraph: Map<string, string[]>,
): number {
	if (fromRegion === toRegion) return 0;
	const visited = new Set<string>([fromRegion]);
	const queue: { region: string; depth: number }[] = [{ region: fromRegion, depth: 0 }];

	while (queue.length > 0) {
		const current = queue.shift()!;
		const neighbors = regionGraph.get(current.region) ?? [];
		for (const neighbor of neighbors) {
			if (neighbor === toRegion) return current.depth + 1;
			if (!visited.has(neighbor)) {
				visited.add(neighbor);
				queue.push({ region: neighbor, depth: current.depth + 1 });
			}
		}
	}

	// No path found — return Infinity so this candidate is never chosen
	return Infinity;
}

/** BFS to find intermediate waypoint regions between two regions (exclusive of start and end). */
function findWaypoints(
	fromRegion: string,
	toRegion: string,
	regionGraph: Map<string, string[]>,
): string[] {
	if (fromRegion === toRegion) return [];

	const visited = new Set<string>([fromRegion]);
	const parent = new Map<string, string>();
	const queue: string[] = [fromRegion];

	while (queue.length > 0) {
		const current = queue.shift()!;
		const neighbors = regionGraph.get(current) ?? [];
		for (const neighbor of neighbors) {
			if (visited.has(neighbor)) continue;
			visited.add(neighbor);
			parent.set(neighbor, current);
			if (neighbor === toRegion) {
				// Reconstruct path, excluding start and end
				const path: string[] = [];
				let node = toRegion;
				while (node !== fromRegion) {
					path.push(node);
					node = parent.get(node)!;
				}
				path.reverse();
				// Remove the destination itself — waypoints are intermediates only
				path.pop();
				return path;
			}
			queue.push(neighbor);
		}
	}

	return [];
}

export function planSupplyRoute(
	knownLocations: string[],
	facilityData: Map<string, FacilityData>,
	_currentRegion: string,
	regionGraph: Map<string, string[]>,
): SupplyRoute | null {
	for (const destId of knownLocations) {
		const dest = facilityData.get(destId);
		if (dest?.input === null || dest?.input === undefined) continue;
		const neededItem = dest.input.item_id;

		let bestSource: string | null = null;
		let bestHops = Infinity;

		for (const srcId of knownLocations) {
			if (srcId === destId) continue;
			const src = facilityData.get(srcId);
			if (src?.output === undefined) continue;
			if (src.output.item_id !== neededItem) continue;

			const hops = calculateHops(src.region, dest.region, regionGraph);
			if (hops < bestHops) {
				bestHops = hops;
				bestSource = srcId;
			}
		}

		if (bestSource !== null) {
			const source = facilityData.get(bestSource)!;
			const waypoints = findWaypoints(source.region, dest.region, regionGraph);
			return { sourceId: bestSource, destinationId: destId, itemId: neededItem, waypoints };
		}
	}

	return null;
}

export interface StockItem {
	item_id: string;
	quantity: number;
}

export interface PickupCargoInput {
	itemId: string;
	agentId: string;
	facilityId: string;
	destinationId: string;
	stock: StockItem[];
}

export interface PickupCargoResult {
	cargo: CargoState | null;
	newStock: StockItem[];
}

export interface DeliverCargoInput {
	cargo: CargoState;
	destinationStock: StockItem[];
}

export interface DeliverCargoResult {
	newStock: StockItem[];
}

export function pickupCargo(input: PickupCargoInput): PickupCargoResult {
	const itemIndex = input.stock.findIndex(s => s.item_id === input.itemId && s.quantity > 0);
	if (itemIndex === -1) {
		return { cargo: null, newStock: [...input.stock] };
	}

	const item = input.stock[itemIndex];
	if (item === undefined) {
		return { cargo: null, newStock: [...input.stock] };
	}

	const newStock: StockItem[] = input.stock
		.map((s, i) => i === itemIndex ? { ...s, quantity: s.quantity - 1 } : { ...s })
		.filter(s => s.quantity > 0);

	const cargo: CargoState = {
		itemId: input.itemId,
		quantity: 1,
		source: input.facilityId,
		destination: input.destinationId,
	};

	return { cargo, newStock };
}

export function deliverCargo(input: DeliverCargoInput): DeliverCargoResult {
	const existingIndex = input.destinationStock.findIndex(
		s => s.item_id === input.cargo.itemId,
	);

	if (existingIndex === -1) {
		return {
			newStock: [
				...input.destinationStock,
				{ item_id: input.cargo.itemId, quantity: input.cargo.quantity },
			],
		};
	}

	const newStock: StockItem[] = input.destinationStock.map((s, i) =>
		i === existingIndex ? { ...s, quantity: s.quantity + input.cargo.quantity } : { ...s },
	);

	return { newStock };
}
