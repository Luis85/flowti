/**
 * CSV Action View for Flowti.
 *
 * Registered as the handler for `.csv` files. When the user clicks a CSV
 * in the file explorer, the landing page shows two actions:
 * "Import as Notes" (transitions to the import wizard) or "Open with Default App"
 * (delegates to the OS). A brief preview table is shown below.
 *
 * The import wizard runs inline (source → configure → preview → result)
 * with no modal overlay.
 */

import { Notice, Setting, TextFileView, WorkspaceLeaf, setIcon } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService";
import type { ImportService } from "../domain/dataExchange/ImportService";
import type {
	ColumnMapping,
	ConflictStrategy,
	ImportResult,
	ParsedCsv,
	SavedImportConfig,
} from "../domain/dataExchange/types";
import { FolderPickerModal, getVaultFolders } from "./FolderPickerModal";

export const VIEW_TYPE_CSV = "flowti-csv";

type CsvPage = "landing" | "source" | "configure" | "preview" | "result";

export class CsvActionView extends TextFileView {
	private eventBus: IEventBus;
	private dataExchangeService: DataExchangeService;
	private autoStartImport: boolean;

	// Import wizard state
	private currentPage: CsvPage = "landing";
	private importService: ImportService | null = null;
	private parsedCsv: ParsedCsv | null = null;
	private parseError: string | null = null;
	private targetFolder = "";
	private nameColumn = "";
	private columnMappings: ColumnMapping[] = [];
	private conflictStrategy: ConflictStrategy = "skip";
	private importResult: ImportResult | null = null;
	private importError: string | null = null;
	private importProgress = { current: 0, total: 0 };
	private createBase = false;
	private basePath = "";
	private savedConfigs: SavedImportConfig[] = [];
	private unsubscribes: (() => void)[] = [];

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		dataExchangeService: DataExchangeService,
		autoStartImport = false,
	) {
		super(leaf);
		this.eventBus = eventBus;
		this.dataExchangeService = dataExchangeService;
		this.autoStartImport = autoStartImport;
	}

	getViewType(): string {
		return VIEW_TYPE_CSV;
	}

	getDisplayText(): string {
		return this.file?.basename ?? "CSV File";
	}

	getIcon(): string {
		return "file-spreadsheet";
	}

	getViewData(): string {
		return this.data;
	}

	setViewData(data: string, clear: boolean): void {
		this.data = data;
		if (clear) this.clear();
		if (this.autoStartImport) {
			this.autoStartImport = false;
			void this.startImportWizard();
		} else {
			this.renderContent();
		}
	}

	clear(): void {
		this.contentEl.empty();
	}

	async onClose(): Promise<void> {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}

	// ── Page router ──────────────────────────────────────────

	private renderContent(): void {
		const el = this.contentEl;
		el.empty();
		el.addClass("flowti-csv-action");

		switch (this.currentPage) {
			case "landing":
				this.renderLanding(el);
				break;
			case "source":
				this.renderSourcePage(el);
				break;
			case "configure":
				this.renderConfigurePage(el);
				break;
			case "preview":
				this.renderPreviewPage(el);
				break;
			case "result":
				this.renderResultPage(el);
				break;
		}
	}

	// ── Landing page ─────────────────────────────────────────

	private renderLanding(el: HTMLElement): void {
		const container = el.createDiv({ cls: "flowti-csv-container" });

		// Icon + heading
		const iconEl = container.createDiv({ cls: "flowti-csv-icon" });
		setIcon(iconEl, "file-spreadsheet");
		container.createEl("h2", { text: this.file?.basename ?? "CSV File" });
		container.createEl("p", {
			cls: "flowti-csv-desc",
			text: "Choose an action for this CSV file:",
		});

		// Action buttons
		const actions = container.createDiv({ cls: "flowti-csv-actions" });

		const importBtn = actions.createEl("button", { cls: "mod-cta" });
		setIcon(importBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "file-input");
		importBtn.appendText(" Import as Notes");
		importBtn.addEventListener("click", () => {
			void this.startImportWizard();
		});

		const openBtn = actions.createEl("button");
		setIcon(openBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "external-link");
		openBtn.appendText(" Open with Default App");
		openBtn.addEventListener("click", () => {
			if (this.file) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(this.app as any).openWithDefaultApp(this.file.path);
				this.leaf.detach();
			}
		});

		// Preview table
		if (this.data?.trim()) {
			this.renderCsvPreview(container);
		}
	}

	private renderCsvPreview(container: HTMLElement): void {
		const lines = this.data.split("\n").filter((l) => l.trim());
		if (lines.length === 0) return;

		container.createEl("h3", { text: "Preview" });
		const tableWrap = container.createDiv({ cls: "flowti-csv-preview" });
		const table = tableWrap.createEl("table");

		const maxRows = Math.min(lines.length, 6);
		for (let i = 0; i < maxRows; i++) {
			const tr = table.createEl("tr");
			const cells = this.splitCsvLine(lines[i]);
			const tag = i === 0 ? "th" : "td";
			for (const cell of cells.slice(0, 8)) {
				tr.createEl(tag, { text: cell });
			}
			if (cells.length > 8) {
				tr.createEl(tag, { text: "\u2026" });
			}
		}

		if (lines.length > 6) {
			container.createEl("p", {
				cls: "flowti-csv-more",
				text: `\u2026 and ${lines.length - 6} more rows`,
			});
		}
	}

	/** Rough CSV line split that handles double-quoted fields. */
	private splitCsvLine(line: string): string[] {
		const result: string[] = [];
		let current = "";
		let inQuotes = false;
		for (const ch of line) {
			if (ch === '"') {
				inQuotes = !inQuotes;
			} else if (ch === "," && !inQuotes) {
				result.push(current.trim());
				current = "";
			} else {
				current += ch;
			}
		}
		result.push(current.trim());
		return result;
	}

	// ── Import wizard entry ──────────────────────────────────

	private async startImportWizard(): Promise<void> {
		this.importService = this.dataExchangeService.getImportService();
		this.savedConfigs = this.dataExchangeService.getSavedImportConfigs();

		// Subscribe to progress events
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.import.progress", (event) => {
				this.importProgress = {
					current: event.payload.current,
					total: event.payload.total,
				};
				if (this.currentPage === "result" && !this.importResult) {
					this.renderProgressIndicator();
				}
			}),
		);

		// Parse CSV
		try {
			this.parsedCsv = await this.importService.parseFile(this.file!.path);
			this.initializeFromCsv();
		} catch (error) {
			this.parseError =
				error instanceof Error ? error.message : String(error);
		}

		this.currentPage = "source";
		this.renderContent();
	}

	private resetImportState(): void {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
		this.importService = null;
		this.parsedCsv = null;
		this.parseError = null;
		this.targetFolder = "";
		this.nameColumn = "";
		this.columnMappings = [];
		this.conflictStrategy = "skip";
		this.importResult = null;
		this.importError = null;
		this.importProgress = { current: 0, total: 0 };
		this.createBase = false;
		this.basePath = "";
		this.savedConfigs = [];
	}

	// ── Page 1: Source ───────────────────────────────────────

	private renderSourcePage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "flowti-csv-container flowti-csv-wide" });
		container.createEl("h3", { text: "Import CSV as Notes" });

		if (this.parseError) {
			const alert = container.createDiv({ cls: "ft-alert-error ft-p-3 ft-mb-4" });
			alert.createEl("strong", { text: "Parse Error: " });
			alert.createSpan({ text: this.parseError });
			this.renderNav(container, { cancel: true });
			return;
		}

		if (!this.parsedCsv) return;

		new Setting(container)
			.setName("Source file")
			.setDesc(this.file!.path);

		new Setting(container)
			.setName("Rows detected")
			.setDesc(`${this.parsedCsv.rowCount} data rows`);

		new Setting(container)
			.setName("Columns detected")
			.setDesc(this.parsedCsv.headers.join(", "));

		// Load saved config
		if (this.savedConfigs.length > 0) {
			new Setting(container)
				.setName("Load saved config")
				.setDesc("Apply a previously saved import configuration")
				.addDropdown((dd) => {
					dd.addOption("", "\u2014 Select \u2014");
					for (const cfg of this.savedConfigs) {
						dd.addOption(cfg.id, cfg.name);
					}
					dd.onChange((id) => {
						if (!id) return;
						this.applySavedImportConfig(id);
					});
				});
		}

		this.renderNav(container, { cancel: true, next: "configure" });
	}

	// ── Page 2: Configure ───────────────────────────────────

	private renderConfigurePage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "flowti-csv-container flowti-csv-wide" });
		container.createEl("h3", { text: "Configure Import" });

		if (!this.parsedCsv) return;

		// Target folder
		const targetSetting = new Setting(container)
			.setName("Target folder")
			.setDesc("Vault folder where notes will be created")
			.addText((text) =>
				text
					.setValue(this.targetFolder)
					.setPlaceholder("path/to/folder")
					.onChange((v) => {
						this.targetFolder = v;
					}),
			);
		targetSetting.addExtraButton((btn) =>
			btn
				.setIcon("folder")
				.setTooltip("Browse vault folders")
				.onClick(() => this.openFolderPicker()),
		);

		// Name column
		new Setting(container)
			.setName("Name column")
			.setDesc("CSV column used as the note filename")
			.addDropdown((dropdown) => {
				for (const h of this.parsedCsv!.headers) {
					dropdown.addOption(h, h);
				}
				dropdown.setValue(this.nameColumn);
				dropdown.onChange((v) => {
					this.nameColumn = v;
				});
			});

		// Conflict strategy
		new Setting(container)
			.setName("Existing notes")
			.setDesc("What to do when a note already exists")
			.addDropdown((dropdown) => {
				dropdown.addOption("skip", "Skip");
				dropdown.addOption("update", "Update frontmatter");
				dropdown.addOption("overwrite", "Overwrite entire note");
				dropdown.setValue(this.conflictStrategy);
				dropdown.onChange((v) => {
					this.conflictStrategy = v as ConflictStrategy;
				});
			});

		// Column mapping header
		container.createEl("h4", { text: "Column Mapping", cls: "ft-mt-4" });
		container.createEl("p", {
			text: "Map CSV columns to frontmatter keys. Uncheck to exclude.",
			cls: "ft-text-muted ft-text-sm",
		});

		// Column mapping repeater
		const mappingContainer = container.createDiv({ cls: "ft-flex-col ft-gap-1" });
		for (const mapping of this.columnMappings) {
			if (mapping.csvColumn === this.nameColumn) continue;

			const row = mappingContainer.createDiv({
				cls: "ft-column-mapping-row",
			});

			row.createSpan({
				text: mapping.csvColumn,
				cls: "ft-text-sm",
			}).style.width = "120px";

			row.createSpan({ text: "\u2192", cls: "ft-text-muted" });

			const inputEl = row.createEl("input", {
				type: "text",
				cls: "ft-input",
			});
			inputEl.value = mapping.frontmatterKey;
			inputEl.style.flex = "1";
			inputEl.addEventListener("input", () => {
				mapping.frontmatterKey = inputEl.value;
			});

			const toggleEl = row.createEl("input", { type: "checkbox" });
			toggleEl.checked = mapping.included;
			toggleEl.addEventListener("change", () => {
				mapping.included = toggleEl.checked;
			});
		}

		this.renderNav(container, { back: "source", next: "preview", save: true });
	}

	// ── Page 3: Preview ─────────────────────────────────────

	private renderPreviewPage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "flowti-csv-container flowti-csv-wide" });
		container.createEl("h3", { text: "Preview" });

		if (!this.parsedCsv) return;

		const includedMappings = this.columnMappings.filter(
			(m) => m.included && m.csvColumn !== this.nameColumn,
		);

		// Preview table
		const table = container.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		headerRow.createEl("th", { text: "Filename" });
		for (const m of includedMappings) {
			headerRow.createEl("th", { text: m.frontmatterKey });
		}

		const tbody = table.createEl("tbody");
		const nameIndex = this.parsedCsv.headers.indexOf(this.nameColumn);
		const previewRows = this.parsedCsv.rows.slice(0, 10);

		for (const row of previewRows) {
			const tr = tbody.createEl("tr");
			const filename = this.importService!.sanitizeFilename(
				row[nameIndex] ?? "",
			);
			tr.createEl("td", { text: filename || "(empty)" });

			for (const m of includedMappings) {
				const colIdx = this.parsedCsv!.headers.indexOf(m.csvColumn);
				tr.createEl("td", { text: row[colIdx] ?? "" });
			}
		}

		if (this.parsedCsv.rowCount > 10) {
			container.createEl("p", {
				text: `Showing 10 of ${this.parsedCsv.rowCount} rows`,
				cls: "ft-text-muted ft-text-sm ft-mt-2",
			});
		}

		// Validation
		const issues: string[] = [];
		if (!this.targetFolder.trim()) issues.push("Target folder is required");
		if (!this.nameColumn) issues.push("Name column is required");

		if (issues.length > 0) {
			const alert = container.createDiv({
				cls: "ft-alert-warning ft-p-3 ft-mt-4",
			});
			for (const issue of issues) {
				alert.createEl("p", { text: issue });
			}
		}

		this.renderNav(container, {
			back: "configure",
			execute: issues.length === 0,
		});
	}

	// ── Page 4: Result ──────────────────────────────────────

	private renderResultPage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "flowti-csv-container flowti-csv-wide" });

		if (this.importResult) {
			this.renderImportResult(container);
			return;
		}

		if (this.importError) {
			container.createEl("h3", { text: "Import Failed" });
			const alert = container.createDiv({ cls: "ft-alert-error ft-p-3" });
			alert.createEl("strong", { text: "Import Failed: " });
			alert.createSpan({ text: this.importError });
			this.renderNav(container, { cancel: true });
			return;
		}

		// Progress indicator
		container.createEl("h3", { text: "Importing..." });
		container.createDiv({ cls: "ft-import-progress" });
		this.renderProgressIndicator();
	}

	private renderProgressIndicator(): void {
		const container = this.contentEl.querySelector(".ft-import-progress");
		if (!container) return;
		container.innerHTML = "";

		const wrapper = document.createElement("div");
		wrapper.className = "ft-flex-col ft-gap-2 ft-p-3";

		const label = document.createElement("p");
		label.textContent = `Processing row ${this.importProgress.current} of ${this.importProgress.total}...`;
		wrapper.appendChild(label);

		const bar = document.createElement("div");
		bar.className = "ft-progress-bar";
		const fill = document.createElement("div");
		fill.className = "ft-progress-bar-fill";
		const pct =
			this.importProgress.total > 0
				? (this.importProgress.current / this.importProgress.total) * 100
				: 0;
		fill.style.width = `${pct}%`;
		bar.appendChild(fill);
		wrapper.appendChild(bar);

		container.appendChild(wrapper);
	}

	private renderImportResult(container: HTMLElement): void {
		const r = this.importResult!;

		container.createEl("h3", { text: "Import Complete" });

		const stats = container.createDiv({ cls: "ft-card ft-p-3 ft-flex-col ft-gap-1" });
		stats.createDiv({ text: `Total rows: ${r.totalRows}` });
		stats.createDiv({ text: `Created: ${r.created}` });
		stats.createDiv({ text: `Updated: ${r.updated}` });
		stats.createDiv({ text: `Skipped: ${r.skipped}` });
		if (r.failed > 0) {
			stats.createDiv({
				text: `Failed: ${r.failed}`,
				cls: "ft-text-error",
			});
		}

		if (r.errors.length > 0) {
			container.createEl("h4", { text: "Errors", cls: "ft-mt-4" });
			const errorList = container.createDiv({
				cls: "ft-flex-col ft-gap-1 ft-text-sm",
			});
			for (const err of r.errors.slice(0, 20)) {
				errorList.createDiv({
					text: `Row ${err.row} (${err.filename}): ${err.error}`,
				});
			}
			if (r.errors.length > 20) {
				errorList.createDiv({
					text: `...and ${r.errors.length - 20} more`,
					cls: "ft-text-muted",
				});
			}
		}

		// ── Create .base view option ───────────────────────
		if (!this.basePath) {
			this.basePath = this.targetFolder
				? `${this.targetFolder}/${this.getBaseFilename()}`
				: this.getBaseFilename();
		}
		let checkPath = this.basePath.trim();
		if (checkPath && !checkPath.endsWith(".base")) checkPath += ".base";
		const baseExists = !!this.app.vault.getAbstractFileByPath(checkPath);

		if (baseExists) {
			new Setting(container)
				.setName("Base view")
				.setDesc(`Already exists: ${checkPath}`);
		} else {
			container.createEl("h4", { text: "Create Base View", cls: "ft-mt-4" });

			new Setting(container)
				.setName("Create a .base view file")
				.setDesc("Generate a table view for the imported notes")
				.addToggle((toggle) =>
					toggle
						.setValue(this.createBase)
						.onChange((v) => {
							this.createBase = v;
							this.renderContent();
						}),
				);

			if (this.createBase) {
				const baseSetting = new Setting(container)
					.setName("Base file path")
					.setDesc("Where to save the .base view file")
					.addText((text) =>
						text
							.setValue(this.basePath)
							.setPlaceholder("path/to/view.base")
							.onChange((v) => {
								this.basePath = v;
							}),
					);
				baseSetting.addExtraButton((btn) =>
					btn
						.setIcon("folder")
						.setTooltip("Browse vault folders")
						.onClick(() => this.openBaseFolderPicker()),
				);

				const createBtn = container.createEl("button", {
					text: "Create .base",
					cls: "ft-btn ft-btn-sm ft-mt-2",
				});
				createBtn.addEventListener("click", () => void this.createBaseFile());
			}
		}

		this.renderNav(container, { cancel: true, cancelLabel: "Back to CSV" });
	}

	// ── Navigation helpers ──────────────────────────────────

	private renderNav(
		el: HTMLElement,
		options: {
			cancel?: boolean;
			cancelLabel?: string;
			back?: CsvPage;
			next?: CsvPage;
			execute?: boolean;
			save?: boolean;
		},
	): void {
		const nav = new Setting(el).setClass("ft-mt-4");

		if (options.cancel) {
			nav.addButton((btn) =>
				btn
					.setButtonText(options.cancelLabel ?? "Cancel")
					.onClick(() => {
						this.resetImportState();
						this.currentPage = "landing";
						this.renderContent();
					}),
			);
		}

		if (options.back) {
			const backPage = options.back;
			nav.addButton((btn) =>
				btn.setButtonText("Back").onClick(() => {
					this.currentPage = backPage;
					this.renderContent();
				}),
			);
		}

		if (options.save) {
			nav.addButton((btn) =>
				btn
					.setButtonText("Save Config")
					.onClick(() => this.promptSaveConfig()),
			);
		}

		if (options.next) {
			const nextPage = options.next;
			nav.addButton((btn) =>
				btn
					.setButtonText("Next")
					.setCta()
					.onClick(() => {
						this.currentPage = nextPage;
						this.renderContent();
					}),
			);
		}

		if (options.execute) {
			nav.addButton((btn) =>
				btn
					.setButtonText("Import")
					.setCta()
					.onClick(() => {
						this.currentPage = "result";
						this.renderContent();
						void this.runImport();
					}),
			);
		}
	}

	// ── Execution ───────────────────────────────────────────

	private async runImport(): Promise<void> {
		try {
			this.importResult = await this.importService!.executeImport({
				sourcePath: this.file!.path,
				targetFolder: this.targetFolder,
				nameColumn: this.nameColumn,
				columnMappings: this.columnMappings,
				conflictStrategy: this.conflictStrategy,
			});
			const r = this.importResult;
			new Notice(
				`Import complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped`,
			);
		} catch (error) {
			this.importError =
				error instanceof Error ? error.message : String(error);
		}
		this.renderContent();
	}

	// ── Config save/load ───────────────────────────────────

	private applySavedImportConfig(id: string): void {
		const cfg = this.savedConfigs.find((c) => c.id === id);
		if (!cfg) return;
		this.targetFolder = cfg.targetFolder;
		this.nameColumn = cfg.nameColumn;
		this.conflictStrategy = cfg.conflictStrategy;
		if (cfg.columnMappings.length > 0 && this.columnMappings.length > 0) {
			for (const mapping of this.columnMappings) {
				const saved = cfg.columnMappings.find(
					(s) => s.csvColumn === mapping.csvColumn,
				);
				if (saved) {
					mapping.frontmatterKey = saved.frontmatterKey;
					mapping.included = saved.included;
				}
			}
		}
		new Notice(`Loaded config: ${cfg.name}`);
	}

	private promptSaveConfig(): void {
		const existing = this.contentEl.querySelector(".ft-save-config-prompt");
		if (existing) return;

		const prompt = this.contentEl.createDiv({
			cls: "ft-save-config-prompt ft-flex ft-gap-2 ft-items-center ft-mt-2 ft-p-2",
		});
		const input = prompt.createEl("input", {
			type: "text",
			cls: "ft-input",
		});
		input.placeholder = "Config name";
		input.style.flex = "1";
		const saveBtn = prompt.createEl("button", {
			text: "Save",
			cls: "ft-btn ft-btn-sm",
		});
		saveBtn.addEventListener("click", () => {
			const name = input.value.trim();
			if (!name) {
				new Notice("Please enter a name for this config");
				return;
			}
			void this.dataExchangeService
				.saveImportConfig({
					name,
					targetFolder: this.targetFolder,
					nameColumn: this.nameColumn,
					columnMappings: [...this.columnMappings],
					conflictStrategy: this.conflictStrategy,
				})
				.then((saved) => {
					this.savedConfigs = this.dataExchangeService.getSavedImportConfigs();
					new Notice(`Config saved: ${saved.name}`);
					prompt.remove();
				})
				.catch((err) =>
					console.error("[Flowti] Failed to save import config", err),
				);
		});
		input.focus();
	}

	// ── Folder pickers ─────────────────────────────────────

	private openFolderPicker(): void {
		const folders = getVaultFolders(this.app);
		new FolderPickerModal(this.app, folders, (folder) => {
			this.targetFolder = folder;
			this.renderContent();
		}).open();
	}

	private openBaseFolderPicker(): void {
		const folders = getVaultFolders(this.app);
		new FolderPickerModal(this.app, folders, (folder) => {
			const filename = this.getBaseFilename();
			this.basePath = folder ? `${folder}/${filename}` : filename;
			this.renderContent();
		}).open();
	}

	// ── .base file creation ────────────────────────────────

	private generateBaseYaml(): string {
		const folder = this.targetFolder;
		const includedMappings = this.columnMappings.filter(
			(m) => m.included && m.csvColumn !== this.nameColumn,
		);

		const lines: string[] = [];
		lines.push("filters:");
		lines.push("  and:");
		lines.push(`    - 'file.inFolder("${folder}")'`);
		lines.push(`    - 'file.ext == "md"'`);
		lines.push("");
		lines.push("views:");
		lines.push("  - name: \"Imported Data\"");
		lines.push("    type: \"table\"");
		if (includedMappings.length > 0) {
			lines.push("    order:");
			lines.push("      - \"file.name\"");
			for (const m of includedMappings) {
				lines.push(`      - "${m.frontmatterKey}"`);
			}
		}
		return lines.join("\n") + "\n";
	}

	private async createBaseFile(): Promise<void> {
		if (!this.basePath.trim()) {
			new Notice("Please enter a path for the .base file");
			return;
		}

		let path = this.basePath.trim();
		if (!path.endsWith(".base")) path += ".base";

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing) {
			new Notice(`Base file already exists: ${path}`);
			return;
		}

		try {
			const content = this.generateBaseYaml();
			await this.app.vault.create(path, content);
			new Notice(`Base view created: ${path}`);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			new Notice(`Failed to create .base file: ${msg}`);
		}
	}

	private getBaseFilename(): string {
		const parts = (this.file?.path ?? "imported.csv").replace(/\\/g, "/").split("/");
		const csvFile = parts[parts.length - 1] || "imported.csv";
		return csvFile.replace(/\.csv$/i, ".base");
	}

	// ── Initialization ──────────────────────────────────────

	private initializeFromCsv(): void {
		if (!this.parsedCsv) return;

		const csvPath = this.file!.path;
		const lastSlash = csvPath.lastIndexOf("/");
		const csvFolder =
			lastSlash >= 0 ? csvPath.substring(0, lastSlash) : "";
		this.targetFolder = csvFolder
			? `${csvFolder}/imported`
			: "imported";

		this.nameColumn = this.parsedCsv.headers[0] ?? "";

		this.columnMappings = this.parsedCsv.headers.map((h) => ({
			csvColumn: h,
			frontmatterKey: h
				.toLowerCase()
				.replace(/\s+/g, "_")
				.replace(/[^a-z0-9_]/g, ""),
			included: true,
		}));
	}
}
