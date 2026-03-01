/**
 * PipelineSourceModal — modal for adding/editing a CSV source within a pipeline.
 *
 * Shows CSV file picker, merge key column dropdown, column mapping grid,
 * custom properties, and prefix/suffix fields.
 */

import { App, Modal, Notice, Setting, TFile, setIcon } from "obsidian";
import { generateUUID } from "../../utils/helpers";
import { matchMergeKeyColumn, syncColumnMappings } from "../../utils/csvUtils";
import type { ImportService } from "../../domain/dataExchange/ImportService";
import type { ColumnMapping, MultiImportSource, SavedImportConfig } from "../../domain/dataExchange/types";
import { FilePickerModal } from "../shared/FilePickerModal";
import { ConfigChooserModal } from "../modals";
import { basename } from "../../utils/pathUtils";

export interface PipelineSourceModalOptions {
	app: App;
	importService: ImportService;
	/** Canonical merge key name from the pipeline (e.g., "item_id") */
	mergeKey: string;
	/** Existing source to edit (undefined = create new) */
	existingSource?: MultiImportSource;
	/** Other sources in the pipeline (used to detect key overlaps) */
	otherSources?: MultiImportSource[];
	/** Callback on save */
	onSave: (source: MultiImportSource) => void;
	/** Available saved import configs for the "Load from config" feature */
	savedImportConfigs?: SavedImportConfig[];
	/** CSV paths to exclude from the file picker (hidden files) */
	hiddenCsvPaths?: string[];
}

function generateSourceId(): string {
	return generateUUID();
}

export class PipelineSourceModal extends Modal {
	private importService: ImportService;
	private mergeKey: string;
	private existingSource?: MultiImportSource;
	private onSave: (source: MultiImportSource) => void;
	/** Frontmatter keys already claimed by other sources in the pipeline */
	private otherSourceKeys: Set<string>;
	private savedImportConfigs: SavedImportConfig[];
	private hiddenCsvPaths: string[];

	// State
	private csvPath = "";
	private csvHeaders: string[] = [];
	private mergeKeyColumn = "";
	private columnMappings: ColumnMapping[] = [];
	private customProperties: Record<string, string> = {};
	private isLoading = false;

	constructor(options: PipelineSourceModalOptions) {
		super(options.app);
		this.importService = options.importService;
		this.mergeKey = options.mergeKey;
		this.existingSource = options.existingSource;
		this.onSave = options.onSave;
		this.savedImportConfigs = options.savedImportConfigs ?? [];
		this.hiddenCsvPaths = options.hiddenCsvPaths ?? [];

		// Build set of keys already claimed by other sources
		this.otherSourceKeys = new Set<string>();
		if (options.otherSources) {
			for (const src of options.otherSources) {
				for (const m of src.columnMappings) {
					if (m.included) this.otherSourceKeys.add(m.frontmatterKey);
				}
				if (src.customProperties) {
					for (const key of Object.keys(src.customProperties)) {
						this.otherSourceKeys.add(key);
					}
				}
			}
		}

		if (options.existingSource) {
			const src = options.existingSource;
			this.csvPath = src.csvPath;
			this.mergeKeyColumn = src.mergeKeyColumn;
			this.columnMappings = src.columnMappings.map((m) => ({ ...m }));
			this.customProperties = src.customProperties ? { ...src.customProperties } : {};
		}
	}

