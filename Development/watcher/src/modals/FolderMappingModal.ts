import FileWatcherPlugin from "src/main";
import { App, Modal, Setting, setIcon, TextComponent } from "obsidian";
import { FolderMapping, ConflictResolution, SyncDirection } from "src/types";
import { pickFolder, isFolderPickerAvailable } from "src/services/FolderPickerService";
import { confirmDelete } from "./ConfirmModal";

export type MappingModalMode = "create" | "edit";

export interface MappingModalResult {
	saved: boolean;
	deleted?: boolean;
	mapping?: FolderMapping;
}

export class FolderMappingModal extends Modal {
	private plugin: FileWatcherPlugin;
	private mapping: FolderMapping;
	private mode: MappingModalMode;
	private onComplete: (result: MappingModalResult) => void;
	private hasChanges = false;

	constructor(
		app: App,
		plugin: FileWatcherPlugin,
		mapping: FolderMapping,
		mode: MappingModalMode,
		onComplete: (result: MappingModalResult) => void
	) {
		super(app);
		this.plugin = plugin;
		this.mapping = { ...mapping }; // Clone to avoid modifying original
		this.mode = mode;
		this.onComplete = onComplete;
	}

	onOpen() {
		const { contentEl } = this;
		this.modalEl.addClass("filewatcher-modal");
		contentEl.empty();
		contentEl.addClass("filewatcher-mapping-modal");

		this.renderHeader();
		this.renderBasicSettings();
		this.renderPathSettings();
		this.renderSyncDirectionSettings();
		this.renderSyncSettings();
		this.renderAdvancedSettings();
		this.renderFooter();
	}

	private renderHeader() {
		const { contentEl } = this;

		const header = contentEl.createDiv({ cls: "mapping-modal-header" });

		const iconEl = header.createDiv({ cls: "header-icon" });
		setIcon(iconEl, this.mode === "create" ? "folder-plus" : "folder-cog");

		const titleArea = header.createDiv({ cls: "header-title-area" });
		titleArea.createEl("h2", {
			text: this.mode === "create" ? "New Folder Mapping" : "Edit Folder Mapping",
		});

		if (this.mode === "edit" && this.mapping.description) {
			titleArea.createDiv({
				cls: "header-subtitle",
				text: this.mapping.description,
			});
		}
	}

	private renderBasicSettings() {
		const { contentEl } = this;

		const section = this.createSection(contentEl, "Basic Settings", "settings");

		new Setting(section)
			.setName("Enabled")
			.setDesc("Start this watcher when the plugin runs")
			.addToggle((t) =>
				t
					.setValue(this.mapping.enabled)
					.onChange((v) => {
						this.mapping.enabled = v;
						this.hasChanges = true;
					})
			);

		new Setting(section)
			.setName("Description")
			.setDesc("A friendly name shown in the dashboard and status bar")
			.addText((t) =>
				t
					.setPlaceholder("e.g., OneDrive Documents")
					.setValue(this.mapping.description)
					.onChange((v) => {
						this.mapping.description = v;
						this.hasChanges = true;
					})
			);
	}

	private renderPathSettings() {
		const { contentEl } = this;

		const section = this.createSection(contentEl, "Folder Paths", "folder");

		// Source Folder with native picker
		let sourceTextComponent: TextComponent;
		const sourceRow = new Setting(section)
			.setName("Source Folder")
			.setDesc("The external folder to watch (absolute path)")
			.addText((t) => {
				sourceTextComponent = t;
				t.setPlaceholder("C:\\Users\\...\\OneDrive\\Documents")
					.setValue(this.mapping.sourceFolder)
					.onChange((v) => {
						this.mapping.sourceFolder = v.trim();
						this.hasChanges = true;
					});
			});

		// Add browse button if native picker is available
		if (isFolderPickerAvailable()) {
			sourceRow.addButton((b) =>
				b
					.setButtonText("Browse...")
					.setTooltip("Open folder picker")
					.onClick(async () => {
						const selected = await pickFolder(this.mapping.sourceFolder || undefined);
						if (selected) {
							this.mapping.sourceFolder = selected;
							sourceTextComponent.setValue(selected);
							this.hasChanges = true;
						}
					})
			);
		}

		// Target Folder - simple text input (user may want to create new folders)
		new Setting(section)
			.setName("Target Folder")
			.setDesc("Where to sync files in your vault (relative to vault root, will be created if needed)")
			.addText((t) =>
				t
					.setPlaceholder("imported/onedrive")
					.setValue(this.mapping.targetFolder)
					.onChange((v) => {
						this.mapping.targetFolder = v.trim();
						this.hasChanges = true;
					})
			);

		new Setting(section)
			.setName("Watch Subfolders")
			.setDesc("Also watch and sync files in subdirectories")
			.addToggle((t) =>
				t
					.setValue(this.mapping.watchSubfolders)
					.onChange((v) => {
						this.mapping.watchSubfolders = v;
						this.hasChanges = true;
					})
			);
	}

