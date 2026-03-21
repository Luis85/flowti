/**
 * Performance metrics aggregator.
 *
 * Listens to `perf.*` events, maintains rolling windows of measurements,
 * and exposes summary queries for startup, storage, and query metrics.
 *
 * @see TD-127 — Performance observability for growing state
 */

import type { IEventBus } from "../events/types";
import type { ITypedStorage } from "../../utils/TypedStorage";
import type {
	StartupSummary,
	StartupPhaseEntry,
	StartupSegmentEntry,
	StorageSummary,
	StorageKeySummary,
	QuerySummary,
	EventDispatchSummary,
	EventTypeDispatchEntry,
	MetricSummary,
	ServiceStartupEntry,
	InstallerStepEntry,
	InstallerSummary,
	ImportSummary,
	ViewSummary,
	PerfState,
	AgentWorldSampleSnapshot,
	AgentWorldPerfSummary,
	AgentCanvasAggregateView,
	IAgentWorldPerfDashboard,
} from "./perfTypes";

const WINDOW_SIZE = 20;
const DEFAULT_STARTUP_THRESHOLD_MS = 5000;

export class PerfAggregator implements IAgentWorldPerfDashboard {
	private startupServices: ServiceStartupEntry[] = [];
	/** Cleared when the next startup run begins (first phase/segment of a run). */
	private startupPhasesBuffer: StartupPhaseEntry[] = [];
	private startupSegmentsBuffer: StartupSegmentEntry[] = [];
	private lastRunPhases: StartupPhaseEntry[] = [];
	private lastRunSegments: StartupSegmentEntry[] = [];
	private startupRunOpen = false;
	private startupTotals: number[] = [];
	private storageLoads = new Map<string, number[]>();
	private storageSaves = new Map<string, number[]>();
	private storageSizes = new Map<string, number>();
	private queryTimings: number[] = [];
	private querySourceRows: number[] = [];
	private queryResultRows: number[] = [];
	private dispatchTimings: number[] = [];
	private dispatchPerType = new Map<string, { maxMs: number; count: number }>();
	private installerTimings: number[] = [];
	private installerSteps: InstallerStepEntry[] = [];
	private csvParseTimings: number[] = [];
	private importTimings: number[] = [];
	private importRows: number[] = [];
	private viewTimings = new Map<string, number[]>();
	private agentWorldSamples: AgentWorldSampleSnapshot[] = [];
	private agentWorldSlowFrames = 0;
	private agentWorldSimMax: number[] = [];
	private unsubscribes: Array<() => void> = [];
	private startupThresholdMs: number;

	constructor(
		private eventBus: IEventBus,
		private storage?: ITypedStorage<PerfState>,
		options?: { startupThresholdMs?: number },
	) {
		this.startupThresholdMs = options?.startupThresholdMs ?? DEFAULT_STARTUP_THRESHOLD_MS;
	}

