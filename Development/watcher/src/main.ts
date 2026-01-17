import { Plugin } from "obsidian";
import { StatusBarService } from "src/services/StatusBarService";
import { WatcherManager } from "src/watcher/WatcherManager";
import { FileWatcherSettingTab } from "src/settings/FileWatcherSettingTab";
import { FileSyncService } from "src/services/FileSyncService";
import { ReconcileService } from "src/services/ReconcileService";
import { StatsService } from "src/services/StatsService";
import { SyncStateService } from "src/services/SyncStateService";
import { DashboardModal } from "src/modals/DashboardModal";
import { LogService } from "src/services/LogService";
import { createNoticeService, type INoticeService } from "src/services/NoticeService";
import { FileWatcherSettings, DEFAULT_SETTINGS } from "src/settings/types";
import { ReconcileProgress, FolderMapping, ChangeType } from "src/types";
import { getMappingLabel } from "src/utils";

/**
 * Main plugin class for the Foreign Folder Watcher.
 *
 * @remarks
 * This plugin monitors external folders outside the Obsidian vault and
 * automatically synchronizes their contents into the vault. It supports:
 *
 * - **Real-time watching**: Monitors folders for file changes using chokidar
 * - **Reconciliation**: Bulk sync to ensure all files are synchronized
 * - **Cloud sync compatibility**: Special handling for OneDrive, Dropbox, etc.
 * - **Conflict resolution**: Multiple strategies (overwrite, skip, rename, keep newer)
 * - **Dashboard**: Visual interface for monitoring and control
 *
 * The plugin is structured around several key services:
 * - {@link FileSyncService}: Core file synchronization logic
 * - {@link ReconcileService}: Bulk reconciliation operations
 * - {@link WatcherManager}: Manages folder watchers
 * - {@link StatsService}: Tracks sync statistics
 * - {@link StatusBarService}: Status bar display
 *
 * @example
 * ```typescript
 * // The plugin is automatically instantiated by Obsidian
 * // Access via app.plugins.plugins['foreign-folder-watcher']
 *
 * // Toggle all watchers
 * plugin.toggleAll();
 *
 * // Open the dashboard
 * plugin.openDashboard();
 *
 * // Access stats
 * console.log(plugin.stats.filesProcessed);
 * ```
 *
 * @category Core
 */
export default class FileWatcherPlugin extends Plugin {
	/** Core file synchronization service */
	fileSync!: FileSyncService;
	/** Manages all folder watchers */
	manager!: WatcherManager;
	/** Status bar display service */
	statusbar!: StatusBarService;
	/** Bulk reconciliation service */
	reconcile!: ReconcileService;
	/** Statistics tracking service */
	statsService!: StatsService;
	/** User notification service */
	noticeService!: INoticeService;
	/** Sync state service for incremental reconciliation */
	syncStateService!: SyncStateService;

	/** Current plugin settings */
	settings!: FileWatcherSettings;

	/** Current reconcile progress snapshot */
	private reconcileSnapshot: ReconcileProgress | null = null;
	/** Subscribers for reconcile progress updates */
	private reconcileSubscribers = new Set<(p: ReconcileProgress | null) => void>();

	/**
	 * Convenience getter for sync statistics.
	 * @returns The current stats object from {@link StatsService}
	 */
	get stats() {
		return this.statsService.stats;
	}

	/**
	 * Updates the reconcile progress snapshot and notifies subscribers.
	 * @param p - The new progress snapshot, or null when complete
	 * @internal
	 */
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

	/**
	 * Gets the current reconcile progress snapshot.
	 * @returns The current progress, or null if no reconcile is running
	 */
	getReconcileSnapshot() {
		return this.reconcileSnapshot;
	}

	/**
	 * Subscribes to reconcile progress updates.
	 *
	 * @param callback - Function called when progress changes
	 * @returns Unsubscribe function to remove the subscription
	 *
	 * @example
	 * ```typescript
	 * const unsubscribe = plugin.subscribeToReconcileProgress((progress) => {
	 *   if (progress) {
	 *     console.log(`Phase: ${progress.phase}, Scanned: ${progress.scanned}`);
	 *   }
	 * });
	 * // Later: unsubscribe();
	 * ```
	 */
	subscribeToReconcileProgress(callback: (p: ReconcileProgress | null) => void): () => void {
		this.reconcileSubscribers.add(callback);
		return () => this.reconcileSubscribers.delete(callback);
	}

	/**
	 * Opens the File Watcher Dashboard modal.
	 */
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

			// Defer expensive operations until workspace is ready
			// This prevents blocking Obsidian's startup
			this.app.workspace.onLayoutReady(() => {
				void this.startPlugin();
			});

			LogService.info("Plugin", "File Watcher plugin loaded");
		} catch (error) {
			this.handleLoadError(error);
		}
	}

	async onunload() {
		void this.manager?.stopAll();
		this.statusbar?.destroy();

		// Save sync state before unloading
		if (this.syncStateService) {
			this.syncStateService.cancelPendingSave();
			try {
				await this.syncStateService.save();
			} catch (error) {
				LogService.warn("Plugin", "Failed to save sync state on unload", {
					details: { error: String(error) },
				});
			}
		}
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

		// Sync state service for incremental reconciliation
		this.syncStateService = new SyncStateService(this.app, this.manifest.id);
		this.fileSync.setSyncStateService(this.syncStateService);

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
				if (!this.app.workspace.layoutReady) return;
				LogService.info("Plugin", "Watchers restart requested");
				this.manager?.updateMappings();
				this.noticeService.show("File watchers restarted");
			},
		});

		this.addCommand({
			id: "filewatcher-dashboard",
			name: "Open Dashboard",
			callback: () => {
				if (!this.app.workspace.layoutReady) return;
				this.openDashboard();
			},
		});
	}

	/**
	 * Start the plugin (reconcile on start, then start watchers)
	 */
	private async startPlugin(): Promise<void> {
		// Load sync state for incremental reconciliation
		try {
			await this.syncStateService.load();
			const { mappingCount, totalFiles } = this.syncStateService.getStats();
			LogService.debug("Plugin", "Sync state loaded", {
				details: { mappingCount, totalFiles },
			});
		} catch (error) {
			LogService.warn("Plugin", "Failed to load sync state", {
				details: { error: String(error) },
			});
		}

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
	 * Toggles all watchers on or off.
	 *
	 * @remarks
	 * If any watchers are running, stops all watchers.
	 * If no watchers are running, starts all enabled watchers.
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
	 * Synchronizes a single file and updates statistics.
	 *
	 * @remarks
	 * This method is called by watchers when a file change is detected.
	 * It delegates to {@link FileSyncService.syncFile} and handles
	 * the result by updating stats and showing notifications.
	 *
	 * @param mapping - The folder mapping configuration
	 * @param sourceFilePath - Absolute path to the source file
	 * @param changeType - Type of change that triggered the sync
	 */
	async syncFile(
		mapping: FolderMapping,
		sourceFilePath: string,
		changeType: ChangeType
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
