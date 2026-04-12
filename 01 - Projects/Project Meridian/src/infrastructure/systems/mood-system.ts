import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { calculateMood, type MoodFactors } from '../../domain/systems/mood.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { NeedsComponent } from '../components/needs-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { MemoryComponent } from '../components/memory-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { RelationshipComponent } from '../components/relationship-component.js';
import { clamp } from '../../domain/core/math-utils.js';

/** 4 needs x 100 max each = 400 */
const NEEDS_SUM_MAX = 400;

export function createMoodSystem(
	entities: () => AgentActor[],
): GameSystem {
	return {
		name: 'MoodSystem',
		priority: SystemPriority.MOOD,

		execute(deps: GameCoreDeps): void {
			const memoryWindowTicks = deps.config.mood.memory_window_ticks;
			const memorySaturationCount = deps.config.mood.memory_saturation_count;
			const tickWindow = deps.tickCount - memoryWindowTicks;

			for (const entity of entities()) {
				const needs = entity.get(NeedsComponent);
				const mood = entity.get(MoodComponent);
				const memory = entity.get(MemoryComponent);

				const recentEntries = memory.state.entries.filter(e => e.tick >= tickWindow);
				const positiveCount = recentEntries.filter(e => e.outcome === 'positive').length;
				const negativeCount = recentEntries.filter(e => e.outcome === 'negative').length;

				const wallet = entity.get(WalletComponent);
				const walletHealth = clamp(wallet.state.gold / 100, 0, 1);

				const relComp = entity.get(RelationshipComponent);
				const relEntries = relComp.state.entries;
				const relationshipQuality = relEntries.length > 0
					? clamp((relEntries.reduce((sum, e) => sum + e.disposition, 0) / relEntries.length + 100) / 200, 0, 1)
					: 0.5;

				// goalProgress: aptitude fit for current job
				let goalProgress = 0.5;
				if (entity.job !== null) {
					const jobDef = deps.config.jobs.definitions[entity.job];
					if (jobDef !== undefined) {
						const attrValue = entity.get(AttributesComponent).getByName(jobDef.primary_attribute) || 10;
						goalProgress = clamp(attrValue / (deps.config.jobs.aptitude_baseline * 2), 0, 1);
					}
				}

				// equipmentCondition: average charge level of chargeable items
				const itemDefs = deps.config.items;
				let equipmentCondition = 0.5;
				const inv = entity.get(InventoryComponent);
				const chargeable = inv.state.items.filter(i => i.charges !== undefined);
				if (chargeable.length > 0) {
					let totalRatio = 0;
					for (const item of chargeable) {
						const maxCh = itemDefs[item.item_id]?.maxCharges ?? 5;
						totalRatio += (item.charges ?? 0) / maxCh;
					}
					equipmentCondition = clamp(totalRatio / chargeable.length, 0, 1);
				}

				const factors: MoodFactors = {
					needsSatisfaction: (needs.state.hunger + needs.state.energy + needs.state.social + needs.state.thirst) / NEEDS_SUM_MAX,
					positiveMemories: Math.min(positiveCount / memorySaturationCount, 1.0),
					negativeMemories: Math.min(negativeCount / memorySaturationCount, 1.0),
					goalProgress,
					walletHealth,
					equipmentCondition,
					relationshipQuality,
				};

				// Drain pending area modifiers queued by AreaEffectSystem. The sum
				// is clamped to `external_modifier_cap` and then passed as
				// `externalModifiers` to `calculateMood`. The queue is cleared each
				// tick so each area pulse contributes exactly once. Guarded by an
				// undefined check because some unit tests construct `AgentActor`
				// without wiring a `behaviorAgent` — in that case there are no
				// modifiers to drain.
				let areaDelta = 0;
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
				if (entity.behaviorAgent !== undefined) {
					const pending = entity.behaviorAgent.pendingAreaModifiers;
					for (const mod of pending) {
						// All AreaModifiers are currently `kind: 'mood'`; adding
						// new kinds later requires branching here.
						areaDelta += mod.delta_per_tick;
					}
					if (pending.length > 0) {
						entity.behaviorAgent.pendingAreaModifiers = [];
					}
				}
				const cap = deps.config.mood.external_modifier_cap;
				const clampedAreaDelta = clamp(areaDelta, -cap, cap);

				const previousBucket = mood.state.bucket;
				const result = calculateMood(factors, previousBucket, deps.config.mood, clampedAreaDelta);

				mood.state = {
					value: result.value,
					bucket: result.bucket,
					factors: {
						needs: factors.needsSatisfaction,
						positiveMemories: factors.positiveMemories,
						negativeMemories: factors.negativeMemories,
						goalProgress: factors.goalProgress,
						walletHealth: factors.walletHealth,
						equipmentCondition: factors.equipmentCondition,
						relationshipQuality: factors.relationshipQuality,
					},
				};
				mood.markDirty();

				if (result.changed) {
					deps.eventBus.emit({
						type: 'MoodChanged',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'MoodSystem',
						payload: {
							agentId: entity.agentId,
							oldBucket: previousBucket,
							newBucket: result.bucket,
							value: result.value,
						},
					});

					if (result.bucket === 'breakdown') {
						deps.eventBus.emit({
							type: 'MoodBreakdown',
							tick: deps.tickCount,
							wallClock: Date.now(),
							source: 'MoodSystem',
							payload: { agentId: entity.agentId, value: result.value },
						});
					}
				}
			}
		},
	};
}
