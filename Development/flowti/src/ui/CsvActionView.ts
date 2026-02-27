/**
 * CSV Action View for Flowti.
 *
 * Orchestrator for the CSV file viewer and import wizard. Page rendering is
 * delegated to components in src/ui/csv/.
 */

import { Notice, TFile, TextFileView, WorkspaceLeaf, setIcon } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService";
import type { SavedImportConfig } from "../domain/dataExchange/types";
import { FolderPickerModal, getVaultFolders } from "./FolderPickerModal";
import { ConfirmModal, ConfigChooserModal, InputModal } from "./modals";
import { renderStepBar, renderConfigDropdown } from "./hub/helpers";
import {
	CsvLanding,
	CsvConfigPage,
	CsvPreviewPage,
	CsvResultPage,
	STEP_LABELS,
	detectDelimiter,
	generateBaseYaml,
	getBaseFilename,
} from "./csv";
import type { CsvViewState, CsvComponentDeps, CsvPage } from "./csv";
import { basename } from "../utils/pathUtils";

export const VIEW_TYPE_CSV = "flowti-csv";

export class CsvActionView extends TextFileView {
	private eventBus: IEventBus;
	private dataExchangeService: DataExchangeService;
	private autoStartImport: boolean;
	private openHubImportConfigCb: ((configId: string) => void) | null = null;
	private getQueriesBySourceCb: ((csvPath: string) => import("../domain/analytics/types").SavedAnalyticsQuery[]) | null = null;
	private openAnalyticsHubCb: ((tabId: string, entityId: string) => void) | null = null;
	private unsubscribes: (() => void)[] = [];
	private unsavedHintEl: HTMLElement | null = null;
	private saveBtnEl: HTMLElement | null = null;

	// Layout skeleton
	private rootEl: HTMLElement | null = null;
	private topBarEl: HTMLElement | null = null;
	private landingEl: HTMLElement | null = null;
	private workspaceEl: HTMLElement | null = null;

	// Page components
	private csvDeps: CsvComponentDeps | null = null;
	private landingPage: CsvLanding | null = null;
	private configPage: CsvConfigPage | null = null;
	private previewPage: CsvPreviewPage | null = null;
	private resultPage: CsvResultPage | null = null;

	// Consolidated state
	private state: CsvViewState = {
		currentPage: "landing",
		importService: null,
		parsedCsv: null,
		parseError: null,
		targetFolder: "",
		nameColumn: "",
		namePrefix: "",
		nameSuffix: "",
		columnMappings: [],
		conflictStrategy: "skip",
		importResult: null,
		importError: null,
		importProgress: { current: 0, total: 0 },
		createBase: false,
		basePath: "",
		savedConfigs: [],
		pendingSavedConfig: null,
		columnSearchText: "",
		customProperties: {},
		loadedConfigId: null,
		detectedDelimiter: ",",
		previewSortColumn: null,
		previewSortDir: "asc",
		hiddenColumns: [],
		filterColumn: null,
		filterText: "",
		previewMaxRows: 100,
		lastImportedAt: null,
	};

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

	// ── Public API ──────────────────────────────────────────

	/** Sets the callback for navigating to the Data Exchange Hub import config page. */
	setOpenHubImportConfig(cb: (configId: string) => void): void {
		this.openHubImportConfigCb = cb;
	}

	/** Pre-apply a saved import config when the wizard starts (skips to preview). */
	setSavedConfig(config: SavedImportConfig): void {
		this.state.pendingSavedConfig = config;
	}

	/** Sets the callback for discovering analytics queries by source path. */
	setGetQueriesBySource(cb: (csvPath: string) => import("../domain/analytics/types").SavedAnalyticsQuery[]): void {
		this.getQueriesBySourceCb = cb;
	}

	/** Sets the callback for navigating to the Analytics Hub. */
	setOpenAnalyticsHub(cb: (tabId: string, entityId: string) => void): void {
		this.openAnalyticsHubCb = cb;
	}

	// ── TextFileView lifecycle ──────────────────────────────

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

		// When the user switches to another CSV file via the file navigator,
		// reset everything so the user sees the fresh landing page for the new file.
		if (this.state.currentPage !== "landing") {
			this.resetImportState();
			this.state.currentPage = "landing";
		}

		// Auto-detect delimiter for landing page data snapshot
		if (data) this.state.detectedDelimiter = detectDelimiter(data);

