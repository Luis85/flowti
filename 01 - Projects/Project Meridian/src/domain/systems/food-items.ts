/** Consumable food items — only items agents can eat, not raw materials. */
export const FOOD_ITEMS = new Set(['food']);

export interface InventoryItem {
	item_id: string;
	quantity: number;
}

/** Find the first food item in the given inventory. */
export function findFoodInInventory(inventory: InventoryItem[]): InventoryItem | null {
	for (const item of inventory) {
		if (FOOD_ITEMS.has(item.item_id)) {
			return item;
		}
	}
	return null;
}

/** Return a new inventory array with the specified item decremented (or removed if qty reaches 0). */
export function removeFromInventory(
	inventory: InventoryItem[],
	itemId: string,
	amount: number,
): InventoryItem[] {
	return inventory
		.map(item => {
			if (item.item_id !== itemId) return { ...item };
			const newQty = item.quantity - amount;
			return newQty > 0 ? { ...item, quantity: newQty } : null;
		})
		.filter((item): item is InventoryItem => item !== null);
}
