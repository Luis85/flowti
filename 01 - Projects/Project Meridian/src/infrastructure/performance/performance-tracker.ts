import type { Logger } from '../../domain/core/logger.js';

export interface SystemTiming {
	name: string;
	durationMs: number;
}

export interface TickPerformance {
	tick: number;
	totalMs: number;
	systems: SystemTiming[];
}

export interface PerformanceTracker {
	/** Whether tracking is enabled */
	readonly enabled: boolean;
	/** Enable/disable tracking */
	setEnabled(enabled: boolean): void;
	/** Start timing a system */
	startSystem(name: string): void;
	/** End timing the current system */
	endSystem(): void;
	/** Complete the tick and record the result */
	completeTick(tick: number): TickPerformance | null;
	/** Get the last N tick performances */
	history(limit?: number): TickPerformance[];
	/** Get average system times over last N ticks */
	averages(ticks?: number): Map<string, number>;
}

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
			const totalMs = Math.round((performance.now() - tickStart) * 100) / 100;
			const result: TickPerformance = {
				tick,
				totalMs,
				systems: [...currentSystems],
			};
			tickHistory.push(result);
			if (tickHistory.length > HISTORY_MAX) tickHistory.shift();
			currentSystems = [];
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
