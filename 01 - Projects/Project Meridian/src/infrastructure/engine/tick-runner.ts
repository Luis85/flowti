import type { TickScheduler, GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { BatchableEventBus } from './batchable-event-bus.js';

export function createTickRunner(eventBus: BatchableEventBus): TickScheduler {
	const systems: GameSystem[] = [];
	let tickCount = 0;

	return {
		get tickCount() { return tickCount; },

		register(system: GameSystem): void {
			systems.push(system);
			systems.sort((a, b) => a.priority - b.priority);
		},

		tick(deps: GameCoreDeps): void {
			const currentTick = tickCount + 1;
			deps.tickCount = currentTick;

			for (const system of systems) {
				eventBus.beginBatch();
				deps.performanceTracker.startSystem(system.name);
				try {
					system.execute(deps);
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : String(err);
					deps.logger.error('TickRunner', `System "${system.name}" failed: ${message}`, err instanceof Error ? err : undefined);
					deps.eventBus.emit({
						type: 'SystemError',
						tick: currentTick,
						wallClock: Date.now(),
						source: 'TickRunner',
						payload: { systemName: system.name, message },
					});
				} finally {
					deps.performanceTracker.endSystem();
					eventBus.flushBatch();
				}
			}

			deps.performanceTracker.completeTick(currentTick);

			if (currentTick % deps.config.ticks_per_day === 0) {
				deps.logger.info('TickRunner', `Day ${Math.floor(currentTick / deps.config.ticks_per_day)} complete (tick ${String(currentTick)})`);
			}

			tickCount = currentTick;
		},
	};
}
