export function findNearest<T extends { distance: number }>(items: T[]): T | null {
	if (items.length === 0) return null;
	return items.reduce((min, item) => item.distance < min.distance ? item : min);
}

interface InventoryItem {
	item_id: string;
	[key: string]: unknown;
}

export function updateItemInInventory<T extends InventoryItem>(
	items: T[],
	itemId: string,
	updates: Partial<T>,
): T[] {
	return items.map(i => i.item_id === itemId ? { ...i, ...updates } : { ...i });
}
