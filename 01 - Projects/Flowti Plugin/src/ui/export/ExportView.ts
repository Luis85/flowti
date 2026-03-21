/**
 * Export View for Flowti.
 *
 * A dedicated ItemView for exporting vault data as CSV or tab-delimited files.
 * Triggered from context menus on folders / `.base` files, or from the command palette.
 *
 * Layout: top bar with horizontal stepper + full-width workspace.
 * Page rendering is delegated to components in `./export/`.
 */

import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { DataExchangeService } from "../../domain/dataExchange/DataExchangeService";
import type { ExportService } from "../../domain/dataExchange/ExportService";
import type {
	ExportResult,
	ParsedBaseFile,
	ResolvedColumn,
	SavedExportConfig,
	VaultFileInfo,
} from "../../domain/dataExchange/types";
import { FolderPickerModal, getVaultFolders } from "../shared/FolderPickerModal";
import { ConfigChooserModal } from "../modals";
import { showNativeSaveDialog } from "./electronDialog";
import { renderStepBar, renderConfigDropdown } from "../hub/helpers";
import { promptSaveConfig as doPromptSaveConfig, runExport as doRunExport, type ExportConfigOpsContext } from "./ExportViewConfigOps";
import {
	ViewSelectPage,
	ConfigurePage,
	PreviewPage,
	ResultPage,
	STEP_LABELS,
	getFilenameFromPath,
	getOutputFilename,
	buildOutputPath,
} from ".";
import type { ExportPage, ExportViewState, ExportComponentDeps } from ".";

export const VIEW_TYPE_EXPORT = "flowti-export";

export interface ExportViewConfig {
	sourcePath: string;
	sourceType: "folder" | "base";
	format: "csv" | "tab";
}

export class ExportView extends ItemView {
	private eventBus: IEventBus;
	private dataExchangeService: DataExchangeService;
	private getConfig: () => ExportViewConfig | null;

	// Config (set in onOpen)
	private exportService!: ExportService;
	private sourcePath = "";
	private sourceType: "folder" | "base" = "folder";
	private format: "csv" | "tab" = "csv";

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
	private conflictStrategy: "overwrite" | "skip" | "append" = "overwrite";
	private displayNames: Record<string, string> = {};
	private resolvedColumns: ResolvedColumn[] | null = null;
	private noteType = "";
	private exportResult: ExportResult | null = null;
	private exportError: string | null = null;
	private loadError: string | null = null;
	private savedConfigs: SavedExportConfig[] = [];
	private pendingSavedConfig: SavedExportConfig | null = null;
	private propertySearchText = "";
	private loadedConfigId: string | null = null;

	// Persistent DOM references
	private rootEl: HTMLElement | null = null;
	private topBarEl: HTMLElement | null = null;
	private workspaceEl: HTMLElement | null = null;
	private unsavedHintEl: HTMLElement | null = null;

