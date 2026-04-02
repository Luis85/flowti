import type { CircularBuffer } from 'mnemonist';

export interface PriceMemory {
	itemId: string;
	price: number;
	locationId: string;
	tick: number;
}

export function isPriceStale(memory: PriceMemory, currentTick: number, staleTicks: number): boolean {
	return (currentTick - memory.tick) > staleTicks;
}

export function getRememberedPrice(
	memories: CircularBuffer<PriceMemory>,
	itemId: string,
	currentTick: number,
	staleTicks: number,
): PriceMemory | null {
	let best: PriceMemory | null = null;
	for (const mem of memories) {
		if (mem.itemId !== itemId) continue;
		if (isPriceStale(mem, currentTick, staleTicks)) continue;
		if (best === null || mem.tick > best.tick) best = mem;
	}
	return best;
}

export function getBestKnownSource(
	memories: CircularBuffer<PriceMemory>,
	itemId: string,
	currentTick: number,
	staleTicks: number,
): string | null {
	let cheapest: PriceMemory | null = null;
	for (const mem of memories) {
		if (mem.itemId !== itemId) continue;
		if (isPriceStale(mem, currentTick, staleTicks)) continue;
		if (cheapest === null || mem.price < cheapest.price) cheapest = mem;
	}
	return cheapest?.locationId ?? null;
}
