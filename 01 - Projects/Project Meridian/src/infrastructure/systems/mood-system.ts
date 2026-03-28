import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { calculateMood, type MoodFactors } from '../../domain/systems/mood.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { NeedsComponent } from '../components/needs-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { MemoryComponent } from '../components/memory-component.js';

const MEMORY_WINDOW_TICKS = 50;
const MEMORY_SATURATION_COUNT = 10;

export function createMoodSystem(
	entities: () => AgentActor[],
): GameSystem {
	return {
		name: 'MoodSystem',
		priority: SystemPriority.MOOD,

		execute(deps: GameCoreDeps): void {
			const tickWindow = deps.tickCount - MEMORY_WINDOW_TICKS;

			for (const entity of entities()) {
				const needs = entity.get(NeedsComponent);
				const mood = entity.get(MoodComponent);
				const memory = entity.get(MemoryComponent);

				const recentEntries = memory.state.entries.filter(e => e.tick >= tickWindow);
				const positiveCount = recentEntries.filter(e => e.outcome === 'positive').length;
				const negativeCount = recentEntries.filter(e => e.outcome === 'negative').length;

				const factors: MoodFactors = {
					needsSatisfaction: (needs.state.hunger + needs.state.energy + needs.state.social) / 300,
					positiveMemories: Math.min(positiveCount / MEMORY_SATURATION_COUNT, 1.0),
					negativeMemories: Math.min(negativeCount / MEMORY_SATURATION_COUNT, 1.0),
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
