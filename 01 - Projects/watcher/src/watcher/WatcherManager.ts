import { MappingWatcher, IMappingWatcherContext } from "./MappingWatcher";
import { VaultWatcher, IVaultWatcherContext } from "./VaultWatcher";
import { LogService } from "../services/LogService";
import type { App } from "obsidian";
import type { ISettingsProvider, IStatusBar } from "../interfaces/IPluginContext";
import type { FolderMapping } from "../types";

/**
 * Context required by WatcherManager.
 * Separates plugin dependencies for better testability.
 * @category Watchers
 */
export interface IWatcherManagerContext extends ISettingsProvider {
	/** The Obsidian app instance */
	readonly app: App;
	/** Optional status bar service for UI updates */
	readonly statusbar?: IStatusBar;
	/** Context to pass to MappingWatcher instances (source → vault) */
	readonly watcherContext: IMappingWatcherContext;
	/** Context to pass to VaultWatcher instances (vault → source) */
	readonly vaultWatcherContext: IVaultWatcherContext;
}

/**
 * Possible states for a folder watcher.
 * @category Watchers
 */
export type WatcherState = "running" | "stopped" | "error";

/**
 * Health status for a watcher based on activity and errors.
 * - healthy: Running and had recent activity
 * - idle: Running but no activity for a while (5+ minutes)
 * - warning: Running but has dropped jobs or high queue
 * - error: In error state
 * @category Watchers
 */
export type WatcherHealth = "healthy" | "idle" | "warning" | "error";

/** Idle threshold in milliseconds (5 minutes) */
const IDLE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Information about a single watcher instance.
 * Used by the dashboard to display watcher status.
 * @category Watchers
 */
export interface WatcherInfo {
	/** Unique identifier of the folder mapping */
	mappingId: string;
	/** Human-readable description of the mapping */
	mappingDescription: string;
	/** Absolute path to the source folder being watched */
	sourceFolder: string;
	/** Vault-relative path to the target folder */
	targetFolder: string;
	/** Current state of the watcher */
	state: WatcherState;
	/** Health status based on activity and errors */
	health: WatcherHealth;
	/** Timestamp of last activity (file event received), null if never active */
	lastActivity: number | null;
	/** Queue statistics for pending operations */
	queueStats: {
		pendingFiles: number;
		pendingDirs: number;
		droppedJobs: number;
		maxPendingFiles: number;
		maxPendingDirs: number;
	};
	/** Number of files currently tracked by the watcher */
	watchedFiles: number;
}

/**
 * Manages the lifecycle of all folder watchers.
 *
 * @remarks
 * The WatcherManager is responsible for:
 * - Creating and starting watchers for enabled folder mappings
 * - Stopping and cleaning up watchers when needed
 * - Tracking watcher states (running, stopped, error)
 * - Providing aggregated queue statistics
 * - Coordinating watcher restarts when settings change
 *
 * Each folder mapping gets its own {@link MappingWatcher} instance that
 * monitors the source folder for changes using chokidar.
 *
 * @example
 * ```typescript
 * const manager = new WatcherManager(ctx);
 *
 * // Start all enabled watchers
 * await manager.startAll();
 *
 * // Check status
 * console.log(`${manager.activeCount()} watchers running`);
 *
 * // Get detailed info for dashboard
 * const infos = manager.getWatcherInfos();
 *
 * // Stop all watchers
 * await manager.stopAll();
 * ```
 *
 * @category Watchers
 */
export class WatcherManager {
	/** Source watchers (external → vault) */
	private watchers = new Map<string, MappingWatcher>();
	/** Vault watchers (vault → external) */
	private vaultWatchers = new Map<string, VaultWatcher>();
	private watcherStates = new Map<string, WatcherState>();
	private starting = false;

	/**
	 * Creates a new WatcherManager instance.
	 * @param ctx - Context providing app, settings, and watcher dependencies
	 */
	constructor(private ctx: IWatcherManagerContext) {}

