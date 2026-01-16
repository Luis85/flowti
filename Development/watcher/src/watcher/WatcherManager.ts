import FileWatcherPlugin from "src/main";
import { MappingWatcher } from "./MappingWatcher";
import { Debug } from "../services/DebugService";
import { LogService } from "../services/LogService";

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

	constructor(private plugin: FileWatcherPlugin) {}

	async startAll() {
		// Prevent concurrent startAll calls
		if (this.starting) {
			Debug.warn("Manager", "startAll() already in progress, skipping");
			return;
		}
		this.starting = true;

		try {
			Debug.info("Manager", `startAll() called`, {
				totalMappings: this.plugin.settings.folderMappings.length,
				mappings: this.plugin.settings.folderMappings.map((m) => ({
					id: m.id,
					description: m.description,
					enabled: m.enabled,
					sourceFolder: m.sourceFolder,
					targetFolder: m.targetFolder,
				})),
			});

			LogService.info("Manager", "Starting all watchers", {
				details: {
					totalMappings: this.plugin.settings.folderMappings.length,
				},
			});

			// Wait for all existing watchers to fully stop
			await this.stopAll();

			for (const m of this.plugin.settings.folderMappings) {
				if (!m.enabled) {
					Debug.debug(
						"Manager",
						`Skipping disabled mapping: ${m.description || m.id}`
					);
					this.watcherStates.set(m.id, "stopped");
					continue;
				}

				Debug.info("Manager", `Creating watcher for mapping`, {
					id: m.id,
					description: m.description,
					sourceFolder: m.sourceFolder,
					targetFolder: m.targetFolder,
				});

				const mw = new MappingWatcher(this.plugin.app, this.plugin, m);
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

			Debug.info("Manager", `startAll() completed`, {
				activeWatchers: this.watchers.size,
			});

			LogService.info("Manager", "All watchers started", {
				details: { activeWatchers: this.watchers.size },
			});

			this.plugin.statusbar?.onStatsChanged();
		} finally {
			this.starting = false;
		}
	}

	async stopAll() {
		if (this.watchers.size === 0) {
			Debug.debug("Manager", "stopAll() called but no watchers to stop");
			return;
		}

		Debug.info(
			"Manager",
			`stopAll() stopping ${this.watchers.size} watchers`
		);
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

		Debug.info("Manager", `stopAll() completed`);
		LogService.info("Manager", "All watchers stopped");
	}

	activeCount() {
		return this.watchers.size;
	}

	updateMappings() {
		Debug.info("Manager", `updateMappings() called`);
		LogService.info("Manager", "Updating mappings - restarting watchers");
		void this.startAll();
	}

	/**
	 * Get detailed info about all watchers (for dashboard)
	 */
	getWatcherInfos(): WatcherInfo[] {
		const infos: WatcherInfo[] = [];

		for (const m of this.plugin.settings.folderMappings) {
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
		const mapping = this.plugin.settings.folderMappings.find(
			(m) => m.id === mappingId
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

		const mw = new MappingWatcher(this.plugin.app, this.plugin, mapping);
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
			this.plugin.statusbar?.onStatsChanged();
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

		const mapping = this.plugin.settings.folderMappings.find(
			(m) => m.id === mappingId
		);
		const label = mapping?.description || mappingId;

		try {
			await watcher.stop();
			this.watchers.delete(mappingId);
			this.watcherStates.set(mappingId, "stopped");
			LogService.info("Manager", `Watcher stopped: ${label}`, {
				mappingId,
			});
			this.plugin.statusbar?.onStatsChanged();
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
