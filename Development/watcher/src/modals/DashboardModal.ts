import { Modal, Setting, setIcon } from "obsidian";
import type FileWatcherPlugin from "src/main";
import { truncatePath } from "src/utils";
import { LogService, LogEntry, LogLevel } from "src/services/LogService";
import type { WatcherInfo } from "src/watcher/WatcherManager";
import { FolderMappingModal, createNewMapping } from "./FolderMappingModal";

type TabId = "overview" | "watchers" | "logs";

export class DashboardModal extends Modal {
	private plugin: FileWatcherPlugin;
	private timer: number | null = null;
	private currentTab: TabId = "overview";
	private logUnsubscribe: (() => void) | null = null;
	private reconcileUnsubscribe: (() => void) | null = null;

	// UI Elements
	private tabContainer!: HTMLElement;
	private contentContainer!: HTMLElement;

	// Track if action is in progress to prevent double-clicks
	private actionInProgress = false;

	// Log filter state
	private logFilter: {
		levels: Set<LogLevel>;
		search: string;
	} = {
		levels: new Set(["info", "warn", "error"]),
		search: "",
	};

	// Cache for log scroll position
	private logScrollTop = 0;

	// Last rendered log count to detect changes
	private lastLogCount = 0;

	constructor(plugin: FileWatcherPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		this.modalEl.addClass("filewatcher-modal");
		contentEl.empty();
		contentEl.addClass("filewatcher-dashboard");

		// Header
		const header = contentEl.createDiv({ cls: "dashboard-header" });
		header.createEl("h2", { text: "File Watcher Dashboard" });

		// Tabs
		this.tabContainer = contentEl.createDiv({ cls: "dashboard-tabs" });
		this.renderTabs();

		// Content area
		this.contentContainer = contentEl.createDiv({
			cls: "dashboard-content",
		});

		// Footer with close button
		new Setting(contentEl).addButton((b) =>
			b.setButtonText("Close").onClick(() => this.close())
		);

		// Subscribe to log updates - only update if on logs tab
		this.logUnsubscribe = LogService.subscribe(() => {
			if (this.currentTab === "logs") {
				this.updateLogList();
			}
		});

		// Subscribe to reconcile progress updates for immediate UI feedback
		this.reconcileUnsubscribe = this.plugin.subscribeToReconcileProgress(() => {
			if (this.currentTab === "overview") {
				this.updateReconcileStatus();
			}
		});

		// Poll UI for stats updates - use slower interval and smarter updates
		this.timer = window.setInterval(() => this.updateContent(), 1000);
		this.renderContent();
	}

	onClose() {
		if (this.timer) window.clearInterval(this.timer);
		this.timer = null;
		if (this.logUnsubscribe) this.logUnsubscribe();
		this.logUnsubscribe = null;
		if (this.reconcileUnsubscribe) this.reconcileUnsubscribe();
		this.reconcileUnsubscribe = null;
		this.contentEl.empty();
	}

	private renderTabs() {
		this.tabContainer.empty();

		const tabs: { id: TabId; label: string; icon: string }[] = [
			{ id: "overview", label: "Overview", icon: "layout-dashboard" },
			{ id: "watchers", label: "Watchers", icon: "eye" },
			{ id: "logs", label: "Logs", icon: "scroll-text" },
		];

		for (const tab of tabs) {
			const tabEl = this.tabContainer.createDiv({
				cls: `dashboard-tab ${this.currentTab === tab.id ? "active" : ""}`,
			});

			setIcon(tabEl.createSpan({ cls: "tab-icon" }), tab.icon);
			tabEl.createSpan({ cls: "tab-label", text: tab.label });

			// Add badge for logs with errors
			if (tab.id === "logs") {
				const counts = LogService.getCounts();
				if (counts.error > 0) {
					tabEl.createSpan({
						cls: "tab-badge error",
						text: String(counts.error),
					});
				}
			}

			tabEl.addEventListener("click", () => {
				if (this.currentTab !== tab.id) {
					this.currentTab = tab.id;
					this.renderTabs();
					this.renderContent();
				}
			});
		}
	}

	private renderContent() {
		this.contentContainer.empty();

		switch (this.currentTab) {
			case "overview":
				this.renderOverview();
				break;
			case "watchers":
				this.renderWatchers();
				break;
			case "logs":
				this.renderLogs();
				break;
		}
	}

