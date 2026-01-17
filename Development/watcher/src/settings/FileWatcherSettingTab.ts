import FileWatcherPlugin from "src/main";
import { App, PluginSettingTab, Setting } from "obsidian";
import { FolderMapping } from "../types";
import { FolderMappingModal } from "src/modals/FolderMappingModal";
import { confirmDelete } from "src/modals/ConfirmModal";
import { truncatePath, toVaultPath, makeId } from "src/utils";
import { LogService } from "src/services/LogService";

export class FileWatcherSettingTab extends PluginSettingTab {
	plugin: FileWatcherPlugin;
	private filter = "";

	constructor(app: App, plugin: FileWatcherPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("filewatcher-settings");

		// 1. FOLDER MAPPINGS (most important - at the top)
		this.renderMappingsSection(containerEl);

		// 2. SYNC BEHAVIOR
		this.renderSyncBehaviorSection(containerEl);

		// 3. ONEDRIVE / CLOUD SYNC
		this.renderCloudSyncSection(containerEl);

		// 4. ADVANCED & DEBUG (least important - at the bottom)
		this.renderAdvancedSection(containerEl);
	}

	// =========================================================================
	// SECTION 1: FOLDER MAPPINGS
	// =========================================================================

	private renderMappingsSection(containerEl: HTMLElement) {
		containerEl.createEl("h2", { text: "Folder Mappings" });

		const desc = containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Define which external folders to watch and where to sync files in your vault.",
		});
		desc.style.marginBottom = "1em";

		// Action buttons
		new Setting(containerEl)
			.addButton((b) =>
				b
					.setButtonText("Add Mapping")
					.setCta()
					.onClick(() => this.openNewMappingModal())
			)
			.addButton((b) =>
				b
					.setButtonText("Reconcile All")
					.setTooltip("Sync all enabled mappings now")
					.onClick(() => this.reconcileAllMappings())
			);

		// Search filter (only show if there are mappings)
		if (this.plugin.settings.folderMappings.length > 0) {
			new Setting(containerEl)
				.setName("Filter")
				.addText((t) =>
					t
						.setPlaceholder("Search mappings...")
						.setValue(this.filter)
						.onChange((v) => {
							this.filter = v.trim().toLowerCase();
							this.renderMappingsList(containerEl);
						})
				);
		}

		this.renderMappingsList(containerEl);
	}

	private renderMappingsList(containerEl: HTMLElement) {
		// Remove existing list
		containerEl.querySelectorAll(".filewatcher-mapping-list").forEach((el) => el.remove());

		const listEl = containerEl.createDiv({ cls: "filewatcher-mapping-list" });
		const mappings = this.plugin.settings.folderMappings;

		const filtered = this.filter
			? mappings.filter((m) => {
					const hay = [m.description, m.sourceFolder, m.targetFolder, m.id]
						.filter(Boolean)
						.join(" ")
						.toLowerCase();
					return hay.includes(this.filter);
				})
			: mappings;

		if (filtered.length === 0) {
			const emptyState = listEl.createDiv({ cls: "filewatcher-empty-state" });
			if (mappings.length === 0) {
				emptyState.createEl("p", {
					text: "No folder mappings configured yet.",
				});
				emptyState.createEl("p", {
					text: "Click \"Add Mapping\" to start watching an external folder.",
					cls: "setting-item-description",
				});
			} else {
				emptyState.createEl("p", { text: "No mappings match your filter." });
			}
			return;
		}

		filtered.forEach((m) => this.renderMappingRow(listEl, m));
	}

	private renderMappingRow(container: HTMLElement, m: FolderMapping) {
		const row = container.createDiv({ cls: "filewatcher-mapping-row" });

		const setting = new Setting(row)
			.setName(m.description || "Untitled mapping")
			.setDesc(`${truncatePath(m.sourceFolder)} → ${toVaultPath(m.targetFolder)}`);

		// Enabled toggle
		setting.addToggle((t) =>
			t
				.setTooltip(m.enabled ? "Disable watcher" : "Enable watcher")
				.setValue(m.enabled)
				.onChange(async (v) => {
					m.enabled = v;
					await this.plugin.saveSettings();
				})
		);

		// Edit button
		setting.addExtraButton((b) =>
			b
				.setIcon("pencil")
				.setTooltip("Edit mapping")
				.onClick(() => this.openEditMappingModal(m))
		);

		// Reconcile button
		setting.addExtraButton((b) =>
			b
				.setIcon("refresh-cw")
				.setTooltip("Reconcile now")
				.onClick(() => this.reconcileMapping(m))
		);

		// Delete button
		setting.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip("Delete mapping")
				.onClick(() => this.deleteMapping(m))
		);
	}

	// =========================================================================
	// SECTION 2: SYNC BEHAVIOR
	// =========================================================================

	private renderSyncBehaviorSection(containerEl: HTMLElement) {
		containerEl.createEl("h2", { text: "Sync Behavior" });

		new Setting(containerEl)
			.setName("Sync on startup")
			.setDesc("Automatically reconcile all enabled mappings when Obsidian starts.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.syncOnStart).onChange(async (v) => {
					this.plugin.settings.syncOnStart = v;
					await this.plugin.saveSettings();
				})
			);

		const r = this.plugin.settings.reconcile;

		new Setting(containerEl)
			.setName("Fast skip unchanged files")
			.setDesc("Skip files that haven't changed (based on size and modification time). Recommended.")
			.addToggle((t) =>
				t.setValue(r.fastSkipUnchanged ?? true).onChange(async (v) => {
					r.fastSkipUnchanged = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Show notification per mapping")
			.setDesc("Display a notice when each mapping finishes reconciling.")
			.addToggle((t) =>
				t.setValue(r.notifyOnMappingDone ?? false).onChange(async (v) => {
					r.notifyOnMappingDone = v;
					await this.plugin.saveSettings();
				})
			);
	}

	// =========================================================================
	// SECTION 3: ONEDRIVE / CLOUD SYNC
	// =========================================================================

	private renderCloudSyncSection(containerEl: HTMLElement) {
		containerEl.createEl("h2", { text: "Cloud Sync Compatibility" });

		const desc = containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Settings to improve reliability when watching OneDrive, Dropbox, or other cloud-synced folders.",
		});
		desc.style.marginBottom = "1em";

		new Setting(containerEl)
			.setName("Ignore temporary files")
			.setDesc("Skip Office lock files (~$...) and other temporary files. Recommended for OneDrive.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.ignoreOneDriveTemp).onChange(async (v) => {
					this.plugin.settings.ignoreOneDriveTemp = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Verify file stability before copying")
			.setDesc("Wait until file size and modification time are stable. Prevents copying incomplete downloads.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.verifyFileStability).onChange(async (v) => {
					this.plugin.settings.verifyFileStability = v;
					await this.plugin.saveSettings();
					this.display();
				})
			);

		if (this.plugin.settings.verifyFileStability) {
			new Setting(containerEl)
				.setClass("filewatcher-nested-setting")
				.setName("Check interval")
				.setDesc("Milliseconds between stability checks.")
				.addText((t) =>
					t
						.setValue(String(this.plugin.settings.stabilityCheckInterval))
						.setPlaceholder("200")
						.onChange(async (v) => {
							const n = Number(v);
							if (!Number.isFinite(n) || n < 50) return;
							this.plugin.settings.stabilityCheckInterval = n;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setClass("filewatcher-nested-setting")
				.setName("Required stable readings")
				.setDesc("How many consecutive stable checks before copying.")
				.addText((t) =>
					t
						.setValue(String(this.plugin.settings.stabilityChecks))
						.setPlaceholder("3")
						.onChange(async (v) => {
							const n = Number(v);
							if (!Number.isFinite(n) || n < 1) return;
							this.plugin.settings.stabilityChecks = n;
							await this.plugin.saveSettings();
						})
				);

			const r = this.plugin.settings.reconcile;
			new Setting(containerEl)
				.setClass("filewatcher-nested-setting")
				.setName("Skip stability checks during reconcile")
				.setDesc("Faster batch processing. Files are usually stable during manual reconcile.")
				.addToggle((t) =>
					t.setValue(r.disableStabilityCheckDuringReconcile ?? true).onChange(async (v) => {
						r.disableStabilityCheckDuringReconcile = v;
						await this.plugin.saveSettings();
					})
				);
		}
	}

	// =========================================================================
	// SECTION 4: ADVANCED & DEBUG
	// =========================================================================

	private renderAdvancedSection(containerEl: HTMLElement) {
		containerEl.createEl("h2", { text: "Advanced" });

		const r = this.plugin.settings.reconcile;

		new Setting(containerEl)
			.setName("Reconcile parallelism")
			.setDesc("Number of files processed simultaneously during reconcile. Higher = faster, but may stress disk.")
			.addText((t) =>
				t
					.setValue(String(r.parallelism ?? 8))
					.setPlaceholder("8")
					.onChange(async (v) => {
						const n = Number(v);
						if (!Number.isFinite(n) || n < 1) return;
						r.parallelism = Math.min(64, Math.max(1, Math.floor(n)));
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Progress update throttle")
			.setDesc("Milliseconds between UI updates during reconcile. Higher = faster processing.")
			.addText((t) =>
				t
					.setValue(String(r.progressThrottleMs ?? 250))
					.setPlaceholder("250")
					.onChange(async (v) => {
						const n = Number(v);
						if (!Number.isFinite(n) || n < 0) return;
						r.progressThrottleMs = Math.min(5000, Math.max(0, Math.floor(n)));
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Debug mode")
			.setDesc("Log detailed information to the developer console (Ctrl+Shift+I). Useful for troubleshooting.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.debugMode).onChange(async (v) => {
					this.plugin.settings.debugMode = v;
					LogService.setDebugEnabled(v);
					LogService.configure({
						minLevel: v ? "debug" : "info",
						consoleOutput: v,
					});
					await this.plugin.saveSettings();
					this.plugin.noticeService.show(v ? "Debug mode enabled" : "Debug mode disabled");
				})
			);
	}

	// =========================================================================
	// HELPER METHODS
	// =========================================================================

	private openNewMappingModal() {
		const m = this.createDefaultMapping();

		new FolderMappingModal(this.app, this.plugin, m, "create", async (result) => {
			if (result.saved && result.mapping) {
				// Add the configured mapping to the list
				this.plugin.settings.folderMappings.push(result.mapping);
			}
			// If cancelled or deleted, don't add anything
			await this.plugin.saveSettings();
			this.display();
		}).open();
	}

	private openEditMappingModal(m: FolderMapping) {
		new FolderMappingModal(this.app, this.plugin, m, "edit", async (result) => {
			if (result.deleted) {
				this.plugin.settings.folderMappings = this.plugin.settings.folderMappings.filter(
					(x) => x.id !== m.id
				);
			} else if (result.saved && result.mapping) {
				const index = this.plugin.settings.folderMappings.findIndex(
					(x) => x.id === result.mapping!.id
				);
				if (index >= 0) {
					this.plugin.settings.folderMappings[index] = result.mapping;
				}
			}
			await this.plugin.saveSettings();
			this.display();
		}).open();
	}

	private async reconcileMapping(m: FolderMapping) {
		if (!this.plugin.reconcile) {
			this.plugin.noticeService.error("Reconcile service not available");
			return;
		}
		if (!m.enabled) {
			this.plugin.noticeService.show("Enable the mapping first.");
			return;
		}

		this.plugin.noticeService.show(`Reconciling: ${m.description || m.id}...`);
		await this.plugin.reconcile.reconcileMappings([m], {
			onProgress: (p, meta) => {
				this.plugin.setReconcileSnapshot?.(p);
				this.plugin.statusbar?.setReconcileProgress?.(p, meta);
			},
			onMappingDone: () => {
				this.plugin.statusbar?.onStatsChanged();
			},
		});
		this.plugin.noticeService.success("Reconcile finished.");
	}

	private async reconcileAllMappings() {
		if (!this.plugin.reconcile) {
			this.plugin.noticeService.error("Reconcile service not available");
			return;
		}

		const enabled = this.plugin.settings.folderMappings.filter(
			(m) => m.enabled && m.reconcileOnStart !== false
		);

		if (enabled.length === 0) {
			this.plugin.noticeService.show("No enabled mappings to reconcile.");
			return;
		}

		this.plugin.noticeService.show(`Reconciling ${enabled.length} mapping(s)...`);
		await this.plugin.reconcile.reconcileMappings(enabled, {
			onProgress: (p, meta) => {
				this.plugin.setReconcileSnapshot?.(p);
				this.plugin.statusbar?.setReconcileProgress?.(p, meta);
			},
			onMappingDone: () => {
				this.plugin.statusbar?.onStatsChanged();
			},
		});
		this.plugin.noticeService.success("Reconcile finished.");
	}

	private async deleteMapping(m: FolderMapping) {
		const confirmed = await confirmDelete(
			this.app,
			m.description || m.id,
			"This will stop watching the source folder."
		);

		if (confirmed) {
			this.plugin.settings.folderMappings = this.plugin.settings.folderMappings.filter(
				(x) => x.id !== m.id
			);
			await this.plugin.saveSettings();
			this.plugin.noticeService.show("Mapping deleted");
			this.display();
		}
	}

	private createDefaultMapping(): FolderMapping {
		return {
			id: makeId(),
			enabled: false,
			sourceFolder: "",
			targetFolder: "imported",
			watchSubfolders: true,
			fileExtensions: [],
			conflictResolution: "keepNewer",
			debounceDelay: 800,
			description: "New mapping",
			usePolling: false,
			pollingInterval: 300,
			reconcileOnStart: true,
		};
	}
}
