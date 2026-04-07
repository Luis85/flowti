import type { ConditionContext } from './bt-action-helpers.js';
import type { ConditionMethods } from './bt-conditions.js';
import { InventoryComponent } from '../components/inventory-component.js';

type QuestKeys = 'HasQuest' | 'QuestAvailable' | 'QuestAtFacility' | 'QuestCargoReady';

export function createQuestConditions(ctx: ConditionContext): Pick<ConditionMethods, QuestKeys> {
	const { actor, deps, memory, resolveNearbyLocations } = ctx;

	return {
		HasQuest(): boolean {
			return memory.activeQuest !== null;
		},

		QuestAvailable(): boolean {
			const board = deps.getQuestBoard?.();
			if (board === undefined) return false;
			const openQuests = board.quests.filter(q => q.state === 'open');
			if (openQuests.length === 0) return false;

			let bestQuest: typeof openQuests[0] | null = null;
			let bestScore = -Infinity;

			for (const q of openQuests) {
				// For supply/restock, check agent can source the item from known locations
				if (q.type !== 'repair' && q.itemId !== null) {
					const knownSet = new Set(memory.knownLocations);
					if (!knownSet.has(q.facilityId)) continue; // can't reach quest facility
				}

				// Score by reward / distance (estimate from perception)
				const locList = resolveNearbyLocations();
				const facilityLoc = locList.find(l => l.id === q.facilityId);
				const distance = facilityLoc?.distance ?? 1000;
				const score = q.reward / Math.max(distance, 1);

				if (score > bestScore) {
					bestScore = score;
					bestQuest = q;
				}
			}

			memory.cachedAvailableQuest = bestQuest;
			return bestQuest !== null;
		},

		QuestAtFacility(): boolean {
			if (memory.activeQuest === null) return false;
			return memory.atLocation === memory.activeQuest.facilityId;
		},

		QuestCargoReady(): boolean {
			if (memory.activeQuest === null) return false;
			if (memory.activeQuest.type === 'repair') return true;
			if (memory.activeQuest.itemId === null) return false;
			const inv = actor.get(InventoryComponent).state.items;
			const item = inv.find(i => i.item_id === memory.activeQuest!.itemId);
			return item !== undefined && item.quantity >= memory.activeQuest.quantity;
		},
	};
}
