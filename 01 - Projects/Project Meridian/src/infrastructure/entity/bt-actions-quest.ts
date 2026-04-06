import type { ActionResult } from '../../domain/systems/behavior-agent.js';
import type { ActionMethods } from './bt-actions.js';
import type { ActionContext } from './bt-action-helpers.js';
import { SUCCEEDED, FAILED, RUNNING, beginAction } from './bt-action-helpers.js';
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { MemoryComponent } from '../components/memory-component.js';
import { QuestBoardComponent } from '../components/quest-board-component.js';

export function createQuestActions(ctx: ActionContext): Pick<ActionMethods, 'ClaimQuest' | 'SeekQuestFacility' | 'WorkRepair' | 'CompleteQuest' | 'AbandonQuest'> {
	const { memory, actor, deps } = ctx;
	const { config, getLocationActors, tickCount, eventBus } = deps;

	return {
		ClaimQuest(): ActionResult {
			if (memory.cachedAvailableQuest === null) return FAILED;

			// Re-read quest state from board (race condition guard)
			const board = deps.getQuestBoard?.();
			if (board === undefined) return FAILED;
			const cachedId = memory.cachedAvailableQuest.id;
			const quest = board.quests.find(q => q.id === cachedId);
			if (quest?.state !== 'open') {
				memory.cachedAvailableQuest = null;
				return FAILED;
			}

			quest.state = 'claimed';
			quest.claimedBy = actor.agentId;
			deps.worldEntity().get(QuestBoardComponent).markDirty();
			memory.activeQuest = quest;
			memory.cachedAvailableQuest = null;
			beginAction(ctx, 'claim_quest');

			deps.eventBus.emit({
				type: 'QuestClaimed',
				tick: deps.tickCount(),
				wallClock: Date.now(),
				source: 'BehaviorAgent',
				payload: { agentId: actor.agentId, questId: quest.id, questType: quest.type, facilityId: quest.facilityId },
			});

			return SUCCEEDED;
		},

		SeekQuestFacility(): ActionResult {
			if (memory.activeQuest === null) return FAILED;
			beginAction(ctx, 'seek_quest');
			memory.movementTarget = { id: memory.activeQuest.facilityId, type: 'location' };
			if (memory.atLocation === memory.activeQuest.facilityId) return SUCCEEDED;
			return RUNNING;
		},

		WorkRepair(): ActionResult {
			if (memory.activeQuest?.type !== 'repair') return FAILED;
			beginAction(ctx, 'repair');
			return RUNNING;
		},

		CompleteQuest(): ActionResult {
			if (memory.activeQuest === null) return FAILED;
			const quest = memory.activeQuest;

			if (quest.type === 'supply' || quest.type === 'restock') {
				// Check agent has required item
				if (quest.itemId === null) return FAILED;
				const inv = actor.get(InventoryComponent);
				const item = inv.state.items.find(i => i.item_id === quest.itemId);
				if (item === undefined || item.quantity < quest.quantity) return FAILED;

				// Transfer item from agent to facility
				const newItems = inv.state.items
					.map(i => {
						if (i.item_id !== quest.itemId) return { ...i };
						const newQty = i.quantity - quest.quantity;
						return newQty > 0 ? { ...i, quantity: newQty } : null;
					})
					.filter((i): i is NonNullable<typeof i> => i !== null);
				inv.state = { ...inv.state, items: newItems };
				inv.markDirty();

				// Add to facility stock
				const locActors = getLocationActors();
				const facActor = locActors.get(quest.facilityId);
				if (facActor !== undefined) {
					const fac = facActor.get(FacilityComponent);
					const hasItem = fac.state.stock.some(s => s.item_id === quest.itemId);
					const newStock = hasItem
						? fac.state.stock.map(s => s.item_id === quest.itemId ? { ...s, quantity: s.quantity + quest.quantity } : { ...s })
						: [...fac.state.stock.map(s => ({ ...s })), { item_id: quest.itemId, quantity: quest.quantity }];
					fac.state = { ...fac.state, stock: newStock };
					fac.markDirty();
				}
			} else {
				// Check repair progress
				if (quest.repairProgress < config.quests.repair_ticks) return FAILED;

				// Restore facility
				const locActors = getLocationActors();
				const facActor = locActors.get(quest.facilityId);
				if (facActor !== undefined) {
					const fac = facActor.get(FacilityComponent);
					const injection = config.quests.repair_fund_injection;
					fac.state = { ...fac.state, status: 'idle', fund: fac.state.fund + injection };
					fac.markDirty();
				}
			}

			// Pay reward from treasury
			const worldEnt = deps.worldEntity();
			if (worldEnt.has(EconomyComponent)) {
				const economy = worldEnt.get(EconomyComponent);
				if (economy.state.treasury >= quest.reward) {
					const wallet = actor.get(WalletComponent);
					wallet.state = { ...wallet.state, gold: wallet.state.gold + quest.reward };
					wallet.markDirty();
					economy.state = {
						...economy.state,
						treasury: economy.state.treasury - quest.reward,
						ledger: [...economy.state.ledger, {
							tick: tickCount(),
							type: 'quest_reward' as const,
							from: 'treasury',
							to: actor.agentId,
							itemId: null,
							quantity: 0,
							gold: quest.reward,
						}],
					};
					economy.markDirty();

					eventBus.emit({
						type: 'GoldFlowed',
						tick: tickCount(),
						wallClock: Date.now(),
						source: 'BehaviorAgent',
						payload: { category: 'transfer' as const, subcategory: 'quest_reward', amount: quest.reward, fromEntity: 'treasury', toEntity: actor.agentId },
					});
				} else {
					eventBus.emit({
						type: 'QuestRewardSkipped',
						tick: tickCount(),
						wallClock: Date.now(),
						source: 'BehaviorAgent',
						payload: { agentId: actor.agentId, questId: quest.id, reason: 'treasury_empty' },
					});
				}
			}

			// Create positive memory
			const mem = actor.get(MemoryComponent);
			mem.state = {
				...mem.state,
				entries: [...mem.state.entries, {
					tick: tickCount(),
					type: 'quest_completed',
					description: `Completed a ${quest.type} quest at ${quest.facilityId}`,
					participants: [quest.facilityId],
					outcome: 'positive' as const,
					significance: 8,
					mood_impact: 15,
				}],
			};
			mem.markDirty();

			// Mark quest completed
			quest.state = 'completed';
			deps.worldEntity().get(QuestBoardComponent).markDirty();
			memory.activeQuest = null;

			eventBus.emit({
				type: 'QuestCompleted',
				tick: tickCount(),
				wallClock: Date.now(),
				source: 'BehaviorAgent',
				payload: { agentId: actor.agentId, questId: quest.id, questType: quest.type, facilityId: quest.facilityId, reward: quest.reward },
			});

			return SUCCEEDED;
		},

		AbandonQuest(): ActionResult {
			if (memory.activeQuest === null) return FAILED;
			const quest = memory.activeQuest;

			// Create negative memory
			const abandonMem = actor.get(MemoryComponent);
			abandonMem.state = {
				...abandonMem.state,
				entries: [...abandonMem.state.entries, {
					tick: tickCount(),
					type: 'quest_failed',
					description: `Failed a ${quest.type} quest at ${quest.facilityId}`,
					participants: [quest.facilityId],
					outcome: 'negative' as const,
					significance: 5,
					mood_impact: -10,
				}],
			};
			abandonMem.markDirty();

			// Reset quest to open
			quest.state = 'open';
			quest.claimedBy = null;
			quest.repairProgress = 0;
			deps.worldEntity().get(QuestBoardComponent).markDirty();
			memory.activeQuest = null;

			eventBus.emit({
				type: 'QuestAbandoned',
				tick: tickCount(),
				wallClock: Date.now(),
				source: 'BehaviorAgent',
				payload: { agentId: actor.agentId, questId: quest.id, reason: 'abandoned' },
			});

			return SUCCEEDED;
		},
	};
}
