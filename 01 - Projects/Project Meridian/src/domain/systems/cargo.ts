import type { CargoState } from '../core/component-data.js';

export type { CargoState } from '../core/component-data.js';

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