	private renderSyncDirectionSettings() {
		const { contentEl } = this;

		const section = this.createSection(contentEl, "Sync Direction", "arrow-left-right");

		new Setting(section)
			.setName("Sync Mode")
			.setDesc("Direction of file synchronization between source and vault")
			.addDropdown((d) => {
				d.addOption("source-only", "Source → Vault (consume only)");
				d.addOption("vault-only", "Vault → Source (publish only)");
				d.addOption("bidirectional", "Bidirectional (both ways)");
				d.setValue(this.mapping.syncDirection ?? "source-only");
				d.onChange((v) => {
					this.mapping.syncDirection = v as SyncDirection;
					this.hasChanges = true;
					// Show/hide reverse conflict resolution
					this.updateReverseConflictVisibility(section, v !== "source-only");
				});
			});

		// Reverse conflict resolution container
		const reverseConflictContainer = section.createDiv({ cls: "reverse-conflict-setting" });
		this.renderReverseConflictSetting(reverseConflictContainer, (this.mapping.syncDirection ?? "source-only") !== "source-only");
	}

	private updateReverseConflictVisibility(section: HTMLElement, show: boolean) {
		const container = section.querySelector(".reverse-conflict-setting");
		if (container) {
			container.empty();
			this.renderReverseConflictSetting(container as HTMLElement, show);
		}
	}

	private renderReverseConflictSetting(container: HTMLElement, show: boolean) {
		if (!show) return;

		new Setting(container)
			.setName("Reverse Conflict Resolution")
			.setDesc("How to handle conflicts when syncing from vault to source")
			.addDropdown((d) => {
				d.addOption("overwrite", "Overwrite - Replace existing file");
				d.addOption("rename", "Rename - Add number suffix");
				d.addOption("skip", "Skip - Don't sync if exists");
				d.addOption("keepNewer", "Keep Newer - Compare timestamps");
				d.setValue(this.mapping.reverseConflictResolution ?? this.mapping.conflictResolution);
				d.onChange((v) => {
					this.mapping.reverseConflictResolution = v as ConflictResolution;
					this.hasChanges = true;
				});
			});
	}

	private renderSyncSettings() {
		const { contentEl } = this;

		const section = this.createSection(contentEl, "Sync Behavior", "refresh-cw");

		new Setting(section)
			.setName("File Extensions")
			.setDesc("Only sync files with these extensions (comma-separated, leave empty for all)")
			.addText((t) =>
				t
					.setPlaceholder(".md, .pdf, .docx")
					.setValue(this.mapping.fileExtensions.join(", "))
					.onChange((v) => {
						this.mapping.fileExtensions = v
							.split(",")
							.map((x) => x.trim().toLowerCase())
							.filter(Boolean);
						this.hasChanges = true;
					})
			);

		new Setting(section)
			.setName("Exclude Patterns")
			.setDesc("Patterns to exclude (one per line). Supports wildcards: *, **, ?")
			.addTextArea((t) =>
				t
					.setPlaceholder("node_modules\n*.log\nbuild/**\n.git")
					.setValue((this.mapping.excludePatterns ?? []).join("\n"))
					.onChange((v) => {
						this.mapping.excludePatterns = v
							.split("\n")
							.map((x) => x.trim())
							.filter(Boolean);
						this.hasChanges = true;
					})
			);

		new Setting(section)
			.setName("Conflict Resolution")
			.setDesc("How to handle conflicts when a file already exists")
			.addDropdown((d) => {
				d.addOption("overwrite", "Overwrite - Replace existing file");
				d.addOption("rename", "Rename - Add number suffix");
				d.addOption("skip", "Skip - Don't sync if exists");
				d.addOption("keepNewer", "Keep Newer - Compare timestamps");
				d.setValue(this.mapping.conflictResolution);
				d.onChange((v) => {
					this.mapping.conflictResolution = v as ConflictResolution;
					this.hasChanges = true;
				});
			});

		new Setting(section)
			.setName("Reconcile on Start")
			.setDesc("Scan and sync all existing files when the plugin starts")
			.addToggle((t) =>
				t
					.setValue(this.mapping.reconcileOnStart)
					.onChange((v) => {
						this.mapping.reconcileOnStart = v;
						this.hasChanges = true;
					})
			);
	}

