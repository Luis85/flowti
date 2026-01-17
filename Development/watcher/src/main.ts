import { Plugin } from "obsidian";
import { StatusBarService } from "src/services/StatusBarService";
import { WatcherManager } from "src/watcher/WatcherManager";
import { FileWatcherSettingTab } from "src/settings/FileWatcherSettingTab";
import { FileSyncService } from "src/services/FileSyncService";
import { ReconcileService } from "src/services/ReconcileService";
import { StatsService } from "src/services/StatsService";
import { DashboardModal } from "src/modals/DashboardModal";
import { LogService } from "src/services/LogService";
import { createNoticeService, type INoticeService } from "src/services/NoticeService";
import { FileWatcherSettings, DEFAULT_SETTINGS } from "src/settings/types";
import { ReconcileProgress, FolderMapping, SyncChangeType } from "src/types";
import { getMappingLabel } from "src/utils";

export default class FileWatcherPlugin extends Plugin {
	// Services
	fileSync!: FileSyncService;
	manager!: WatcherManager;
	statusbar!: StatusBarService;
	reconcile!: ReconcileService;
	statsService!: StatsService;
	noticeService!: INoticeService;

	// Settings
	settings!: FileWatcherSettings;

	// Reconcile state
	private reconcileSnapshot: ReconcileProgress | null = null;
	private reconcileSubscribers = new Set<(p: ReconcileProgress | null) => void>();

	/**
	 * Convenience getter for stats (delegates to StatsService)
	 */
	get stats() {
		return this.statsService.stats;
	}

	setReconcileSnapshot(p: ReconcileProgress | null) {
		this.reconcileSnapshot = p;
		// Notify all subscribers
		for (const sub of this.reconcileSubscribers) {
			try {
				sub(p);
			} catch {
				// Ignore subscriber errors
			}
		}
	}

	getReconcileSnapshot() {
		return this.reconcileSnapshot;
	}

	/**
	 * Subscribe to reconcile progress updates
	 * @returns Unsubscribe function
	 */
	subscribeToReconcileProgress(callback: (p: ReconcileProgress | null) => void): () => void {
		this.reconcileSubscribers.add(callback);
		return () => this.reconcileSubscribers.delete(callback);
	}

	openDashboard() {
		new DashboardModal(this).open();
	}

	async onload() {
		try {
			await this.loadSettings();
			this.configureLogging();

			LogService.debug("Plugin", "onload() starting");
			LogService.info("Plugin", "File Watcher plugin loading", {
				details: { mappingCount: this.settings.folderMappings.length },
			});

			this.initializeServices();
			this.registerCommands();
			this.addSettingTab(new FileWatcherSettingTab(this.app, this));

			await this.startPlugin();

			LogService.info("Plugin", "File Watcher plugin loaded");
		} catch (error) {
			this.handleLoadError(error);
		}
	}

	onunload() {
		void this.manager?.stopAll();
		this.statusbar?.destroy();
	}

