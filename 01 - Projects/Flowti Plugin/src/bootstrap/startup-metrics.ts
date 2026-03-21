/**
 * Startup performance metric emission — extracted from main.ts.
 *
 * Collects phase and service timing data and emits structured events
 * for PerfAggregator, tracing, and the startup-profile logger.
 */

import type { IEventBus } from "../infrastructure/events/types.js";
import type { ILogger } from "../infrastructure/logger/types.js";

export interface StartupTimingData {
	startupStart: number;
	startupPhases: Array<{ name: string; durationMs: number }>;
	serviceCount: number;
	serviceTimings: Array<{ name: string; durationMs: number }>;
	domainSegments: Array<{ label: string; durationMs: number }>;
}

/**
 * Emits all startup performance metrics and logs the startup profile.
 */
export function emitStartupMetrics(
	eventBus: IEventBus,
	logger: ILogger,
	data: StartupTimingData,
): void {
	const totalDurationMs = performance.now() - data.startupStart;
	const topServices = [...data.serviceTimings].sort((a, b) => b.durationMs - a.durationMs).slice(0, 5);
	const topServiceSummary = topServices.length > 0
		? topServices.map((s) => `${s.name}=${Math.round(s.durationMs)}ms`).join(", ")
		: "none";
	const dominantPhase = [...data.startupPhases].sort((a, b) => b.durationMs - a.durationMs)[0];
	const dominantPhasePct = dominantPhase
		? Math.round((dominantPhase.durationMs / totalDurationMs) * 100)
		: 0;
	const loadSeverity = totalDurationMs > 5000 ? "critical"
		: totalDurationMs > 2500 ? "high"
			: totalDurationMs > 1500 ? "medium" : "low";
	const phaseSummary = data.startupPhases
		.map((p) => `${p.name}=${Math.round(p.durationMs)}ms`).join(", ");
	const segSorted = [...data.domainSegments].sort((a, b) => b.durationMs - a.durationMs);
	const segSum = segSorted.reduce((s, x) => s + x.durationMs, 0);

	void eventBus.emit("perf.startup.total", {
		durationMs: totalDurationMs,
		serviceCount: data.serviceCount,
	});
	void eventBus.emit("perf.startup.breakdown", {
		totalMs: totalDurationMs,
		severity: loadSeverity,
		serviceCount: data.serviceCount,
		phases: data.startupPhases.map((p) => ({ phase: p.name, durationMs: p.durationMs })),
		segments: data.domainSegments.map((s) => ({ segment: s.label, durationMs: s.durationMs })),
		segmentsWallClockSumMs: segSum,
		topServices: topServices.map((s) => ({ service: s.name, durationMs: s.durationMs })),
		dominantPhase: dominantPhase
			? { phase: dominantPhase.name, durationMs: dominantPhase.durationMs }
			: null,
	});

	const segTop = segSorted.slice(0, 8)
		.map((x) => `${x.label}=${Math.round(x.durationMs)}ms`).join(", ");
	logger.info(
		`[StartupProfile] total=${Math.round(totalDurationMs)}ms severity=${loadSeverity} services=${data.serviceCount}${phaseSummary ? ` | phases: ${phaseSummary}` : ""}`,
	);
	logger.info(
		`[StartupProfile] bottlenecks: dominant-phase: ${dominantPhase ? `${dominantPhase.name}=${Math.round(dominantPhase.durationMs)}ms (${dominantPhasePct}%)` : "n/a"} | longest-individual-service-loads (overlap when parallel — do not sum): ${topServiceSummary}`,
	);
	logger.info(
		`[StartupProfile] domain.load.segments (wall-clock, sum=${Math.round(segSum)}ms): ${segTop || "none"}`,
	);
}
