import type { WatcherStats } from "../types";
import type { IStatsTracker, IStatusBar } from "../interfaces/IPluginContext";
import { truncatePath } from "../utils";

/**
 * Configuration for StatsService
 */
export interface IStatsServiceConfig {
	/** Optional status bar to notify on changes */
	statusbar?: IStatusBar;
}

/**
 * Service for tracking and managing file watcher statistics.
 * Implements IStatsTracker for use by other services.
 */
export class StatsService implements IStatsTracker {
	private _stats: WatcherStats = {
		filesProcessed: 0,
		filesSkipped: 0,
		errors: 0,
		lastProcessed: null,
		perMappingStats: {},
	};

	private statusbar?: IStatusBar;

	constructor(config?: IStatsServiceConfig) {
		this.statusbar = config?.statusbar;
	}

	/**
	 * Set the status bar reference (for late binding)
	 */
	setStatusBar(statusbar: IStatusBar): void {
		this.statusbar = statusbar;
	}

	/**
	 * Get current stats (read-only)
	 */
	get stats(): WatcherStats {
		return this._stats;
	}

	/**
	 * Initialize per-mapping stats for a list of mapping IDs
	 */
	initializeMappingStats(mappingIds: string[]): void {
		for (const id of mappingIds) {
			this.ensureMappingStats(id);
		}
	}

	/**
	 * Ensure stats object exists for a mapping
	 */
	private ensureMappingStats(mappingId: string): void {
		if (!this._stats.perMappingStats[mappingId]) {
			this._stats.perMappingStats[mappingId] = {
				processed: 0,
				skipped: 0,
				errors: 0,
			};
		}
	}

	/**
	 * Increment processed count for a mapping
	 */
	bumpProcessed(mappingId: string, filePath?: string): void {
		this._stats.filesProcessed += 1;
		this.ensureMappingStats(mappingId);
		this._stats.perMappingStats[mappingId].processed += 1;
		this._stats.lastProcessed = filePath
			? truncatePath(filePath)
			: new Date().toISOString();
		this.notifyStatusBar();
	}

	/**
	 * Increment skipped count for a mapping
	 */
	bumpSkipped(mappingId: string): void {
		this._stats.filesSkipped += 1;
		this.ensureMappingStats(mappingId);
		this._stats.perMappingStats[mappingId].skipped += 1;
		this.notifyStatusBar();
	}

	/**
	 * Increment error count for a mapping
	 */
	bumpError(mappingId: string): void {
		this._stats.errors += 1;
		this.ensureMappingStats(mappingId);
		this._stats.perMappingStats[mappingId].errors += 1;
		this.notifyStatusBar();
	}

	/**
	 * Apply bulk stats from a reconcile operation
	 */
	applyReconcileStats(
		mappingId: string,
		stats: { processed: number; skipped: number; errors: number }
	): void {
		this._stats.filesProcessed += stats.processed;
		this._stats.filesSkipped += stats.skipped;
		this._stats.errors += stats.errors;

		this.ensureMappingStats(mappingId);
		this._stats.perMappingStats[mappingId].processed += stats.processed;
		this._stats.perMappingStats[mappingId].skipped += stats.skipped;
		this._stats.perMappingStats[mappingId].errors += stats.errors;

		this.notifyStatusBar();
	}

	/**
	 * Reset all stats to zero
	 */
	reset(): void {
		this._stats = {
			filesProcessed: 0,
			filesSkipped: 0,
			errors: 0,
			lastProcessed: null,
			perMappingStats: {},
		};
		this.notifyStatusBar();
	}

	/**
	 * Reset stats for a specific mapping
	 */
	resetMapping(mappingId: string): void {
		if (this._stats.perMappingStats[mappingId]) {
			const mappingStats = this._stats.perMappingStats[mappingId];
			this._stats.filesProcessed -= mappingStats.processed;
			this._stats.filesSkipped -= mappingStats.skipped;
			this._stats.errors -= mappingStats.errors;

			this._stats.perMappingStats[mappingId] = {
				processed: 0,
				skipped: 0,
				errors: 0,
			};
			this.notifyStatusBar();
		}
	}

	/**
	 * Remove stats for a deleted mapping
	 */
	removeMapping(mappingId: string): void {
		if (this._stats.perMappingStats[mappingId]) {
			const mappingStats = this._stats.perMappingStats[mappingId];
			this._stats.filesProcessed -= mappingStats.processed;
			this._stats.filesSkipped -= mappingStats.skipped;
			this._stats.errors -= mappingStats.errors;

			delete this._stats.perMappingStats[mappingId];
			this.notifyStatusBar();
		}
	}

	/**
	 * Notify the status bar of changes
	 */
	private notifyStatusBar(): void {
		this.statusbar?.onStatsChanged();
	}
}

/**
 * Create a new StatsService instance
 */
export function createStatsService(config?: IStatsServiceConfig): StatsService {
	return new StatsService(config);
}
