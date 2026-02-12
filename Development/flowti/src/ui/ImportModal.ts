/**
 * ImportModal — 4-page wizard for importing CSV files as vault notes.
 *
 * Pages: Source → Configure → Preview → Execute
 *
 * Follows the InstallerWizardModal pattern for multi-page modals.
 */

import { App, Modal, Notice, Setting } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { ImportService } from "../domain/dataExchange/ImportService";
import type {
	ColumnMapping,
	ConflictStrategy,
	ImportResult,
	ParsedCsv,
} from "../domain/dataExchange/types";

type ImportPage = "source" | "configure" | "preview" | "execute";

export class ImportModal extends Modal {
	private eventBus: IEventBus;
	private importService: ImportService;
	private csvPath: string;
	private unsubscribes: (() => void)[] = [];

	// State
	private currentPage: ImportPage = "source";
	private parsedCsv: ParsedCsv | null = null;
	private parseError: string | null = null;
	private targetFolder = "";
	private nameColumn = "";
	private columnMappings: ColumnMapping[] = [];
	private conflictStrategy: ConflictStrategy = "skip";
	private importResult: ImportResult | null = null;
	private importError: string | null = null;
	private importProgress = { current: 0, total: 0 };

	constructor(
		app: App,
		eventBus: IEventBus,
		importService: ImportService,
		csvPath: string,
	) {
		super(app);
		this.eventBus = eventBus;
		this.importService = importService;
		this.csvPath = csvPath;
	}

