import { Notice, Plugin } from "obsidian";
import { StatusBarService } from "src/services/StatusBarService";
import { WatcherManager } from "src/watcher/WatcherManager";
import { FileWatcherSettingTab } from "src/settings/FileWatcherSettingTab";
import { FileSyncService } from "src/services/FileSyncService";
import { ReconcileService } from "src/services/ReconcileService";
import { ReconcileProgressModal } from "src/modals/ReconcileProgressModal";
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

	openReconcileModal() {
		new ReconcileProgressModal(this).open();
	}

	async onload() {
		await this.loadSettings();
		this.fileSync = new FileSyncService(this.app, this.settings);
		this.reconcile = new ReconcileService(this, this.fileSync);
		this.manager = new WatcherManager(this);
		this.statusbar = new StatusBarService(this);

		this.addRibbonIcon("folder-sync", "Toggle File Watcher", () => {
			void this.toggleAll();
		});

		this.addCommand({
			id: "filewatcher-restart",
			name: "Restart all watchers",
			callback: () => {
				this.manager?.updateMappings();
				new Notice("File watchers restarted");
			},
		});

		this.addSettingTab(new FileWatcherSettingTab(this.app, this));

		void this.reconcile.reconcileOnStart().finally(() => {
			this.manager.startAll();
			this.statusbar?.onStatsChanged();
		});
		new Notice("File watcher plugin loaded");
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
			this.manager.startAll();
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
		await this.saveData(this.settings);
		this.fileSync.updateSettings(this.settings);
		this.manager?.updateMappings();
		this.statusbar?.onStatsChanged();
	}
}
