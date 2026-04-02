import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import {
	createMonetaryLedger,
	recordFlow,
	calculateMonetarySnapshot,
	evaluateSafetyNets,
	type MonetaryLedger,
} from '../../domain/systems/monetary-policy.js';
import { WalletComponent } from '../components/wallet-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { Actor } from 'excalibur';

export function createMonetaryPolicySystem(
	agents: () => AgentActor[],
	worldEntity: () => Actor,
): GameSystem {
	const ledger: MonetaryLedger = createMonetaryLedger(0);
	let consecutiveStagnantTicks = 0;
	let lastCaravanTick = -Infinity;

	return {
		name: 'MonetaryPolicySystem',
		priority: SystemPriority.MONETARY_POLICY,

		execute(deps: GameCoreDeps): void {
			const config = deps.config.economy.monetary_policy;
			ledger.windowSize = config.velocity_window_ticks;

			const goldEvents = deps.eventBus.history({ type: 'GoldFlowed' })
				.filter(e => e.tick === deps.tickCount);
			for (const e of goldEvents) {
				const cat = e.payload.category;
				if (cat !== 'faucet' && cat !== 'sink' && cat !== 'transfer') continue;
				const amount = typeof e.payload.amount === 'number' ? e.payload.amount : 0;
				recordFlow(ledger, {
					category: cat,
					subcategory: typeof e.payload.subcategory === 'string' ? e.payload.subcategory : '',
					amount,
					tick: e.tick,
					fromEntity: typeof e.payload.fromEntity === 'string' ? e.payload.fromEntity : null,
					toEntity: typeof e.payload.toEntity === 'string' ? e.payload.toEntity : null,
				});
			}

			const agentList = agents();
			const balances = agentList.map(a => a.get(WalletComponent).state.gold);
			const world = worldEntity();
			const economy = world.get(EconomyComponent);

			const snapshot = calculateMonetarySnapshot(
				ledger,
				deps.tickCount,
				balances,
				economy.state.treasury,
			);

			economy.state = { ...economy.state, monetarySnapshot: snapshot };
			economy.markDirty();

			if (snapshot.velocity < config.velocity_stagnant) {
				consecutiveStagnantTicks++;
			} else {
				consecutiveStagnantTicks = 0;
			}

			const interventions = evaluateSafetyNets(
				snapshot.velocity,
				consecutiveStagnantTicks,
				{
					stagnant: config.velocity_stagnant,
					critical: config.velocity_critical,
					stimulusTriggerTicks: config.stimulus_trigger_ticks,
				},
			);

			for (const intervention of interventions) {
				if (intervention === 'recovery_event') {
					if (deps.tickCount - lastCaravanTick < config.caravan_cooldown_ticks) continue;
					lastCaravanTick = deps.tickCount;
					deps.eventBus.emit({
						type: 'EmergencyCaravanRequested',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'MonetaryPolicySystem',
						payload: { velocity: snapshot.velocity },
					});
				}

				if (intervention === 'stimulus') {
					deps.eventBus.emit({
						type: 'EconomicStimulusActivated',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'MonetaryPolicySystem',
						payload: { velocity: snapshot.velocity, duration: config.stimulus_duration_ticks },
					});
				}
			}

			deps.logger.debug('MonetaryPolicySystem', 'tick snapshot', {
				velocity: snapshot.velocity.toFixed(3),
				moneySupply: snapshot.moneySupply,
				netFlow: snapshot.netFlow,
				stagnantTicks: consecutiveStagnantTicks,
				interventions,
			});
		},
	};
}