	async onOpen(): Promise<void> {
		this.modalEl.addClass("flowti-import-modal");

		// Subscribe to progress events
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.import.progress", (event) => {
				this.importProgress = {
					current: event.payload.current,
					total: event.payload.total,
				};
				if (this.currentPage === "execute" && !this.importResult) {
					this.renderProgressIndicator();
				}
			}),
		);

		// Parse CSV immediately
		try {
			this.parsedCsv = await this.importService.parseFile(this.csvPath);
			this.initializeFromCsv();
		} catch (error) {
			this.parseError =
				error instanceof Error ? error.message : String(error);
		}

		this.renderPage();
	}

	onClose(): void {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
		this.contentEl.empty();
	}

	// ── Page routing ────────────────────────────────────────

	private renderPage(): void {
		const { contentEl } = this;
		contentEl.empty();

		switch (this.currentPage) {
			case "source":
				this.renderSourcePage(contentEl);
				break;
			case "configure":
				this.renderConfigurePage(contentEl);
				break;
			case "preview":
				this.renderPreviewPage(contentEl);
				break;
			case "execute":
				this.renderExecutePage(contentEl);
				break;
		}
	}

	// ── Page 1: Source ───────────────────────────────────────

	private renderSourcePage(el: HTMLElement): void {
		el.createEl("h3", { text: "Import CSV as Notes" });

		if (this.parseError) {
			const alert = el.createDiv({ cls: "ft-alert-error ft-p-3 ft-mb-4" });
			alert.createEl("strong", { text: "Parse Error: " });
			alert.createSpan({ text: this.parseError });
			this.renderNav(el, { cancel: true });
			return;
		}

		if (!this.parsedCsv) return;

		new Setting(el)
			.setName("Source file")
			.setDesc(this.csvPath);

		new Setting(el)
			.setName("Rows detected")
			.setDesc(`${this.parsedCsv.rowCount} data rows`);

		new Setting(el)
			.setName("Columns detected")
			.setDesc(this.parsedCsv.headers.join(", "));

		this.renderNav(el, { cancel: true, next: "configure" });
	}

	// ── Page 2: Configure ───────────────────────────────────

	private renderConfigurePage(el: HTMLElement): void {
		el.createEl("h3", { text: "Configure Import" });

		if (!this.parsedCsv) return;

		// Target folder
		new Setting(el)
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

		// Name column
		new Setting(el)
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
		new Setting(el)
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
		el.createEl("h4", { text: "Column Mapping", cls: "ft-mt-4" });
		el.createEl("p", {
			text: "Map CSV columns to frontmatter keys. Uncheck to exclude.",
			cls: "ft-text-muted ft-text-sm",
		});

		// Column mapping repeater
		const mappingContainer = el.createDiv({ cls: "ft-flex-col ft-gap-1" });
		for (const mapping of this.columnMappings) {
			if (mapping.csvColumn === this.nameColumn) continue;

			const row = mappingContainer.createDiv({
				cls: "ft-column-mapping-row",
			});

			// CSV column label
			row.createSpan({
				text: mapping.csvColumn,
				cls: "ft-text-sm",
			}).style.width = "120px";

			// Arrow
			row.createSpan({ text: "\u2192", cls: "ft-text-muted" });

			// Frontmatter key input
			const inputEl = row.createEl("input", {
				type: "text",
				cls: "ft-input",
			});
			inputEl.value = mapping.frontmatterKey;
			inputEl.style.flex = "1";
			inputEl.addEventListener("input", () => {
				mapping.frontmatterKey = inputEl.value;
			});

			// Include toggle
			const toggleEl = row.createEl("input", { type: "checkbox" });
			toggleEl.checked = mapping.included;
			toggleEl.addEventListener("change", () => {
				mapping.included = toggleEl.checked;
			});
		}

		this.renderNav(el, { back: "source", next: "preview" });
	}

	// ── Page 3: Preview ─────────────────────────────────────

	private renderPreviewPage(el: HTMLElement): void {
		el.createEl("h3", { text: "Preview" });

		if (!this.parsedCsv) return;

		const includedMappings = this.columnMappings.filter(
			(m) => m.included && m.csvColumn !== this.nameColumn,
		);

		// Preview table
		const table = el.createEl("table", { cls: "ft-preview-table" });
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
			const filename = this.importService.sanitizeFilename(
				row[nameIndex] ?? "",
			);
			tr.createEl("td", { text: filename || "(empty)" });

			for (const m of includedMappings) {
				const colIdx = this.parsedCsv!.headers.indexOf(m.csvColumn);
				tr.createEl("td", { text: row[colIdx] ?? "" });
			}
		}

		if (this.parsedCsv.rowCount > 10) {
			el.createEl("p", {
				text: `Showing 10 of ${this.parsedCsv.rowCount} rows`,
				cls: "ft-text-muted ft-text-sm ft-mt-2",
			});
		}

		// Validation
		const issues: string[] = [];
		if (!this.targetFolder.trim()) issues.push("Target folder is required");
		if (!this.nameColumn) issues.push("Name column is required");
		if (includedMappings.length === 0)
			issues.push("At least one column must be included");

		if (issues.length > 0) {
			const alert = el.createDiv({
				cls: "ft-alert-warning ft-p-3 ft-mt-4",
			});
			for (const issue of issues) {
				alert.createEl("p", { text: issue });
			}
		}

		this.renderNav(el, {
			back: "configure",
			execute: issues.length === 0,
		});
	}

	// ── Page 4: Execute ─────────────────────────────────────

	private renderExecutePage(el: HTMLElement): void {
		el.createEl("h3", { text: "Importing..." });

		if (this.importResult) {
			this.renderResult(el);
			return;
		}

		if (this.importError) {
			const alert = el.createDiv({ cls: "ft-alert-error ft-p-3" });
			alert.createEl("strong", { text: "Import Failed: " });
			alert.createSpan({ text: this.importError });
			this.renderNav(el, { cancel: true });
			return;
		}

		// Progress indicator container
		el.createDiv({ cls: "ft-import-progress" });
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

	private renderResult(el: HTMLElement): void {
		const r = this.importResult!;

		el.empty();
		el.createEl("h3", { text: "Import Complete" });

		const stats = el.createDiv({ cls: "ft-card ft-p-3 ft-flex-col ft-gap-1" });
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
			el.createEl("h4", { text: "Errors", cls: "ft-mt-4" });
			const errorList = el.createDiv({
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

		new Notice(
			`Import complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped`,
		);

		this.renderNav(el, { cancel: true, cancelLabel: "Close" });
	}

	// ── Navigation helpers ──────────────────────────────────

	private renderNav(
		el: HTMLElement,
		options: {
			cancel?: boolean;
			cancelLabel?: string;
			back?: ImportPage;
			next?: ImportPage;
			execute?: boolean;
		},
	): void {
		const nav = new Setting(el).setClass("ft-mt-4");

		if (options.cancel) {
			nav.addButton((btn) =>
				btn
					.setButtonText(options.cancelLabel ?? "Cancel")
					.onClick(() => this.close()),
			);
		}

		if (options.back) {
			const backPage = options.back;
			nav.addButton((btn) =>
				btn.setButtonText("Back").onClick(() => {
					this.currentPage = backPage;
					this.renderPage();
				}),
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
						this.renderPage();
					}),
			);
		}

		if (options.execute) {
			nav.addButton((btn) =>
				btn
					.setButtonText("Import")
					.setCta()
					.onClick(() => {
						this.currentPage = "execute";
						this.renderPage();
						void this.runImport();
					}),
			);
		}
	}

	// ── Execution ───────────────────────────────────────────

	private async runImport(): Promise<void> {
		try {
			this.importResult = await this.importService.executeImport({
				sourcePath: this.csvPath,
				targetFolder: this.targetFolder,
				nameColumn: this.nameColumn,
				columnMappings: this.columnMappings,
				conflictStrategy: this.conflictStrategy,
			});
		} catch (error) {
			this.importError =
				error instanceof Error ? error.message : String(error);
		}
		this.renderPage();
	}

	// ── Initialization ──────────────────────────────────────

	private initializeFromCsv(): void {
		if (!this.parsedCsv) return;

		// Default target folder: same folder as CSV + "/imported"
		const lastSlash = this.csvPath.lastIndexOf("/");
		const csvFolder =
			lastSlash >= 0 ? this.csvPath.substring(0, lastSlash) : "";
		this.targetFolder = csvFolder
			? `${csvFolder}/imported`
			: "imported";

		// Default name column: first header
		this.nameColumn = this.parsedCsv.headers[0] ?? "";

		// Initialize column mappings: auto-map all headers
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
