/**
 * ExportModal — 3-4 page wizard for exporting vault data as CSV or tab-delimited.
 *
 * Pages:
 * - View Select (`.base` files only) → Configure → Preview → Execute
 * - Configure → Preview → Execute (folder sources)
 *
 * Follows the InstallerWizardModal pattern for multi-page modals.
 */

import { App, FuzzySuggestModal, Modal, Notice, Setting, TFolder } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { ExportService } from "../domain/dataExchange/ExportService";
import type {
	ExportConflictStrategy,
	ExportFormat,
	ExportResult,
	FilePropertyDef,
	ParsedBaseFile,
	VaultFileInfo,
} from "../domain/dataExchange/types";
import { STANDARD_FILE_PROPERTIES } from "../domain/dataExchange/types";

type ExportPage = "view-select" | "configure" | "preview" | "execute";

// ── Folder picker modal ────────────────────────────────

class FolderPickerModal extends FuzzySuggestModal<string> {
	private folders: string[];
	private onChoose: (folder: string) => void;

	constructor(app: App, folders: string[], onChoose: (folder: string) => void) {
		super(app);
		this.folders = folders;
		this.onChoose = onChoose;
	}

	getItems(): string[] {
		return this.folders;
	}

	getItemText(item: string): string {
		return item || "(vault root)";
	}

	onChooseItem(item: string): void {
		this.onChoose(item);
	}
}

// ── Export modal ────────────────────────────────────────

export class ExportModal extends Modal {
	private eventBus: IEventBus;
	private exportService: ExportService;
	private sourcePath: string;
	private sourceType: "folder" | "base";

	// State
	private currentPage: ExportPage;
	private format: ExportFormat = "csv";
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

	constructor(
		app: App,
		eventBus: IEventBus,
		exportService: ExportService,
		sourcePath: string,
		sourceType: "folder" | "base",
		format: ExportFormat,
	) {
		super(app);
		this.eventBus = eventBus;
		this.exportService = exportService;
		this.sourcePath = sourcePath;
		this.sourceType = sourceType;
		this.format = format;
		this.currentPage = sourceType === "base" ? "view-select" : "configure";

		// Default output path
		const baseName = sourcePath.replace(/\.\w+$/, "");
		const ext = format === "tab" ? ".txt" : ".csv";
		this.outputPath = `${baseName}_export${ext}`;
	}

