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

	/**
	 * Synchronous work in {@code onload} after `plugin.loading` until `plugin.loaded`
	 * (service registration, `initializeAll`, ribbons — not domain hydration).
	 */
	"perf.startup.shell": {
		durationMs: number;
	};

	/**
	 * Wall time from `plugin.loaded` until Obsidian fires `workspace.onLayoutReady`
	 * (plugin idle / Obsidian layout — no Flowti work in between).
	 */
	"perf.startup.layoutGap": {
		durationMs: number;
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

	/**
	 * Aggregated agent-world (Excalibur preframe simulation + store postframe) sample.
	 * Emitted every ~4s or 120 frames while the world is running.
	 */
	"perf.agentWorld.sample": {
		windowFrames: number;
		windowDurationMs: number;
		simulation: { avgMs: number; maxMs: number };
		postframe: { avgMs: number; maxMs: number };
		delta: { avgMs: number; maxMs: number };
		phases: Record<string, { avgMs: number; maxMs: number }>;
		/** Per named game system / store step (avg & max ms per frame in this window). */
		gameSystems: Record<string, { avgMs: number; maxMs: number }>;
		agentCount: number;
		sceneName: string;
		/**
		 * Plugin EventBus: aggregates `perf.event.dispatched` over the same wall window.
		 * Typed `emit()` only — `emitCustom` is not measured.
		 */
		eventBus: {
			typedDispatchCount: number;
			handlerInvocationCount: number;
			avgDispatchWallMs: number;
			maxDispatchWallMs: number;
			dispatchesPerSec: number;
			topEventTypes: { eventType: string; count: number; maxMs: number }[];
		};
		/**
		 * Per-agent canvas simulation slices (avg/max ms per frame over the window).
		 * Slices: needs, reactive, thresholds, objects, brain, talk.
		 */
		perAgentCanvas: {
			agents: {
				agentName: string;
				slices: Record<string, { avgMs: number; maxMs: number }>;
			}[];
		};
	};

	/** Single frame exceeded the slow simulation threshold (throttled). */
	"perf.agentWorld.slowFrame": {
		simulationMs: number;
		sceneName: string;
		agentCount: number;
		deltaMs: number;
	};

	/**
	 * Agent World view finished cold start (`startEngine`: Excalibur start, sprites, provider, agents).
	 * Not emitted until the user opens the Agent World leaf.
	 */
	"perf.agentWorld.engine.start": {
		durationMs: number;
	};
}