	/**
	 * Starts watchers for all enabled folder mappings.
	 *
	 * @remarks
	 * This method:
	 * 1. Stops any existing watchers first
	 * 2. Creates new watchers for each enabled mapping
	 * 3. Tracks state for each watcher
	 *
	 * Concurrent calls are prevented - if startAll is already running,
	 * subsequent calls will be ignored.
	 */
	async startAll() {
		// Prevent concurrent startAll calls
		if (this.starting) {
			LogService.warn("Manager", "startAll() already in progress, skipping");
			return;
		}
		this.starting = true;

		try {
			const mappings = this.ctx.settings.folderMappings;
			LogService.info("Manager", "Starting all watchers", {
				details: {
					totalMappings: mappings.length,
					mappings: mappings.map((m: FolderMapping) => ({
						id: m.id,
						description: m.description,
						enabled: m.enabled,
						sourceFolder: m.sourceFolder,
						targetFolder: m.targetFolder,
					})),
				},
			});

			// Wait for all existing watchers to fully stop
			await this.stopAll();

			for (const m of mappings) {
				if (!m.enabled) {
					LogService.debug(
						"Manager",
						`Skipping disabled mapping: ${m.description || m.id}`,
						{ mappingId: m.id }
					);
					this.watcherStates.set(m.id, "stopped");
					continue;
				}

				LogService.debug("Manager", `Creating watcher(s) for mapping`, {
					mappingId: m.id,
					details: {
						description: m.description,
						sourceFolder: m.sourceFolder,
						targetFolder: m.targetFolder,
						syncDirection: m.syncDirection ?? "source-only",
					},
				});

				const syncDirection = m.syncDirection ?? "source-only";
				let sourceStarted = false;
				let vaultStarted = false;

				// Start source watcher (external → vault) if needed
				if (syncDirection !== "vault-only") {
					const mw = new MappingWatcher(this.ctx.app, this.ctx.watcherContext, m);
					try {
						mw.start();
						this.watchers.set(m.id, mw);
						sourceStarted = true;
						LogService.info(
							"Manager",
							`Source watcher started: ${m.description || m.id}`,
							{
								mappingId: m.id,
								details: {
									sourceFolder: m.sourceFolder,
									targetFolder: m.targetFolder,
								},
							}
						);
					} catch (e) {
						LogService.error(
							"Manager",
							`Source watcher failed to start: ${m.description || m.id}`,
							{
								mappingId: m.id,
								details: { error: String(e) },
							}
						);
					}
				}

				// Start vault watcher (vault → external) if needed
				if (syncDirection !== "source-only") {
					const vw = new VaultWatcher(this.ctx.app, this.ctx.vaultWatcherContext, m);
					try {
						vw.start();
						this.vaultWatchers.set(m.id, vw);
						vaultStarted = true;
						LogService.info(
							"Manager",
							`Vault watcher started: ${m.description || m.id}`,
							{
								mappingId: m.id,
								details: {
									sourceFolder: m.sourceFolder,
									targetFolder: m.targetFolder,
								},
							}
						);
					} catch (e) {
						LogService.error(
							"Manager",
							`Vault watcher failed to start: ${m.description || m.id}`,
							{
								mappingId: m.id,
								details: { error: String(e) },
							}
						);
					}
				}

				// Determine overall state
				if (sourceStarted || vaultStarted) {
					this.watcherStates.set(m.id, "running");
				} else {
					this.watcherStates.set(m.id, "error");
				}
			}

			LogService.info("Manager", "All watchers started", {
				details: { activeWatchers: this.watchers.size },
			});

			this.ctx.statusbar?.onStatsChanged();
		} finally {
			this.starting = false;
		}
	}

	async stopAll() {
		const totalWatchers = this.watchers.size + this.vaultWatchers.size;
		if (totalWatchers === 0) {
			LogService.debug("Manager", "stopAll() called but no watchers to stop");
			return;
		}

		LogService.info("Manager", `Stopping ${totalWatchers} watchers (${this.watchers.size} source, ${this.vaultWatchers.size} vault)`);

		const sourceWatchers = Array.from(this.watchers.entries());
		const vaultWatchersList = Array.from(this.vaultWatchers.entries());
		this.watchers.clear();
		this.vaultWatchers.clear();

		// Wait for all watchers to fully close
		await Promise.all([
			...sourceWatchers.map(async ([id, w]) => {
				await w.stop();
			}),
			...vaultWatchersList.map(async ([id, w]) => {
				await w.stop();
			}),
		]);

		// Update states for all mappings
		for (const [id] of sourceWatchers) {
			this.watcherStates.set(id, "stopped");
		}
		for (const [id] of vaultWatchersList) {
			// Only set to stopped if not already set by source watcher
			if (!sourceWatchers.find(([sid]) => sid === id)) {
				this.watcherStates.set(id, "stopped");
			}
		}

		LogService.info("Manager", "All watchers stopped");
	}

