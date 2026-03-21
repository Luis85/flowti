/**
 * Performance aggregator type definitions.
 *
 * @see TD-127 — Performance observability for growing state
 */

/** Summary of a single metric's measurements. */
export interface MetricSummary {
	count: number;
	p50: number;
	p95: number;
	max: number;
}

/** Per-service startup timing. */
export interface ServiceStartupEntry {
	service: string;
	durationMs: number;
}

/** One startup phase timing (onLayoutReady trackPhase). */
export interface StartupPhaseEntry {
	phase: string;
	durationMs: number;
}

/** One domain-load wall-clock segment (loadDomainServices trackSeg). */
export interface StartupSegmentEntry {
	segment: string;
	durationMs: number;
}

/** Startup performance summary. */
export interface StartupSummary {
	totalMs: number;
	serviceCount: number;
	perService: ServiceStartupEntry[];
	timing: MetricSummary;
	/** Last completed startup run (from perf.startup.phase / perf.startup.segment). */
	lastRunPhases: StartupPhaseEntry[];
	lastRunSegments: StartupSegmentEntry[];
}

/** Per-key storage performance. */
export interface StorageKeySummary {
	key: string;
	loadCount: number;
	saveCount: number;
	avgLoadMs: number;
	avgSaveMs: number;
	lastSizeBytes: number;
}

/** Storage performance summary. */
export interface StorageSummary {
	keys: StorageKeySummary[];
}

/** Query execution performance summary. */
export interface QuerySummary {
	totalExecutions: number;
	timing: MetricSummary;
	avgSourceRows: number;
	avgResultRows: number;
}

/** Per-event-type dispatch timing. */
export interface EventTypeDispatchEntry {
	eventType: string;
	maxMs: number;
	count: number;
}

/** Event dispatch performance summary. */
export interface EventDispatchSummary {
	totalDispatches: number;
	timing: MetricSummary;
	slowest: EventTypeDispatchEntry[];
}

/** Per-step installer timing. */
export interface InstallerStepEntry {
	stepId: string;
	durationMs: number;
}

/** Installer performance summary. */
export interface InstallerSummary {
	totalMs: number;
	stepCount: number;
	perStep: InstallerStepEntry[];
}

/** Import pipeline performance summary. */
export interface ImportSummary {
	totalImports: number;
	timing: MetricSummary;
	avgRows: number;
}

/** Per-hub view timing. */
export interface ViewHubEntry {
	hubId: string;
	timing: MetricSummary;
}

/** View lifecycle performance summary. */
export interface ViewSummary {
	perHub: ViewHubEntry[];
}

/** One aggregated agent-world perf window (matches `perf.agentWorld.sample` payload). */
export interface AgentWorldSampleSnapshot {
	readonly windowFrames: number;
	readonly windowDurationMs: number;
	readonly simulation: { avgMs: number; maxMs: number };
	readonly postframe: { avgMs: number; maxMs: number };
	readonly delta: { avgMs: number; maxMs: number };
	readonly phases: Record<string, { avgMs: number; maxMs: number }>;
	readonly agentCount: number;
	readonly sceneName: string;
}

/** Rolling agent-world (Excalibur simulation) performance view. */
export interface AgentWorldPerfSummary {
	readonly samples: readonly AgentWorldSampleSnapshot[];
	readonly slowFrameCount: number;
	readonly simulationMaxAcrossSamples: MetricSummary;
}

/**
 * Narrow interface so game UI (e.g. Ask Bob World tab) can read aggregator state
 * without importing the PerfAggregator class from game code paths.
 */
export interface IAgentWorldPerfDashboard {
	getAgentWorldSummary(): AgentWorldPerfSummary;
}

/** Persisted performance state (cross-session trend data). */
export interface PerfState {
	startupHistory: number[];
}
