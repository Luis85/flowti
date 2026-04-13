import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { Actor } from 'excalibur';
import { QuestBoardComponent } from '../components/quest-board-component.js';
import type { AgentActor } from '../entity/agent-actor.js';

export function createQuestEvaluationSystem(
	worldEntity: () => Actor,
	getAgents: () => AgentActor[],
): GameSystem {
	return {
		name: 'QuestEvaluationSystem',
		priority: SystemPriority.QUEST_EVALUATION,

		execute(deps: GameCoreDeps): void {
			const entity = worldEntity();
			if (!entity.has(QuestBoardComponent)) return;

			const board = entity.get(QuestBoardComponent);
			const agents = getAgents();

			// 1. Expire old open/claimed quests + clean up completed quests
			const expiredQuests = board.state.quests.filter(
				q => (q.state === 'open' || q.state === 'claimed') && deps.tickCount - q.createdTick > q.expiryTicks,
			);

			const staleCompleted = board.state.quests.filter(
				q => q.state === 'completed',
			);

			if (expiredQuests.length > 0 || staleCompleted.length > 0) {
				// Clear activeQuest on agents holding expired quests
				const expiredIds = new Set(expiredQuests.map(q => q.id));
				for (const agent of agents) {
					if (agent.behaviorAgent.activeQuest !== null && expiredIds.has(agent.behaviorAgent.activeQuest.id)) {
						agent.behaviorAgent.activeQuest = null;
						agent.behaviorAgent.questCargo = null;
					}
				}

				for (const expired of expiredQuests) {
					deps.eventBus.emit({
						type: 'QuestExpired',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'QuestEvaluationSystem',
						payload: { questId: expired.id, facilityId: expired.facilityId },
					});
				}

				const removeIds = new Set([
					...expiredQuests.map(q => q.id),
					...staleCompleted.map(q => q.id),
				]);
				board.state = {
					...board.state,
					quests: board.state.quests.filter(q => !removeIds.has(q.id)),
				};
				board.markDirty();
			}

			// 2. Track repair progress

			for (const quest of board.state.quests) {
				if (quest.state !== 'claimed' || quest.type !== 'repair') continue;

				const claimingAgent = agents.find(a => a.agentId === quest.claimedBy);
				if (claimingAgent === undefined) continue;

				if (
					claimingAgent.behaviorAgent.btAction === 'repair' &&
					claimingAgent.behaviorAgent.atLocation === quest.facilityId
				) {
					quest.repairProgress++;
					board.markDirty();
				}
			}
		},
	};
}
