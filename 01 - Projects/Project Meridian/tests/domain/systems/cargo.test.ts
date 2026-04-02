import { describe, it, expect } from 'vitest';
import { pickupCargo, deliverCargo } from '../../../src/domain/systems/cargo.js';
import type { PickupCargoInput, DeliverCargoInput } from '../../../src/domain/systems/cargo.js';

describe('pickupCargo', () => {
	it('transfers 1 unit from stock to cargo', () => {
		const input: PickupCargoInput = {
			itemId: 'bread',
			agentId: 'agent1',
			facilityId: 'fac1',
			destinationId: 'fac2',
			stock: [{ item_id: 'bread', quantity: 3 }],
		};
		const result = pickupCargo(input);
		expect(result.cargo).not.toBeNull();
		expect(result.cargo?.itemId).toBe('bread');
		expect(result.cargo?.quantity).toBe(1);
		expect(result.cargo?.source).toBe('fac1');
		expect(result.cargo?.destination).toBe('fac2');
		expect(result.newStock).toEqual([{ item_id: 'bread', quantity: 2 }]);
	});

	it('fails when item not in stock', () => {
		const input: PickupCargoInput = {
			itemId: 'wheat',
			agentId: 'agent1',
			facilityId: 'fac1',
			destinationId: 'fac2',
			stock: [{ item_id: 'bread', quantity: 3 }],
		};
		const result = pickupCargo(input);
		expect(result.cargo).toBeNull();
		expect(result.newStock).toEqual([{ item_id: 'bread', quantity: 3 }]);
	});

	it('removes item from stock when quantity reaches 0', () => {
		const input: PickupCargoInput = {
			itemId: 'bread',
			agentId: 'agent1',
			facilityId: 'fac1',
			destinationId: 'fac2',
			stock: [{ item_id: 'bread', quantity: 1 }],
		};
		const result = pickupCargo(input);
		expect(result.cargo).not.toBeNull();
		expect(result.cargo?.quantity).toBe(1);
		expect(result.newStock).toEqual([]);
	});
});

describe('deliverCargo', () => {
	it('adds cargo item to destination stock', () => {
		const input: DeliverCargoInput = {
			cargo: { itemId: 'bread', quantity: 1, source: 'fac1', destination: 'fac2' },
			destinationStock: [],
		};
		const result = deliverCargo(input);
		expect(result.newStock).toEqual([{ item_id: 'bread', quantity: 1 }]);
	});

	it('increments existing item quantity', () => {
		const input: DeliverCargoInput = {
			cargo: { itemId: 'bread', quantity: 2, source: 'fac1', destination: 'fac2' },
			destinationStock: [{ item_id: 'bread', quantity: 5 }],
		};
		const result = deliverCargo(input);
		expect(result.newStock).toEqual([{ item_id: 'bread', quantity: 7 }]);
	});
});