		// Load persisted display settings for this CSV file
		this.loadDisplaySettings();

		if (this.autoStartImport) {
			this.autoStartImport = false;
			void this.startImportWizard();
		} else {
			this.renderContent();
		}
	}

	clear(): void {
		this.contentEl.empty();
		this.rootEl = null;
		this.topBarEl = null;
		this.landingEl = null;
		this.workspaceEl = null;
		this.csvDeps = null;
		this.landingPage = null;
		this.configPage = null;
		this.previewPage = null;
		this.resultPage = null;
	}

	async onClose(): Promise<void> {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}

	// ── Layout skeleton ─────────────────────────────────────

	private ensureRoot(): void {
		if (this.rootEl) return;

		const el = this.contentEl;
		el.empty();

		this.rootEl = el.createDiv({ cls: "flowti-container ft-view-root-flex" });

		// Top bar (hidden on landing)
		this.topBarEl = this.rootEl.createDiv({ cls: "ft-view-top-bar ft-hidden" });
		this.renderTopBar();

		// Landing page container
		this.landingEl = this.rootEl.createDiv({ cls: "ft-view-landing" });

		// Workspace container (for wizard pages)
		this.workspaceEl = this.rootEl.createDiv({ cls: "ft-view-workspace ft-hidden" });

		// Create page components
		this.csvDeps = this.buildDeps();
		this.landingPage = new CsvLanding(this.landingEl, this.csvDeps);
		this.configPage = new CsvConfigPage(this.workspaceEl, this.csvDeps);
		this.previewPage = new CsvPreviewPage(this.workspaceEl, this.csvDeps);
		this.resultPage = new CsvResultPage(this.workspaceEl, this.csvDeps);
	}

	// ── Page router ─────────────────────────────────────────

	private renderContent(): void {
		this.ensureRoot();

		const isLanding = this.state.currentPage === "landing";
		this.topBarEl!.classList.toggle("ft-hidden", isLanding);
		this.landingEl!.classList.toggle("ft-hidden", !isLanding);
		this.workspaceEl!.classList.toggle("ft-hidden", isLanding);

		if (!isLanding) {
			this.renderTopBar();
		}

		switch (this.state.currentPage) {
			case "landing":
				this.landingPage!.render();
				break;
			case "config":
				this.configPage!.render();
				break;
			case "preview":
				this.previewPage!.render();
				break;
			case "result":
				this.resultPage!.render();
				break;
		}
	}

	// ── Deps builder ────────────────────────────────────────

	private buildDeps(): CsvComponentDeps {
		return {
			app: this.app,
			eventBus: this.eventBus,
			dataExchangeService: this.dataExchangeService,
			getState: () => this.state,
			setState: (partial) => { Object.assign(this.state, partial); },
			renderContent: () => this.renderContent(),
			startImportWizard: (skip) => this.startImportWizard(skip),
			resetImportState: () => this.resetImportState(),
			openFolderPicker: () => this.openFolderPicker(),
			openBaseFolderPicker: () => this.openBaseFolderPicker(),
			openHubImportConfig: (id) => this.openHubImportConfig(id),
			detachLeaf: () => this.leaf.detach(),
			runImport: () => this.runImport(),
			promptSaveConfig: () => this.promptSaveConfig(),
			hasUnsavedChanges: () => this.hasUnsavedChanges(),
			updateUnsavedHint: () => this.updateUnsavedHint(),
			getUnsavedHintEl: () => this.unsavedHintEl,
			setUnsavedHintEl: (el) => { this.unsavedHintEl = el; },
			getFile: () => this.file,
			getData: () => this.data,
			getQueriesBySource: this.getQueriesBySourceCb ?? undefined,
			openAnalyticsHub: this.openAnalyticsHubCb ?? undefined,
		};
	}

	// ── Top bar with stepper ────────────────────────────────

	private renderTopBar(): void {
		const bar = this.topBarEl!;
		bar.empty();

		// ── Row 1: File header (same design as landing page) ──
		const headerRow = bar.createDiv({ cls: "ft-csv-header ft-header-mb-0" });
		const iconEl = headerRow.createDiv({ cls: "ft-csv-header-icon" });
		setIcon(iconEl, "file-spreadsheet");
		const titleCol = headerRow.createDiv();
		const titleRow = titleCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const nameEl = titleRow.createEl("h2", {
			text: this.file?.basename ?? "CSV File",
			cls: "ft-heading ft-csv-title",
		});
		nameEl.addClass("ft-cursor-pointer");
		nameEl.addEventListener("click", () => {
			this.resetImportState();
			this.state.currentPage = "landing";
			this.renderContent();
		});
		titleRow.createSpan({
			text: "Import",
			cls: "ft-operation-badge ft-operation-badge-import",
		});

		// Loaded config indicator
		if (this.state.loadedConfigId) {
			const cfg = this.state.savedConfigs.find((c) => c.id === this.state.loadedConfigId);
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
		subtitle.createSpan({ text: this.file?.path ?? "", cls: "ft-text-sm ft-text-muted" });
		if (this.state.parsedCsv) {
			subtitle.createSpan({
				text: `${this.state.parsedCsv.rowCount} rows`,
				cls: "ft-badge ft-badge-muted",
			});
			subtitle.createSpan({
				text: `${this.state.parsedCsv.headers.length} cols`,
				cls: "ft-badge ft-badge-muted",
			});
		}

		// ── Row 2: Stepper + config dropdown ──
		const stepRow = bar.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });

		renderStepBar(stepRow, {
			steps: ["config", "preview", "result"] as CsvPage[],
			currentPage: this.state.currentPage,
			labels: STEP_LABELS,
			hasResult: !!this.state.importResult,
			hasError: !!this.state.importError,
			onNavigate: (page) => {
				this.state.currentPage = page;
				this.renderContent();
			},
		});

		// Spacer
		stepRow.createDiv({ cls: "ft-flex-1" });

		// Save button (always rendered, toggled by updateUnsavedHint)
		const saveBtn = stepRow.createEl("span", { cls: "ft-nav-link" });
		setIcon(saveBtn.createSpan(), "save");
		saveBtn.appendText(" Save");
		saveBtn.addEventListener("click", () => this.promptSaveConfig());
		saveBtn.classList.toggle("ft-hidden", !this.hasUnsavedChanges());
		this.saveBtnEl = saveBtn;

		// Config dropdown
		const fileConfigs = this.state.savedConfigs.filter(
			(c) => c.sourcePath === this.file?.path,
		);
		renderConfigDropdown(stepRow, {
			onSave: () => this.promptSaveConfig(),
			configs: fileConfigs,
			onLoad: (id) => {
				this.applySavedImportConfig(id);
				this.renderContent();
			},
		});
	}

	// ── Config management ───────────────────────────────────

	private promptSaveConfig(): void {
		// Prefill with loaded config name, then file basename, then generic
		let defaultName = "My import config";
		if (this.state.loadedConfigId) {
			const loaded = this.state.savedConfigs.find((c) => c.id === this.state.loadedConfigId);
			if (loaded) defaultName = loaded.name;
		} else if (this.file?.basename) {
			defaultName = this.file.basename;
		}

		new InputModal(this.app, {
			title: "Save Import Config",
			inputName: "Config name",
			inputDesc: "A descriptive name for this import configuration",
			placeholder: "My import config",
			defaultValue: defaultName,
			submitLabel: "Save",
			onSubmit: (name) => {
				// Look up noteType from linked CsvDoc report (if available)
				let reportNoteType: string | undefined;
				if (this.file) {
					const docPath = this.dataExchangeService.resolveCsvDocPath(this.file.path, (p) => !!this.app.vault.getAbstractFileByPath(p));
					const docFile = this.app.vault.getAbstractFileByPath(docPath);
					if (docFile instanceof TFile) {
						const cache = this.app.metadataCache.getFileCache(docFile);
						const nt = cache?.frontmatter?.noteType;
						if (typeof nt === "string" && nt) reportNoteType = nt;
					}
				}

				const configData = {
					name,
					sourcePath: this.file?.path,
					targetFolder: this.state.targetFolder,
					nameColumn: this.state.nameColumn,
					namePrefix: this.state.namePrefix || undefined,
					nameSuffix: this.state.nameSuffix || undefined,
					columnMappings: [...this.state.columnMappings],
					conflictStrategy: this.state.conflictStrategy,
					customProperties: Object.keys(this.state.customProperties).length > 0
						? { ...this.state.customProperties }
						: undefined,
					createBase: this.state.createBase || undefined,
					basePath: this.state.basePath || undefined,
					noteType: reportNoteType,
				};

				const existing = this.dataExchangeService
					.getSavedImportConfigs()
					.find((c) => c.name === name);

				if (existing) {
					new ConfirmModal(this.app, {
						message: `A config named "${name}" already exists. Update it?`,
						confirmLabel: "Update",
						onConfirm: () => {
							void this.dataExchangeService
								.updateImportConfig(existing.id, configData)
								.then((updated) => {
									this.state.savedConfigs = this.dataExchangeService.getSavedImportConfigs();
									this.state.loadedConfigId = existing.id;
									new Notice(`Config updated: ${updated?.name ?? name}`);
									this.renderContent();
								})
								.catch((err) =>
									console.error("[Flowti] Failed to update import config", err),
								);
						},
					}).open();
					return;
				}

				void this.dataExchangeService
					.saveImportConfig(configData)
					.then((saved) => {
						this.state.savedConfigs = this.dataExchangeService.getSavedImportConfigs();
						this.state.loadedConfigId = saved.id;
						new Notice(`Config saved: ${saved.name}`);
						this.renderContent();
					})
					.catch((err) =>
						console.error("[Flowti] Failed to save import config", err),
					);
			},
		}).open();
	}

	private applySavedImportConfig(id: string): void {
		const cfg = this.state.savedConfigs.find((c) => c.id === id);
		if (!cfg) return;
		this.state.loadedConfigId = cfg.id;
		this.state.targetFolder = cfg.targetFolder;
		this.state.nameColumn = cfg.nameColumn;
		this.state.namePrefix = cfg.namePrefix ?? "";
		this.state.nameSuffix = cfg.nameSuffix ?? "";
		this.state.conflictStrategy = cfg.conflictStrategy;
		this.state.customProperties = cfg.customProperties ? { ...cfg.customProperties } : {};
		this.state.createBase = cfg.createBase ?? false;
		this.state.basePath = cfg.basePath ?? "";
		// Reset all mappings to defaults, then overlay saved config values
		for (const mapping of this.state.columnMappings) {
			mapping.frontmatterKey = mapping.csvColumn
				.toLowerCase()
				.replace(/\s+/g, "_")
				.replace(/[^a-z0-9_]/g, "");
			mapping.included = true;
		}
		for (const saved of cfg.columnMappings) {
			const mapping = this.state.columnMappings.find(
				(m) => m.csvColumn === saved.csvColumn,
			);
			if (mapping) {
				mapping.frontmatterKey = saved.frontmatterKey;
				mapping.included = saved.included;
			}
		}
		new Notice(`Loaded config: ${cfg.name}`);
	}

	// ── Import wizard entry ─────────────────────────────────

	private async startImportWizard(skipAutoDetect = false): Promise<void> {
		this.state.importService = this.dataExchangeService.getImportService();
		this.state.savedConfigs = this.dataExchangeService.getSavedImportConfigs();

		// Subscribe to progress events
		this.unsubscribes.push(
			this.eventBus.on("dataExchange.import.progress", (event) => {
				this.state.importProgress = {
					current: event.payload.current,
					total: event.payload.total,
				};
				if (this.state.currentPage === "result" && !this.state.importResult) {
					this.resultPage?.renderProgressIndicator();
				}
			}),
		);

		// Parse CSV (papaparse auto-detects the delimiter)
		try {
			this.state.parsedCsv = await this.state.importService.parseFile(this.file!.path);
			this.state.detectedDelimiter = this.state.parsedCsv.detectedDelimiter;
			this.initializeFromCsv();
		} catch (error) {
			this.state.parseError =
				error instanceof Error ? error.message : String(error);
		}

		// Pre-apply saved config if provided (e.g. from Hub)
		if (this.state.pendingSavedConfig) {
			this.applySavedImportConfig(this.state.pendingSavedConfig.id);
			this.state.pendingSavedConfig = null;
			this.state.currentPage = "preview";
			this.renderContent();
			return;
		}

		// Auto-detect existing configs for this CSV file (skipped when user already chose)
		if (!skipAutoDetect) {
			const matchingConfigs = this.dataExchangeService.getImportConfigsForFile(this.file!.path);
			if (matchingConfigs.length === 1) {
				this.applySavedImportConfig(matchingConfigs[0].id);
				this.state.currentPage = "preview";
				this.renderContent();
				return;
			}
			if (matchingConfigs.length > 1) {
				new ConfigChooserModal(
					this.app,
					matchingConfigs.map((c) => ({ id: c.id, name: c.name })),
					(id) => {
						if (id) {
							this.applySavedImportConfig(id);
							this.state.currentPage = "preview";
						} else {
							this.state.currentPage = "config";
						}
						this.renderContent();
					},
				).open();
				return;
			}
		}

		this.state.currentPage = "config";
		this.renderContent();
	}

	private resetImportState(): void {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
		this.state.importService = null;
		this.state.parsedCsv = null;
		this.state.parseError = null;
		this.state.targetFolder = "";
		this.state.nameColumn = "";
		this.state.namePrefix = "";
		this.state.nameSuffix = "";
		this.state.columnMappings = [];
		this.state.conflictStrategy = "skip";
		this.state.importResult = null;
		this.state.importError = null;
		this.state.importProgress = { current: 0, total: 0 };
		this.state.createBase = false;
		this.state.basePath = "";
		this.state.savedConfigs = [];
		this.state.columnSearchText = "";
		this.state.customProperties = {};
		this.state.loadedConfigId = null;
	}

	// ── Execution ───────────────────────────────────────────

	private async runImport(): Promise<void> {
		try {
			this.state.importResult = await this.state.importService!.executeImport({
				sourcePath: this.file!.path,
				targetFolder: this.state.targetFolder,
				nameColumn: this.state.nameColumn,
				namePrefix: this.state.namePrefix || undefined,
				nameSuffix: this.state.nameSuffix || undefined,
				columnMappings: this.state.columnMappings,
				conflictStrategy: this.state.conflictStrategy,
				customProperties: Object.keys(this.state.customProperties).length > 0
					? { ...this.state.customProperties }
					: undefined,
			});
			const r = this.state.importResult;
			new Notice(
				`Import complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped`,
			);
			// Record last import timestamp
			this.state.lastImportedAt = Date.now();
			this.persistDisplaySettings();
			// Auto-save config on first import if none exists for this file
			await this.autoSaveConfigIfNeeded();
			// Create or update corresponding .base file
			await this.syncBaseFile();
		} catch (error) {
			this.state.importError =
				error instanceof Error ? error.message : String(error);
		}
		this.renderContent();
	}

	private async autoSaveConfigIfNeeded(): Promise<void> {
		if (!this.file) return;
		const existing = this.dataExchangeService.getImportConfigsForFile(this.file.path);
		if (existing.length > 0) return;
		try {
			const saved = await this.dataExchangeService.saveImportConfig({
				name: this.file.basename,
				sourcePath: this.file.path,
				targetFolder: this.state.targetFolder,
				nameColumn: this.state.nameColumn,
				namePrefix: this.state.namePrefix || undefined,
				nameSuffix: this.state.nameSuffix || undefined,
				columnMappings: [...this.state.columnMappings],
				conflictStrategy: this.state.conflictStrategy,
				customProperties: Object.keys(this.state.customProperties).length > 0
					? { ...this.state.customProperties }
					: undefined,
				createBase: this.state.createBase || undefined,
				basePath: this.state.basePath || undefined,
			});
			this.state.savedConfigs = this.dataExchangeService.getSavedImportConfigs();
			new Notice(`Config auto-saved: ${saved.name}`);
		} catch (err) {
			console.error("[Flowti] Failed to auto-save import config", err);
		}
	}

	/** Creates a new .base file if one doesn't exist yet. Existing files are never overwritten
	 *  because they may contain custom formulas, views, and properties. */
	private async syncBaseFile(): Promise<void> {
		if (!this.state.createBase) return;
		if (!this.state.basePath) {
			const baseFilename = getBaseFilename(this.file?.path ?? "imported.csv");
			this.state.basePath = this.state.targetFolder
				? `${this.state.targetFolder}/${baseFilename}`
				: baseFilename;
		}
		let path = this.state.basePath.trim();
		if (!path) return;
		if (!path.endsWith(".base")) path += ".base";

		const existingFile = this.app.vault.getAbstractFileByPath(path);
		if (existingFile) return; // Never overwrite — existing base may have formulas, views, etc.

		try {
			const content = generateBaseYaml(this.state.targetFolder, this.state.columnMappings);
			await this.eventBus.emit("doc.create", {
				docType: "CsvDoc" as const,
				name: basename(path) || path,
				path,
				content,
				source: "CsvActionView",
			});
			new Notice(`Base view created: ${path}`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(`Failed to create .base file: ${msg}`);
		}
	}

	// ── Unsaved changes ─────────────────────────────────────

	/** Checks whether the current config state differs from the loaded saved config. */
	private hasUnsavedChanges(): boolean {
		if (!this.state.loadedConfigId) return false;
		const cfg = this.state.savedConfigs.find((c) => c.id === this.state.loadedConfigId);
		if (!cfg) return false;
		if (cfg.targetFolder !== this.state.targetFolder) return true;
		if (cfg.nameColumn !== this.state.nameColumn) return true;
		if ((cfg.namePrefix ?? "") !== this.state.namePrefix) return true;
		if ((cfg.nameSuffix ?? "") !== this.state.nameSuffix) return true;
		if (cfg.conflictStrategy !== this.state.conflictStrategy) return true;
		const savedProps = cfg.customProperties ?? {};
		if (JSON.stringify(savedProps) !== JSON.stringify(this.state.customProperties)) return true;
		if ((cfg.createBase ?? false) !== this.state.createBase) return true;
		if ((cfg.basePath ?? "") !== this.state.basePath) return true;
		for (const mapping of this.state.columnMappings) {
			const saved = cfg.columnMappings.find((s) => s.csvColumn === mapping.csvColumn);
			if (saved && (saved.included !== mapping.included || saved.frontmatterKey !== mapping.frontmatterKey)) return true;
		}
		return false;
	}

	private updateUnsavedHint(): void {
		const changed = this.hasUnsavedChanges();
		if (this.unsavedHintEl) {
			this.unsavedHintEl.classList.toggle("ft-hidden", !changed);
		}
		if (this.saveBtnEl) {
			this.saveBtnEl.classList.toggle("ft-hidden", !changed);
		}
	}

	// ── Folder pickers ──────────────────────────────────────

	private openFolderPicker(): void {
		const folders = getVaultFolders(this.app);
		new FolderPickerModal(this.app, folders, (folder) => {
			this.state.targetFolder = folder;
			this.renderContent();
		}).open();
	}

	private openBaseFolderPicker(): void {
		const folders = getVaultFolders(this.app);
		new FolderPickerModal(this.app, folders, (folder) => {
			const filename = getBaseFilename(this.file?.path ?? "imported.csv");
			this.state.basePath = folder ? `${folder}/${filename}` : filename;
			this.renderContent();
		}).open();
	}

	// ── Display settings ────────────────────────────────────

	private loadDisplaySettings(): void {
		if (!this.file) return;
		const settings = this.dataExchangeService.getCsvDisplaySettings(this.file.path);
		if (settings) {
			this.state.previewSortColumn = settings.sortColumn;
			this.state.previewSortDir = settings.sortDirection;
			this.state.hiddenColumns = settings.hiddenColumns ?? [];
			this.state.filterColumn = settings.filterColumn ?? null;
			this.state.filterText = settings.filterText ?? "";
			this.state.previewMaxRows = settings.maxPreviewRows;
			this.state.lastImportedAt = settings.lastImportedAt ?? null;
		}
	}

	private persistDisplaySettings(): void {
		if (!this.file) return;
		this.dataExchangeService.saveCsvDisplaySettings(this.file.path, {
			sortColumn: this.state.previewSortColumn,
			sortDirection: this.state.previewSortDir,
			hiddenColumns: [...this.state.hiddenColumns],
			filterColumn: this.state.filterColumn,
			filterText: this.state.filterText,
			maxPreviewRows: this.state.previewMaxRows,
			lastImportedAt: this.state.lastImportedAt ?? undefined,
		}).catch((err) => console.error("[Flowti] Failed to persist CSV display settings", err));
	}

	// ── Initialization ──────────────────────────────────────

	private initializeFromCsv(): void {
		if (!this.state.parsedCsv) return;

		const csvPath = this.file!.path;
		const lastSlash = csvPath.lastIndexOf("/");
		const csvFolder =
			lastSlash >= 0 ? csvPath.substring(0, lastSlash) : "";
		this.state.targetFolder = csvFolder
			? `${csvFolder}/imported`
			: "imported";

		this.state.nameColumn = this.state.parsedCsv.headers[0] ?? "";

		this.state.columnMappings = this.state.parsedCsv.headers.map((h) => ({
			csvColumn: h,
			frontmatterKey: h
				.toLowerCase()
				.replace(/\s+/g, "_")
				.replace(/[^a-z0-9_]/g, ""),
			included: true,
		}));
	}

	private openHubImportConfig(configId: string): void {
		if (this.openHubImportConfigCb) {
			this.openHubImportConfigCb(configId);
		}
	}
}
