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

/** Startup performance summary. */
export interface StartupSummary {
	totalMs: number;
	serviceCount: number;
	perService: ServiceStartupEntry[];
	timing: MetricSummary;
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

/** Persisted performance state (cross-session trend data). */
export interface PerfState {
	startupHistory: number[];
}
