import type { Logger } from '../../domain/core/logger.js';
import type { PerformanceTracker, TickPerformance, SystemTiming } from '../../domain/core/performance.js';
export type { PerformanceTracker, TickPerformance, SystemTiming };

const HISTORY_MAX = 100;

export function createPerformanceTracker(logger?: Logger): PerformanceTracker {
	let enabled = false;
	const tickHistory: TickPerformance[] = [];
	let currentSystems: SystemTiming[] = [];
	let currentSystemName: string | null = null;
	let currentSystemStart = 0;
	let tickStart = 0;

	return {
		get enabled() { return enabled; },

		setEnabled(value: boolean): void {
			enabled = value;
			if (value) {
				logger?.debug('Performance', 'Performance tracking enabled');
			}
		},

		startSystem(name: string): void {
			if (!enabled) return;
			if (currentSystemName === null) {
				tickStart = performance.now();
			}
			currentSystemName = name;
			currentSystemStart = performance.now();
		},

		endSystem(): void {
			if (!enabled || currentSystemName === null) return;
			const duration = performance.now() - currentSystemStart;
			currentSystems.push({ name: currentSystemName, durationMs: Math.round(duration * 100) / 100 });
			currentSystemName = null;
		},

		completeTick(tick: number): TickPerformance | null {
			if (!enabled) return null;
			// Guard: if no systems ran this tick, tickStart was never set — report 0ms
			const totalMs = currentSystems.length === 0
				? 0
				: Math.round((performance.now() - tickStart) * 100) / 100;
			const result: TickPerformance = {
				tick,
				totalMs,
				systems: [...currentSystems],
			};
			tickHistory.push(result);
			if (tickHistory.length > HISTORY_MAX) tickHistory.shift();
			currentSystems = [];
			currentSystemName = null;
			tickStart = 0;
			return result;
		},

		history(limit = HISTORY_MAX): TickPerformance[] {
			return tickHistory.slice(-limit);
		},

		averages(ticks = 20): Map<string, number> {
			const recent = tickHistory.slice(-ticks);
			const totals = new Map<string, { sum: number; count: number }>();

			for (const tick of recent) {
				for (const sys of tick.systems) {
					const existing = totals.get(sys.name);
					if (existing !== undefined) {
						existing.sum += sys.durationMs;
						existing.count += 1;
					} else {
						totals.set(sys.name, { sum: sys.durationMs, count: 1 });
					}
				}
			}

			const result = new Map<string, number>();
			for (const [name, { sum, count }] of totals) {
				result.set(name, Math.round((sum / count) * 100) / 100);
			}
			return result;
		},
	};
}
