import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { Actor } from 'excalibur';
import { TimeComponent } from '../components/time-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { QuestBoardComponent } from '../components/quest-board-component.js';
import type { QuestRuntime } from '../../domain/schemas/quest-schema.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';

export function createQuestGenerationSystem(
	worldEntity: () => Actor,
	getLocationActors: () => Map<string, Actor>,
	getLocations: () => WorldLocation[],
): GameSystem {
	return {
		name: 'QuestGenerationSystem',
		priority: SystemPriority.QUEST_GENERATION,

		execute(deps: GameCoreDeps): void {
			const entity = worldEntity();
			const time = entity.get(TimeComponent);
			if (!time.state.dayBoundaryThisTick) return;

			const board = entity.get(QuestBoardComponent);

			// Expiration is handled by QuestEvaluationSystem (runs every tick).
			// Generate quests for facilities that need help
			const locationActorMap = getLocationActors();
			const locationList = getLocations();

			for (const loc of locationList) {
				// Skip if max_open quests reached
				const openCount = board.state.quests.filter(q => q.state === 'open' || q.state === 'claimed').length;
				if (openCount >= deps.config.quests.max_open) break;

				// Skip if facility already has an open/claimed quest on the board
				const hasExistingQuest = board.state.quests.some(
					q => q.facilityId === loc.id && (q.state === 'open' || q.state === 'claimed'),
				);
				if (hasExistingQuest) continue;

				const locActor = locationActorMap.get(loc.id);
				if (locActor === undefined) continue;
				if (!locActor.has(FacilityComponent)) continue;

				const facility = locActor.get(FacilityComponent);

				// Check conditions and generate appropriate quest
				let quest: QuestRuntime | null = null;

				// Repair quest: facility is abandoned
				if (facility.state.status === 'abandoned') {
					quest = {
						id: `q-${loc.id}-${deps.tickCount}`,
						type: 'repair',
						facilityId: loc.id,
						itemId: null,
						quantity: 1,
						reward: deps.config.quests.repair_reward,
						rewardXp: 5,
						state: 'open',
						claimedBy: null,
						createdTick: deps.tickCount,
						expiryTicks: deps.config.quests.expiry_ticks,
						repairProgress: 0,
					};
				}

				// Supply quest: production.input exists AND input stock below required quantity
				if (quest === null && loc.production !== null && loc.production.input !== null) {
					const inputStock = facility.state.stock.find(s => s.item_id === loc.production!.input!.item_id);
					const currentQty = inputStock?.quantity ?? 0;
					const requiredQty = loc.production.input.quantity;

					if (currentQty < requiredQty) {
						const neededQty = requiredQty - currentQty;
						const itemConfig = deps.config.items[loc.production.input.item_id];
						const baseValue = itemConfig?.baseValue ?? deps.config.economy.food_price;
						const reward = baseValue * neededQty * deps.config.quests.supply_reward_multiplier;

						quest = {
							id: `q-${loc.id}-${deps.tickCount}`,
							type: 'supply',
							facilityId: loc.id,
							itemId: loc.production.input.item_id,
							quantity: neededQty,
							reward,
							rewardXp: 5,
							state: 'open',
							claimedBy: null,
							createdTick: deps.tickCount,
							expiryTicks: deps.config.quests.expiry_ticks,
							repairProgress: 0,
						};
					}
				}

				// Restock quest: location type is 'market' AND total stock < restock_threshold
				if (quest === null && loc.type === 'market') {
					const totalStock = facility.state.stock.reduce((sum, s) => sum + s.quantity, 0);
					if (totalStock < deps.config.quests.restock_threshold) {
						// Pick the lowest-stock food item to restock
						const foodStock = facility.state.stock.find(s => s.item_id === 'food');
						const restockItem = foodStock === undefined || foodStock.quantity < deps.config.quests.restock_threshold
							? 'food'
							: facility.state.stock.reduce((lowest, s) => s.quantity < lowest.quantity ? s : lowest).item_id;

						quest = {
							id: `q-${loc.id}-${deps.tickCount}`,
							type: 'restock',
							facilityId: loc.id,
							itemId: restockItem,
							quantity: 1,
							reward: deps.config.quests.restock_reward,
							rewardXp: 5,
							state: 'open',
							claimedBy: null,
							createdTick: deps.tickCount,
							expiryTicks: deps.config.quests.expiry_ticks,
							repairProgress: 0,
						};
					}
				}

				if (quest !== null) {
					board.state = {
						...board.state,
						quests: [...board.state.quests, quest],
					};
					board.markDirty();

					deps.eventBus.emit({
						type: 'QuestGenerated',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'QuestGenerationSystem',
						payload: { questId: quest.id, type: quest.type, facilityId: quest.facilityId, reward: quest.reward },
					});
				}
			}
		},
	};
}