	private renderAdvancedSettings() {
		const { contentEl } = this;

		const section = this.createSection(contentEl, "Advanced Options", "sliders-horizontal");

		// Add a collapsible container
		const advancedContent = section.createDiv({ cls: "advanced-content" });

		new Setting(advancedContent)
			.setName("Debounce Delay")
			.setDesc("Wait time (ms) before processing rapid changes. Higher values reduce CPU usage.")
			.addText((t) =>
				t
					.setPlaceholder("800")
					.setValue(String(this.mapping.debounceDelay ?? 800))
					.onChange((v) => {
						const n = Number(v);
						if (!Number.isFinite(n) || n < 0) return;
						this.mapping.debounceDelay = n;
						this.hasChanges = true;
					})
			);

		new Setting(advancedContent)
			.setName("Use Polling")
			.setDesc("More reliable for network/cloud folders, but uses more CPU")
			.addToggle((t) =>
				t
					.setValue(this.mapping.usePolling ?? false)
					.onChange((v) => {
						this.mapping.usePolling = v;
						this.hasChanges = true;
						// Re-render to show/hide interval setting
						this.renderPollingInterval(advancedContent, v);
					})
			);

		// Polling interval (conditionally shown)
		this.renderPollingInterval(advancedContent, this.mapping.usePolling ?? false);
	}

	private renderPollingInterval(container: HTMLElement, show: boolean) {
		// Remove existing if any
		const existing = container.querySelector(".polling-interval-setting");
		if (existing) existing.remove();

		if (show) {
			const intervalContainer = container.createDiv({ cls: "polling-interval-setting" });
			new Setting(intervalContainer)
				.setName("Polling Interval")
				.setDesc("How often to check for changes (ms)")
				.addText((t) =>
					t
						.setPlaceholder("300")
						.setValue(String(this.mapping.pollingInterval ?? 300))
						.onChange((v) => {
							const n = Number(v);
							if (!Number.isFinite(n) || n < 50) return;
							this.mapping.pollingInterval = n;
							this.hasChanges = true;
						})
				);
		}
	}

	private renderFooter() {
		const { contentEl } = this;

		const footer = contentEl.createDiv({ cls: "mapping-modal-footer" });

		// Left side - delete button (only for edit mode)
		const leftActions = footer.createDiv({ cls: "footer-left" });
		if (this.mode === "edit") {
			const deleteBtn = leftActions.createEl("button", {
				cls: "mod-warning mapping-delete-btn",
			});
			setIcon(deleteBtn.createSpan({ cls: "btn-icon" }), "trash-2");
			deleteBtn.createSpan({ cls: "btn-text", text: "Delete" });
			deleteBtn.addEventListener("click", (e) => {
				e.preventDefault();
				this.handleDelete();
			});
		}

		// Right side - cancel and save
		const rightActions = footer.createDiv({ cls: "footer-right" });

		const cancelBtn = rightActions.createEl("button", { cls: "mapping-cancel-btn" });
		cancelBtn.setText("Cancel");
		cancelBtn.addEventListener("click", (e) => {
			e.preventDefault();
			this.close();
		});

		const saveBtn = rightActions.createEl("button", {
			cls: "mod-cta mapping-save-btn",
		});
		setIcon(saveBtn.createSpan({ cls: "btn-icon" }), "check");
		saveBtn.createSpan({
			cls: "btn-text",
			text: this.mode === "create" ? "Create Mapping" : "Save Changes",
		});
		saveBtn.addEventListener("click", (e) => {
			e.preventDefault();
			this.handleSave();
		});
	}

	private createSection(container: HTMLElement, title: string, icon: string): HTMLElement {
		const section = container.createDiv({ cls: "mapping-section" });

		const header = section.createDiv({ cls: "section-header" });
		const iconEl = header.createSpan({ cls: "section-icon" });
		setIcon(iconEl, icon);
		header.createSpan({ cls: "section-title", text: title });

		const content = section.createDiv({ cls: "section-content" });
		return content;
	}

	private validateMapping(): string | null {
		if (!this.mapping.sourceFolder.trim()) {
			return "Source folder is required";
		}
		if (!this.mapping.targetFolder.trim()) {
			return "Target folder is required";
		}
		return null;
	}

	private async handleSave() {
		const error = this.validateMapping();
		if (error) {
			this.plugin.noticeService.error(error);
			return;
		}

		// Generate ID for new mappings
		if (this.mode === "create" && !this.mapping.id) {
			this.mapping.id = `mapping-${Date.now()}`;
		}

		this.onComplete({
			saved: true,
			mapping: this.mapping,
		});

		this.plugin.noticeService.success(this.mode === "create" ? "Mapping created" : "Mapping saved");
		this.close();
	}

	private async handleDelete() {
		const confirmed = await confirmDelete(
			this.app,
			this.mapping.description || this.mapping.id,
			"This will stop watching the source folder."
		);

		if (confirmed) {
			this.onComplete({
				saved: false,
				deleted: true,
				mapping: this.mapping,
			});
			this.plugin.noticeService.show("Mapping deleted");
			this.close();
		}
	}

	onClose() {
		// If closed without saving, notify with no changes
		if (!this.hasChanges) {
			// Already handled by save/delete
		}
		this.contentEl.empty();
	}
}