	/**
	 * Returns the number of currently active watcher mappings.
	 * A mapping counts as active if it has either a source or vault watcher running.
	 */
	activeCount() {
		const activeIds = new Set([
			...this.watchers.keys(),
			...this.vaultWatchers.keys(),
		]);
		return activeIds.size;
	}

	/**
	 * Restarts all watchers after settings change.
	 *
	 * @remarks
	 * Called automatically when folder mappings are modified.
	 * Triggers a full restart of all watchers.
	 */
	updateMappings() {
		LogService.info("Manager", "Updating mappings - restarting watchers");
		void this.startAll();
	}

	/**
	 * Returns detailed information about all configured watchers.
	 *
	 * @remarks
	 * Used by the dashboard to display watcher status, queue stats,
	 * and provide controls for individual watchers.
	 *
	 * @returns Array of {@link WatcherInfo} for all folder mappings
	 */
	getWatcherInfos(): WatcherInfo[] {
		const infos: WatcherInfo[] = [];

		for (const m of this.ctx.settings.folderMappings) {
			const sourceWatcher = this.watchers.get(m.id);
			const vaultWatcher = this.vaultWatchers.get(m.id);
			const state = this.watcherStates.get(m.id) ?? "stopped";
			const effectiveState = m.enabled ? state : "stopped";

			// Combine last activity from both watchers
			const sourceActivity = sourceWatcher?.getLastActivity() ?? null;
			const vaultActivity = vaultWatcher?.getLastActivity() ?? null;
			const lastActivity = sourceActivity && vaultActivity
				? Math.max(sourceActivity, vaultActivity)
				: sourceActivity ?? vaultActivity;

			// Combine queue stats from both watchers
			const sourceStats = sourceWatcher?.getQueueStats();
			const vaultStats = vaultWatcher?.getQueueStats();
			const queueStats = {
				pendingFiles: (sourceStats?.pendingFiles ?? 0) + (vaultStats?.pendingFiles ?? 0),
				pendingDirs: sourceStats?.pendingDirs ?? 0,
				droppedJobs: (sourceStats?.droppedJobs ?? 0) + (vaultStats?.droppedJobs ?? 0),
				maxPendingFiles: sourceStats?.maxPendingFiles ?? vaultStats?.maxPendingFiles ?? 1000,
				maxPendingDirs: sourceStats?.maxPendingDirs ?? 100,
			};

			// Calculate health based on state, activity, and queue stats
			let health: WatcherHealth;
			if (effectiveState === "error") {
				health = "error";
			} else if (effectiveState !== "running") {
				health = "idle";
			} else if (queueStats.droppedJobs > 0 || queueStats.pendingFiles > queueStats.maxPendingFiles * 0.8) {
				health = "warning";
			} else if (lastActivity === null || Date.now() - lastActivity > IDLE_THRESHOLD_MS) {
				health = "idle";
			} else {
				health = "healthy";
			}

			// Count watched files from both watchers
			const watchedFiles =
				(sourceWatcher?.getWatchedFileCount() ?? 0) +
				(vaultWatcher?.getWatchedFileCount() ?? 0);

			infos.push({
				mappingId: m.id,
				mappingDescription: m.description || m.id,
				sourceFolder: m.sourceFolder,
				targetFolder: m.targetFolder,
				state: effectiveState,
				health,
				lastActivity,
				queueStats,
				watchedFiles,
			});
		}

		return infos;
	}

	/**
	 * Returns aggregated queue statistics across all active watchers.
	 *
	 * @returns Combined counts of pending files, dirs, and dropped jobs
	 */
	getTotalQueueStats() {
		let pendingFiles = 0;
		let pendingDirs = 0;
		let droppedJobs = 0;

		// Count source watcher stats
		for (const watcher of this.watchers.values()) {
			const stats = watcher.getQueueStats();
			pendingFiles += stats.pendingFiles;
			pendingDirs += stats.pendingDirs;
			droppedJobs += stats.droppedJobs;
		}

		// Count vault watcher stats
		for (const watcher of this.vaultWatchers.values()) {
			const stats = watcher.getQueueStats();
			pendingFiles += stats.pendingFiles;
			droppedJobs += stats.droppedJobs;
		}

		return { pendingFiles, pendingDirs, droppedJobs };
	}

