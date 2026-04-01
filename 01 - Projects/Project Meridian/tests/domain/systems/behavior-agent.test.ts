import { describe, it, expectTypeOf } from 'vitest';
import type {
	BehaviorAgent,
	PerceivedAgent,
	PerceivedLocation,
	PerceivedFacility,
	MovementTarget,
	ActionResult,
} from '../../../src/domain/systems/behavior-agent.js';
import type { CargoState } from '../../../src/domain/systems/behavior-agent.js';

describe('BehaviorAgent interface — type-level contract', () => {
	describe('supporting types', () => {
		it('PerceivedAgent can be constructed', () => {
			const pa: PerceivedAgent = { id: 'a1', position: { x: 10, y: 20 }, distance: 5 };
			expectTypeOf(pa).toMatchTypeOf<PerceivedAgent>();
		});

		it('PerceivedLocation can be constructed', () => {
			const pl: PerceivedLocation = { id: 'loc1', type: 'market', position: { x: 0, y: 0 }, distance: 10 };
			expectTypeOf(pl).toMatchTypeOf<PerceivedLocation>();
		});

		it('PerceivedFacility can be constructed', () => {
			const pf: PerceivedFacility = {
				id: 'fac1',
				job: 'baker',
				stock: [{ item_id: 'bread', quantity: 3 }],
				distance: 15,
				hasUnmetInput: false,
			};
			expectTypeOf(pf).toMatchTypeOf<PerceivedFacility>();
		});

		it('CargoState can be constructed (re-export)', () => {
			const cs: CargoState = { itemId: 'bread', quantity: 1, source: 'fac1', destination: 'fac2' };
			expectTypeOf(cs).toMatchTypeOf<CargoState>();
		});

		it('MovementTarget can be constructed', () => {
			const mt: MovementTarget = { id: 'target1', type: 'location' };
			expectTypeOf(mt).toMatchTypeOf<MovementTarget>();
		});

		it('ActionResult is a string literal union', () => {
			const r: ActionResult = 'mistreevous.succeeded';
			expectTypeOf(r).toMatchTypeOf<ActionResult>();
		});
	});

	describe('BehaviorAgent condition methods (19 total)', () => {
		it('IsHungry exists', () => {
			expectTypeOf<BehaviorAgent['IsHungry']>().toBeFunction();
		});

		it('IsExhausted exists', () => {
			expectTypeOf<BehaviorAgent['IsExhausted']>().toBeFunction();
		});

		it('IsLonely exists', () => {
			expectTypeOf<BehaviorAgent['IsLonely']>().toBeFunction();
		});

		it('NeedsCritical exists', () => {
			expectTypeOf<BehaviorAgent['NeedsCritical']>().toBeFunction();
		});

		it('HasFood exists', () => {
			expectTypeOf<BehaviorAgent['HasFood']>().toBeFunction();
		});

		it('HasGold exists', () => {
			expectTypeOf<BehaviorAgent['HasGold']>().toBeFunction();
		});

		it('CanAffordFood exists', () => {
			expectTypeOf<BehaviorAgent['CanAffordFood']>().toBeFunction();
		});

		it('AtLocation exists', () => {
			expectTypeOf<BehaviorAgent['AtLocation']>().toBeFunction();
		});

		it('NearLocation exists', () => {
			expectTypeOf<BehaviorAgent['NearLocation']>().toBeFunction();
		});

		it('NearAgent exists', () => {
			expectTypeOf<BehaviorAgent['NearAgent']>().toBeFunction();
		});

		it('NearAgentClose exists', () => {
			expectTypeOf<BehaviorAgent['NearAgentClose']>().toBeFunction();
		});

		it('IsDaytime exists', () => {
			expectTypeOf<BehaviorAgent['IsDaytime']>().toBeFunction();
		});

		it('IsNighttime exists', () => {
			expectTypeOf<BehaviorAgent['IsNighttime']>().toBeFunction();
		});

		it('HasJob exists', () => {
			expectTypeOf<BehaviorAgent['HasJob']>().toBeFunction();
		});

		it('AtJobFacility exists', () => {
			expectTypeOf<BehaviorAgent['AtJobFacility']>().toBeFunction();
		});

		it('FacilityHasStock exists', () => {
			expectTypeOf<BehaviorAgent['FacilityHasStock']>().toBeFunction();
		});

		it('HasCargo exists', () => {
			expectTypeOf<BehaviorAgent['HasCargo']>().toBeFunction();
		});

		it('CargoDestinationNearby exists', () => {
			expectTypeOf<BehaviorAgent['CargoDestinationNearby']>().toBeFunction();
		});

		it('FacilityNeedsSupply exists', () => {
			expectTypeOf<BehaviorAgent['FacilityNeedsSupply']>().toBeFunction();
		});
	});

	describe('BehaviorAgent action methods (16 total)', () => {
		it('Eat exists', () => {
			expectTypeOf<BehaviorAgent['Eat']>().toBeFunction();
		});

		it('Rest exists', () => {
			expectTypeOf<BehaviorAgent['Rest']>().toBeFunction();
		});

		it('SeekFood exists', () => {
			expectTypeOf<BehaviorAgent['SeekFood']>().toBeFunction();
		});

		it('SeekRest exists', () => {
			expectTypeOf<BehaviorAgent['SeekRest']>().toBeFunction();
		});

		it('SeekWork exists', () => {
			expectTypeOf<BehaviorAgent['SeekWork']>().toBeFunction();
		});

		it('SeekSocial exists', () => {
			expectTypeOf<BehaviorAgent['SeekSocial']>().toBeFunction();
		});

		it('SeekMarket exists', () => {
			expectTypeOf<BehaviorAgent['SeekMarket']>().toBeFunction();
		});

		it('Work exists', () => {
			expectTypeOf<BehaviorAgent['Work']>().toBeFunction();
		});

		it('Talk exists', () => {
			expectTypeOf<BehaviorAgent['Talk']>().toBeFunction();
		});

		it('Buy exists', () => {
			expectTypeOf<BehaviorAgent['Buy']>().toBeFunction();
		});

		it('PickupCargo exists', () => {
			expectTypeOf<BehaviorAgent['PickupCargo']>().toBeFunction();
		});

		it('DeliverCargo exists', () => {
			expectTypeOf<BehaviorAgent['DeliverCargo']>().toBeFunction();
		});

		it('SeekDeliveryTarget exists', () => {
			expectTypeOf<BehaviorAgent['SeekDeliveryTarget']>().toBeFunction();
		});

		it('SeekSupplySource exists', () => {
			expectTypeOf<BehaviorAgent['SeekSupplySource']>().toBeFunction();
		});

		it('Idle exists', () => {
			expectTypeOf<BehaviorAgent['Idle']>().toBeFunction();
		});

		it('Wander exists', () => {
			expectTypeOf<BehaviorAgent['Wander']>().toBeFunction();
		});
	});
});
