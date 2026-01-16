import { Notice, Plugin } from "obsidian";
import { StatusBarService } from "src/services/StatusBarService";
import { WatcherManager } from "src/watcher/WatcherManager";
import { FileWatcherSettingTab } from "src/settings/FileWatcherSettingTab";
import { FileSyncService } from "src/services/FileSyncService";
import { ReconcileService } from "src/services/ReconcileService";
import { DashboardModal } from "src/modals/DashboardModal";
import { LogService } from "src/services/LogService";
import { FileWatcherSettings, DEFAULT_SETTINGS } from "src/settings/types";
import {
	WatcherStats,
	ReconcileProgress,
	FolderMapping,
	SyncChangeType,
} from "src/types";
import { truncatePath, getMappingLabel } from "src/utils";

export default class FileWatcherPlugin extends Plugin {
	stats: WatcherStats = {
		filesProcessed: 0,
		filesSkipped: 0,
		errors: 0,
		lastProcessed: null,
		perMappingStats: {},
	};

	fileSync!: FileSyncService;
	manager!: WatcherManager;
	statusbar!: StatusBarService;
	reconcile!: ReconcileService;
	settings!: FileWatcherSettings;

	private reconcileSnapshot: ReconcileProgress | null = null;

	setReconcileSnapshot(p: ReconcileProgress | null) {
		this.reconcileSnapshot = p;
	}

	getReconcileSnapshot() {
		return this.reconcileSnapshot;
	}

	openDashboard() {
		new DashboardModal(this).open();
	}

	async onload() {
		await this.loadSettings();

		// Configure LogService based on debug mode
		LogService.configure({
			minLevel: this.settings.debugMode ? "debug" : "info",
			consoleOutput: this.settings.debugMode,
		});

		LogService.debug("Plugin", "onload() starting");
		LogService.info("Plugin", "File Watcher plugin loading", {
			details: { mappingCount: this.settings.folderMappings.length },
		});

		LogService.debug("Plugin", "Settings loaded", {
			details: {
				mappingCount: this.settings.folderMappings.length,
				mappings: this.settings.folderMappings.map((m) => ({
					id: m.id,
					description: m.description,
					enabled: m.enabled,
					sourceFolder: m.sourceFolder,
					targetFolder: m.targetFolder,
				})),
			},
		});

		this.fileSync = new FileSyncService(this.app, this.settings);
		this.reconcile = new ReconcileService(this, this.fileSync);
		this.manager = new WatcherManager(this);
		this.statusbar = new StatusBarService(this);

		this.addCommand({
			id: "filewatcher-restart",
			name: "Restart all watchers",
			callback: () => {
				LogService.info("Plugin", "Watchers restart requested");
				this.manager?.updateMappings();
				new Notice("File watchers restarted");
			},
		});

		this.addCommand({
			id: "filewatcher-dashboard",
			name: "Open Dashboard",
			callback: () => {
				this.openDashboard();
			},
		});

		this.addSettingTab(new FileWatcherSettingTab(this.app, this));

		LogService.debug("Plugin", "Starting reconcileOnStart");
		void this.reconcile.reconcileOnStart().finally(async () => {
			LogService.debug("Plugin", "reconcileOnStart finished, starting watchers");
			await this.manager.startAll();
			this.statusbar?.onStatsChanged();
		});

		LogService.info("Plugin", "File Watcher plugin loaded");
	}

	onunload() {
		void this.manager?.stopAll();
		this.statusbar?.destroy();
	}

	async toggleAll() {
		if (!this.manager) return;

		// If any active => stop, else start
		if (this.manager.activeCount() > 0) {
			await this.manager.stopAll();
			new Notice("All file watchers stopped");
		} else {
			await this.manager.startAll();
			new Notice("All file watchers started");
		}
		this.statusbar?.onStatsChanged();
	}

	// Stats helpers
	private ensureMappingStats(mappingId: string) {
		if (!this.stats.perMappingStats[mappingId]) {
			this.stats.perMappingStats[mappingId] = {
				processed: 0,
				skipped: 0,
				errors: 0,
			};
		}
	}

	bumpProcessed(mappingId: string, filePath?: string) {
		this.stats.filesProcessed += 1;
		this.ensureMappingStats(mappingId);
		this.stats.perMappingStats[mappingId].processed += 1;
		this.stats.lastProcessed = filePath
			? truncatePath(filePath)
			: new Date().toISOString();
		this.statusbar?.onStatsChanged();
	}

	bumpSkipped(mappingId: string) {
		this.stats.filesSkipped += 1;
		this.ensureMappingStats(mappingId);
		this.stats.perMappingStats[mappingId].skipped += 1;
		this.statusbar?.onStatsChanged();
	}

	bumpError(mappingId: string) {
		this.stats.errors += 1;
		this.ensureMappingStats(mappingId);
		this.stats.perMappingStats[mappingId].errors += 1;
		this.statusbar?.onStatsChanged();
	}

	/** Apply stats from a completed reconcile operation */
	applyReconcileStats(
		mappingId: string,
		stats: { processed: number; skipped: number; errors: number }
	) {
		this.stats.filesProcessed += stats.processed;
		this.stats.filesSkipped += stats.skipped;
		this.stats.errors += stats.errors;

		this.ensureMappingStats(mappingId);
		this.stats.perMappingStats[mappingId].processed += stats.processed;
		this.stats.perMappingStats[mappingId].skipped += stats.skipped;
		this.stats.perMappingStats[mappingId].errors += stats.errors;

		this.statusbar?.onStatsChanged();
	}

	async syncFile(
		mapping: FolderMapping,
		sourceFilePath: string,
		changeType: SyncChangeType
	) {
		const res = await this.fileSync.syncFile(
			mapping,
			sourceFilePath,
			changeType
		);

		const label = getMappingLabel(mapping);

		if (!res.ok) {
			this.bumpError(mapping.id);
			new Notice(`[${label}] Error: ${res.error.message}`);
			console.error(res.error);
			return;
		}

		if (res.action === "skipped") {
			this.bumpSkipped(mapping.id);
			return;
		}

		// processed
		this.bumpProcessed(mapping.id, sourceFilePath);
		new Notice(`[${label}] ${changeType}: ${sourceFilePath}`);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);

		// Ensure stats object keys exist
		for (const m of this.settings.folderMappings) {
			if (!this.stats.perMappingStats[m.id]) {
				this.stats.perMappingStats[m.id] = {
					processed: 0,
					skipped: 0,
					errors: 0,
				};
			}
		}
	}

	async saveSettings() {
		LogService.debug("Plugin", "saveSettings() called", {
			details: {
				mappingCount: this.settings.folderMappings.length,
				mappings: this.settings.folderMappings.map((m) => ({
					id: m.id,
					description: m.description,
					enabled: m.enabled,
					sourceFolder: m.sourceFolder,
					targetFolder: m.targetFolder,
				})),
			},
		});

		await this.saveData(this.settings);
		this.fileSync.updateSettings(this.settings);
		this.manager?.updateMappings();
		this.statusbar?.onStatsChanged();

		LogService.debug("Plugin", "saveSettings() completed");
	}
}