	/**
	 * Incremental update - only update values, not rebuild DOM
	 */
	private updateContent() {
		if (this.actionInProgress) return;

		switch (this.currentTab) {
			case "overview":
				this.updateOverviewValues();
				break;
			case "watchers":
				this.updateWatcherValues();
				break;
			case "logs":
				// Logs are updated via subscription, just update counts
				this.updateLogCounts();
				break;
		}
	}

	private renderOverview() {
		const container = this.contentContainer;

		// Global controls
		const controlsSection = container.createDiv({ cls: "dashboard-section" });
		controlsSection.createEl("h3", { text: "Controls" });

		const controlsRow = controlsSection.createDiv({ cls: "controls-row" });

		// Start/Stop All button
		const toggleAllBtn = controlsRow.createEl("button", {
			cls: "control-btn",
			attr: { "data-action": "toggle-all" },
		});
		toggleAllBtn.createSpan({ cls: "btn-icon" });
		toggleAllBtn.createSpan({ cls: "btn-text" });
		toggleAllBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			void this.handleToggleAll();
		});

		// Reconcile All button
		const reconcileAllBtn = controlsRow.createEl("button", {
			cls: "control-btn",
			attr: { "data-action": "reconcile-all" },
		});
		reconcileAllBtn.createSpan({ cls: "btn-icon" });
		reconcileAllBtn.createSpan({ cls: "btn-text" });
		reconcileAllBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			void this.handleReconcileAll();
		});

		// Cancel button container (will be shown/hidden)
		const cancelBtnContainer = controlsRow.createDiv({
			cls: "cancel-btn-container",
			attr: { "data-action": "cancel-container" },
		});
		const cancelBtn = cancelBtnContainer.createEl("button", {
			cls: "control-btn danger",
		});
		setIcon(cancelBtn.createSpan({ cls: "btn-icon" }), "x");
		cancelBtn.createSpan({ cls: "btn-text", text: "Cancel" });
		cancelBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.plugin.reconcile?.cancel();
			this.plugin.noticeService.show("Reconcile cancelled");
		});

		// Stats summary
		const statsSection = container.createDiv({ cls: "dashboard-section" });
		statsSection.createEl("h3", { text: "Statistics" });

		const statsGrid = statsSection.createDiv({ cls: "stats-grid" });

		this.createStatCard(statsGrid, "Active Watchers", "0", "eye", undefined, "stat-active");
		this.createStatCard(statsGrid, "Processed", "0", "check-circle", "success", "stat-processed");
		this.createStatCard(statsGrid, "Skipped", "0", "skip-forward", "warning", "stat-skipped");
		this.createStatCard(statsGrid, "Errors", "0", "alert-circle", "error", "stat-errors");

		// Queue status
		const queueSection = container.createDiv({ cls: "dashboard-section" });
		queueSection.createEl("h3", { text: "Queue Status" });

		const queueGrid = queueSection.createDiv({ cls: "stats-grid" });
		this.createStatCard(queueGrid, "Pending Files", "0", "file-clock", undefined, "stat-pending-files");
		this.createStatCard(queueGrid, "Pending Dirs", "0", "folder-clock", undefined, "stat-pending-dirs");
		this.createStatCard(queueGrid, "Dropped Jobs", "0", "trash-2", undefined, "stat-dropped");

		// Reconcile status
		const reconcileSection = container.createDiv({ cls: "dashboard-section" });
		reconcileSection.createEl("h3", { text: "Reconcile Status" });
		reconcileSection.createDiv({ cls: "reconcile-status-content" });

		// Recent activity
		const recentSection = container.createDiv({ cls: "dashboard-section" });
		recentSection.createEl("h3", { text: "Recent Activity" });
		recentSection.createDiv({ cls: "recent-logs" });

		// Initial update
		this.updateOverviewValues();
	}

	private updateOverviewValues() {
		const container = this.contentContainer;
		const activeWatchers = this.plugin.manager?.activeCount() ?? 0;
		const stats = this.plugin.stats;
		const queueStats = this.plugin.manager?.getTotalQueueStats() ?? {
			pendingFiles: 0,
			pendingDirs: 0,
			droppedJobs: 0,
		};

		// Update toggle button
		const toggleBtn = container.querySelector('[data-action="toggle-all"]') as HTMLElement;
		if (toggleBtn) {
			toggleBtn.className = `control-btn ${activeWatchers > 0 ? "warning" : "success"}`;
			const icon = toggleBtn.querySelector(".btn-icon") as HTMLElement;
			const text = toggleBtn.querySelector(".btn-text") as HTMLElement;
			if (icon) {
				icon.empty();
				setIcon(icon, activeWatchers > 0 ? "pause" : "play");
			}
			if (text) text.setText(activeWatchers > 0 ? "Stop All" : "Start All");
		}

		// Update stat values
		this.updateStatValue(container, "stat-active", String(activeWatchers));
		this.updateStatValue(container, "stat-processed", String(stats.filesProcessed));
		this.updateStatValue(container, "stat-skipped", String(stats.filesSkipped));
		this.updateStatValue(container, "stat-errors", String(stats.errors));
		this.updateStatValue(container, "stat-pending-files", String(queueStats.pendingFiles));
		this.updateStatValue(container, "stat-pending-dirs", String(queueStats.pendingDirs));
		this.updateStatValue(container, "stat-dropped", String(queueStats.droppedJobs));

		// Update dropped jobs styling
		const droppedCard = container.querySelector(".stat-dropped")?.closest(".stat-card");
		if (droppedCard) {
			droppedCard.classList.toggle("warning", queueStats.droppedJobs > 0);
		}

		// Update reconcile status section
		this.updateReconcileStatus();

		// Update recent logs
		const recentLogsContainer = container.querySelector(".recent-logs");
		if (recentLogsContainer) {
			recentLogsContainer.empty();
			const recentLogs = LogService.getRecentLogs(5);
			if (recentLogs.length > 0) {
				for (const log of recentLogs) {
					this.renderLogEntry(recentLogsContainer as HTMLElement, log, true);
				}
			} else {
				recentLogsContainer.createDiv({
					cls: "no-logs",
					text: "No recent activity",
				});
			}
		}
	}

	private updateStatValue(container: HTMLElement, dataId: string, value: string) {
		const el = container.querySelector(`.${dataId}`) as HTMLElement;
		if (el) el.setText(value);
	}

	/**
	 * Update reconcile status section and related UI elements
	 * Called both by polling and by subscription for immediate feedback
	 */
	private updateReconcileStatus() {
		const container = this.contentContainer;
		const isReconciling = this.plugin.reconcile?.isRunning() ?? false;
		const reconcile = this.plugin.getReconcileSnapshot?.();

		// Update reconcile button state
		const reconcileBtn = container.querySelector('[data-action="reconcile-all"]') as HTMLElement;
		if (reconcileBtn) {
			reconcileBtn.className = `control-btn ${isReconciling ? "disabled" : "primary"}`;
			const icon = reconcileBtn.querySelector(".btn-icon") as HTMLElement;
			const text = reconcileBtn.querySelector(".btn-text") as HTMLElement;
			if (icon) {
				icon.empty();
				setIcon(icon, "refresh-cw");
			}
			if (text) text.setText(isReconciling ? "Reconciling..." : "Reconcile All");
		}

		// Show/hide cancel button
		const cancelContainer = container.querySelector('[data-action="cancel-container"]') as HTMLElement;
		if (cancelContainer) {
			cancelContainer.style.display = isReconciling ? "block" : "none";
		}

		// Update reconcile status content
		const reconcileContent = container.querySelector(".reconcile-status-content");
		if (reconcileContent) {
			reconcileContent.empty();
			if (reconcile && reconcile.phase !== "idle" && reconcile.phase !== "done") {
				const progress = reconcileContent.createDiv({ cls: "reconcile-progress" });
				progress.createDiv({ text: `Mapping: ${reconcile.mappingLabel}` });
				progress.createDiv({ text: `Phase: ${reconcile.phase}` });

				const total = reconcile.total ?? 0;
				const scannedText = total > 0 ? `${reconcile.scanned}/${total}` : String(reconcile.scanned);
				progress.createDiv({ text: `Scanned: ${scannedText}` });

				const statsLine = progress.createDiv({ cls: "reconcile-stats" });
				statsLine.createSpan({ cls: "stat success", text: `✅ ${reconcile.processed}` });
				statsLine.createSpan({ cls: "stat warning", text: `⏭️ ${reconcile.skipped}` });
				statsLine.createSpan({ cls: "stat error", text: `⚠️ ${reconcile.errors}` });

				if (reconcile.current) {
					progress.createDiv({
						cls: "current-file",
						text: `Current: ${truncatePath(reconcile.current, 60)}`,
					});
				}
			} else {
				reconcileContent.createDiv({
					cls: "no-reconcile",
					text: "No reconcile running",
				});
			}
		}
	}

	private async handleToggleAll() {
		if (this.actionInProgress) return;
		this.actionInProgress = true;

		try {
			const activeWatchers = this.plugin.manager?.activeCount() ?? 0;
			if (activeWatchers > 0) {
				await this.plugin.manager?.stopAll();
				this.plugin.noticeService.show("All watchers stopped");
			} else {
				await this.plugin.manager?.startAll();
				this.plugin.noticeService.show("All watchers started");
			}
			this.updateOverviewValues();
		} finally {
			this.actionInProgress = false;
		}
	}

	private async handleReconcileAll() {
		if (this.actionInProgress) return;
		const isReconciling = this.plugin.reconcile?.isRunning() ?? false;
		if (isReconciling) return;

		this.actionInProgress = true;
		try {
			await this.plugin.reconcile?.reconcileAll();
		} finally {
			this.actionInProgress = false;
		}
	}

	private renderWatchers() {
		const container = this.contentContainer;

		// Header with "New Mapping" button
		const headerSection = container.createDiv({ cls: "watchers-header" });
		const newMappingBtn = headerSection.createEl("button", {
			cls: "control-btn success",
		});
		setIcon(newMappingBtn.createSpan({ cls: "btn-icon" }), "folder-plus");
		newMappingBtn.createSpan({ cls: "btn-text", text: "New Mapping" });
		newMappingBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.openNewMappingModal();
		});

		const watcherInfos = this.plugin.manager?.getWatcherInfos() ?? [];

		if (watcherInfos.length === 0) {
			container.createDiv({
				cls: "no-watchers",
				text: "No folder mappings configured. Click 'New Mapping' to create one.",
			});
			return;
		}

		for (const info of watcherInfos) {
			this.renderWatcherCard(container, info);
		}
	}

	private updateWatcherValues() {
		const container = this.contentContainer;
		const watcherInfos = this.plugin.manager?.getWatcherInfos() ?? [];
		const isReconciling = this.plugin.reconcile?.isRunning() ?? false;

		for (const info of watcherInfos) {
			const card = container.querySelector(`[data-mapping-id="${info.mappingId}"]`);
			if (!card) continue;

			// Update state indicator based on health
			const stateIndicator = card.querySelector(".status-indicator") as HTMLElement;
			if (stateIndicator) {
				stateIndicator.className = `status-indicator ${info.health}`;
				stateIndicator.empty();
				setIcon(
					stateIndicator,
					info.health === "healthy" ? "check-circle" :
					info.health === "warning" ? "alert-triangle" :
					info.health === "error" ? "alert-circle" : "clock"
				);
			}

			// Update state badge
			const stateBadge = card.querySelector(".watcher-state") as HTMLElement;
			if (stateBadge) {
				stateBadge.className = `watcher-state ${info.state}`;
				stateBadge.setText(info.state);
			}

			// Update health badge
			const healthBadge = card.querySelector(".watcher-health") as HTMLElement;
			if (healthBadge) {
				healthBadge.className = `watcher-health ${info.health}`;
				healthBadge.setText(info.health);
				if (info.lastActivity) {
					healthBadge.setAttribute("title", `Last activity: ${new Date(info.lastActivity).toLocaleTimeString()}`);
				}
			}

			// Update queue stats
			const queueEl = card.querySelector(".watcher-queue") as HTMLElement;
			if (queueEl) {
				queueEl.empty();
				queueEl.createSpan({ text: `Pending: ${info.queueStats.pendingFiles} files, ${info.queueStats.pendingDirs} dirs` });
				if (info.queueStats.droppedJobs > 0) {
					queueEl.createSpan({
						cls: "dropped-warning",
						text: ` (${info.queueStats.droppedJobs} dropped)`,
					});
				}
			}

			// Update per-mapping stats
			const mappingStats = this.plugin.stats.perMappingStats[info.mappingId];
			const statsRow = card.querySelector(".watcher-stats") as HTMLElement;
			if (statsRow && mappingStats) {
				statsRow.empty();
				statsRow.createSpan({ cls: "stat success", text: `✅ ${mappingStats.processed}` });
				statsRow.createSpan({ cls: "stat warning", text: `⏭️ ${mappingStats.skipped}` });
				statsRow.createSpan({ cls: "stat error", text: `⚠️ ${mappingStats.errors}` });
			}

			// Update toggle button
			const toggleBtn = card.querySelector(".watcher-toggle-btn") as HTMLElement;
			if (toggleBtn) {
				toggleBtn.className = `watcher-btn watcher-toggle-btn ${info.state === "running" ? "warning" : "success"}`;
				const icon = toggleBtn.querySelector(".btn-icon") as HTMLElement;
				const text = toggleBtn.querySelector(".btn-text") as HTMLElement;
				if (icon) {
					icon.empty();
					setIcon(icon, info.state === "running" ? "pause" : "play");
				}
				if (text) text.setText(info.state === "running" ? "Stop" : "Start");
			}

			// Update reconcile button
			const reconcileBtn = card.querySelector(".watcher-reconcile-btn") as HTMLElement;
			if (reconcileBtn) {
				reconcileBtn.className = `watcher-btn watcher-reconcile-btn ${isReconciling ? "disabled" : "primary"}`;
			}
		}
	}

	private renderWatcherCard(container: HTMLElement, info: WatcherInfo) {
		const card = container.createDiv({
			cls: "watcher-card",
			attr: { "data-mapping-id": info.mappingId },
		});

		// Header with status indicator
		const header = card.createDiv({ cls: "watcher-header" });

		const statusIndicator = header.createSpan({
			cls: `status-indicator ${info.health}`,
		});
		setIcon(
			statusIndicator,
			info.health === "healthy" ? "check-circle" :
			info.health === "warning" ? "alert-triangle" :
			info.health === "error" ? "alert-circle" : "clock"
		);

		header.createSpan({
			cls: "watcher-name",
			text: info.mappingDescription,
		});

		header.createSpan({
			cls: `watcher-state ${info.state}`,
			text: info.state,
		});

		// Health badge with last activity
		const healthBadge = header.createSpan({
			cls: `watcher-health ${info.health}`,
			text: info.health,
		});
		if (info.lastActivity) {
			healthBadge.setAttribute("title", `Last activity: ${new Date(info.lastActivity).toLocaleTimeString()}`);
		}

		// Details
		const details = card.createDiv({ cls: "watcher-details" });

		details.createDiv({
			cls: "detail-row",
			text: `Source: ${truncatePath(info.sourceFolder, 50)}`,
		});
		details.createDiv({
			cls: "detail-row",
			text: `Target: ${info.targetFolder}`,
		});

		// Queue stats for this watcher
		const queueStats = card.createDiv({ cls: "watcher-queue" });
		queueStats.createSpan({ text: `Pending: ${info.queueStats.pendingFiles} files, ${info.queueStats.pendingDirs} dirs` });
		if (info.queueStats.droppedJobs > 0) {
			queueStats.createSpan({
				cls: "dropped-warning",
				text: ` (${info.queueStats.droppedJobs} dropped)`,
			});
		}

		// Per-mapping stats
		const mappingStats = this.plugin.stats.perMappingStats[info.mappingId];
		const statsRow = card.createDiv({ cls: "watcher-stats" });
		if (mappingStats) {
			statsRow.createSpan({ cls: "stat success", text: `✅ ${mappingStats.processed}` });
			statsRow.createSpan({ cls: "stat warning", text: `⏭️ ${mappingStats.skipped}` });
			statsRow.createSpan({ cls: "stat error", text: `⚠️ ${mappingStats.errors}` });
		}

		// Control buttons
		const controls = card.createDiv({ cls: "watcher-controls" });
		const isReconciling = this.plugin.reconcile?.isRunning() ?? false;

		// Start/Stop button - capture mappingId in closure
		const mappingId = info.mappingId;
		const mappingDesc = info.mappingDescription;

		const toggleBtn = controls.createEl("button", {
			cls: `watcher-btn watcher-toggle-btn ${info.state === "running" ? "warning" : "success"}`,
		});
		setIcon(toggleBtn.createSpan({ cls: "btn-icon" }), info.state === "running" ? "pause" : "play");
		toggleBtn.createSpan({
			cls: "btn-text",
			text: info.state === "running" ? "Stop" : "Start",
		});
		toggleBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			void this.handleWatcherToggle(mappingId, mappingDesc);
		});

		// Reconcile button
		const reconcileBtn = controls.createEl("button", {
			cls: `watcher-btn watcher-reconcile-btn ${isReconciling ? "disabled" : "primary"}`,
		});
		setIcon(reconcileBtn.createSpan({ cls: "btn-icon" }), "refresh-cw");
		reconcileBtn.createSpan({ cls: "btn-text", text: "Reconcile" });
		reconcileBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			void this.handleWatcherReconcile(mappingId);
		});

		// Edit button
		const editBtn = controls.createEl("button", {
			cls: "watcher-btn watcher-edit-btn",
		});
		setIcon(editBtn.createSpan({ cls: "btn-icon" }), "pencil");
		editBtn.createSpan({ cls: "btn-text", text: "Edit" });
		editBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.openEditMappingModal(mappingId);
		});
	}

	private async handleWatcherToggle(mappingId: string, mappingDesc: string) {
		if (this.actionInProgress) return;
		this.actionInProgress = true;

		try {
			const isRunning = this.plugin.manager?.isWatcherRunning(mappingId) ?? false;
			if (isRunning) {
				await this.plugin.manager?.stopWatcher(mappingId);
				this.plugin.noticeService.show(`Watcher stopped: ${mappingDesc}`);
			} else {
				await this.plugin.manager?.startWatcher(mappingId);
				this.plugin.noticeService.show(`Watcher started: ${mappingDesc}`);
			}
			this.updateWatcherValues();
		} finally {
			this.actionInProgress = false;
		}
	}

	private async handleWatcherReconcile(mappingId: string) {
		if (this.actionInProgress) return;
		const isReconciling = this.plugin.reconcile?.isRunning() ?? false;
		if (isReconciling) return;

		this.actionInProgress = true;
		try {
			await this.plugin.reconcile?.reconcileSingleMapping(mappingId);
		} finally {
			this.actionInProgress = false;
		}
	}

	private openNewMappingModal() {
		const newMapping = createNewMapping();
		new FolderMappingModal(
			this.app,
			this.plugin,
			newMapping,
			"create",
			async (result) => {
				if (result.saved && result.mapping) {
					// Add the new mapping to settings
					this.plugin.settings.folderMappings.push(result.mapping);
					await this.plugin.saveSettings();
					// Re-render the watchers tab
					this.renderContent();
				}
			}
		).open();
	}

	private openEditMappingModal(mappingId: string) {
		const mapping = this.plugin.settings.folderMappings.find(
			(m) => m.id === mappingId
		);
		if (!mapping) {
			this.plugin.noticeService.error("Mapping not found");
			return;
		}

		new FolderMappingModal(
			this.app,
			this.plugin,
			mapping,
			"edit",
			async (result) => {
				if (result.deleted && result.mapping) {
					// Remove the mapping from settings
					const index = this.plugin.settings.folderMappings.findIndex(
						(m) => m.id === result.mapping!.id
					);
					if (index >= 0) {
						this.plugin.settings.folderMappings.splice(index, 1);
						await this.plugin.saveSettings();
					}
					// Re-render the watchers tab
					this.renderContent();
				} else if (result.saved && result.mapping) {
					// Update the mapping in settings
					const index = this.plugin.settings.folderMappings.findIndex(
						(m) => m.id === result.mapping!.id
					);
					if (index >= 0) {
						this.plugin.settings.folderMappings[index] = result.mapping;
						await this.plugin.saveSettings();
					}
					// Re-render the watchers tab
					this.renderContent();
				}
			}
		).open();
	}

	private renderLogs() {
		const container = this.contentContainer;

		// Filter controls
		const filterSection = container.createDiv({ cls: "log-filters" });

		// Level filters
		const levelFilters = filterSection.createDiv({ cls: "level-filters" });
		const levels: LogLevel[] = ["debug", "info", "warn", "error"];

		for (const level of levels) {
			const btn = levelFilters.createEl("button", {
				cls: `level-btn ${level} ${this.logFilter.levels.has(level) ? "active" : ""}`,
				text: level,
			});
			btn.addEventListener("click", (e) => {
				e.preventDefault();
				if (this.logFilter.levels.has(level)) {
					this.logFilter.levels.delete(level);
				} else {
					this.logFilter.levels.add(level);
				}
				btn.classList.toggle("active", this.logFilter.levels.has(level));
				this.updateLogList();
			});
		}

		// Search input
		const searchInput = filterSection.createEl("input", {
			cls: "log-search",
			type: "text",
			placeholder: "Search logs...",
			value: this.logFilter.search,
		});
		searchInput.addEventListener("input", (e) => {
			this.logFilter.search = (e.target as HTMLInputElement).value;
			this.updateLogList();
		});

		// Clear button
		const clearBtn = filterSection.createEl("button", {
			cls: "clear-logs-btn",
			text: "Clear All",
		});
		clearBtn.addEventListener("click", (e) => {
			e.preventDefault();
			LogService.clear();
			this.updateLogList();
		});

		// Log list
		const logList = container.createDiv({ cls: "log-list" });

		// Log count
		const countInfo = container.createDiv({ cls: "log-counts" });

		// Initial render
		this.updateLogList();
	}

	private updateLogList() {
		const container = this.contentContainer;
		const logList = container.querySelector(".log-list") as HTMLElement;
		if (!logList) return;

		// Save scroll position
		this.logScrollTop = logList.scrollTop;

		logList.empty();

		const filteredLogs = LogService.getRecentLogs(100, {
			levels: Array.from(this.logFilter.levels),
			search: this.logFilter.search || undefined,
		});

		if (filteredLogs.length === 0) {
			logList.createDiv({
				cls: "no-logs",
				text: "No logs matching filters",
			});
		} else {
			for (const log of filteredLogs) {
				this.renderLogEntry(logList, log);
			}
		}

		// Restore scroll position
		logList.scrollTop = this.logScrollTop;

		this.updateLogCounts();
	}

	private updateLogCounts() {
		const container = this.contentContainer;
		const countInfo = container.querySelector(".log-counts") as HTMLElement;
		if (countInfo) {
			const counts = LogService.getCounts();
			countInfo.setText(
				`Total: ${LogService.count} | Debug: ${counts.debug} | Info: ${counts.info} | Warn: ${counts.warn} | Error: ${counts.error}`
			);
		}

		// Update tab badge
		this.renderTabs();
	}

	private renderLogEntry(container: HTMLElement, log: LogEntry, compact = false) {
		const entry = container.createDiv({ cls: `log-entry ${log.level}` });

		if (!compact) {
			const time = entry.createSpan({ cls: "log-time" });
			time.setText(this.formatTime(log.timestamp));
		}

		const levelBadge = entry.createSpan({ cls: `log-level ${log.level}` });
		levelBadge.setText(log.level.toUpperCase());

		const category = entry.createSpan({ cls: "log-category" });
		category.setText(`[${log.category}]`);

		const message = entry.createSpan({ cls: "log-message" });
		message.setText(log.message);

		if (log.filePath && !compact) {
			const filePath = entry.createDiv({ cls: "log-filepath" });
			filePath.setText(truncatePath(log.filePath, 80));
		}

		if (log.details && !compact) {
			const details = entry.createDiv({ cls: "log-details" });
			details.setText(JSON.stringify(log.details, null, 2));
		}
	}

	private createStatCard(
		container: HTMLElement,
		label: string,
		value: string,
		icon: string,
		variant?: "success" | "warning" | "error",
		valueClass?: string
	) {
		const card = container.createDiv({
			cls: `stat-card ${variant ?? ""}`,
		});

		const iconEl = card.createDiv({ cls: "stat-icon" });
		setIcon(iconEl, icon);

		const content = card.createDiv({ cls: "stat-content" });
		content.createDiv({ cls: `stat-value ${valueClass ?? ""}`, text: value });
		content.createDiv({ cls: "stat-label", text: label });
	}

	private formatTime(date: Date): string {
		return date.toLocaleTimeString("de-DE", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	}
}
