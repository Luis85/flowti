/**
 * timing-factory.ts — Timing tracker factory extracted from main.ts.
 */

import type { IEventBus } from "../infrastructure/events/types.js";
import type { ILogger } from "../infrastructure/logger/types.js";
import type { TimingTracker } from "./domain-loader.js";

export interface TimingState {
	startupServiceCount: number;
	startupServiceTimings: Array<{ name: string; durationMs: number }>;
	startupDomainSegments: Array<{ label: string; durationMs: number }>;
}

export function createTimingTracker(
	eventBus: IEventBus,
	logger: ILogger,
	state: TimingState,
): TimingTracker {
	const tracker: TimingTracker = {
		timedServiceLoad: async (name: string, loadFn: () => Promise<void>): Promise<void> => {
			const start = performance.now();
			await loadFn();
			state.startupServiceCount++;
			const durationMs = performance.now() - start;
			state.startupServiceTimings.push({ name, durationMs });
			void eventBus.emit("perf.startup.service", { service: name, durationMs });
			logger.debug(`[StartupProfile] service ${name}=${Math.round(durationMs)}ms`);
		},
		timedServiceLoadsParallel: async (entries: readonly { name: string; fn: () => Promise<void> }[]): Promise<void> => {
			await Promise.all(entries.map(({ name, fn }) => tracker.timedServiceLoad(name, fn)));
		},
		trackSeg: async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
			const t0 = performance.now();
			try { return await fn(); }
			finally {
				const durationMs = performance.now() - t0;
				state.startupDomainSegments.push({ label, durationMs });
				void eventBus.emit("perf.startup.segment", { segment: label, durationMs });
			}
		},
	};
	return tracker;
}
