import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { Actor } from 'excalibur';
import { TimeComponent } from '../components/time-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import type { AgentActor } from '../entity/agent-actor.js';

export function createStipendSystem(
	worldEntity: () => Actor,
	getAgents: () => AgentActor[],
): GameSystem {
	return {
		name: 'StipendSystem',
		priority: SystemPriority.STIPEND,
		execute(deps: GameCoreDeps): void {
			const entity = worldEntity();
			const time = entity.get(TimeComponent);
			if (!time.state.dayBoundaryThisTick) return;
			if (!entity.has(EconomyComponent)) return;

			const economy = entity.get(EconomyComponent);
			const agentList = getAgents();

			for (const agent of agentList) {
				const job = agent.job;
				let stipendAmount = 0;
				if (job === 'guard') {
					stipendAmount = deps.config.economy.guard_stipend;
				} else if (job === 'merchant') {
					stipendAmount = deps.config.economy.merchant_stipend;
				}
				if (stipendAmount === 0) continue;

				if (economy.state.treasury < stipendAmount) {
					deps.eventBus.emit({
						type: 'StipendSkipped',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'StipendSystem',
						payload: { agentId: agent.agentId, job, amount: stipendAmount, treasuryRemaining: economy.state.treasury },
					});
					continue;
				}

				const wallet = agent.get(WalletComponent);
				wallet.state = { ...wallet.state, gold: wallet.state.gold + stipendAmount };
				wallet.markDirty();

				economy.state = {
					...economy.state,
					treasury: economy.state.treasury - stipendAmount,
					ledger: [
						...economy.state.ledger,
						{
							tick: deps.tickCount,
							type: 'stipend' as const,
							from: 'treasury',
							to: agent.agentId,
							itemId: null,
							quantity: 0,
							gold: stipendAmount,
						},
					],
				};
				economy.markDirty();

				deps.eventBus.emit({
					type: 'StipendPaid',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'StipendSystem',
					payload: { agentId: agent.agentId, job, amount: stipendAmount, treasuryRemaining: economy.state.treasury },
				});

				deps.eventBus.emit({
					type: 'GoldFlowed',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'StipendSystem',
					payload: {
						category: 'transfer' as const,
						subcategory: 'stipend',
						amount: stipendAmount,
						fromEntity: 'treasury',
						toEntity: agent.agentId,
					},
				});
			}
		},
	};
}
