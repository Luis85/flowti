import FileWatcherPlugin from "src/main";
import { App, Modal, Setting, Notice } from "obsidian";
import { FolderMapping, ConflictResolution } from "src/types";
import { ModalHandlers } from "./types";

export class FolderMappingModal extends Modal {
	private plugin: FileWatcherPlugin;
	private mapping: FolderMapping;
	private handlers: ModalHandlers;

	constructor(
		app: App,
		plugin: FileWatcherPlugin,
		mapping: FolderMapping,
		handlers: ModalHandlers
	) {
		super(app);
		this.plugin = plugin;
		this.mapping = mapping;
		this.handlers = handlers;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("filewatcher-mapping-modal");

		contentEl.createEl("h2", {
			text: this.mapping.description || "Edit mapping",
		});

		new Setting(contentEl)
			.setName("Enabled")
			.setDesc("Start this watcher when the plugin runs.")
			.addToggle((t) =>
				t
					.setValue(this.mapping.enabled)
					.onChange((v) => (this.mapping.enabled = v))
			);

		new Setting(contentEl)
			.setName("Description")
			.setDesc("Shown in settings and status bar.")
			.addText((t) =>
				t.setValue(this.mapping.description).onChange((v) => {
					this.mapping.description = v;
				})
			);

		new Setting(contentEl)
			.setName("Source folder (absolute)")
			.setDesc("Example: C:\\Users\\…\\OneDrive\\Folder")
			.addText((t) =>
				t
					.setPlaceholder("C:\\Users\\...\\OneDrive\\Folder")
					.setValue(this.mapping.sourceFolder)
					.onChange((v) => {
						this.mapping.sourceFolder = v.trim();
					})
			);

		new Setting(contentEl)
			.setName("Target folder (vault)")
			.setDesc("Example: imported/onedrive")
			.addText((t) =>
				t
					.setPlaceholder("imported/onedrive")
					.setValue(this.mapping.targetFolder)
					.onChange((v) => {
						this.mapping.targetFolder = v.trim();
					})
			);

		new Setting(contentEl)
			.setName("Watch subfolders")
			.addToggle((t) =>
				t
					.setValue(this.mapping.watchSubfolders)
					.onChange((v) => (this.mapping.watchSubfolders = v))
			);

		new Setting(contentEl)
			.setName("Reconcile existing files on start")
			.setDesc(
				"When enabled, performs a one-time scan and sync at startup."
			)
			.addToggle((t) =>
				t
					.setValue(this.mapping.reconcileOnStart)
					.onChange((v) => (this.mapping.reconcileOnStart = v))
			);

		new Setting(contentEl)
			.setName("File extensions")
			.setDesc("Comma-separated (.md,.pdf). Empty = all.")
			.addText((t) =>
				t
					.setValue(this.mapping.fileExtensions.join(","))
					.onChange((v) => {
						this.mapping.fileExtensions = v
							.split(",")
							.map((x) => x.trim().toLowerCase())
							.filter(Boolean);
					})
			);

		new Setting(contentEl)
			.setName("Conflict resolution")
			.addDropdown((d) => {
				d.addOption("overwrite", "overwrite");
				d.addOption("rename", "rename");
				d.addOption("skip", "skip");
				d.addOption("keepNewer", "keepNewer");
				d.setValue(this.mapping.conflictResolution);
				d.onChange(
					(v) =>
						(this.mapping.conflictResolution =
							v as ConflictResolution)
				);
			});

		new Setting(contentEl)
			.setName("Debounce delay (ms)")
			.setDesc(
				"Collects rapid events and processes once. Recommended for OneDrive."
			)
			.addText((t) =>
				t
					.setValue(String(this.mapping.debounceDelay ?? 800))
					.onChange((v) => {
						const n = Number(v);
						if (!Number.isFinite(n) || n < 0) return;
						this.mapping.debounceDelay = n;
					})
			);

		new Setting(contentEl)
			.setName("Use polling (advanced)")
			.setDesc(
				"More reliable on some sync/network folders, but higher CPU."
			)
			.addToggle((t) =>
				t
					.setValue(this.mapping.usePolling ?? false)
					.onChange((v) => (this.mapping.usePolling = v))
			);

		if (this.mapping.usePolling) {
			new Setting(contentEl)
				.setName("Polling interval (ms)")
				.addText((t) =>
					t
						.setValue(String(this.mapping.pollingInterval ?? 300))
						.onChange((v) => {
							const n = Number(v);
							if (!Number.isFinite(n) || n < 50) return;
							this.mapping.pollingInterval = n;
						})
				);
		}

		// Footer actions
		contentEl.createEl("hr");
		const actions = contentEl.createDiv({
			cls: "filewatcher-modal-actions",
		});

		new Setting(actions).addButton((b) =>
			b
				.setButtonText("Save")
				.setCta()
				.onClick(async () => {
					await this.handlers.onSave();
					new Notice("Mapping saved");
					this.close();
				})
		);

		new Setting(actions).addButton((b) =>
			b
				.setButtonText("Delete")
				.setWarning()
				.onClick(async () => {
					await this.handlers.onDelete();
					new Notice("Mapping deleted");
					this.close();
				})
		);

		new Setting(actions).addButton((b) =>
			b.setButtonText("Close").onClick(() => this.close())
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
