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
			? this.toVaultSafeString(filePath)
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

		if (!res.ok) {
			this.bumpError(mapping.id);
			new Notice(
				`[${mapping.description || mapping.id}] Error: ${
					res.error.message
				}`
			);
			console.error(res.error)
			return;
		}

		if (res.action === "skipped") {
			this.bumpSkipped(mapping.id);
			return;
		}

		// processed
		this.bumpProcessed(mapping.id, sourceFilePath);

		new Notice(
			`[${
				mapping.description || mapping.id
			}] ${changeType}: ${sourceFilePath}`
		);
	}

	private toVaultSafeString(p: string): string {
		// just for display
		return p.length > 60 ? `…${p.slice(-60)}` : p;
	}

	async ensureFolder(folderPath: string) {
		const fp = folderPath.replace(/\\/g, "/");
		const parts = fp.split("/").filter(Boolean);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!(await this.app.vault.adapter.exists(current))) {
				await this.app.vault.createFolder(current);
			}
		}
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
