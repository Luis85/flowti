import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { calculateMood, type MoodFactors } from '../../domain/systems/mood.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { NeedsComponent } from '../components/needs-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { MemoryComponent } from '../components/memory-component.js';
import { WalletComponent } from '../components/wallet-component.js';
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

				const factors: MoodFactors = {
					needsSatisfaction: (needs.state.hunger + needs.state.energy + needs.state.social + needs.state.thirst) / NEEDS_SUM_MAX,
					positiveMemories: Math.min(positiveCount / memorySaturationCount, 1.0),
					negativeMemories: Math.min(negativeCount / memorySaturationCount, 1.0),
					goalProgress: 0,
					walletHealth,
					equipmentCondition: 0,
					relationshipQuality,
				};

				const previousBucket = mood.state.bucket;
				const result = calculateMood(factors, previousBucket, deps.config.mood, 0);

				mood.state = { value: result.value, bucket: result.bucket };
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
