import { describe, it, expect } from 'vitest';
import { pickupCargo, deliverCargo, planSupplyRoute } from '../../../src/domain/systems/cargo.js';
import type { PickupCargoInput, DeliverCargoInput, FacilityData } from '../../../src/domain/systems/cargo.js';

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

describe('planSupplyRoute', () => {
	it('returns null when knownLocations is empty', () => {
		const facilityData = new Map<string, FacilityData>();
		const result = planSupplyRoute([], facilityData, 'region-a', new Map());
		expect(result).toBeNull();
	});

	it('returns null when no facility produces needed input', () => {
		const facilityData = new Map<string, FacilityData>([
			['fac-mill', { id: 'fac-mill', input: { item_id: 'wheat' }, region: 'region-a' }],
		]);
		const result = planSupplyRoute(['fac-mill'], facilityData, 'region-a', new Map());
		expect(result).toBeNull();
	});

	it('returns route when source has output and destination needs input', () => {
		const facilityData = new Map<string, FacilityData>([
			['fac-farm', { id: 'fac-farm', output: { item_id: 'wheat' }, region: 'region-a' }],
			['fac-mill', { id: 'fac-mill', input: { item_id: 'wheat' }, region: 'region-a' }],
		]);
		const result = planSupplyRoute(['fac-farm', 'fac-mill'], facilityData, 'region-a', new Map());
		expect(result).not.toBeNull();
		expect(result!.sourceId).toBe('fac-farm');
		expect(result!.destinationId).toBe('fac-mill');
		expect(result!.itemId).toBe('wheat');
		expect(result!.waypoints).toEqual([]);
	});

	it('picks nearest source when multiple candidates exist', () => {
		const regionGraph = new Map<string, string[]>([
			['region-a', ['region-b']],
			['region-b', ['region-a', 'region-c']],
			['region-c', ['region-b']],
		]);
		const facilityData = new Map<string, FacilityData>([
			['fac-far-farm', { id: 'fac-far-farm', output: { item_id: 'wheat' }, region: 'region-c' }],
			['fac-near-farm', { id: 'fac-near-farm', output: { item_id: 'wheat' }, region: 'region-a' }],
			['fac-mill', { id: 'fac-mill', input: { item_id: 'wheat' }, region: 'region-a' }],
		]);
		const result = planSupplyRoute(
			['fac-far-farm', 'fac-near-farm', 'fac-mill'],
			facilityData,
			'region-a',
			regionGraph,
		);
		expect(result).not.toBeNull();
		expect(result!.sourceId).toBe('fac-near-farm');
	});

	it('handles cross-region route via regionGraph', () => {
		const regionGraph = new Map<string, string[]>([
			['region-a', ['region-b']],
			['region-b', ['region-a', 'region-c']],
			['region-c', ['region-b']],
		]);
		const facilityData = new Map<string, FacilityData>([
			['fac-farm', { id: 'fac-farm', output: { item_id: 'wheat' }, region: 'region-a' }],
			['fac-mill', { id: 'fac-mill', input: { item_id: 'wheat' }, region: 'region-c' }],
		]);
		const result = planSupplyRoute(
			['fac-farm', 'fac-mill'],
			facilityData,
			'region-a',
			regionGraph,
		);
		expect(result).not.toBeNull();
		expect(result!.sourceId).toBe('fac-farm');
		expect(result!.destinationId).toBe('fac-mill');
		expect(result!.waypoints).toEqual(['region-b']);
	});

	it('returns null when known location is absent from facilityData (stale)', () => {
		const facilityData = new Map<string, FacilityData>([
			['fac-farm', { id: 'fac-farm', output: { item_id: 'wheat' }, region: 'region-a' }],
		]);
		// fac-mill is in knownLocations but not in facilityData (stale reference)
		const result = planSupplyRoute(['fac-farm', 'fac-mill'], facilityData, 'region-a', new Map());
		expect(result).toBeNull();
	});
});
