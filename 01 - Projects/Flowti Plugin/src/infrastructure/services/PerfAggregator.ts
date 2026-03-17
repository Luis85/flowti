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
} from "./perfTypes";

const WINDOW_SIZE = 20;
const DEFAULT_STARTUP_THRESHOLD_MS = 5000;

export class PerfAggregator {
	private startupServices: ServiceStartupEntry[] = [];
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
				this.startupServices.push({
					service: event.payload.service,
					durationMs: event.payload.durationMs,
				});
			}),
			this.eventBus.on("perf.startup.total", (event) => {
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
