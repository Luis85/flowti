import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyFeed, type FeedConfig } from '../../domain/systems/feed.js';
import { findFoodInInventory, removeFromInventory } from '../../domain/systems/food-items.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { Actor } from 'excalibur';
import { NeedsComponent } from '../components/needs-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { EconomyComponent } from '../components/economy-component.js';

export function createFeedSystem(
	agents: () => AgentActor[],
	worldEntity: () => Actor,
): GameSystem {
	return {
		name: 'FeedSystem',
		priority: SystemPriority.FEED,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const world = worldEntity();
			const economy = world.get(EconomyComponent);

			for (const agent of agentList) {
				const ba = agent.behaviorAgent;
				const btAction = ba.btAction;

				if (btAction !== 'eat') {
					if (ba.feedingAt !== null) {
						ba.feedingAt = null;
					}
					continue;
				}

				const inv = agent.get(InventoryComponent);
				const foodItem = findFoodInInventory(inv.state.items);
				if (foodItem === null) {
					if (ba.feedingAt !== null) {
						ba.feedingAt = null;
					}
					continue;
				}

				const newItems = removeFromInventory(inv.state.items, foodItem.item_id, 1);
				inv.state = { items: newItems };
				inv.markDirty();

				const needs = agent.get(NeedsComponent);
				const feedConfig: FeedConfig = { recovery_rate: deps.config.needs.food_recovery_rate };
				const result = applyFeed({ currentHunger: needs.state.hunger }, feedConfig);

				needs.state = { ...needs.state, hunger: result.newHunger };
				needs.markDirty();

				economy.state = {
					...economy.state,
					ledger: [
						...economy.state.ledger,
						{
							tick: deps.tickCount,
							type: 'consumption' as const,
							from: agent.agentId,
							to: 'consumed',
							itemId: foodItem.item_id,
							quantity: 1,
							gold: 0,
						},
					],
					dailySummary: {
						...economy.state.dailySummary,
						totalConsumption: economy.state.dailySummary.totalConsumption + 1,
					},
				};
				economy.markDirty();

				const previousFeedingAt = ba.feedingAt;
				if (previousFeedingAt !== 'inventory') {
					ba.feedingAt = 'inventory';

					deps.eventBus.emit({
						type: 'FeedStarted',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'FeedSystem',
						payload: { agentId: agent.agentId, locationId: null },
					});
				}

				deps.eventBus.emit({
					type: 'ItemConsumed',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'FeedSystem',
					payload: { agentId: agent.agentId, itemId: foodItem.item_id },
				});
			}
		},
	};
}