	/**
	 * Configure LogService based on settings
	 */
	private configureLogging(): void {
		LogService.configure({
			minLevel: this.settings.debugMode ? "debug" : "info",
			consoleOutput: this.settings.debugMode,
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
	}

	/**
	 * Initialize all plugin services
	 */
	private initializeServices(): void {
		// Core services
		this.noticeService = createNoticeService();
		this.fileSync = new FileSyncService(this.app, this.settings);

		// Stats service (initialized before statusbar since statusbar depends on stats)
		this.statsService = new StatsService();
		this.statsService.initializeMappingStats(
			this.settings.folderMappings.map((m) => m.id)
		);

		// Status bar (needs stats reference)
		this.statusbar = new StatusBarService({
			settings: this.settings,
			stats: this.statsService.stats,
			getActiveWatcherCount: () => this.manager?.activeCount() ?? 0,
			openDashboard: () => this.openDashboard(),
			addStatusBarItem: () => this.addStatusBarItem(),
		});

		// Wire up statusbar to stats service for notifications
		this.statsService.setStatusBar(this.statusbar);

		// Reconcile service
		this.reconcile = new ReconcileService(
			{
				settings: this.settings,
				applyReconcileStats: (mappingId, stats) =>
					this.statsService.applyReconcileStats(mappingId, stats),
				setReconcileSnapshot: (p) => this.setReconcileSnapshot(p),
				statusbar: this.statusbar,
			},
			this.fileSync,
			this.noticeService
		);

		// Watcher manager
		this.manager = new WatcherManager({
			app: this.app,
			settings: this.settings,
			statusbar: this.statusbar,
			watcherContext: {
				settings: this.settings,
				stats: this.statsService.stats,
				fileSync: this.fileSync,
				noticeService: this.noticeService,
				bumpProcessed: (mappingId, filePath) =>
					this.statsService.bumpProcessed(mappingId, filePath),
				bumpSkipped: (mappingId) => this.statsService.bumpSkipped(mappingId),
				bumpError: (mappingId) => this.statsService.bumpError(mappingId),
				applyReconcileStats: (mappingId, stats) =>
					this.statsService.applyReconcileStats(mappingId, stats),
				syncFile: (mapping, sourceFilePath, changeType) =>
					this.syncFile(mapping, sourceFilePath, changeType),
			},
		});
	}

	/**
	 * Register plugin commands
	 */
	private registerCommands(): void {
		this.addCommand({
			id: "filewatcher-restart",
			name: "Restart all watchers",
			callback: () => {
				LogService.info("Plugin", "Watchers restart requested");
				this.manager?.updateMappings();
				this.noticeService.show("File watchers restarted");
			},
		});

		this.addCommand({
			id: "filewatcher-dashboard",
			name: "Open Dashboard",
			callback: () => {
				this.openDashboard();
			},
		});
	}

	/**
	 * Start the plugin (reconcile on start, then start watchers)
	 */
	private async startPlugin(): Promise<void> {
		LogService.debug("Plugin", "Starting reconcileOnStart");

		try {
			await this.reconcile.reconcileOnStart();
		} catch (error) {
			LogService.error("Plugin", "reconcileOnStart failed", {
				details: { error: String(error) },
			});
			this.noticeService.error("Reconcile on start failed - check console for details");
		}

		LogService.debug("Plugin", "reconcileOnStart finished, starting watchers");

		try {
			await this.manager.startAll();
		} catch (error) {
			LogService.error("Plugin", "Failed to start watchers", {
				details: { error: String(error) },
			});
			this.noticeService.error("Failed to start some watchers - check console for details");
		}

		this.statusbar?.onStatsChanged();
	}

	/**
	 * Handle critical errors during plugin load
	 */
	private handleLoadError(error: unknown): void {
		const message = error instanceof Error ? error.message : String(error);

		LogService.error("Plugin", "Failed to load plugin", {
			details: { error: message },
		});
	}

	/**
	 * Toggle all watchers on/off
	 */
	async toggleAll() {
		if (!this.manager) return;

		if (this.manager.activeCount() > 0) {
			await this.manager.stopAll();
			this.noticeService.show("All file watchers stopped");
		} else {
			await this.manager.startAll();
			this.noticeService.show("All file watchers started");
		}
		this.statusbar?.onStatsChanged();
	}

	/**
	 * Sync a single file and update stats/UI
	 */
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
			this.statsService.bumpError(mapping.id);
			this.noticeService.error(`[${label}] Error: ${res.error.message}`);
			return;
		}

		if (res.action === "skipped") {
			this.statsService.bumpSkipped(mapping.id);
			return;
		}

		// Processed successfully
		this.statsService.bumpProcessed(mapping.id, sourceFilePath);
		this.noticeService.success(`[${label}] ${changeType}: ${sourceFilePath}`);
	}

	/**
	 * Load settings from storage
	 */
	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	/**
	 * Save settings to storage and propagate changes
	 */
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

		// Initialize stats for any new mappings
		this.statsService.initializeMappingStats(
			this.settings.folderMappings.map((m) => m.id)
		);

		LogService.debug("Plugin", "saveSettings() completed");
	}
}
