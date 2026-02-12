/**
 * Export View for Flowti.
 *
 * A dedicated ItemView for exporting vault data as CSV or tab-delimited files.
 * Triggered from context menus on folders / `.base` files, or from the command palette.
 *
 * Pages: View Select (base only) → Configure → Preview → Result
 */

import { ItemView, Notice, Setting, WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService";
import type { ExportService } from "../domain/dataExchange/ExportService";
import type {
	ExportConflictStrategy,
	ExportFormat,
	ExportResult,
	FilePropertyDef,
	ParsedBaseFile,
	SavedExportConfig,
	VaultFileInfo,
} from "../domain/dataExchange/types";
import { STANDARD_FILE_PROPERTIES } from "../domain/dataExchange/types";
import { FolderPickerModal, getVaultFolders } from "./FolderPickerModal";

export const VIEW_TYPE_EXPORT = "flowti-export";

export interface ExportViewConfig {
	sourcePath: string;
	sourceType: "folder" | "base";
	format: ExportFormat;
}

type ExportPage = "view-select" | "configure" | "preview" | "result";

export class ExportView extends ItemView {
	private eventBus: IEventBus;
	private dataExchangeService: DataExchangeService;
	private getConfig: () => ExportViewConfig | null;

	// Config (set in onOpen)
	private exportService!: ExportService;
	private sourcePath = "";
	private sourceType: "folder" | "base" = "folder";
	private format: ExportFormat = "csv";

	// State
	private currentPage: ExportPage = "configure";
	private outputPath = "";
	private isExternal = false;
	private availableColumns: string[] = [];
	private selectedColumns: string[] = [];
	private selectedFileProperties: string[] = ["file.name"];
	private baseViewIndex = 0;
	private baseFile: ParsedBaseFile | null = null;
	private previewFiles: VaultFileInfo[] = [];
	private conflictStrategy: ExportConflictStrategy = "overwrite";
	private displayNames: Record<string, string> = {};
	private exportResult: ExportResult | null = null;
	private exportError: string | null = null;
	private loadError: string | null = null;
	private savedConfigs: SavedExportConfig[] = [];

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		dataExchangeService: DataExchangeService,
		getConfig: () => ExportViewConfig | null,
	) {
		super(leaf);
		this.eventBus = eventBus;
		this.dataExchangeService = dataExchangeService;
		this.getConfig = getConfig;
	}

	getViewType(): string {
		return VIEW_TYPE_EXPORT;
	}

	getDisplayText(): string {
		if (!this.sourcePath) return "Export";
		const fmt = this.format === "tab" ? "Tab" : "CSV";
		const parts = this.sourcePath.replace(/\\/g, "/").split("/");
		const name = parts[parts.length - 1] || this.sourcePath;
		return `Export ${fmt}: ${name}`;
	}

	getIcon(): string {
		return "file-output";
	}

	async onOpen(): Promise<void> {
		const config = this.getConfig();
		if (!config) {
			this.contentEl.addClass("flowti-csv-action");
			const container = this.contentEl.createDiv({ cls: "flowti-csv-container" });
			container.createEl("p", {
				text: "No export configuration provided.",
				cls: "ft-text-muted",
			});
			return;
		}

		this.exportService = this.dataExchangeService.getExportService();
		this.sourcePath = config.sourcePath;
		this.sourceType = config.sourceType;
		this.format = config.format;
		this.savedConfigs = this.dataExchangeService.getSavedExportConfigs()
			.filter((c) => c.format === config.format);
		this.currentPage = config.sourceType === "base" ? "view-select" : "configure";

		// Default output path
		const baseName = config.sourcePath.replace(/\.\w+$/, "");
		const ext = config.format === "tab" ? ".txt" : ".csv";
		this.outputPath = `${baseName}_export${ext}`;

		try {
			if (this.sourceType === "base") {
				this.baseFile =
					await this.exportService.parseBaseViews(this.sourcePath);
			}
			await this.loadColumnsAndPreview();
		} catch (error) {
			this.loadError =
				error instanceof Error ? error.message : String(error);
		}

		this.renderPage();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	// ── Page routing ────────────────────────────────────────

	private renderPage(): void {
		const el = this.contentEl;
		el.empty();
		el.addClass("flowti-csv-action");

		if (this.loadError && this.currentPage !== "result") {
			this.renderError(el);
			return;
		}

		switch (this.currentPage) {
			case "view-select":
				this.renderViewSelectPage(el);
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

	private renderError(el: HTMLElement): void {
		const container = el.createDiv({ cls: "flowti-csv-container flowti-csv-wide" });
		container.createEl("h3", { text: "Export" });
		const alert = container.createDiv({ cls: "ft-alert-error ft-p-3" });
		alert.createEl("strong", { text: "Error: " });
		alert.createSpan({ text: this.loadError! });
		this.renderNav(container, { close: true });
	}

	// ── Page 0: View Select (.base only) ────────────────────

	private renderViewSelectPage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "flowti-csv-container flowti-csv-wide" });
		container.createEl("h3", { text: "Select View to Export" });

		if (!this.baseFile || this.baseFile.views.length === 0) {
			container.createEl("p", {
				text: "No views found in this base file.",
				cls: "ft-text-muted",
			});
			this.renderNav(container, { close: true });
			return;
		}

		container.createEl("p", {
			text: `${this.baseFile.views.length} view(s) found in ${this.sourcePath}`,
			cls: "ft-text-muted ft-text-sm ft-mb-3",
		});

		const viewList = container.createDiv({ cls: "ft-flex-col ft-gap-2" });
		for (let i = 0; i < this.baseFile.views.length; i++) {
			const view = this.baseFile.views[i];
			const card = viewList.createDiv({
				cls: `ft-card ft-p-3 ${i === this.baseViewIndex ? "ft-card-selected" : ""}`,
			});
			card.style.cursor = "pointer";

			card.createDiv({
				text: view.name,
				cls: "ft-font-bold",
			});
			card.createDiv({
				text: `Type: ${view.type}${view.order ? ` \u00B7 ${view.order.length} columns` : ""}`,
				cls: "ft-text-muted ft-text-sm",
			});

			const viewIndex = i;
			card.addEventListener("click", () => {
				this.baseViewIndex = viewIndex;
				this.renderPage();
			});
		}

		this.renderNav(container, {
			close: true,
			next: "configure",
			onNext: async () => {
				await this.loadColumnsAndPreview();
			},
		});
	}

	// ── Page 1: Configure ───────────────────────────────────

	private renderConfigurePage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "flowti-csv-container flowti-csv-wide" });
		const formatLabel = this.format === "tab" ? "Tab-delimited" : "CSV";
		container.createEl("h3", { text: `Configure Export (${formatLabel})` });

		// Load saved config
		if (this.savedConfigs.length > 0) {
			new Setting(container)
				.setName("Load saved config")
				.setDesc("Apply a previously saved export configuration")
				.addDropdown((dd) => {
					dd.addOption("", "\u2014 Select \u2014");
					for (const cfg of this.savedConfigs) {
						dd.addOption(cfg.id, cfg.name);
					}
					dd.onChange((id) => {
						if (!id) return;
						this.applySavedExportConfig(id);
					});
				});
		}

		// Target indicator
		const targetDesc = this.isExternal
			? "Saving to filesystem (absolute path)"
			: "Saving inside vault";
		const outputSetting = new Setting(container)
			.setName("Output file")
			.setDesc(targetDesc)
			.addText((text) =>
				text
					.setValue(this.outputPath)
					.setPlaceholder(this.isExternal ? "C:\\path\\to\\output.csv" : "path/to/output.csv")
					.onChange((v) => {
						this.outputPath = v;
					}),
			);
		outputSetting.addExtraButton((btn) =>
			btn
				.setIcon("folder")
				.setTooltip("Browse vault folders")
				.onClick(() => this.openFolderPicker()),
		);
		outputSetting.addExtraButton((btn) =>
			btn
				.setIcon("hard-drive")
				.setTooltip("Save to filesystem")
				.onClick(() => this.openNativeSaveDialog()),
		);

		// Conflict strategy
		new Setting(container)
			.setName("If file exists")
			.setDesc("How to handle an existing output file")
			.addDropdown((dd) =>
				dd
					.addOptions({
						overwrite: "Overwrite",
						skip: "Skip (do nothing)",
						append: "Append rows",
					})
					.setValue(this.conflictStrategy)
					.onChange((v) => {
						this.conflictStrategy = v as ExportConflictStrategy;
					}),
			);

		// ── File Properties ──────────────────────────────────
		container.createEl("h4", { text: "File Properties", cls: "ft-mt-4" });
		container.createEl("p", {
			text: "Standard Obsidian file properties to include as columns.",
			cls: "ft-text-muted ft-text-sm ft-mb-2",
		});

		const filePropsContainer = container.createDiv({
			cls: "ft-flex ft-flex-wrap ft-gap-2 ft-mb-3",
		});
		for (const fp of STANDARD_FILE_PROPERTIES) {
			const label = filePropsContainer.createEl("label", {
				cls: "ft-flex ft-items-center ft-gap-1 ft-text-sm",
			});
			const cb = label.createEl("input", { type: "checkbox" });
			cb.checked = this.selectedFileProperties.includes(fp.key);
			const key = fp.key;
			cb.addEventListener("change", () => {
				if (cb.checked) {
					if (!this.selectedFileProperties.includes(key)) {
						this.selectedFileProperties.push(key);
					}
				} else {
					this.selectedFileProperties = this.selectedFileProperties.filter(
						(p) => p !== key,
					);
				}
			});
			label.createSpan({ text: fp.label });
		}

		// ── Note Properties ──────────────────────────────────
		container.createEl("h4", { text: "Note Properties", cls: "ft-mt-4" });

		if (this.availableColumns.length === 0) {
			container.createEl("p", {
				text: "No frontmatter properties found in the source files.",
				cls: "ft-text-muted ft-text-sm",
			});
		} else {
			const actions = container.createDiv({
				cls: "ft-flex ft-gap-2 ft-mb-2",
			});

			const selectAllBtn = actions.createEl("button", {
				text: "Select All",
				cls: "ft-btn ft-btn-sm",
			});
			selectAllBtn.addEventListener("click", () => {
				this.selectedColumns = [...this.availableColumns];
				this.renderPage();
			});

			const deselectAllBtn = actions.createEl("button", {
				text: "Deselect All",
				cls: "ft-btn ft-btn-sm",
			});
			deselectAllBtn.addEventListener("click", () => {
				this.selectedColumns = [];
				this.renderPage();
			});

			const colContainer = container.createDiv({
				cls: "ft-flex ft-flex-wrap ft-gap-2",
			});
			for (const col of this.availableColumns) {
				const label = colContainer.createEl("label", {
					cls: "ft-flex ft-items-center ft-gap-1 ft-text-sm",
				});
				const cb = label.createEl("input", { type: "checkbox" });
				cb.checked = this.selectedColumns.includes(col);
				cb.addEventListener("change", () => {
					if (cb.checked) {
						if (!this.selectedColumns.includes(col)) {
							this.selectedColumns.push(col);
						}
					} else {
						this.selectedColumns = this.selectedColumns.filter(
							(c) => c !== col,
						);
					}
				});
				label.createSpan({ text: col });
			}
		}

		const backPage: ExportPage | undefined =
			this.sourceType === "base" ? "view-select" : undefined;
		this.renderNav(container, {
			close: true,
			back: backPage,
			next: "preview",
			save: true,
		});
	}

	// ── Page 2: Preview ─────────────────────────────────────

	private renderPreviewPage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "flowti-csv-container flowti-csv-wide" });
		container.createEl("h3", { text: "Preview" });

		const dn = this.displayNames;
		const fileHeaders: { key: string; label: string }[] =
			this.selectedFileProperties.map((key) => ({
				key,
				label: dn[key] ?? this.getFilePropertyLabel(key),
			}));
		const columnHeaders: { key: string; label: string }[] =
			this.selectedColumns.map((col) => ({
				key: col,
				label: dn[col] ?? dn[`note.${col}`] ?? col,
			}));
		const allHeaders = [
			...fileHeaders.map((h) => h.label),
			...columnHeaders.map((h) => h.label),
		];

		if (allHeaders.length === 0) {
			container.createEl("p", {
				text: "No columns selected. Go back and select at least one column.",
				cls: "ft-text-muted",
			});
			this.renderNav(container, { back: "configure", close: true });
			return;
		}

		// Preview table
		const maxPreview = 5;
		const table = container.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const h of allHeaders) {
			headerRow.createEl("th", { text: h });
		}

		const tbody = table.createEl("tbody");
		const previewSlice = this.previewFiles.slice(0, maxPreview);

		for (const file of previewSlice) {
			const tr = tbody.createEl("tr");
			for (const fh of fileHeaders) {
				tr.createEl("td", { text: this.resolveFileProperty(file, fh.key) });
			}
			for (const ch of columnHeaders) {
				const val = file.frontmatter?.[ch.key];
				tr.createEl("td", {
					text:
						val !== undefined && val !== null
							? String(val)
							: "",
				});
			}
		}

		if (this.previewFiles.length > maxPreview) {
			container.createEl("p", {
				text: `Showing ${maxPreview} of ${this.previewFiles.length} rows`,
				cls: "ft-text-muted ft-text-sm ft-mt-2",
			});
		} else {
			container.createEl("p", {
				text: `${this.previewFiles.length} rows total`,
				cls: "ft-text-muted ft-text-sm ft-mt-2",
			});
		}

		// Validation
		const issues: string[] = [];
		if (!this.outputPath.trim()) issues.push("Output path is required");
		if (allHeaders.length === 0) issues.push("At least one column is required");

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

	// ── Page 3: Result ──────────────────────────────────────

	private renderResultPage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "flowti-csv-container flowti-csv-wide" });

		if (this.exportResult) {
			this.renderExportResult(container);
			return;
		}

		if (this.exportError) {
			container.createEl("h3", { text: "Export Failed" });
			const alert = container.createDiv({ cls: "ft-alert-error ft-p-3" });
			alert.createEl("strong", { text: "Error: " });
			alert.createSpan({ text: this.exportError });
			this.renderNav(container, { back: "configure", close: true });
			return;
		}

		container.createEl("h3", { text: "Exporting..." });
		container.createDiv({
			text: "Writing export file...",
			cls: "ft-text-muted ft-p-3",
		});
	}

	private renderExportResult(container: HTMLElement): void {
		const r = this.exportResult!;

		if (r.skipped) {
			container.createEl("h3", { text: "Export Skipped" });
			const info = container.createDiv({ cls: "ft-card ft-p-3" });
			info.createDiv({ text: `File already exists: ${r.outputPath}` });
			info.createDiv({
				text: "The conflict strategy was set to \"skip\", so no changes were made.",
				cls: "ft-text-muted ft-text-sm ft-mt-1",
			});
			new Notice(`Export skipped: ${r.outputPath} already exists`);
			this.renderNav(container, { close: true, closeLabel: "Close" });
			return;
		}

		container.createEl("h3", { text: "Export Complete" });

		const stats = container.createDiv({
			cls: "ft-card ft-p-3 ft-flex-col ft-gap-1",
		});
		stats.createDiv({ text: `Rows exported: ${r.totalRows}` });
		stats.createDiv({ text: `Columns: ${r.totalColumns}` });
		stats.createDiv({ text: `Output file: ${r.outputPath}` });

		new Notice(
			`Export complete: ${r.totalRows} rows written to ${r.outputPath}`,
		);

		this.renderNav(container, { close: true, closeLabel: "Close" });
	}

	// ── Navigation helpers ──────────────────────────────────

	private renderNav(
		el: HTMLElement,
		options: {
			close?: boolean;
			closeLabel?: string;
			back?: ExportPage;
			next?: ExportPage;
			onNext?: () => Promise<void>;
			execute?: boolean;
			save?: boolean;
		},
	): void {
		const nav = new Setting(el).setClass("ft-mt-4");

		if (options.close) {
			nav.addButton((btn) =>
				btn
					.setButtonText(options.closeLabel ?? "Cancel")
					.onClick(() => this.leaf.detach()),
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
					.onClick(async () => {
						if (options.onNext) await options.onNext();
						this.currentPage = nextPage;
						this.renderPage();
					}),
			);
		}

		if (options.execute) {
			nav.addButton((btn) =>
				btn
					.setButtonText("Export")
					.setCta()
					.onClick(() => {
						this.currentPage = "result";
						this.renderPage();
						void this.runExport();
					}),
			);
		}
	}

	// ── Execution ───────────────────────────────────────────

	private async runExport(): Promise<void> {
		try {
			this.exportResult = await this.exportService.executeExport({
				sourcePath: this.sourcePath,
				sourceType: this.sourceType,
				format: this.format,
				outputPath: this.outputPath,
				columns: this.selectedColumns,
				fileProperties: [...this.selectedFileProperties],
				baseViewIndex: this.baseViewIndex,
				displayNames: Object.keys(this.displayNames).length > 0
					? this.displayNames
					: undefined,
				isExternal: this.isExternal || undefined,
				conflictStrategy: this.conflictStrategy,
			});
		} catch (error) {
			this.exportError =
				error instanceof Error ? error.message : String(error);
		}
		this.renderPage();
	}

	// ── Helpers ─────────────────────────────────────────────

	private getFilePropertyLabel(key: string): string {
		const def = STANDARD_FILE_PROPERTIES.find((p: FilePropertyDef) => p.key === key);
		return def?.label ?? key.replace(/^file\./, "");
	}

	private resolveFileProperty(file: VaultFileInfo, key: string): string {
		switch (key) {
			case "file.name": return file.basename;
			case "file.basename": return file.basename;
			case "file.fullname": return `${file.basename}.${file.extension}`;
			case "file.path": return file.path;
			case "file.folder": return file.folder;
			case "file.ext": return file.extension;
			case "file.ctime":
				return file.stat?.ctime ? new Date(file.stat.ctime).toISOString() : "";
			case "file.mtime":
				return file.stat?.mtime ? new Date(file.stat.mtime).toISOString() : "";
			case "file.size":
				return file.stat?.size !== undefined ? String(file.stat.size) : "";
			case "file.tags": return file.tags?.join(", ") ?? "";
			default: return "";
		}
	}

	private openFolderPicker(): void {
		const folders = getVaultFolders(this.app);
		new FolderPickerModal(this.app, folders, (folder) => {
			const filename = this.getFilenameFromPath(this.outputPath);
			this.outputPath = folder ? `${folder}/${filename}` : filename;
			this.isExternal = false;
			this.renderPage();
		}).open();
	}

	private async openNativeSaveDialog(): Promise<void> {
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const { remote } = require("electron");
			const ext = this.format === "tab" ? "txt" : "csv";
			const filters = this.format === "tab"
				? [{ name: "Tab-Separated", extensions: ["txt", "tsv"] }, { name: "All Files", extensions: ["*"] }]
				: [{ name: "CSV Files", extensions: ["csv"] }, { name: "All Files", extensions: ["*"] }];

			const result = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), {
				defaultPath: this.getFilenameFromPath(this.outputPath) || `export.${ext}`,
				filters,
			});

			if (!result.canceled && result.filePath) {
				this.outputPath = result.filePath;
				this.isExternal = true;
				this.renderPage();
			}
		} catch {
			new Notice("Could not open save dialog. Try entering the path manually.");
		}
	}

	private getFilenameFromPath(p: string): string {
		const parts = p.replace(/\\/g, "/").split("/");
		return parts[parts.length - 1] || p;
	}

	// ── Config save/load ───────────────────────────────────

	private applySavedExportConfig(id: string): void {
		const cfg = this.savedConfigs.find((c) => c.id === id);
		if (!cfg) return;
		// Never override format — it's determined by how the view was opened
		this.outputPath = cfg.outputPath;
		this.selectedColumns = [...cfg.columns];
		this.selectedFileProperties = [...cfg.fileProperties];
		this.conflictStrategy = cfg.conflictStrategy ?? "overwrite";
		if (cfg.baseViewIndex !== undefined) {
			this.baseViewIndex = cfg.baseViewIndex;
		}
		if (cfg.isExternal !== undefined) {
			this.isExternal = cfg.isExternal;
		}
		new Notice(`Loaded config: ${cfg.name}`);
		this.renderPage();
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
				.saveExportConfig({
					name,
					sourcePath: this.sourcePath,
					sourceType: this.sourceType,
					format: this.format,
					outputPath: this.outputPath,
					columns: [...this.selectedColumns],
					fileProperties: [...this.selectedFileProperties],
					baseViewIndex: this.baseViewIndex,
					conflictStrategy: this.conflictStrategy,
					isExternal: this.isExternal || undefined,
				})
				.then((saved) => {
					this.savedConfigs = this.dataExchangeService.getSavedExportConfigs()
						.filter((c) => c.format === this.format);
					new Notice(`Config saved: ${saved.name}`);
					prompt.remove();
				})
				.catch((err) =>
					console.error("[Flowti] Failed to save export config", err),
				);
		});
		input.focus();
	}

	private async loadColumnsAndPreview(): Promise<void> {
		this.availableColumns = await this.exportService.scanColumns(
			this.sourcePath,
			this.sourceType,
			this.baseViewIndex,
		);
		this.selectedColumns = [...this.availableColumns];
		this.previewFiles = await this.exportService.resolveExportFiles(
			this.sourcePath,
			this.sourceType,
			this.baseViewIndex,
		);

		if (this.sourceType === "base") {
			const viewFileProps =
				await this.exportService.scanViewFileProperties(
					this.sourcePath,
					this.baseViewIndex,
				);
			// Respect the view's explicit configuration — no forced defaults
			this.selectedFileProperties = viewFileProps;

			this.displayNames =
				await this.exportService.scanDisplayNames(this.sourcePath);
		}
	}
}