	/**
	 * Returns the total number of files currently tracked by all watchers.
	 */
	getTotalWatchedFileCount(): number {
		let total = 0;
		for (const w of this.watchers.values()) {
			total += w.getWatchedFileCount();
		}
		for (const w of this.vaultWatchers.values()) {
			total += w.getWatchedFileCount();
		}
		return total;
	}

	/**
	 * Starts a watcher for a specific folder mapping.
	 *
	 * @param mappingId - The unique identifier of the mapping
	 * @returns `true` if the watcher was started successfully
	 */
	async startWatcher(mappingId: string): Promise<boolean> {
		const mapping = this.ctx.settings.folderMappings.find(
			(m: FolderMapping) => m.id === mappingId
		);
		if (!mapping) {
			LogService.warn("Manager", `Mapping not found: ${mappingId}`);
			return false;
		}

		// Stop existing watchers if any
		const existingSourceWatcher = this.watchers.get(mappingId);
		if (existingSourceWatcher) {
			await existingSourceWatcher.stop();
			this.watchers.delete(mappingId);
		}
		const existingVaultWatcher = this.vaultWatchers.get(mappingId);
		if (existingVaultWatcher) {
			await existingVaultWatcher.stop();
			this.vaultWatchers.delete(mappingId);
		}

		const syncDirection = mapping.syncDirection ?? "source-only";
		let sourceStarted = false;
		let vaultStarted = false;

		// Start source watcher if needed
		if (syncDirection !== "vault-only") {
			const mw = new MappingWatcher(this.ctx.app, this.ctx.watcherContext, mapping);
			try {
				mw.start();
				this.watchers.set(mappingId, mw);
				sourceStarted = true;
			} catch (e) {
				LogService.error("Manager", `Source watcher failed to start`, {
					mappingId,
					details: { error: String(e) },
				});
			}
		}

		// Start vault watcher if needed
		if (syncDirection !== "source-only") {
			const vw = new VaultWatcher(this.ctx.app, this.ctx.vaultWatcherContext, mapping);
			try {
				vw.start();
				this.vaultWatchers.set(mappingId, vw);
				vaultStarted = true;
			} catch (e) {
				LogService.error("Manager", `Vault watcher failed to start`, {
					mappingId,
					details: { error: String(e) },
				});
			}
		}

		if (sourceStarted || vaultStarted) {
			this.watcherStates.set(mappingId, "running");
			LogService.info(
				"Manager",
				`Watcher(s) started: ${mapping.description || mappingId}`,
				{
					mappingId,
					details: {
						sourceFolder: mapping.sourceFolder,
						targetFolder: mapping.targetFolder,
						syncDirection,
						sourceStarted,
						vaultStarted,
					},
				}
			);
			this.ctx.statusbar?.onStatsChanged();
			return true;
		} else {
			this.watcherStates.set(mappingId, "error");
			return false;
		}
	}

	/**
	 * Stops a watcher for a specific folder mapping.
	 *
	 * @param mappingId - The unique identifier of the mapping
	 * @returns `true` if the watcher was stopped successfully
	 */
	async stopWatcher(mappingId: string): Promise<boolean> {
		const sourceWatcher = this.watchers.get(mappingId);
		const vaultWatcher = this.vaultWatchers.get(mappingId);

		if (!sourceWatcher && !vaultWatcher) {
			// Already stopped
			this.watcherStates.set(mappingId, "stopped");
			return true;
		}

		const mapping = this.ctx.settings.folderMappings.find(
			(m: FolderMapping) => m.id === mappingId
		);
		const label = mapping?.description || mappingId;

		try {
			if (sourceWatcher) {
				await sourceWatcher.stop();
				this.watchers.delete(mappingId);
			}
			if (vaultWatcher) {
				await vaultWatcher.stop();
				this.vaultWatchers.delete(mappingId);
			}
			this.watcherStates.set(mappingId, "stopped");
			LogService.info("Manager", `Watcher(s) stopped: ${label}`, {
				mappingId,
			});
			this.ctx.statusbar?.onStatsChanged();
			return true;
		} catch (e) {
			LogService.error("Manager", `Failed to stop watcher(s): ${label}`, {
				mappingId,
				details: { error: String(e) },
			});
			return false;
		}
	}

	/**
	 * Checks if a specific watcher is currently running.
	 *
	 * @param mappingId - The unique identifier of the mapping
	 * @returns `true` if the watcher is active
	 */
	isWatcherRunning(mappingId: string): boolean {
		return this.watchers.has(mappingId) || this.vaultWatchers.has(mappingId);
	}
}
