import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import type { Actor } from 'excalibur';
import { FacilityComponent } from '../components/facility-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import type { Item } from '../../domain/schemas/item-schema.js';
import { processRecipeFacilityTick } from './facility-system-recipe.js';
import type { Recipe } from '../../domain/schemas/recipe-schema.js';
import type { FacilityType } from '../../domain/schemas/facility-type-schema.js';

/**
 * Attempts the recipe-based path for a location.
 * Returns true if this location was handled by the recipe path, false otherwise.
 */
function tryRecipePath(
	loc: WorldLocation,
	facility: FacilityComponent,
	agentList: AgentActor[],
	economy: EconomyComponent,
	deps: GameCoreDeps,
	facilityTypeRegistry: Map<string, FacilityType>,
	recipeRegistry: Map<string, Recipe>,
): boolean {
	if (loc.active_recipe === null) return false;
	const facilityType = facilityTypeRegistry.get(loc.facility_type);
	if (facilityType?.kind !== 'production') return false;
	const recipe = recipeRegistry.get(loc.active_recipe);
	if (recipe === undefined) return false;
	processRecipeFacilityTick(loc, facilityType, recipe, facility, agentList, economy, deps);
	return true;
}

interface StockItem {
	item_id: string;
	quantity: number;
}

export function findItemInStock(stock: StockItem[], itemId: string): number {
	for (const item of stock) {
		if (item.item_id === itemId) return item.quantity;
	}
	return 0;
}

export function updateStock(stock: StockItem[], itemId: string, delta: number): StockItem[] {
	const hasItem = stock.some(item => item.item_id === itemId);
	if (!hasItem && delta > 0) {
		return [...stock.map(item => ({ ...item })), { item_id: itemId, quantity: delta }];
	}
	return stock
		.map(item => {
			if (item.item_id !== itemId) return { ...item };
			const newQty = item.quantity + delta;
			return newQty > 0 ? { ...item, quantity: newQty } : null;
		})
		.filter((item): item is StockItem => item !== null);
}

export function createFacilitySystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	getLocationActors: () => Map<string, Actor>,
	worldEntity: () => Actor,
	_getItemRegistry?: () => Map<string, Item>,
): GameSystem {
	return {
		name: 'FacilitySystem',
		priority: SystemPriority.FACILITY,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const locationList = locations();
			const locationActorMap = getLocationActors();
			const economy = worldEntity().get(EconomyComponent);

			const recipeRegistry = deps.getRecipeRegistry();
			const facilityTypeRegistry = deps.getFacilityTypeRegistry();

			for (const loc of locationList) {
				const locActor = locationActorMap.get(loc.id);
				if (locActor === undefined) continue;
				const facility = locActor.get(FacilityComponent);
				if (facility.state.status === 'abandoned') continue;

				tryRecipePath(loc, facility, agentList, economy, deps, facilityTypeRegistry, recipeRegistry);
			}
		},
	};
}
