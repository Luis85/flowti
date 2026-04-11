import type { ActionResult } from '../../domain/systems/behavior-agent.js';
import type { ActionMethods } from './bt-actions.js';
import type { ActionContext } from './bt-action-helpers.js';
import { SUCCEEDED, FAILED, RUNNING, beginAction } from './bt-action-helpers.js';
import { FacilityComponent } from '../components/facility-component.js';
import { pickupCargo, deliverCargo } from '../../domain/systems/cargo.js';
import { findNearest } from '../../domain/core/array-utils.js';
import type { Recipe } from '../../domain/schemas/recipe-schema.js';

export function createCargoActions(ctx: ActionContext): Pick<ActionMethods, 'PickupCargo' | 'DeliverCargo' | 'SeekDeliveryTarget' | 'SeekSupplySource'> {
	const { memory, actor, deps, resolveNearbyFacilities } = ctx;
	const { getLocationActors, getLocations, tickCount, eventBus } = deps;

	function getLocationRecipe(locationId: string): Recipe | undefined {
		const loc = getLocations().find(l => l.id === locationId);
		if (loc === undefined) return undefined;
		if (loc.active_recipe === null) return undefined;
		return deps.getRecipeRegistry?.().get(loc.active_recipe);
	}

	function getLocationRecipeInputs(locationId: string): { item_id: string; quantity: number }[] {
		return getLocationRecipe(locationId)?.inputs ?? [];
	}

	function getLocationRecipeOutputs(locationId: string): { item_id: string; quantity: number }[] {
		return getLocationRecipe(locationId)?.outputs ?? [];
	}

	return {
		PickupCargo(): ActionResult {
			beginAction(ctx, 'pickup_cargo');
			// Find nearest facility with output stock
			const facilitiesWithOutput = resolveNearbyFacilities().filter(
				f => f.stock.some(s => s.quantity > 0),
			);
			if (facilitiesWithOutput.length === 0) return FAILED;

			const source = findNearest(facilitiesWithOutput)!;
			const stockItem = source.stock.find(s => s.quantity > 0);
			if (stockItem === undefined) return FAILED;

			// Find destination facility that needs this item as input
			const allLocations = getLocations();
			const destLoc = allLocations.find(l => {
				if (l.id === source.id) return false;
				const inputs = getLocationRecipeInputs(l.id);
				return inputs.some(i => i.item_id === stockItem.item_id);
			});
			if (destLoc === undefined) return FAILED;

			const result = pickupCargo({
				itemId: stockItem.item_id,
				agentId: actor.agentId,
				facilityId: source.id,
				destinationId: destLoc.id,
				stock: source.stock,
			});

			if (result.cargo === null) return FAILED;

			// Update facility stock
			const locActors = getLocationActors();
			const sourceActor = locActors.get(source.id);
			if (sourceActor !== undefined) {
				const facComp = sourceActor.get(FacilityComponent);
				facComp.state = { ...facComp.state, stock: result.newStock };
				facComp.markDirty();
			}

			memory.haulCargo = result.cargo;
			return SUCCEEDED;
		},

		DeliverCargo(): ActionResult {
			if (memory.haulCargo === null) return FAILED;
			if (memory.atLocation !== memory.haulCargo.destination) return FAILED;
			beginAction(ctx, 'deliver_cargo');

			const locActors = getLocationActors();
			const destActor = locActors.get(memory.haulCargo.destination);
			if (destActor === undefined) return FAILED;

			const destFac = destActor.get(FacilityComponent);
			const result = deliverCargo({
				cargo: memory.haulCargo,
				destinationStock: destFac.state.stock,
			});

			destFac.state = { ...destFac.state, stock: result.newStock };
			destFac.markDirty();

			const cargo = memory.haulCargo;
			memory.haulCargo = null;

			eventBus.emit({
				type: 'SupplyDelivered',
				tick: tickCount(),
				wallClock: Date.now(),
				source: 'BehaviorAgent',
				payload: { agentId: actor.agentId, itemId: cargo.itemId, quantity: cargo.quantity, sourceId: cargo.source, destinationId: cargo.destination },
			});

			return SUCCEEDED;
		},

		SeekDeliveryTarget(): ActionResult {
			if (memory.haulCargo === null) return FAILED;
			beginAction(ctx, 'seek_delivery');
			memory.movementTarget = { id: memory.haulCargo.destination, type: 'location' };
			if (memory.atLocation === memory.haulCargo.destination) return SUCCEEDED;
			return RUNNING;
		},

		SeekSupplySource(): ActionResult {
			// Find nearest facility with unmet input
			const needyFacilities = resolveNearbyFacilities().filter(f => f.hasUnmetInput);
			if (needyFacilities.length === 0) return FAILED;
			beginAction(ctx, 'seek_supply');

			const needy = findNearest(needyFacilities)!;

			// Find the PRODUCING facility (source) for the needed item
			const allLocations = getLocations();
			const needyInputs = getLocationRecipeInputs(needy.id);
			if (needyInputs.length === 0) return FAILED;
			const neededItemId = needyInputs[0]!.item_id;
			const sourceLoc = allLocations.find(l => {
				if (l.id === needy.id) return false;
				const outputs = getLocationRecipeOutputs(l.id);
				return outputs.some(o => o.item_id === neededItemId);
			});
			if (sourceLoc === undefined) return FAILED;

			memory.movementTarget = { id: sourceLoc.id, type: 'location' };
			if (memory.atLocation === sourceLoc.id) return SUCCEEDED;
			return RUNNING;
		},
	};
}
