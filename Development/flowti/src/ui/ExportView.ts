/**
 * Export View for Flowti.
 *
 * A dedicated ItemView for exporting vault data as CSV or tab-delimited files.
 * Triggered from context menus on folders / `.base` files, or from the command palette.
 *
 * Layout: top bar with horizontal stepper + full-width workspace.
 * Page rendering is delegated to components in `./export/`.
 */

import { ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService";
import type { ExportService } from "../domain/dataExchange/ExportService";
import type {
	ExportResult,
	ParsedBaseFile,
	ResolvedColumn,
	SavedExportConfig,
	VaultFileInfo,
} from "../domain/dataExchange/types";
import { FolderPickerModal, getVaultFolders } from "./FolderPickerModal";
import { ConfigChooserModal, ConfirmModal, InputModal } from "./modals";
import { showNativeSaveDialog } from "./electronDialog";
import { renderStepBar, renderConfigDropdown } from "./hub/helpers";
import {
	ViewSelectPage,
	ConfigurePage,
	PreviewPage,
	ResultPage,
	STEP_LABELS,
	getFilenameFromPath,
	getOutputFilename,
	buildOutputPath,
} from "./export";
import type { ExportPage, ExportViewState, ExportComponentDeps } from "./export";

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

	// ── Layout skeleton ─────────────────────────────────────

	private buildLayout(): void {
		const el = this.contentEl;
		el.empty();

		this.rootEl = el.createDiv({ cls: "flowti-container" });
		this.rootEl.style.height = "100%";
		this.rootEl.style.display = "flex";
		this.rootEl.style.flexDirection = "column";

		// Top bar
		this.topBarEl = this.rootEl.createDiv({ cls: "ft-view-top-bar" });

		// Workspace
		this.workspaceEl = this.rootEl.createDiv({ cls: "ft-view-workspace" });

		// Create page components
		const deps = this.buildDeps();
		this.viewSelectPage = new ViewSelectPage(this.workspaceEl, deps);
		this.configurePage = new ConfigurePage(this.workspaceEl, deps);
		this.previewPage = new PreviewPage(this.workspaceEl, deps);
		this.resultPage = new ResultPage(this.workspaceEl, deps);
	}

	private buildDeps(): ExportComponentDeps {
		return {
			app: this.app,
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
		if (partial.sourcePath !== undefined) this.sourcePath = partial.sourcePath;
		if (partial.sourceType !== undefined) this.sourceType = partial.sourceType;
		if (partial.format !== undefined) this.format = partial.format;
		if (partial.currentPage !== undefined) this.currentPage = partial.currentPage;
		if (partial.outputPath !== undefined) this.outputPath = partial.outputPath;
		if (partial.isExternal !== undefined) this.isExternal = partial.isExternal;
		if (partial.availableColumns !== undefined) this.availableColumns = partial.availableColumns;
		if (partial.selectedColumns !== undefined) this.selectedColumns = partial.selectedColumns;
		if (partial.selectedFileProperties !== undefined) this.selectedFileProperties = partial.selectedFileProperties;
		if (partial.baseViewIndex !== undefined) this.baseViewIndex = partial.baseViewIndex;
		if (partial.baseFile !== undefined) this.baseFile = partial.baseFile;
		if (partial.previewFiles !== undefined) this.previewFiles = partial.previewFiles;
		if (partial.conflictStrategy !== undefined) this.conflictStrategy = partial.conflictStrategy;
		if (partial.displayNames !== undefined) this.displayNames = partial.displayNames;
		if (partial.resolvedColumns !== undefined) this.resolvedColumns = partial.resolvedColumns;
		if (partial.noteType !== undefined) this.noteType = partial.noteType;
		if (partial.exportResult !== undefined) this.exportResult = partial.exportResult;
		if (partial.exportError !== undefined) this.exportError = partial.exportError;
		if (partial.loadError !== undefined) this.loadError = partial.loadError;
		if (partial.savedConfigs !== undefined) this.savedConfigs = partial.savedConfigs;
		if (partial.loadedConfigId !== undefined) this.loadedConfigId = partial.loadedConfigId;
		if (partial.propertySearchText !== undefined) this.propertySearchText = partial.propertySearchText;
	}

	// ── Page routing ────────────────────────────────────────

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
		const container = ws.createDiv({ cls: "ft-table-scroll" });
		container.createEl("h3", { text: "Export", cls: "ft-heading ft-heading-sm" });
		const alert = container.createDiv({ cls: "ft-alert-error ft-p-3 ft-mt-3" });
		alert.createEl("strong", { text: "Error: " });
		alert.createSpan({ text: this.loadError! });

		const nav = container.createDiv({ cls: "ft-detail-actions ft-mt-4" });
		const closeBtn = nav.createEl("span", { cls: "ft-nav-link" });
		setIcon(closeBtn.createSpan(), "x");
		closeBtn.appendText(" Close");
		closeBtn.addEventListener("click", () => this.leaf.detach());
	}

	// ── Top bar with stepper (2-row layout) ─────────────────

	private renderTopBar(): void {
		const bar = this.topBarEl!;
		bar.empty();

		// ── Row 1: File header ──
		const headerRow = bar.createDiv({ cls: "ft-csv-header" });
		headerRow.style.marginBottom = "0";
		const iconEl = headerRow.createDiv({ cls: "ft-csv-header-icon" });
		setIcon(iconEl, "file-output");
		const titleCol = headerRow.createDiv();
		const titleRow = titleCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });

		const parts = this.sourcePath.replace(/\\/g, "/").split("/");
		const name = parts[parts.length - 1] || this.sourcePath;
		titleRow.createEl("h2", {
			text: name,
			cls: "ft-heading ft-csv-title",
		});

		titleRow.createSpan({
			text: "Export",
			cls: "ft-operation-badge ft-operation-badge-export",
		});

		// Loaded config indicator
		if (this.loadedConfigId) {
			const cfg = this.savedConfigs.find((c) => c.id === this.loadedConfigId);
			if (cfg) {
				titleRow.createSpan({
					text: `Config: ${cfg.name}`,
					cls: "ft-badge ft-badge-accent",
				});
			}
		} else {
			titleRow.createSpan({
				text: "No config loaded",
				cls: "ft-badge ft-badge-muted",
			});
		}

		const subtitle = titleCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		subtitle.createSpan({ text: this.sourcePath, cls: "ft-text-sm ft-text-muted" });
		subtitle.createSpan({
			text: `${this.previewFiles.length} files`,
			cls: "ft-badge ft-badge-muted",
		});
		subtitle.createSpan({
			text: `${this.availableColumns.length} cols`,
			cls: "ft-badge ft-badge-muted",
		});

		// ── Row 2: Stepper + config dropdown ──
		const stepRow = bar.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });

		const steps: ExportPage[] = this.sourceType === "base"
			? ["view-select", "configure", "preview", "result"]
			: ["configure", "preview", "result"];

		renderStepBar(stepRow, {
			steps,
			currentPage: this.currentPage,
			labels: STEP_LABELS,
			hasResult: !!this.exportResult,
			hasError: !!this.exportError,
			onNavigate: (page) => {
				this.currentPage = page;
				this.renderPage();
			},
		});

		// Spacer
		stepRow.createDiv({ cls: "ft-flex-1" });

		// Save button (only when unsaved changes exist)
		if (this.hasUnsavedChanges()) {
			const saveBtn = stepRow.createEl("span", { cls: "ft-nav-link" });
			setIcon(saveBtn.createSpan(), "save");
			saveBtn.appendText(" Save");
			saveBtn.addEventListener("click", () => this.promptSaveConfig());
		}

		// Config dropdown
		const fileConfigs = this.savedConfigs.filter(
			(c) => c.sourcePath === this.sourcePath,
		);
		renderConfigDropdown(stepRow, {
			onSave: () => this.promptSaveConfig(),
			configs: fileConfigs,
			onLoad: (id) => {
				this.applySavedExportConfig(id);
			},
		});
	}

	private promptSaveConfig(): void {
		// Prefill with loaded config name, then source filename, then generic
		let defaultName = "My export config";
		if (this.loadedConfigId) {
			const loaded = this.savedConfigs.find((c) => c.id === this.loadedConfigId);
			if (loaded) defaultName = loaded.name;
		} else {
			defaultName = getFilenameFromPath(this.sourcePath).replace(/\.\w+$/, "");
		}

		new InputModal(this.app, {
			title: "Save Export Config",
			inputName: "Config name",
			inputDesc: "A descriptive name for this export configuration",
			placeholder: "My export config",
			defaultValue: defaultName,
			submitLabel: "Save",
			onSubmit: (name) => {
				const configData = {
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
					noteType: this.noteType || undefined,
				};

				const existing = this.dataExchangeService
					.getSavedExportConfigs()
					.find((c) => c.name === name);

				if (existing) {
					new ConfirmModal(this.app, {
						message: `A config named "${name}" already exists. Update it?`,
						confirmLabel: "Update",
						onConfirm: () => {
							void this.dataExchangeService
								.updateExportConfig(existing.id, configData)
								.then((updated) => {
									this.savedConfigs = this.dataExchangeService.getSavedExportConfigs();
									this.loadedConfigId = existing.id;
									new Notice(`Config updated: ${updated?.name ?? name}`);
									this.renderTopBar();
									this.updateUnsavedHint();
								})
								.catch((err) =>
									console.error("[Flowti] Failed to update export config", err),
								);
						},
					}).open();
					return;
				}

				void this.dataExchangeService
					.saveExportConfig(configData)
					.then((saved) => {
						this.savedConfigs = this.dataExchangeService.getSavedExportConfigs();
						this.loadedConfigId = saved.id;
						new Notice(`Config saved: ${saved.name}`);
						this.renderTopBar();
						this.updateUnsavedHint();
					})
					.catch((err) =>
						console.error("[Flowti] Failed to save export config", err),
					);
			},
		}).open();
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
				resolvedColumns: this.resolvedColumns ?? undefined,
			});
			// Auto-save config on first export if none exists for this source
			await this.autoSaveConfigIfNeeded();
		} catch (error) {
			this.exportError =
				error instanceof Error ? error.message : String(error);
		}
		this.renderPage();
	}

	/** Auto-saves the export config if no config exists for this source yet. */
	private async autoSaveConfigIfNeeded(): Promise<void> {
		if (this.loadedConfigId) return;
		const existing = this.dataExchangeService.getExportConfigsForSource(this.sourcePath);
		if (existing.length > 0) return;
		try {
			const name = getFilenameFromPath(this.sourcePath).replace(/\.\w+$/, "");
			const saved = await this.dataExchangeService.saveExportConfig({
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
				noteType: this.noteType || undefined,
			});
			this.savedConfigs = this.dataExchangeService.getSavedExportConfigs();
			this.loadedConfigId = saved.id;
			new Notice(`Config auto-saved: ${saved.name}`);
			this.renderTopBar();
		} catch (err) {
			console.error("[Flowti] Failed to auto-save export config", err);
		}
	}

	// ── Helpers ─────────────────────────────────────────────

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
			new Notice("Could not open save dialog. Try entering the path manually.");
			return;
		}
		if (!result.canceled && result.filePath) {
			this.outputPath = result.filePath;
			this.isExternal = true;
			this.renderPage();
		}
	}

	// ── Config save/load ────────────────────────────────────

	private applySavedExportConfig(id: string): void {
		const cfg = this.savedConfigs.find((c) => c.id === id);
		if (!cfg) return;
		this.format = cfg.format;
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
		this.noteType = cfg.noteType ?? "";
		this.loadedConfigId = id;
		new Notice(`Loaded config: ${cfg.name}`);
		this.renderPage();
	}

	private async loadColumnsAndPreview(): Promise<void> {
		this.previewFiles = await this.exportService.resolveExportFiles(
			this.sourcePath,
			this.sourceType,
			this.baseViewIndex,
		);

		if (this.sourceType === "base") {
			// Try unified resolved columns first (preserves view order and headers)
			this.resolvedColumns = await this.exportService.scanResolvedColumns(
				this.sourcePath,
				this.baseViewIndex,
			);

			if (this.resolvedColumns) {
				// Derive legacy fields for backward compatibility with ConfigurePage
				this.availableColumns = this.resolvedColumns
					.filter((rc) => rc.source !== "file")
					.map((rc) => rc.resolveKey);
				this.selectedColumns = [...this.availableColumns];
				this.selectedFileProperties = this.resolvedColumns
					.filter((rc) => rc.source === "file" || (rc.source === "formula" && rc.resolveSource === "file"))
					.map((rc) => rc.resolveKey);
				this.displayNames = {};
				for (const rc of this.resolvedColumns) {
					if (rc.header !== rc.resolveKey) {
						this.displayNames[rc.key] = rc.header;
					}
				}
				return;
			}

			// Fallback: legacy scan when view has no order
			this.availableColumns = await this.exportService.scanColumns(
				this.sourcePath,
				this.sourceType,
				this.baseViewIndex,
			);
			this.selectedColumns = [...this.availableColumns];
			const viewFileProps =
				await this.exportService.scanViewFileProperties(
					this.sourcePath,
					this.baseViewIndex,
				);
			this.selectedFileProperties = viewFileProps;
			this.displayNames =
				await this.exportService.scanDisplayNames(this.sourcePath);
			return;
		}

		// Folder source: scan frontmatter
		this.resolvedColumns = null;
		this.availableColumns = await this.exportService.scanColumns(
			this.sourcePath,
			this.sourceType,
		);
		this.selectedColumns = [...this.availableColumns];
	}

	// ── Unsaved changes tracking ────────────────────────────

	private hasUnsavedChanges(): boolean {
		if (!this.loadedConfigId) return false;
		const cfg = this.savedConfigs.find((c) => c.id === this.loadedConfigId);
		if (!cfg) return false;
		if (this.format !== cfg.format) return true;
		if (this.outputPath !== cfg.outputPath) return true;
		if (JSON.stringify(this.selectedColumns) !== JSON.stringify(cfg.columns)) return true;
		if (JSON.stringify(this.selectedFileProperties) !== JSON.stringify(cfg.fileProperties)) return true;
		if (this.conflictStrategy !== (cfg.conflictStrategy ?? "overwrite")) return true;
		if (cfg.baseViewIndex !== undefined && this.baseViewIndex !== cfg.baseViewIndex) return true;
		if (cfg.isExternal !== undefined && this.isExternal !== cfg.isExternal) return true;
		if ((this.noteType || "") !== (cfg.noteType ?? "")) return true;
		return false;
	}

	private updateUnsavedHint(): void {
		if (!this.unsavedHintEl) return;
		this.unsavedHintEl.style.display = this.hasUnsavedChanges() ? "flex" : "none";
	}
}
