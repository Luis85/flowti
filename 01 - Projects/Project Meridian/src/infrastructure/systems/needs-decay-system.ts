import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applyNeedsDecay, type NeedsModifiers } from '../../domain/systems/needs-decay.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { NeedsComponent } from '../components/needs-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { SocialComponent } from '../components/social-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { NEED_CRITICAL_THRESHOLDS } from '../../domain/schemas/ranges.js';

function getActivityModifiers(
	btAction: string | null,
	activityCosts: Record<string, { hunger: number; thirst: number; energy: number }>,
): NeedsModifiers {
	const costs = btAction !== null ? activityCosts[btAction] : undefined;
	if (costs === undefined) return {};
	return {
		hungerDecayScale: costs.hunger,
		thirstDecayScale: costs.thirst,
		energyDecayScale: costs.energy,
	};
}

/**
 * Deterministic per-agent, per-tick jitter in the range [0.95, 1.05].
 * Same (agentId, tick) always returns the same value so replay is stable.
 * Used to prevent identical agents from converging to identical need states
 * and causing lockstep behavior (see recording 2026-04-11-1339 — 16+
 * "all 3 agents resting simultaneously" anomalies).
 */
function computeJitter(agentId: string, tick: number): number {
	// FNV-1a-ish string hash to a 32-bit int, then mix with tick
	let h = 2166136261 >>> 0;
	for (let i = 0; i < agentId.length; i++) {
		h ^= agentId.charCodeAt(i);
		h = (h * 16777619) >>> 0;
	}
	h = ((h ^ (tick * 19349663)) * 2654435761) >>> 0;
	// Map to ±5% — (h % 11) gives 0..10, minus 5 gives -5..5
	return 1 + ((h % 11) - 5) / 100;
}

export function createNeedsDecaySystem(
	entities: () => AgentActor[],
): GameSystem {
	return {
		name: 'NeedsDecaySystem',
		priority: SystemPriority.NEEDS_DECAY,

		execute(deps: GameCoreDeps): void {
			for (const entity of entities()) {
				const needs = entity.get(NeedsComponent);
				const attrs = entity.get(AttributesComponent);
				const social = entity.get(SocialComponent);
				const ba = entity.behaviorAgent;

				// Merge trait modifiers with activity modifiers (activity takes precedence)
				const traitMods = ba.traitModifiers?.['NeedsDecaySystem'] as NeedsModifiers | undefined;
				const activityMods = getActivityModifiers(ba.btAction, deps.config.needs.activity_costs);
				const mergedMods: NeedsModifiers = {
					hungerDecayScale: activityMods.hungerDecayScale ?? traitMods?.hungerDecayScale,
					thirstDecayScale: activityMods.thirstDecayScale ?? traitMods?.thirstDecayScale,
					energyDecayScale: activityMods.energyDecayScale ?? traitMods?.energyDecayScale,
				};

				// Equipment decay reduction
				const inv = entity.get(InventoryComponent);
				const hasEquipment = inv.state.items.some(i => i.item_id === 'equipment' && (i.charges ?? 0) > 0);
				if (hasEquipment) {
					const reduction = 1 - deps.config.economy.equipment_decay_reduction;
					mergedMods.hungerDecayScale = (mergedMods.hungerDecayScale ?? 1) * reduction;
					mergedMods.thirstDecayScale = (mergedMods.thirstDecayScale ?? 1) * reduction;
					mergedMods.energyDecayScale = (mergedMods.energyDecayScale ?? 1) * reduction;
				}

				// Sleep debt increases energy drain
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- behaviorAgent uses !: but may be unset in tests
				const sleepDebtMult = 1 + ((entity.behaviorAgent?.sleepDebt ?? 0) / 100);
				mergedMods.energyDecayScale = (mergedMods.energyDecayScale ?? 1) * sleepDebtMult;

				const result = applyNeedsDecay(
					{
						state: needs.state,
						hungerAttribute: attrs.state.HT,
						energyAttribute: attrs.state.HT,
						socialAttribute: social.state.charisma,
						thirstAttribute: attrs.state.HT,
						modifiers: mergedMods,
						jitterFactor: computeJitter(entity.agentId, deps.tickCount),
					},
					deps.config.needs,
				);

				const oldHunger = needs.state.hunger;
				const oldEnergy = needs.state.energy;
				const oldThirst = needs.state.thirst;

				needs.state = result.state;
				needs.markDirty();

				// Threshold crossing detection
				const needNames = ['hunger', 'energy', 'thirst'] as const;
				const oldValues = { hunger: oldHunger, energy: oldEnergy, thirst: oldThirst };
				for (const need of needNames) {
					const value = needs.state[need];
					const old = oldValues[need];

					// Check personal threshold
					const personalThreshold = ba.personalThresholds[need];
					if (old >= personalThreshold && value < personalThreshold) {
						deps.eventBus.emit({
							type: 'NeedThresholdCrossed',
							tick: deps.tickCount,
							wallClock: Date.now(),
							source: 'NeedsDecaySystem',
							payload: { agentId: entity.agentId, need, value, threshold: personalThreshold, thresholdType: 'personal' as const, direction: 'below' as const },
						});
					} else if (old < personalThreshold && value >= personalThreshold) {
						deps.eventBus.emit({
							type: 'NeedThresholdCrossed',
							tick: deps.tickCount,
							wallClock: Date.now(),
							source: 'NeedsDecaySystem',
							payload: { agentId: entity.agentId, need, value, threshold: personalThreshold, thresholdType: 'personal' as const, direction: 'above' as const },
						});
					}

					// Check critical threshold
					const criticalThreshold = NEED_CRITICAL_THRESHOLDS[need];
					if (old >= criticalThreshold && value < criticalThreshold) {
						deps.eventBus.emit({
							type: 'NeedThresholdCrossed',
							tick: deps.tickCount,
							wallClock: Date.now(),
							source: 'NeedsDecaySystem',
							payload: { agentId: entity.agentId, need, value, threshold: criticalThreshold, thresholdType: 'critical' as const, direction: 'below' as const },
						});
					} else if (old < criticalThreshold && value >= criticalThreshold) {
						deps.eventBus.emit({
							type: 'NeedThresholdCrossed',
							tick: deps.tickCount,
							wallClock: Date.now(),
							source: 'NeedsDecaySystem',
							payload: { agentId: entity.agentId, need, value, threshold: criticalThreshold, thresholdType: 'critical' as const, direction: 'above' as const },
						});
					}
				}

				for (const event of result.events) {
					deps.eventBus.emit({
						type: event.type,
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'NeedsDecaySystem',
						payload: { agentId: entity.agentId, ...event },
					});
				}
			}
		},
	};
}
