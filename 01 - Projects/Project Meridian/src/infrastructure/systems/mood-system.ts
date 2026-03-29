import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { calculateMood, type MoodFactors } from '../../domain/systems/mood.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { NeedsComponent } from '../components/needs-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { MemoryComponent } from '../components/memory-component.js';

/** 3 needs × 100 max each = 300 */
const NEEDS_SUM_MAX = 300;

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

				const factors: MoodFactors = {
					needsSatisfaction: (needs.state.hunger + needs.state.energy + needs.state.social) / NEEDS_SUM_MAX,
					positiveMemories: Math.min(positiveCount / memorySaturationCount, 1.0),
					negativeMemories: Math.min(negativeCount / memorySaturationCount, 1.0),
					goalProgress: 0,
					walletHealth: 0,
					equipmentCondition: 0,
					relationshipQuality: 0,
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