	async onOpen(): Promise<void> {
		this.modalEl.addClass("flowti-export-modal");

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

	onClose(): void {
		this.contentEl.empty();
	}

	// ── Page routing ────────────────────────────────────────

	private renderPage(): void {
		const { contentEl } = this;
		contentEl.empty();

		if (this.loadError && this.currentPage !== "execute") {
			this.renderError(contentEl);
			return;
		}

		switch (this.currentPage) {
			case "view-select":
				this.renderViewSelectPage(contentEl);
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

	private renderError(el: HTMLElement): void {
		el.createEl("h3", { text: "Export" });
		const alert = el.createDiv({ cls: "ft-alert-error ft-p-3" });
		alert.createEl("strong", { text: "Error: " });
		alert.createSpan({ text: this.loadError! });
		this.renderNav(el, { cancel: true });
	}

	// ── Page 0: View Select (.base only) ────────────────────

	private renderViewSelectPage(el: HTMLElement): void {
		el.createEl("h3", { text: "Select View to Export" });

		if (!this.baseFile || this.baseFile.views.length === 0) {
			el.createEl("p", {
				text: "No views found in this base file.",
				cls: "ft-text-muted",
			});
			this.renderNav(el, { cancel: true });
			return;
		}

		el.createEl("p", {
			text: `${this.baseFile.views.length} view(s) found in ${this.sourcePath}`,
			cls: "ft-text-muted ft-text-sm ft-mb-3",
		});

		const viewList = el.createDiv({ cls: "ft-flex-col ft-gap-2" });
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

		this.renderNav(el, {
			cancel: true,
			next: "configure",
			onNext: async () => {
				await this.loadColumnsAndPreview();
			},
		});
	}

	// ── Page 1: Configure ───────────────────────────────────

	private renderConfigurePage(el: HTMLElement): void {
		const formatLabel = this.format === "tab" ? "Tab-delimited" : "CSV";
		el.createEl("h3", { text: `Configure Export (${formatLabel})` });

		// Target indicator
		const targetDesc = this.isExternal
			? "Saving to filesystem (absolute path)"
			: "Saving inside vault";
		const outputSetting = new Setting(el)
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
		new Setting(el)
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

		// ── File Properties (always shown) ──────────────────
		el.createEl("h4", { text: "File Properties", cls: "ft-mt-4" });
		el.createEl("p", {
			text: "Standard Obsidian file properties to include as columns.",
			cls: "ft-text-muted ft-text-sm ft-mb-2",
		});

		const filePropsContainer = el.createDiv({
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

		// ── Note Properties ─────────────────────────────────
		el.createEl("h4", { text: "Note Properties", cls: "ft-mt-4" });

		if (this.availableColumns.length === 0) {
			el.createEl("p", {
				text: "No frontmatter properties found in the source files.",
				cls: "ft-text-muted ft-text-sm",
			});
		} else {
			const actions = el.createDiv({
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

			const colContainer = el.createDiv({
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

		const backPage: ExportPage =
			this.sourceType === "base" ? "view-select" : "configure";
		this.renderNav(el, {
			cancel: true,
			back: this.sourceType === "base" ? backPage : undefined,
			next: "preview",
		});
	}

	// ── Page 2: Preview ─────────────────────────────────────

	private renderPreviewPage(el: HTMLElement): void {
		el.createEl("h3", { text: "Preview" });

		// Build preview headers with display name overrides
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
			el.createEl("p", {
				text: "No columns selected. Go back and select at least one column.",
				cls: "ft-text-muted",
			});
			this.renderNav(el, { back: "configure", cancel: true });
			return;
		}

		// Preview table — first 5 records
		const maxPreview = 5;
		const table = el.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const h of allHeaders) {
			headerRow.createEl("th", { text: h });
		}

		const tbody = table.createEl("tbody");
		const previewFiles = this.previewFiles.slice(0, maxPreview);

		for (const file of previewFiles) {
			const tr = tbody.createEl("tr");
			// File property columns
			for (const fh of fileHeaders) {
				tr.createEl("td", { text: this.resolveFileProperty(file, fh.key) });
			}
			// Frontmatter columns
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
			el.createEl("p", {
				text: `Showing ${maxPreview} of ${this.previewFiles.length} rows`,
				cls: "ft-text-muted ft-text-sm ft-mt-2",
			});
		} else {
			el.createEl("p", {
				text: `${this.previewFiles.length} rows total`,
				cls: "ft-text-muted ft-text-sm ft-mt-2",
			});
		}

		// Validation
		const issues: string[] = [];
		if (!this.outputPath.trim()) issues.push("Output path is required");
		if (allHeaders.length === 0) issues.push("At least one column is required");

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

	// ── Page 3: Execute ─────────────────────────────────────

	private renderExecutePage(el: HTMLElement): void {
		if (this.exportResult) {
			this.renderResult(el);
			return;
		}

		if (this.exportError) {
			el.createEl("h3", { text: "Export Failed" });
			const alert = el.createDiv({ cls: "ft-alert-error ft-p-3" });
			alert.createEl("strong", { text: "Error: " });
			alert.createSpan({ text: this.exportError });
			this.renderNav(el, { back: "configure", cancel: true });
			return;
		}

		el.createEl("h3", { text: "Exporting..." });
		el.createDiv({
			text: "Writing export file...",
			cls: "ft-text-muted ft-p-3",
		});
	}

	private renderResult(el: HTMLElement): void {
		const r = this.exportResult!;

		if (r.skipped) {
			el.createEl("h3", { text: "Export Skipped" });
			const info = el.createDiv({ cls: "ft-card ft-p-3" });
			info.createDiv({ text: `File already exists: ${r.outputPath}` });
			info.createDiv({
				text: "The conflict strategy was set to \"skip\", so no changes were made.",
				cls: "ft-text-muted ft-text-sm ft-mt-1",
			});
			new Notice(`Export skipped: ${r.outputPath} already exists`);
			this.renderNav(el, { cancel: true, cancelLabel: "Close" });
			return;
		}

		el.createEl("h3", { text: "Export Complete" });

		const stats = el.createDiv({
			cls: "ft-card ft-p-3 ft-flex-col ft-gap-1",
		});
		stats.createDiv({ text: `Rows exported: ${r.totalRows}` });
		stats.createDiv({ text: `Columns: ${r.totalColumns}` });
		stats.createDiv({ text: `Output file: ${r.outputPath}` });

		new Notice(
			`Export complete: ${r.totalRows} rows written to ${r.outputPath}`,
		);

		this.renderNav(el, { cancel: true, cancelLabel: "Close" });
	}

	// ── Navigation helpers ──────────────────────────────────

	private renderNav(
		el: HTMLElement,
		options: {
			cancel?: boolean;
			cancelLabel?: string;
			back?: ExportPage;
			next?: ExportPage;
			onNext?: () => Promise<void>;
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
						this.currentPage = "execute";
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
		const folders: string[] = [""];
		this.app.vault.getAllLoadedFiles().forEach((f) => {
			if (f instanceof TFolder) folders.push(f.path);
		});
		folders.sort();

		new FolderPickerModal(this.app, folders, (folder) => {
			// Keep filename, change folder — vault-relative
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
		// Handle both forward and back slashes
		const parts = p.replace(/\\/g, "/").split("/");
		return parts[parts.length - 1] || p;
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
			// Pre-select file properties from the view's order
			const viewFileProps =
				await this.exportService.scanViewFileProperties(
					this.sourcePath,
					this.baseViewIndex,
				);
			// Default to file.name when no file properties configured
			this.selectedFileProperties =
				viewFileProps.length > 0 ? viewFileProps : ["file.name"];

			// Load display name overrides from properties section
			this.displayNames =
				await this.exportService.scanDisplayNames(this.sourcePath);
		}
	}
}
