import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { Actor } from 'excalibur';
import { TimeComponent } from '../components/time-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import type { AgentActor } from '../entity/agent-actor.js';

export function createWelfareSystem(
	worldEntity: () => Actor,
	getAgents: () => AgentActor[],
): GameSystem {
	return {
		name: 'WelfareSystem',
		priority: SystemPriority.WELFARE,
		execute(deps: GameCoreDeps): void {
			const entity = worldEntity();
			const time = entity.get(TimeComponent);
			if (!time.state.dayBoundaryThisTick) return;
			if (!entity.has(EconomyComponent)) return;

			const economy = entity.get(EconomyComponent);
			const agentList = getAgents();

			// Sort by gold ascending so poorest agents get welfare first
			const welfareThreshold = deps.config.economy.welfare_threshold_gold;
			const welfareReward = deps.config.economy.welfare_reward_min;
			const maxGrants = deps.config.economy.max_active_welfare_quests;
			let grantCount = 0;

			const sorted = [...agentList].sort((a, b) =>
				a.get(WalletComponent).state.gold - b.get(WalletComponent).state.gold,
			);

			for (const agent of sorted) {
				if (grantCount >= maxGrants) break;
				const wallet = agent.get(WalletComponent);
				if (wallet.state.gold >= welfareThreshold) continue;
				if (economy.state.treasury < welfareReward) continue;

				wallet.state = { ...wallet.state, gold: wallet.state.gold + welfareReward };
				wallet.markDirty();

				economy.state = {
					...economy.state,
					treasury: economy.state.treasury - welfareReward,
					ledger: [
						...economy.state.ledger,
						{
							tick: deps.tickCount,
							type: 'welfare' as const,
							from: 'treasury',
							to: agent.agentId,
							itemId: null,
							quantity: 0,
							gold: welfareReward,
						},
					],
				};
				economy.markDirty();

				deps.eventBus.emit({
					type: 'WelfareGranted',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'WelfareSystem',
					payload: { agentId: agent.agentId, amount: welfareReward, treasuryRemaining: economy.state.treasury },
				});

				grantCount++;
			}
		},
	};
}
