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
}