	setup(): void {
		this.unsubscribes.push(
			this.eventBus.on("perf.startup.service", (event) => {
				if (!this.startupRunOpen) {
					this.startupRunOpen = true;
					this.startupServices = [];
					this.startupPhasesBuffer = [];
					this.startupSegmentsBuffer = [];
				}
				this.startupServices.push({
					service: event.payload.service,
					durationMs: event.payload.durationMs,
				});
			}),
			this.eventBus.on("perf.startup.phase", (event) => {
				if (!this.startupRunOpen) {
					this.startupRunOpen = true;
					this.startupServices = [];
					this.startupPhasesBuffer = [];
					this.startupSegmentsBuffer = [];
				}
				this.startupPhasesBuffer.push({
					phase: event.payload.phase,
					durationMs: event.payload.durationMs,
				});
			}),
			this.eventBus.on("perf.startup.segment", (event) => {
				if (!this.startupRunOpen) {
					this.startupRunOpen = true;
					this.startupServices = [];
					this.startupPhasesBuffer = [];
					this.startupSegmentsBuffer = [];
				}
				this.startupSegmentsBuffer.push({
					segment: event.payload.segment,
					durationMs: event.payload.durationMs,
				});
			}),
			this.eventBus.on("perf.startup.total", (event) => {
				this.lastRunPhases = [...this.startupPhasesBuffer];
				this.lastRunSegments = [...this.startupSegmentsBuffer];
				this.startupPhasesBuffer = [];
				this.startupSegmentsBuffer = [];
				this.startupRunOpen = false;
				this.push(this.startupTotals, event.payload.durationMs);
				if (event.payload.durationMs > this.startupThresholdMs) {
					void this.eventBus.emit("perf.alert", {
						metric: "startup.total",
						value: event.payload.durationMs,
						threshold: this.startupThresholdMs,
					});
				}
				void this.persist();
			}),
			this.eventBus.on("perf.storage.loaded", (event) => {
				const arr = this.storageLoads.get(event.payload.key) ?? [];
				this.push(arr, event.payload.durationMs);
				this.storageLoads.set(event.payload.key, arr);
				this.storageSizes.set(event.payload.key, event.payload.sizeBytes);
			}),
			this.eventBus.on("perf.storage.saved", (event) => {
				const arr = this.storageSaves.get(event.payload.key) ?? [];
				this.push(arr, event.payload.durationMs);
				this.storageSaves.set(event.payload.key, arr);
				this.storageSizes.set(event.payload.key, event.payload.sizeBytes);
			}),
			this.eventBus.on("perf.query.executed", (event) => {
				this.push(this.queryTimings, event.payload.durationMs);
				this.push(this.querySourceRows, event.payload.sourceRows);
				this.push(this.queryResultRows, event.payload.resultRows);
			}),
			this.eventBus.on("perf.event.dispatched", (event) => {
				this.push(this.dispatchTimings, event.payload.durationMs);
				const existing = this.dispatchPerType.get(event.payload.eventType);
				if (existing) {
					existing.count++;
					existing.maxMs = Math.max(existing.maxMs, event.payload.durationMs);
				} else {
					this.dispatchPerType.set(event.payload.eventType, {
						maxMs: event.payload.durationMs,
						count: 1,
					});
				}
			}),
			this.eventBus.on("perf.installer.total", (event) => {
				this.push(this.installerTimings, event.payload.durationMs);
			}),
			this.eventBus.on("perf.installer.step", (event) => {
				this.installerSteps.push({
					stepId: event.payload.stepId,
					durationMs: event.payload.durationMs,
				});
			}),
			this.eventBus.on("perf.csv.parsed", (event) => {
				this.push(this.csvParseTimings, event.payload.durationMs);
			}),
			this.eventBus.on("perf.import.completed", (event) => {
				this.push(this.importTimings, event.payload.durationMs);
				this.push(this.importRows, event.payload.totalRows);
			}),
			this.eventBus.on("perf.view.opened", (event) => {
				const arr = this.viewTimings.get(event.payload.hubId) ?? [];
				this.push(arr, event.payload.durationMs);
				this.viewTimings.set(event.payload.hubId, arr);
			}),
			this.eventBus.on("perf.agentWorld.sample", (event) => {
				this.agentWorldSamples.push({ ...event.payload });
				if (this.agentWorldSamples.length > WINDOW_SIZE) this.agentWorldSamples.shift();
				this.push(this.agentWorldSimMax, event.payload.simulation.maxMs);
			}),
			this.eventBus.on("perf.agentWorld.slowFrame", () => {
				this.agentWorldSlowFrames++;
			}),
		);
	}

	async load(): Promise<void> {
		const state = await this.storage?.load();
		if (state?.startupHistory) {
			this.startupTotals = state.startupHistory.slice(-WINDOW_SIZE);
		}
	}

	destroy(): void {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}

	getStartupSummary(): StartupSummary {
		const totalMs = this.startupTotals[this.startupTotals.length - 1] ?? 0;
		return {
			totalMs,
			serviceCount: this.startupServices.length,
			perService: [...this.startupServices],
			timing: this.computeSummary(this.startupTotals),
			lastRunPhases: [...this.lastRunPhases],
			lastRunSegments: [...this.lastRunSegments],
		};
	}

	getStorageSummary(): StorageSummary {
		const allKeys = new Set([...this.storageLoads.keys(), ...this.storageSaves.keys()]);
		const keys: StorageKeySummary[] = [];
		for (const key of allKeys) {
			const loads = this.storageLoads.get(key) ?? [];
			const saves = this.storageSaves.get(key) ?? [];
			keys.push({
				key,
				loadCount: loads.length,
				saveCount: saves.length,
				avgLoadMs: avg(loads),
				avgSaveMs: avg(saves),
				lastSizeBytes: this.storageSizes.get(key) ?? 0,
			});
		}
		return { keys };
	}

	getEventDispatchSummary(): EventDispatchSummary {
		const slowest: EventTypeDispatchEntry[] = [...this.dispatchPerType.entries()]
			.map(([eventType, stats]) => ({ eventType, maxMs: stats.maxMs, count: stats.count }))
			.sort((a, b) => b.maxMs - a.maxMs)
			.slice(0, 10);
		return {
			totalDispatches: this.dispatchTimings.length,
			timing: this.computeSummary(this.dispatchTimings),
			slowest,
		};
	}

