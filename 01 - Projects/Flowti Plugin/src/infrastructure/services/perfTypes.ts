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

/** Plugin EventBus stats aligned with one agent-world sample window. */
export interface AgentWorldEventBusWindow {
	readonly typedDispatchCount: number;
	readonly handlerInvocationCount: number;
	readonly avgDispatchWallMs: number;
	readonly maxDispatchWallMs: number;
	readonly dispatchesPerSec: number;
	readonly topEventTypes: readonly { eventType: string; count: number; maxMs: number }[];
}

/** Per-agent canvas slice stats (matches `perf.agentWorld.sample.perAgentCanvas`). */
export interface AgentCanvasPerfEntry {
	readonly agentName: string;
	readonly slices: Record<string, { avgMs: number; maxMs: number }>;
}

/** One aggregated agent-world perf window (matches `perf.agentWorld.sample` payload). */
export interface AgentWorldSampleSnapshot {
	readonly windowFrames: number;
	readonly windowDurationMs: number;
	readonly simulation: { avgMs: number; maxMs: number };
	readonly postframe: { avgMs: number; maxMs: number };
	readonly delta: { avgMs: number; maxMs: number };
	readonly phases: Record<string, { avgMs: number; maxMs: number }>;
	/** Named systems (BrainSystem, talk, store postframe, …); avg/max ms per simulation frame over the window. */
	readonly gameSystems: Record<string, { avgMs: number; maxMs: number }>;
	readonly agentCount: number;
	readonly sceneName: string;
	readonly eventBus: AgentWorldEventBusWindow;
	readonly perAgentCanvas: { readonly agents: readonly AgentCanvasPerfEntry[] };
}

/**
 * Rolled up from buffered `perAgentCanvas` samples (last N windows in PerfAggregator).
 * Complements the single-window view in each `AgentWorldSampleSnapshot`.
 */
export interface AgentCanvasAggregateView {
	readonly windowCount: number;
	/**
	 * Per slice: mean across windows of Σ(agent slice.avgMs) — total roster cost in that
	 * slice category per simulation frame (not equal to full sim time; other phases untracked).
	 */
	readonly sliceSumAvgAcrossWindows: Readonly<Record<string, number>>;
	/** Per slice: max Σ(agent slice.avgMs) in any single buffered window. */
	readonly sliceSumMaxAcrossWindows: Readonly<Record<string, number>>;
	/** Agents ranked by mean Σ(slices.avgMs) over windows where they appear. */
	readonly topAgentsByMeanTotal: readonly {
		readonly agentName: string;
		readonly meanTotalAvgMs: number;
		readonly windowsSeen: number;
	}[];
}

/** Rolling agent-world (Excalibur simulation) performance view. */
export interface AgentWorldPerfSummary {
	readonly samples: readonly AgentWorldSampleSnapshot[];
	readonly slowFrameCount: number;
	readonly simulationMaxAcrossSamples: MetricSummary;
	/** Null when no buffered sample had per-agent canvas data. */
	readonly agentCanvasAggregate: AgentCanvasAggregateView | null;
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
