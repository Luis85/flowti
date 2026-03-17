/**
 * Signal Configuration Modal — form for creating/editing signal connections.
 *
 * Uses Obsidian's Modal + Setting components. Calls SignalService.configure()
 * for new signals or SignalService.update() for existing ones.
 */

import { App, Modal, Setting } from "obsidian";
import type { SignalService } from "../../domain/signal/SignalService";
import type { SignalConfig, ConflictStrategy } from "../../domain/signal/types";

export class SignalConfigModal extends Modal {
	private name = "";
	private orgUrl = "";
	private project = "";
	private pat = "";
	private targetFolder = "signals/items";
	private itemTypeFilter = "";
	private conflictStrategy: ConflictStrategy = "update";

	constructor(
		app: App,
		private signalService: SignalService,
		private onSave: () => void,
		private existing?: SignalConfig,
	) {
		super(app);
		if (existing) {
			this.name = existing.name;
			this.orgUrl = existing.orgUrl;
			this.project = existing.project;
			this.pat = existing.pat;
			this.targetFolder = existing.targetFolder;
			this.itemTypeFilter = existing.itemTypeFilter.join(", ");
			this.conflictStrategy = existing.conflictStrategy;
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: this.existing ? "Edit Signal" : "New Signal" });

		new Setting(contentEl)
			.setName("Name")
			.setDesc("Display name for this signal connection")
			.addText((text) => {
				// eslint-disable-next-line obsidianmd/ui/sentence-case
			text.setPlaceholder("e.g. My Project Backlog")
					.setValue(this.name)
					.onChange((v) => { this.name = v; });
			});

		new Setting(contentEl)
			.setName("Organization URL")
			.setDesc("Azure DevOps organization URL")
			.addText((text) => {
				text.setPlaceholder("https://dev.azure.com/org")
					.setValue(this.orgUrl)
					.onChange((v) => { this.orgUrl = v; });
			});

		new Setting(contentEl)
			.setName("Project")
			.setDesc("Azure DevOps project name")
			.addText((text) => {
				text.setPlaceholder("MyProject")
					.setValue(this.project)
					.onChange((v) => { this.project = v; });
			});

		new Setting(contentEl)
			.setName("Personal access token")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
		.setDesc("PAT with work item read scope")
			.addText((text) => {
				text.setPlaceholder("PAT")
					.setValue(this.pat)
					.onChange((v) => { this.pat = v; });
				text.inputEl.type = "password";
			});

		new Setting(contentEl)
			.setName("Target folder")
			.setDesc("Vault folder for synced notes")
			.addText((text) => {
				// eslint-disable-next-line obsidianmd/ui/sentence-case
			text.setPlaceholder("signals/items")
					.setValue(this.targetFolder)
					.onChange((v) => { this.targetFolder = v; });
			});

		new Setting(contentEl)
			.setName("Item type filter")
			.setDesc("Comma-separated work item types (empty = all)")
			.addText((text) => {
				text.setPlaceholder("Bug, user story, task")
					.setValue(this.itemTypeFilter)
					.onChange((v) => { this.itemTypeFilter = v; });
			});

		new Setting(contentEl)
			.setName("Conflict strategy")
			.setDesc("How to handle existing notes during sync")
			.addDropdown((dd) => {
				dd.addOption("skip", "Skip (keep existing)")
					.addOption("update", "Update frontmatter only")
					.addOption("overwrite", "Overwrite entirely")
					.setValue(this.conflictStrategy)
					.onChange((v) => { this.conflictStrategy = v as ConflictStrategy; });
			});

		const footer = new Setting(contentEl);
		footer.addButton((btn) => {
			btn.setButtonText("Cancel")
				.onClick(() => this.close());
		});
		footer.addButton((btn) => {
			btn.setButtonText("Save")
				.setCta()
				.onClick(() => void this.save());
		});
	}

	private async save(): Promise<void> {
		if (!this.name.trim() || !this.orgUrl.trim() || !this.project.trim() || !this.pat.trim()) {
			return; // Required fields not filled
		}

		const typeFilter = this.itemTypeFilter
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

		if (this.existing) {
			await this.signalService.update(this.existing.id, {
				name: this.name.trim(),
				orgUrl: this.orgUrl.trim(),
				project: this.project.trim(),
				pat: this.pat.trim(),
				targetFolder: this.targetFolder.trim() || "signals/items",
				itemTypeFilter: typeFilter,
				conflictStrategy: this.conflictStrategy,
			});
		} else {
			await this.signalService.configure({
				name: this.name.trim(),
				type: "azure-devops",
				orgUrl: this.orgUrl.trim(),
				project: this.project.trim(),
				pat: this.pat.trim(),
				targetFolder: this.targetFolder.trim() || "signals/items",
				itemTypeFilter: typeFilter,
				conflictStrategy: this.conflictStrategy,
			});
		}

		this.onSave();
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