	onOpen(): void {
		this.modalEl.addClass("ft-modal-width-640");
		this.render();

		// If editing, auto-parse to load headers
		if (this.existingSource && this.csvPath) {
			void this.parseCsv();
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		const isEdit = !!this.existingSource;
		contentEl.createEl("h3", {
			text: isEdit ? "Edit Source" : "Add CSV Source",
		});

		// "Load from Config" button — only for new sources when configs exist
		if (!isEdit && this.savedImportConfigs.length > 0) {
			const loadRow = contentEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
			const loadLink = loadRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const loadIcon = loadLink.createSpan();
			setIcon(loadIcon, "file-input");
			loadLink.appendText(" Load from import config");
			loadLink.addEventListener("click", () => {
				new ConfigChooserModal(
					this.app,
					this.savedImportConfigs.map((c) => ({
						id: c.id,
						name: c.name + (c.sourcePath ? ` (${basename(c.sourcePath)})` : ""),
					})),
					(id) => {
						if (id === null) return;
						const cfg = this.savedImportConfigs.find((c) => c.id === id);
						if (cfg) this.loadFromConfig(cfg);
					},
				).open();
			});
		}

		// CSV file picker
		const csvSetting = new Setting(contentEl)
			.setName("CSV file")
			.setDesc("Select a CSV file from the vault");

		csvSetting.addText((text) =>
			text
				.setValue(this.csvPath)
				.setPlaceholder("path/to/file.csv")
				.onChange((v) => { this.csvPath = v; }),
		);
		csvSetting.addExtraButton((btn) =>
			btn
				.setIcon("search")
				.setTooltip("Parse CSV")
				.onClick(() => { void this.parseCsv(); }),
		);
		csvSetting.addExtraButton((btn) =>
			btn
				.setIcon("folder-open")
				.setTooltip("Browse CSV files")
				.onClick(() => {
					new FilePickerModal(this.app, ["csv"], (path) => {
						this.csvPath = path;
						void this.parseCsv();
					}, this.hiddenCsvPaths).open();
				}),
		);

		// File-not-found warning
		if (this.csvPath && this.csvHeaders.length === 0 && !this.isLoading) {
			const file = this.app.vault.getAbstractFileByPath(this.csvPath);
			if (!file || !(file instanceof TFile)) {
				const warn = contentEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2 ft-text-error" });
				const warnIcon = warn.createSpan();
				setIcon(warnIcon, "alert-triangle");
				warn.createSpan({ text: `File not found: ${this.csvPath}`, cls: "ft-text-sm" });
			}
		}

		if (this.isLoading) {
			const loading = contentEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-3" });
			const spinner = loading.createSpan({ cls: "ft-opacity-50" });
			setIcon(spinner, "loader");
			loading.createSpan({ text: "Parsing CSV...", cls: "ft-text-muted" });
			return;
		}

		if (this.csvHeaders.length > 0) {
			// Merge key column
			new Setting(contentEl)
				.setName("Merge key column")
				.setDesc(`Maps to the pipeline key "${this.mergeKey}"`)
				.addDropdown((dd) => {
					dd.addOption("", "-- select column --");
					for (const h of this.csvHeaders) {
						dd.addOption(h, h);
					}
					dd.setValue(this.mergeKeyColumn);
					dd.onChange((v) => {
						this.mergeKeyColumn = v;
					});
				});

			// Column mappings
			contentEl.createEl("h4", {
				text: "Column mappings",
				cls: "ft-heading ft-heading-sm ft-mt-3 ft-mb-1",
			});
			contentEl.createEl("p", {
				text: "Select which columns to import and their frontmatter key names.",
				cls: "ft-text-muted ft-text-sm ft-mb-2",
			});

			const grid = contentEl.createDiv({ cls: "ft-column-mapping-grid" });
			this.renderColumnGrid(grid);

			// Custom properties
			contentEl.createEl("h4", {
				text: "Custom properties",
				cls: "ft-heading ft-heading-sm ft-mt-3 ft-mb-1",
			});
			contentEl.createEl("p", {
				text: "Static key-value pairs injected into every note from this source.",
				cls: "ft-text-muted ft-text-sm ft-mb-2",
			});

			this.renderCustomProperties(contentEl);
		}

		// Save / Cancel
		const footer = new Setting(contentEl);
		footer.addButton((btn) =>
			btn.setButtonText("Cancel").onClick(() => this.close()),
		);
		footer.addButton((btn) =>
			btn
				.setButtonText(isEdit ? "Update" : "Add Source")
				.setCta()
				.onClick(() => this.handleSave()),
		);
	}

	private async parseCsv(): Promise<void> {
		if (!this.csvPath) return;
		this.isLoading = true;
		this.render();

		try {
			const parsed = await this.importService.parseFile(this.csvPath);
			this.csvHeaders = parsed.headers;

			// Auto-detect merge key column if not set
			if (!this.mergeKeyColumn) {
				const match = matchMergeKeyColumn(this.mergeKey, this.csvHeaders);
				if (match) this.mergeKeyColumn = match;
			}

			// Initialize or sync column mappings with current headers
			this.columnMappings = syncColumnMappings(this.csvHeaders, this.columnMappings);
		} catch (error) {
			new Notice(`Failed to parse CSV: ${error instanceof Error ? error.message : String(error)}`);
			this.csvHeaders = [];
		}

		this.isLoading = false;
		this.render();
	}

	private loadFromConfig(config: SavedImportConfig): void {
		this.csvPath = config.sourcePath ?? "";
		this.columnMappings = config.columnMappings.map((m) => ({ ...m }));
		this.customProperties = config.customProperties ? { ...config.customProperties } : {};
		this.mergeKeyColumn = "";
		this.csvHeaders = [];

		if (this.csvPath) {
			void this.parseCsv();
		} else {
			this.render();
		}
	}

	private renderColumnGrid(container: HTMLElement): void {
		container.empty();

		// Filter out merge key column from the grid (it's handled separately)
		const mappings = this.columnMappings.filter(
			(m) => m.csvColumn !== this.mergeKeyColumn,
		);

		if (mappings.length === 0) {
			container.createEl("p", {
				text: "No additional columns found.",
				cls: "ft-text-muted ft-text-sm ft-p-2",
			});
			return;
		}

		// Quick select buttons
		const actions = container.createDiv({ cls: "ft-flex ft-gap-2 ft-mb-2" });
		const allBtn = actions.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		allBtn.textContent = "All";
		allBtn.addEventListener("click", () => {
			for (const m of this.columnMappings) m.included = true;
			this.renderColumnGrid(container);
		});
		const noneBtn = actions.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		noneBtn.textContent = "None";
		noneBtn.addEventListener("click", () => {
			for (const m of this.columnMappings) {
				if (m.csvColumn !== this.mergeKeyColumn) m.included = false;
			}
			this.renderColumnGrid(container);
		});

		const grid = container.createDiv({ cls: "ft-column-grid-scroll" });

		for (const mapping of mappings) {
			const row = grid.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1 ft-border-bottom" });

			const cb = row.createEl("input", { type: "checkbox" });
			cb.checked = mapping.included;
			cb.addEventListener("change", () => { mapping.included = cb.checked; });

			row.createSpan({ text: mapping.csvColumn, cls: "ft-text-sm ft-column-mapping-label" });

			row.createSpan({ text: "\u2192", cls: "ft-text-muted ft-text-sm ft-flex-noshrink" });

			const keyInput = row.createEl("input", {
				type: "text",
				cls: "ft-text-sm ft-mapping-input",
			});
			keyInput.value = mapping.frontmatterKey;
			keyInput.addEventListener("change", () => {
				mapping.frontmatterKey = keyInput.value || mapping.csvColumn;
				// Re-render to update overlap indicator
				this.renderColumnGrid(container);
			});

			// Overlap indicator
			if (this.otherSourceKeys.has(mapping.frontmatterKey)) {
				const badge = row.createSpan({
					text: "exists",
					cls: "ft-badge ft-badge-muted ft-text-sm ft-overlap-badge",
				});
				badge.title = "This key is already mapped by another source";
			}
		}
	}

	private renderCustomProperties(container: HTMLElement): void {
		const entries = Object.entries(this.customProperties);
		const propsEl = container.createDiv();

		for (const [key, value] of entries) {
			const row = propsEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });

			const keyInput = row.createEl("input", { type: "text", cls: "ft-text-sm ft-mapping-input" });
			keyInput.value = key;
			keyInput.placeholder = "Key";

			const valueInput = row.createEl("input", { type: "text", cls: "ft-text-sm ft-mapping-input" });
			valueInput.value = value;
			valueInput.placeholder = "Value";

			// Overlap indicator
			if (this.otherSourceKeys.has(key)) {
				const badge = row.createSpan({
					text: "exists",
					cls: "ft-badge ft-badge-muted ft-text-sm ft-overlap-badge",
				});
				badge.title = "This key is already defined by another source";
			}

			const removeBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const removeIcon = removeBtn.createSpan();
			setIcon(removeIcon, "x");
			const capturedKey = key;
			removeBtn.addEventListener("click", () => {
				delete this.customProperties[capturedKey];
				this.render();
			});

			keyInput.addEventListener("change", () => {
				const newKey = keyInput.value.trim();
				if (newKey && newKey !== capturedKey) {
					delete this.customProperties[capturedKey];
					this.customProperties[newKey] = valueInput.value;
				}
				this.render();
			});

			valueInput.addEventListener("change", () => {
				if (keyInput.value.trim()) {
					this.customProperties[keyInput.value.trim()] = valueInput.value;
				}
			});
		}

		const addBtn = propsEl.createEl("span", { cls: "ft-nav-link ft-text-sm ft-mt-1" });
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.appendText(" Add property");
		addBtn.addEventListener("click", () => {
			const key = `property${Object.keys(this.customProperties).length + 1}`;
			this.customProperties[key] = "";
			this.render();
		});
	}

	private handleSave(): void {
		if (!this.csvPath) {
			new Notice("Please select a CSV file.");
			return;
		}
		if (!this.mergeKeyColumn) {
			new Notice("Please select a merge key column.");
			return;
		}

		// Filter out the merge key column from mappings (it's auto-handled at execution)
		const mappings = this.columnMappings.filter(
			(m) => m.csvColumn !== this.mergeKeyColumn,
		);

		const source: MultiImportSource = {
			id: this.existingSource?.id ?? generateSourceId(),
			csvPath: this.csvPath,
			mergeKeyColumn: this.mergeKeyColumn,
			columnMappings: mappings,
			customProperties: Object.keys(this.customProperties).length > 0
				? { ...this.customProperties }
				: undefined,
		};

		this.onSave(source);
		this.close();
	}
}
