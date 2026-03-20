/**
 * Performance observability event types.
 *
 * All perf.* events are tagged ["system"] and skipped by wildcard
 * listeners to avoid noise and infinite recursion.
 */

export interface PerformanceEventMap {
	/** Emitted after TypedStorage completes a load operation. */
	"perf.storage.loaded": {
		key: string;
		durationMs: number;
		sizeBytes: number;
	};

	/** Emitted after TypedStorage completes a save operation. */
	"perf.storage.saved": {
		key: string;
		durationMs: number;
		sizeBytes: number;
	};

	/** Emitted after a domain service completes its startup load. */
	"perf.startup.service": {
		service: string;
		durationMs: number;
	};

	/** Emitted after all services have completed startup. */
	"perf.startup.total": {
		durationMs: number;
		serviceCount: number;
	};

	/** Emitted for each high-level startup phase (e.g. domain.services.load, hub.registry.setup). */
	"perf.startup.phase": {
		phase: string;
		durationMs: number;
	};

	/** Emitted for each wall-clock segment inside {@link loadDomainServices} (non-overlapping). */
	"perf.startup.segment": {
		segment: string;
		durationMs: number;
	};

	/** Single structured snapshot after startup profiling (for dashboards, traces, tests). */
	"perf.startup.breakdown": {
		totalMs: number;
		severity: "low" | "medium" | "high" | "critical";
		serviceCount: number;
		phases: { phase: string; durationMs: number }[];
		segments: { segment: string; durationMs: number }[];
		segmentsWallClockSumMs: number;
		topServices: { service: string; durationMs: number }[];
		dominantPhase: { phase: string; durationMs: number } | null;
	};

	/** Emitted after an analytics query completes execution. */
	"perf.query.executed": {
		queryId: string;
		durationMs: number;
		sourceRows: number;
		resultRows: number;
	};

	/** Emitted when a performance metric exceeds a configured threshold. */
	"perf.alert": {
		metric: string;
		value: number;
		threshold: number;
	};

	/** Emitted after EventBus dispatches an event to all handlers. */
	"perf.event.dispatched": {
		eventType: string;
		handlerCount: number;
		durationMs: number;
	};

	/** Emitted after the installer pipeline completes all steps. */
	"perf.installer.total": {
		durationMs: number;
		stepCount: number;
	};

	/** Emitted after each installer step completes. */
	"perf.installer.step": {
		stepId: string;
		stepName: string;
		durationMs: number;
	};

	/** Emitted after CSV content is parsed by CsvParser. */
	"perf.csv.parsed": {
		filePath: string;
		durationMs: number;
		rowCount: number;
		columnCount: number;
	};

	/** Emitted after a full import pipeline completes. */
	"perf.import.completed": {
		durationMs: number;
		totalRows: number;
		created: number;
		updated: number;
		failed: number;
	};

	/** Emitted after a Hub view finishes opening. */
	"perf.view.opened": {
		hubId: string;
		durationMs: number;
	};
}