	getQuerySummary(): QuerySummary {
		return {
			totalExecutions: this.queryTimings.length,
			timing: this.computeSummary(this.queryTimings),
			avgSourceRows: avg(this.querySourceRows),
			avgResultRows: avg(this.queryResultRows),
		};
	}

	getInstallerSummary(): InstallerSummary {
		const totalMs = this.installerTimings[this.installerTimings.length - 1] ?? 0;
		return {
			totalMs,
			stepCount: this.installerSteps.length,
			perStep: [...this.installerSteps],
		};
	}

	getImportSummary(): ImportSummary {
		return {
			totalImports: this.importTimings.length,
			timing: this.computeSummary(this.importTimings),
			avgRows: avg(this.importRows),
		};
	}

	getViewSummary(): ViewSummary {
		const perHub = [...this.viewTimings.entries()].map(([hubId, timings]) => ({
			hubId,
			timing: this.computeSummary(timings),
		}));
		return { perHub };
	}

	/** Agent canvas world: rolling `perf.agentWorld.sample` windows + slow-frame count. */
	getAgentWorldSummary(): AgentWorldPerfSummary {
		return {
			samples: [...this.agentWorldSamples],
			slowFrameCount: this.agentWorldSlowFrames,
			simulationMaxAcrossSamples: this.computeSummary(this.agentWorldSimMax),
			agentCanvasAggregate: this.computeAgentCanvasAggregate(),
		};
	}

	/** Mean/max of per-window Σ-agent slice totals + top agents across buffered samples. */
	private computeAgentCanvasAggregate(): AgentCanvasAggregateView | null {
		const samples = this.agentWorldSamples.filter((s) =>
			s.perAgentCanvas?.agents?.some((a) => Object.keys(a.slices).length > 0),
		);
		if (samples.length === 0) return null;

		const perWindowSliceSums: Record<string, number>[] = [];
		for (const s of samples) {
			const sums: Record<string, number> = {};
			for (const a of s.perAgentCanvas.agents) {
				for (const [sliceKey, v] of Object.entries(a.slices)) {
					sums[sliceKey] = (sums[sliceKey] ?? 0) + v.avgMs;
				}
			}
			perWindowSliceSums.push(sums);
		}

		const allSliceKeys = new Set<string>();
		for (const row of perWindowSliceSums) {
			for (const k of Object.keys(row)) allSliceKeys.add(k);
		}

		const sliceSumAvgAcrossWindows: Record<string, number> = {};
		const sliceSumMaxAcrossWindows: Record<string, number> = {};
		for (const k of allSliceKeys) {
			const vals = perWindowSliceSums.map((r) => r[k] ?? 0);
			sliceSumAvgAcrossWindows[k] = vals.reduce((x, y) => x + y, 0) / vals.length;
			sliceSumMaxAcrossWindows[k] = Math.max(...vals, 0);
		}

		const agentAcc = new Map<string, { sumTotal: number; windows: number }>();
		for (const s of samples) {
			for (const a of s.perAgentCanvas.agents) {
				const total = Object.values(a.slices).reduce((acc, v) => acc + v.avgMs, 0);
				if (total <= 1e-9) continue;
				const cur = agentAcc.get(a.agentName) ?? { sumTotal: 0, windows: 0 };
				cur.sumTotal += total;
				cur.windows += 1;
				agentAcc.set(a.agentName, cur);
			}
		}

		const topAgentsByMeanTotal = [...agentAcc.entries()]
			.map(([agentName, { sumTotal, windows }]) => ({
				agentName,
				meanTotalAvgMs: sumTotal / windows,
				windowsSeen: windows,
			}))
			.sort((a, b) => b.meanTotalAvgMs - a.meanTotalAvgMs)
			.slice(0, 10);

		return {
			windowCount: samples.length,
			sliceSumAvgAcrossWindows,
			sliceSumMaxAcrossWindows,
			topAgentsByMeanTotal,
		};
	}

	private push(arr: number[], value: number): void {
		arr.push(value);
		if (arr.length > WINDOW_SIZE) arr.shift();
	}

	private computeSummary(values: number[]): MetricSummary {
		if (values.length === 0) return { count: 0, p50: 0, p95: 0, max: 0 };
		const sorted = [...values].sort((a, b) => a - b);
		return {
			count: sorted.length,
			p50: percentile(sorted, 0.5),
			p95: percentile(sorted, 0.95),
			max: sorted[sorted.length - 1],
		};
	}

	private async persist(): Promise<void> {
		await this.storage?.save({ startupHistory: this.startupTotals });
	}
}

function avg(values: number[]): number {
	if (values.length === 0) return 0;
	return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const index = Math.ceil(p * sorted.length) - 1;
	return sorted[Math.max(0, index)];
}
