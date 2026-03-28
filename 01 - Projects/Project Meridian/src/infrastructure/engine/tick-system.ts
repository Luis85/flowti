import { System, SystemType } from 'excalibur';
import type { TickScheduler } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';

export class MeridianTickSystem extends System {
	readonly systemType = SystemType.Update;
	static override priority = 0;

	private accumulator = 0;
	private readonly maxCatchUp = 3;

	constructor(
		private tickRunner: TickScheduler,
		private deps: GameCoreDeps,
	) { super(); }

	update(elapsed: number): void {
		this.accumulator += elapsed;
		const interval = this.deps.config.tick_interval_ms;
		let steps = 0;
		while (this.accumulator >= interval && steps < this.maxCatchUp) {
			this.tickRunner.tick(this.deps);
			this.accumulator -= interval;
			steps++;
		}
		if (this.accumulator > interval) {
			this.accumulator = interval;
		}
	}
}
