import { MappingWatcher, IMappingWatcherContext } from "./MappingWatcher";
import { LogService } from "../services/LogService";
import type { App } from "obsidian";
import type { ISettingsProvider, IStatusBar } from "../interfaces";
import type { FolderMapping } from "../types";

/**
 * Context required by WatcherManager.
 * Separates plugin dependencies for better testability.
 */
export interface IWatcherManagerContext extends ISettingsProvider {
	readonly app: App;
	readonly statusbar?: IStatusBar;
	/** Context to pass to MappingWatcher instances */
	readonly watcherContext: IMappingWatcherContext;
}

export type WatcherState = "running" | "stopped" | "error";

export interface WatcherInfo {
	mappingId: string;
	mappingDescription: string;
	sourceFolder: string;
	targetFolder: string;
	state: WatcherState;
	queueStats: {
		pendingFiles: number;
		pendingDirs: number;
		droppedJobs: number;
		maxPendingFiles: number;
		maxPendingDirs: number;
	};
}

export class WatcherManager {
	private watchers = new Map<string, MappingWatcher>();
	private watcherStates = new Map<string, WatcherState>();
	private starting = false;

	constructor(private ctx: IWatcherManagerContext) {}

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

				LogService.debug("Manager", `Creating watcher for mapping`, {
					mappingId: m.id,
					details: {
						description: m.description,
						sourceFolder: m.sourceFolder,
						targetFolder: m.targetFolder,
					},
				});

				const mw = new MappingWatcher(this.ctx.app, this.ctx.watcherContext, m);
				this.watchers.set(m.id, mw);

				try {
					mw.start();
					this.watcherStates.set(m.id, "running");
					LogService.info(
						"Manager",
						`Watcher started: ${m.description || m.id}`,
						{
							mappingId: m.id,
							details: {
								sourceFolder: m.sourceFolder,
								targetFolder: m.targetFolder,
							},
						}
					);
				} catch (e) {
					this.watcherStates.set(m.id, "error");
					LogService.error(
						"Manager",
						`Watcher failed to start: ${m.description || m.id}`,
						{
							mappingId: m.id,
							details: { error: String(e) },
						}
					);
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
		if (this.watchers.size === 0) {
			LogService.debug("Manager", "stopAll() called but no watchers to stop");
			return;
		}

		LogService.info("Manager", `Stopping ${this.watchers.size} watchers`);

		const all = Array.from(this.watchers.entries());
		this.watchers.clear();

		// Wait for all watchers to fully close
		await Promise.all(
			all.map(async ([id, w]) => {
				await w.stop();
				this.watcherStates.set(id, "stopped");
			})
		);

		LogService.info("Manager", "All watchers stopped");
	}

	activeCount() {
		return this.watchers.size;
	}

	updateMappings() {
		LogService.info("Manager", "Updating mappings - restarting watchers");
		void this.startAll();
	}

	/**
	 * Get detailed info about all watchers (for dashboard)
	 */
	getWatcherInfos(): WatcherInfo[] {
		const infos: WatcherInfo[] = [];

		for (const m of this.ctx.settings.folderMappings) {
			const watcher = this.watchers.get(m.id);
			const state = this.watcherStates.get(m.id) ?? "stopped";

			infos.push({
				mappingId: m.id,
				mappingDescription: m.description || m.id,
				sourceFolder: m.sourceFolder,
				targetFolder: m.targetFolder,
				state: m.enabled ? state : "stopped",
				queueStats: watcher?.getQueueStats() ?? {
					pendingFiles: 0,
					pendingDirs: 0,
					droppedJobs: 0,
					maxPendingFiles: 1000,
					maxPendingDirs: 100,
				},
			});
		}

		return infos;
	}

	/**
	 * Get total queue stats across all watchers
	 */
	getTotalQueueStats() {
		let pendingFiles = 0;
		let pendingDirs = 0;
		let droppedJobs = 0;

		for (const watcher of this.watchers.values()) {
			const stats = watcher.getQueueStats();
			pendingFiles += stats.pendingFiles;
			pendingDirs += stats.pendingDirs;
			droppedJobs += stats.droppedJobs;
		}

		return { pendingFiles, pendingDirs, droppedJobs };
	}

	/**
	 * Start a single watcher by mapping ID
	 */
	async startWatcher(mappingId: string): Promise<boolean> {
		const mapping = this.ctx.settings.folderMappings.find(
			(m: FolderMapping) => m.id === mappingId
		);
		if (!mapping) {
			LogService.warn("Manager", `Mapping not found: ${mappingId}`);
			return false;
		}

		// Stop existing watcher if any
		const existingWatcher = this.watchers.get(mappingId);
		if (existingWatcher) {
			await existingWatcher.stop();
			this.watchers.delete(mappingId);
		}

		const mw = new MappingWatcher(this.ctx.app, this.ctx.watcherContext, mapping);
		this.watchers.set(mappingId, mw);

		try {
			mw.start();
			this.watcherStates.set(mappingId, "running");
			LogService.info(
				"Manager",
				`Watcher started: ${mapping.description || mappingId}`,
				{
					mappingId,
					details: {
						sourceFolder: mapping.sourceFolder,
						targetFolder: mapping.targetFolder,
					},
				}
			);
			this.ctx.statusbar?.onStatsChanged();
			return true;
		} catch (e) {
			this.watcherStates.set(mappingId, "error");
			LogService.error(
				"Manager",
				`Watcher failed to start: ${mapping.description || mappingId}`,
				{
					mappingId,
					details: { error: String(e) },
				}
			);
			return false;
		}
	}

	/**
	 * Stop a single watcher by mapping ID
	 */
	async stopWatcher(mappingId: string): Promise<boolean> {
		const watcher = this.watchers.get(mappingId);
		if (!watcher) {
			// Already stopped
			this.watcherStates.set(mappingId, "stopped");
			return true;
		}

		const mapping = this.ctx.settings.folderMappings.find(
			(m: FolderMapping) => m.id === mappingId
		);
		const label = mapping?.description || mappingId;

		try {
			await watcher.stop();
			this.watchers.delete(mappingId);
			this.watcherStates.set(mappingId, "stopped");
			LogService.info("Manager", `Watcher stopped: ${label}`, {
				mappingId,
			});
			this.ctx.statusbar?.onStatsChanged();
			return true;
		} catch (e) {
			LogService.error("Manager", `Failed to stop watcher: ${label}`, {
				mappingId,
				details: { error: String(e) },
			});
			return false;
		}
	}

	/**
	 * Check if a specific watcher is running
	 */
	isWatcherRunning(mappingId: string): boolean {
		return this.watchers.has(mappingId);
	}
}