	// Page components
	private viewSelectPage: ViewSelectPage | null = null;
	private configurePage: ConfigurePage | null = null;
	private previewPage: PreviewPage | null = null;
	private resultPage: ResultPage | null = null;

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
			this.contentEl.createDiv({
				text: "No export configuration provided.",
				cls: "ft-text-muted ft-p-3",
			});
			return;
		}

		this.exportService = this.dataExchangeService.getExportService();
		this.sourcePath = config.sourcePath;
		this.sourceType = config.sourceType;
		this.format = config.format;
		this.savedConfigs = this.dataExchangeService.getSavedExportConfigs();
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

		// Pre-apply saved config if provided (e.g. from Hub)
		if (this.pendingSavedConfig) {
			this.applySavedExportConfig(this.pendingSavedConfig.id);
			this.pendingSavedConfig = null;
			this.currentPage = "preview";
			this.buildLayout();
			this.renderPage();
			return;
		}

		// Auto-detect existing configs for this source
		const matchingConfigs = this.dataExchangeService.getExportConfigsForSource(this.sourcePath);
		if (matchingConfigs.length === 1) {
			this.applySavedExportConfig(matchingConfigs[0].id);
			this.currentPage = "preview";
		} else if (matchingConfigs.length > 1) {
			this.buildLayout();
			new ConfigChooserModal(
				this.app,
				matchingConfigs.map((c) => ({ id: c.id, name: c.name })),
				(id) => {
					if (id) {
						this.applySavedExportConfig(id);
						this.currentPage = "preview";
					}
					this.renderPage();
				},
			).open();
			return;
		}

		this.buildLayout();
		this.renderPage();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	/** Pre-apply a saved export config when the view opens (skips to preview). */
	setSavedConfig(config: SavedExportConfig): void {
		this.pendingSavedConfig = config;
	}

	private buildLayout(): void {
		this.contentEl.empty();
		this.rootEl = this.contentEl.createDiv({ cls: "flowti-container ft-view-root-flex" });
		this.topBarEl = this.rootEl.createDiv({ cls: "ft-view-top-bar" });
		this.workspaceEl = this.rootEl.createDiv({ cls: "ft-view-workspace" });
		const deps = this.buildDeps();
		this.viewSelectPage = new ViewSelectPage(this.workspaceEl, deps);
		this.configurePage = new ConfigurePage(this.workspaceEl, deps);
		this.previewPage = new PreviewPage(this.workspaceEl, deps);
		this.resultPage = new ResultPage(this.workspaceEl, deps);
	}

	private buildDeps(): ExportComponentDeps {
		return {
			app: this.app,
			eventBus: this.eventBus,
			exportService: this.exportService,
			getState: () => this.getViewState(),
			setState: (partial) => this.setViewState(partial),
			renderPage: () => this.renderPage(),
			openFolderPicker: () => this.openFolderPicker(),
			openNativeSaveDialog: () => this.openNativeSaveDialog(),
			detachLeaf: () => this.leaf.detach(),
			runExport: () => void this.runExport(),
			updateUnsavedHint: () => this.updateUnsavedHint(),
			hasUnsavedChanges: () => this.hasUnsavedChanges(),
			getUnsavedHintEl: () => this.unsavedHintEl,
			setUnsavedHintEl: (el) => { this.unsavedHintEl = el; },
		};
	}

	private getViewState(): ExportViewState {
		return {
			sourcePath: this.sourcePath,
			sourceType: this.sourceType,
			format: this.format,
			currentPage: this.currentPage,
			outputPath: this.outputPath,
			isExternal: this.isExternal,
			availableColumns: this.availableColumns,
			selectedColumns: this.selectedColumns,
			selectedFileProperties: this.selectedFileProperties,
			baseViewIndex: this.baseViewIndex,
			baseFile: this.baseFile,
			previewFiles: this.previewFiles,
			conflictStrategy: this.conflictStrategy,
			displayNames: this.displayNames,
			resolvedColumns: this.resolvedColumns,
			noteType: this.noteType,
			exportResult: this.exportResult,
			exportError: this.exportError,
			loadError: this.loadError,
			savedConfigs: this.savedConfigs,
			loadedConfigId: this.loadedConfigId,
			propertySearchText: this.propertySearchText,
		};
	}

	private setViewState(partial: Partial<ExportViewState>): void {
		const self = this as unknown as Record<string, unknown>;
		for (const key of Object.keys(partial) as Array<keyof ExportViewState>) {
			if (partial[key] !== undefined) {
				self[key] = partial[key];
			}
		}
	}

	private renderPage(): void {
		if (!this.rootEl) return;

		this.renderTopBar();

		if (this.loadError && this.currentPage !== "result") {
			this.renderError();
			return;
		}

		switch (this.currentPage) {
			case "view-select":
				this.viewSelectPage?.render();
				break;
			case "configure":
				this.configurePage?.render();
				break;
			case "preview":
				this.previewPage?.render();
				break;
			case "result":
				this.resultPage?.render();
				break;
		}
	}

	private renderError(): void {
		const ws = this.workspaceEl!;
		ws.empty();
		const c = ws.createDiv({ cls: "ft-table-scroll" });
		c.createEl("h3", { text: "Export", cls: "ft-heading ft-heading-sm" });
		const alert = c.createDiv({ cls: "ft-alert-error ft-p-3 ft-mt-3" });
		alert.createEl("strong", { text: "Error: " });
		alert.createSpan({ text: this.loadError! });
		const closeBtn = c.createDiv({ cls: "ft-detail-actions ft-mt-4" }).createEl("span", { cls: "ft-nav-link" });
		setIcon(closeBtn.createSpan(), "x");
		closeBtn.appendText(" Close");
		closeBtn.addEventListener("click", () => this.leaf.detach());
	}

	private renderTopBar(): void {
		const bar = this.topBarEl!;
		bar.empty();

		const headerRow = bar.createDiv({ cls: "ft-csv-header ft-header-mb-0" });
		setIcon(headerRow.createDiv({ cls: "ft-csv-header-icon" }), "file-output");
		const titleCol = headerRow.createDiv();
		const titleRow = titleCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const parts = this.sourcePath.replace(/\\/g, "/").split("/");
		titleRow.createEl("h2", { text: parts[parts.length - 1] || this.sourcePath, cls: "ft-heading ft-csv-title" });
		titleRow.createSpan({ text: "Export", cls: "ft-operation-badge ft-operation-badge-export" });
		const loadedCfg = this.loadedConfigId ? this.savedConfigs.find((c) => c.id === this.loadedConfigId) : null;
		titleRow.createSpan({ text: loadedCfg ? `Config: ${loadedCfg.name}` : "No config loaded", cls: loadedCfg ? "ft-badge ft-badge-accent" : "ft-badge ft-badge-muted" });
		const subtitle = titleCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		subtitle.createSpan({ text: this.sourcePath, cls: "ft-text-sm ft-text-muted" });
		subtitle.createSpan({ text: `${this.previewFiles.length} files`, cls: "ft-badge ft-badge-muted" });
		subtitle.createSpan({ text: `${this.availableColumns.length} cols`, cls: "ft-badge ft-badge-muted" });

		const stepRow = bar.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const steps: ExportPage[] = this.sourceType === "base"
			? ["view-select", "configure", "preview", "result"]
			: ["configure", "preview", "result"];
		renderStepBar(stepRow, { steps, currentPage: this.currentPage, labels: STEP_LABELS, hasResult: !!this.exportResult, hasError: !!this.exportError, onNavigate: (page) => { this.currentPage = page; this.renderPage(); } });
		stepRow.createDiv({ cls: "ft-flex-1" });
		if (this.hasUnsavedChanges()) {
			const saveBtn = stepRow.createEl("span", { cls: "ft-nav-link" });
			setIcon(saveBtn.createSpan(), "save");
			saveBtn.appendText(" Save");
			saveBtn.addEventListener("click", () => this.promptSaveConfig());
		}
		renderConfigDropdown(stepRow, { onSave: () => this.promptSaveConfig(), configs: this.savedConfigs.filter((c) => c.sourcePath === this.sourcePath), onLoad: (id) => { this.applySavedExportConfig(id); } });
	}

	private promptSaveConfig(): void {
		doPromptSaveConfig(this.buildConfigOpsContext());
	}

	// ── Execution ───────────────────────────────────────────

	private async runExport(): Promise<void> {
		await doRunExport(this.buildConfigOpsContext());
	}

	private buildConfigOpsContext(): ExportConfigOpsContext {
		return {
			app: this.app, eventBus: this.eventBus, dataExchangeService: this.dataExchangeService, exportService: this.exportService,
			getSourcePath: () => this.sourcePath, getSourceType: () => this.sourceType, getFormat: () => this.format,
			getOutputPath: () => this.outputPath, getSelectedColumns: () => this.selectedColumns,
			getSelectedFileProperties: () => this.selectedFileProperties, getBaseViewIndex: () => this.baseViewIndex,
			getConflictStrategy: () => this.conflictStrategy, getIsExternal: () => this.isExternal,
			getDisplayNames: () => this.displayNames, getResolvedColumns: () => this.resolvedColumns,
			getNoteType: () => this.noteType, getLoadedConfigId: () => this.loadedConfigId, getSavedConfigs: () => this.savedConfigs,
			setLoadedConfigId: (id) => { this.loadedConfigId = id; }, setSavedConfigs: (configs) => { this.savedConfigs = configs; },
			setExportResult: (result) => { this.exportResult = result as typeof this.exportResult; },
			setExportError: (error) => { this.exportError = error; },
			renderTopBar: () => this.renderTopBar(), renderPage: () => this.renderPage(), updateUnsavedHint: () => this.updateUnsavedHint(),
		};
	}

	private openFolderPicker(): void {
		const folders = getVaultFolders(this.app);
		new FolderPickerModal(this.app, folders, (folder) => {
			const filename = getOutputFilename(this.outputPath);
			this.outputPath = buildOutputPath(folder, filename);
			this.isExternal = false;
			this.renderPage();
		}).open();
	}

	private async openNativeSaveDialog(): Promise<void> {
		const result = await showNativeSaveDialog({
			format: this.format,
			defaultFilename: getFilenameFromPath(this.outputPath),
		});
		if (result === null) {
			void this.eventBus.emit("notice.error", { message: "Could not open save dialog. Try entering the path manually." });
			return;
		}
		if (!result.canceled && result.filePath) {
			this.outputPath = result.filePath;
			this.isExternal = true;
			this.renderPage();
		}
	}

	private applySavedExportConfig(id: string): void {
		const cfg = this.savedConfigs.find((c) => c.id === id);
		if (!cfg) return;
		this.format = cfg.format;
		this.outputPath = cfg.outputPath;
		this.selectedColumns = [...cfg.columns];
		this.selectedFileProperties = [...cfg.fileProperties];
		this.conflictStrategy = cfg.conflictStrategy ?? "overwrite";
		if (cfg.baseViewIndex !== undefined) this.baseViewIndex = cfg.baseViewIndex;
		if (cfg.isExternal !== undefined) this.isExternal = cfg.isExternal;
		this.noteType = cfg.noteType ?? "";
		this.loadedConfigId = id;
		void this.eventBus.emit("notice.show", { message: `Loaded config: ${cfg.name}` });
		this.renderPage();
	}

	private async loadColumnsAndPreview(): Promise<void> {
		this.previewFiles = await this.exportService.resolveExportFiles(this.sourcePath, this.sourceType, this.baseViewIndex);

		if (this.sourceType === "base") {
			this.resolvedColumns = await this.exportService.scanResolvedColumns(this.sourcePath, this.baseViewIndex);
			if (this.resolvedColumns) {
				this.availableColumns = this.resolvedColumns.filter((rc) => rc.source !== "file").map((rc) => rc.resolveKey);
				this.selectedColumns = [...this.availableColumns];
				this.selectedFileProperties = this.resolvedColumns
					.filter((rc) => rc.source === "file" || (rc.source === "formula" && rc.resolveSource === "file"))
					.map((rc) => rc.resolveKey);
				this.displayNames = {};
				for (const rc of this.resolvedColumns) { if (rc.header !== rc.resolveKey) this.displayNames[rc.key] = rc.header; }
				return;
			}
			this.availableColumns = await this.exportService.scanColumns(this.sourcePath, this.sourceType, this.baseViewIndex);
			this.selectedColumns = [...this.availableColumns];
			this.selectedFileProperties = await this.exportService.scanViewFileProperties(this.sourcePath, this.baseViewIndex);
			this.displayNames = await this.exportService.scanDisplayNames(this.sourcePath);
			return;
		}

		this.resolvedColumns = null;
		this.availableColumns = await this.exportService.scanColumns(this.sourcePath, this.sourceType);
		this.selectedColumns = [...this.availableColumns];
	}

	private hasUnsavedChanges(): boolean {
		if (!this.loadedConfigId) return false;
		const cfg = this.savedConfigs.find((c) => c.id === this.loadedConfigId);
		if (!cfg) return false;
		return this.format !== cfg.format
			|| this.outputPath !== cfg.outputPath
			|| JSON.stringify(this.selectedColumns) !== JSON.stringify(cfg.columns)
			|| JSON.stringify(this.selectedFileProperties) !== JSON.stringify(cfg.fileProperties)
			|| this.conflictStrategy !== (cfg.conflictStrategy ?? "overwrite")
			|| (cfg.baseViewIndex !== undefined && this.baseViewIndex !== cfg.baseViewIndex)
			|| (cfg.isExternal !== undefined && this.isExternal !== cfg.isExternal)
			|| (this.noteType || "") !== (cfg.noteType ?? "");
	}

	private updateUnsavedHint(): void {
		if (!this.unsavedHintEl) return;
		this.unsavedHintEl.classList.toggle("ft-hidden", !this.hasUnsavedChanges());
	}
}
