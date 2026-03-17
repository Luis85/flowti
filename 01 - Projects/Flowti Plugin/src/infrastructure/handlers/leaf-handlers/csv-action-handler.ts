/**
 * CSV Action handler — sitemap-driven orchestrator.
 *
 * Manages the 4-page wizard (landing → config → preview → result) and
 * delegates rendering to the existing page components:
 *   CsvLanding, CsvConfigPage, CsvPreviewPage, CsvResultPage
 *
 * Called by the thin CsvActionView TextFileView shell, which passes
 * file/data access and Obsidian-specific callbacks.
 */

import { setIcon, TFile } from "obsidian";
import type { App } from "obsidian";
import type { IEventBus } from "../../events/types";
import type { DataExchangeService } from "../../../domain/dataExchange/DataExchangeService";
import type { SavedImportConfig } from "../../../domain/dataExchange/types";
import { FolderPickerModal, getVaultFolders } from "../../../ui/shared/FolderPickerModal";
import { ConfirmModal, ConfigChooserModal, InputModal } from "../../../ui/modals";
import { renderStepBar, renderConfigDropdown } from "../../../ui/hub/helpers";
import {
	CsvLanding,
	CsvConfigPage,
	CsvPreviewPage,
	CsvResultPage,
	STEP_LABELS,
	detectDelimiter,
	generateBaseYaml,
	getBaseFilename,
} from "../../../ui/csv";
import type { CsvViewState, CsvComponentDeps, CsvPage } from "../../../ui/csv";
import { basename } from "../../../utils/pathUtils";

// ── Deps ──────────────────────────────────────────────────────

export interface CsvActionHandlerDeps {
	eventBus: IEventBus;
	dataExchangeService: DataExchangeService;
	app: App;
	/** Get the currently displayed CSV file. */
	getFile: () => TFile | null;
	/** Get the raw CSV data. */
	getData: () => string;
	/** Detach the hosting leaf (e.g. close the tab). */
	detachLeaf: () => void;
	/** Navigate to Data Exchange Hub import config page. */
	openHubImportConfig?: (configId: string) => void;
	/** Get analytics queries referencing a source path. */
	getQueriesBySource?: (csvPath: string) => import("../../../domain/analytics/types").SavedAnalyticsQuery[];
	/** Navigate to Analytics Hub. */
	openAnalyticsHub?: (tabId: string, entityId: string) => void;
}

// ── State factory ─────────────────────────────────────────────

function createInitialState(): CsvViewState {
	return {
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
}

// ── Orchestrator ──────────────────────────────────────────────

export interface CsvOrchestrator {
	/** Re-render content after file data changes. */
	onDataChanged(data: string, autoStart: boolean): void;
	/** Pre-apply a saved config before the wizard starts. */
	setSavedConfig(config: SavedImportConfig): void;
	/** Cleanup when the view closes. */
	destroy(): void;
}

export function createCsvOrchestrator(
	container: HTMLElement,
	deps: CsvActionHandlerDeps,
): CsvOrchestrator {
	const { eventBus, dataExchangeService, app } = deps;
	const state = createInitialState();
	let unsubscribes: (() => void)[] = [];

	// Layout refs
	let rootEl: HTMLElement | null = null;
	let topBarEl: HTMLElement | null = null;
	let landingEl: HTMLElement | null = null;
	let workspaceEl: HTMLElement | null = null;
	let unsavedHintEl: HTMLElement | null = null;
	let saveBtnEl: HTMLElement | null = null;

	// Page components
	let csvDeps: CsvComponentDeps | null = null;
	let landingPage: CsvLanding | null = null;
	let configPage: CsvConfigPage | null = null;
	let previewPage: CsvPreviewPage | null = null;
	let resultPage: CsvResultPage | null = null;

	// ── Layout skeleton ──────────────────────────────────

	function ensureRoot(): void {
		if (rootEl) return;
		container.empty();

		rootEl = container.createDiv({ cls: "flowti-container ft-view-root-flex" });
		topBarEl = rootEl.createDiv({ cls: "ft-view-top-bar ft-hidden" });
		renderTopBar();
		landingEl = rootEl.createDiv({ cls: "ft-view-landing" });
		workspaceEl = rootEl.createDiv({ cls: "ft-view-workspace ft-hidden" });

		csvDeps = buildDeps();
		landingPage = new CsvLanding(landingEl, csvDeps);
		configPage = new CsvConfigPage(workspaceEl, csvDeps);
		previewPage = new CsvPreviewPage(workspaceEl, csvDeps);
		resultPage = new CsvResultPage(workspaceEl, csvDeps);
	}

	// ── Page router ──────────────────────────────────────

	function renderContent(): void {
		ensureRoot();

		const isLanding = state.currentPage === "landing";
		topBarEl!.classList.toggle("ft-hidden", isLanding);
		landingEl!.classList.toggle("ft-hidden", !isLanding);
		workspaceEl!.classList.toggle("ft-hidden", isLanding);

		if (!isLanding) renderTopBar();

		switch (state.currentPage) {
			case "landing": landingPage!.render(); break;
			case "config": configPage!.render(); break;
			case "preview": previewPage!.render(); break;
			case "result": resultPage!.render(); break;
		}
	}

	// ── Deps builder ─────────────────────────────────────

	function buildDeps(): CsvComponentDeps {
		return {
			app,
			eventBus,
			dataExchangeService,
			getState: () => state,
			setState: (partial) => { Object.assign(state, partial); },
			renderContent: () => renderContent(),
			startImportWizard: (skip) => startImportWizard(skip),
			resetImportState: () => resetImportState(),
			openFolderPicker: () => openFolderPicker(),
			openBaseFolderPicker: () => openBaseFolderPicker(),
			openHubImportConfig: (id) => deps.openHubImportConfig?.(id),
			detachLeaf: () => deps.detachLeaf(),
			runImport: () => runImport(),
			promptSaveConfig: () => promptSaveConfig(),
			hasUnsavedChanges: () => hasUnsavedChanges(),
			updateUnsavedHint: () => updateUnsavedHint(),
			getUnsavedHintEl: () => unsavedHintEl,
			setUnsavedHintEl: (el) => { unsavedHintEl = el; },
			getFile: () => deps.getFile(),
			getData: () => deps.getData(),
			getQueriesBySource: deps.getQueriesBySource,
			openAnalyticsHub: deps.openAnalyticsHub,
		};
	}

	// ── Top bar ──────────────────────────────────────────

	function renderTopBar(): void {
		const bar = topBarEl!;
		bar.empty();

		const file = deps.getFile();

		const headerRow = bar.createDiv({ cls: "ft-csv-header ft-header-mb-0" });
		const iconEl = headerRow.createDiv({ cls: "ft-csv-header-icon" });
		setIcon(iconEl, "file-spreadsheet");
		const titleCol = headerRow.createDiv();
		const titleRow = titleCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const nameEl = titleRow.createEl("h2", {
			text: file?.basename ?? "CSV File",
			cls: "ft-heading ft-csv-title",
		});
		nameEl.addClass("ft-cursor-pointer");
		nameEl.addEventListener("click", () => {
			resetImportState();
			state.currentPage = "landing";
			renderContent();
		});
		titleRow.createSpan({ text: "Import", cls: "ft-operation-badge ft-operation-badge-import" });

		if (state.loadedConfigId) {
			const cfg = state.savedConfigs.find((c) => c.id === state.loadedConfigId);
			if (cfg) {
				titleRow.createSpan({ text: `Config: ${cfg.name}`, cls: "ft-badge ft-badge-accent" });
			}
		} else {
			titleRow.createSpan({ text: "No config loaded", cls: "ft-badge ft-badge-muted" });
		}

		const subtitle = titleCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		subtitle.createSpan({ text: file?.path ?? "", cls: "ft-text-sm ft-text-muted" });
		if (state.parsedCsv) {
			subtitle.createSpan({ text: `${state.parsedCsv.rowCount} rows`, cls: "ft-badge ft-badge-muted" });
			subtitle.createSpan({ text: `${state.parsedCsv.headers.length} cols`, cls: "ft-badge ft-badge-muted" });
		}

		const stepRow = bar.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		renderStepBar(stepRow, {
			steps: ["config", "preview", "result"] as CsvPage[],
			currentPage: state.currentPage,
			labels: STEP_LABELS,
			hasResult: !!state.importResult,
			hasError: !!state.importError,
			onNavigate: (page) => { state.currentPage = page; renderContent(); },
		});

		stepRow.createDiv({ cls: "ft-flex-1" });

		const saveBtn = stepRow.createEl("span", { cls: "ft-nav-link" });
		setIcon(saveBtn.createSpan(), "save");
		saveBtn.appendText(" Save");
		saveBtn.addEventListener("click", () => promptSaveConfig());
		saveBtn.classList.toggle("ft-hidden", !hasUnsavedChanges());
		saveBtnEl = saveBtn;

		const fileConfigs = state.savedConfigs.filter((c) => c.sourcePath === file?.path);
		renderConfigDropdown(stepRow, {
			onSave: () => promptSaveConfig(),
			configs: fileConfigs,
			onLoad: (id) => { applySavedImportConfig(id); renderContent(); },
		});
	}

	// ── Config management ────────────────────────────────

	function promptSaveConfig(): void {
		const file = deps.getFile();
		let defaultName = "My import config";
		if (state.loadedConfigId) {
			const loaded = state.savedConfigs.find((c) => c.id === state.loadedConfigId);
			if (loaded) defaultName = loaded.name;
		} else if (file?.basename) {
			defaultName = file.basename;
		}

		new InputModal(app, {
			title: "Save Import Config",
			inputName: "Config name",
			inputDesc: "A descriptive name for this import configuration",
			placeholder: "My import config",
			defaultValue: defaultName,
			submitLabel: "Save",
			onSubmit: (name) => {
				let reportNoteType: string | undefined;
				if (file) {
					const docPath = dataExchangeService.resolveCsvDocPath(file.path, (p) => !!app.vault.getAbstractFileByPath(p));
					const docFile = app.vault.getAbstractFileByPath(docPath);
					if (docFile instanceof TFile && app.metadataCache) {
						const cache = app.metadataCache.getFileCache(docFile);
						const nt = cache?.frontmatter?.noteType;
						if (typeof nt === "string" && nt) reportNoteType = nt;
					}
				}

				const configData = {
					name,
					sourcePath: file?.path,
					targetFolder: state.targetFolder,
					nameColumn: state.nameColumn,
					namePrefix: state.namePrefix || undefined,
					nameSuffix: state.nameSuffix || undefined,
					columnMappings: [...state.columnMappings],
					conflictStrategy: state.conflictStrategy,
					customProperties: Object.keys(state.customProperties).length > 0
						? { ...state.customProperties } : undefined,
					createBase: state.createBase || undefined,
					basePath: state.basePath || undefined,
					noteType: reportNoteType,
				};

				const existing = dataExchangeService.getSavedImportConfigs().find((c) => c.name === name);
				if (existing) {
					new ConfirmModal(app, {
						message: `A config named "${name}" already exists. Update it?`,
						confirmLabel: "Update",
						onConfirm: () => {
							void dataExchangeService.updateImportConfig(existing.id, configData).then((updated) => {
								state.savedConfigs = dataExchangeService.getSavedImportConfigs();
								state.loadedConfigId = existing.id;
								void eventBus.emit("notice.success", { message: `Config updated: ${updated?.name ?? name}` });
								renderContent();
							}).catch((err) => console.error("[Flowti] Failed to update import config", err));
						},
					}).open();
					return;
				}

				void dataExchangeService.saveImportConfig(configData).then((saved) => {
					state.savedConfigs = dataExchangeService.getSavedImportConfigs();
					state.loadedConfigId = saved.id;
					void eventBus.emit("notice.success", { message: `Config saved: ${saved.name}` });
					renderContent();
				}).catch((err) => console.error("[Flowti] Failed to save import config", err));
			},
		}).open();
	}

	function applySavedImportConfig(id: string): void {
		const cfg = state.savedConfigs.find((c) => c.id === id);
		if (!cfg) return;
		state.loadedConfigId = cfg.id;
		state.targetFolder = cfg.targetFolder;
		state.nameColumn = cfg.nameColumn;
		state.namePrefix = cfg.namePrefix ?? "";
		state.nameSuffix = cfg.nameSuffix ?? "";
		state.conflictStrategy = cfg.conflictStrategy;
		state.customProperties = cfg.customProperties ? { ...cfg.customProperties } : {};
		state.createBase = cfg.createBase ?? false;
		state.basePath = cfg.basePath ?? "";

		for (const mapping of state.columnMappings) {
			mapping.frontmatterKey = mapping.csvColumn.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
			mapping.included = true;
		}
		for (const saved of cfg.columnMappings) {
			const mapping = state.columnMappings.find((m) => m.csvColumn === saved.csvColumn);
			if (mapping) {
				mapping.frontmatterKey = saved.frontmatterKey;
				mapping.included = saved.included;
			}
		}
		void eventBus.emit("notice.show", { message: `Loaded config: ${cfg.name}` });
	}

	// ── Import wizard ────────────────────────────────────

	async function startImportWizard(skipAutoDetect = false): Promise<void> {
		const file = deps.getFile();
		state.importService = dataExchangeService.getImportService();
		state.savedConfigs = dataExchangeService.getSavedImportConfigs();

		unsubscribes.push(
			eventBus.on("dataExchange.import.progress", (event) => {
				state.importProgress = { current: event.payload.current, total: event.payload.total };
				if (state.currentPage === "result" && !state.importResult) {
					resultPage?.renderProgressIndicator();
				}
			}),
		);

		try {
			state.parsedCsv = await state.importService.parseFile(file!.path);
			state.detectedDelimiter = state.parsedCsv.detectedDelimiter;
			initializeFromCsv();
		} catch (error) {
			state.parseError = error instanceof Error ? error.message : String(error);
		}

		if (state.pendingSavedConfig) {
			applySavedImportConfig(state.pendingSavedConfig.id);
			state.pendingSavedConfig = null;
			state.currentPage = "preview";
			renderContent();
			return;
		}

		if (!skipAutoDetect) {
			const matchingConfigs = dataExchangeService.getImportConfigsForFile(file!.path);
			if (matchingConfigs.length === 1) {
				applySavedImportConfig(matchingConfigs[0].id);
				state.currentPage = "preview";
				renderContent();
				return;
			}
			if (matchingConfigs.length > 1) {
				new ConfigChooserModal(
					app,
					matchingConfigs.map((c) => ({ id: c.id, name: c.name })),
					(id) => {
						if (id) { applySavedImportConfig(id); state.currentPage = "preview"; }
						else { state.currentPage = "config"; }
						renderContent();
					},
				).open();
				return;
			}
		}

		state.currentPage = "config";
		renderContent();
	}

	function resetImportState(): void {
		for (const unsub of unsubscribes) unsub();
		unsubscribes = [];
		state.importService = null;
		state.parsedCsv = null;
		state.parseError = null;
		state.targetFolder = "";
		state.nameColumn = "";
		state.namePrefix = "";
		state.nameSuffix = "";
		state.columnMappings = [];
		state.conflictStrategy = "skip";
		state.importResult = null;
		state.importError = null;
		state.importProgress = { current: 0, total: 0 };
		state.createBase = false;
		state.basePath = "";
		state.savedConfigs = [];
		state.columnSearchText = "";
		state.customProperties = {};
		state.loadedConfigId = null;
	}

	// ── Execution ────────────────────────────────────────

	async function runImport(): Promise<void> {
		const file = deps.getFile();
		try {
			state.importResult = await state.importService!.executeImport({
				sourcePath: file!.path,
				targetFolder: state.targetFolder,
				nameColumn: state.nameColumn,
				namePrefix: state.namePrefix || undefined,
				nameSuffix: state.nameSuffix || undefined,
				columnMappings: state.columnMappings,
				conflictStrategy: state.conflictStrategy,
				customProperties: Object.keys(state.customProperties).length > 0
					? { ...state.customProperties } : undefined,
			});
			const r = state.importResult;
			void eventBus.emit("notice.success", {
				message: `Import complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped`,
			});
			state.lastImportedAt = Date.now();
			persistDisplaySettings();
			await autoSaveConfigIfNeeded();
			await syncBaseFile();
		} catch (error) {
			state.importError = error instanceof Error ? error.message : String(error);
		}
		renderContent();
	}

	async function autoSaveConfigIfNeeded(): Promise<void> {
		const file = deps.getFile();
		if (!file) return;
		const existing = dataExchangeService.getImportConfigsForFile(file.path);
		if (existing.length > 0) return;
		try {
			const saved = await dataExchangeService.saveImportConfig({
				name: file.basename,
				sourcePath: file.path,
				targetFolder: state.targetFolder,
				nameColumn: state.nameColumn,
				namePrefix: state.namePrefix || undefined,
				nameSuffix: state.nameSuffix || undefined,
				columnMappings: [...state.columnMappings],
				conflictStrategy: state.conflictStrategy,
				customProperties: Object.keys(state.customProperties).length > 0
					? { ...state.customProperties } : undefined,
				createBase: state.createBase || undefined,
				basePath: state.basePath || undefined,
			});
			state.savedConfigs = dataExchangeService.getSavedImportConfigs();
			void eventBus.emit("notice.success", { message: `Config auto-saved: ${saved.name}` });
		} catch (err) {
			console.error("[Flowti] Failed to auto-save import config", err);
		}
	}

	async function syncBaseFile(): Promise<void> {
		if (!state.createBase) return;
		const file = deps.getFile();
		if (!state.basePath) {
			const baseFilename = getBaseFilename(file?.path ?? "imported.csv");
			state.basePath = state.targetFolder ? `${state.targetFolder}/${baseFilename}` : baseFilename;
		}
		let path = state.basePath.trim();
		if (!path) return;
		if (!path.endsWith(".base")) path += ".base";

		if (app.vault.getAbstractFileByPath(path)) return;

		try {
			const content = generateBaseYaml(state.targetFolder, state.columnMappings);
			await eventBus.emit("doc.create", {
				docType: "CsvDoc" as const,
				name: basename(path) || path,
				path,
				content,
				source: "CsvActionView",
			});
			void eventBus.emit("notice.success", { message: `Base view created: ${path}` });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			void eventBus.emit("notice.error", { message: `Failed to create .base file: ${msg}` });
		}
	}

	// ── Unsaved changes ──────────────────────────────────

	function hasUnsavedChanges(): boolean {
		if (!state.loadedConfigId) return false;
		const cfg = state.savedConfigs.find((c) => c.id === state.loadedConfigId);
		if (!cfg) return false;
		if (cfg.targetFolder !== state.targetFolder) return true;
		if (cfg.nameColumn !== state.nameColumn) return true;
		if ((cfg.namePrefix ?? "") !== state.namePrefix) return true;
		if ((cfg.nameSuffix ?? "") !== state.nameSuffix) return true;
		if (cfg.conflictStrategy !== state.conflictStrategy) return true;
		if (JSON.stringify(cfg.customProperties ?? {}) !== JSON.stringify(state.customProperties)) return true;
		if ((cfg.createBase ?? false) !== state.createBase) return true;
		if ((cfg.basePath ?? "") !== state.basePath) return true;
		for (const mapping of state.columnMappings) {
			const saved = cfg.columnMappings.find((s) => s.csvColumn === mapping.csvColumn);
			if (saved && (saved.included !== mapping.included || saved.frontmatterKey !== mapping.frontmatterKey)) return true;
		}
		return false;
	}

	function updateUnsavedHint(): void {
		const changed = hasUnsavedChanges();
		if (unsavedHintEl) unsavedHintEl.classList.toggle("ft-hidden", !changed);
		if (saveBtnEl) saveBtnEl.classList.toggle("ft-hidden", !changed);
	}

	// ── Folder pickers ───────────────────────────────────

	function openFolderPicker(): void {
		const folders = getVaultFolders(app);
		new FolderPickerModal(app, folders, (folder) => {
			state.targetFolder = folder;
			renderContent();
		}).open();
	}

	function openBaseFolderPicker(): void {
		const file = deps.getFile();
		const folders = getVaultFolders(app);
		new FolderPickerModal(app, folders, (folder) => {
			const filename = getBaseFilename(file?.path ?? "imported.csv");
			state.basePath = folder ? `${folder}/${filename}` : filename;
			renderContent();
		}).open();
	}

	// ── Display settings ─────────────────────────────────

	function loadDisplaySettings(): void {
		const file = deps.getFile();
		if (!file) return;
		const settings = dataExchangeService.getCsvDisplaySettings(file.path);
		if (settings) {
			state.previewSortColumn = settings.sortColumn;
			state.previewSortDir = settings.sortDirection;
			state.hiddenColumns = settings.hiddenColumns ?? [];
			state.filterColumn = settings.filterColumn ?? null;
			state.filterText = settings.filterText ?? "";
			state.previewMaxRows = settings.maxPreviewRows;
			state.lastImportedAt = settings.lastImportedAt ?? null;
		}
	}

	function persistDisplaySettings(): void {
		const file = deps.getFile();
		if (!file) return;
		dataExchangeService.saveCsvDisplaySettings(file.path, {
			sortColumn: state.previewSortColumn,
			sortDirection: state.previewSortDir,
			hiddenColumns: [...state.hiddenColumns],
			filterColumn: state.filterColumn,
			filterText: state.filterText,
			maxPreviewRows: state.previewMaxRows,
			lastImportedAt: state.lastImportedAt ?? undefined,
		}).catch((err) => console.error("[Flowti] Failed to persist CSV display settings", err));
	}

	// ── Initialization ───────────────────────────────────

	function initializeFromCsv(): void {
		if (!state.parsedCsv) return;
		const file = deps.getFile();
		const csvPath = file!.path;
		const lastSlash = csvPath.lastIndexOf("/");
		const csvFolder = lastSlash >= 0 ? csvPath.substring(0, lastSlash) : "";
		state.targetFolder = csvFolder ? `${csvFolder}/imported` : "imported";
		state.nameColumn = state.parsedCsv.headers[0] ?? "";
		state.columnMappings = state.parsedCsv.headers.map((h) => ({
			csvColumn: h,
			frontmatterKey: h.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
			included: true,
		}));
	}

	// ── Public interface ─────────────────────────────────

	function onDataChanged(data: string, autoStart: boolean): void {
		if (state.currentPage !== "landing") {
			resetImportState();
			state.currentPage = "landing";
		}
		if (data) state.detectedDelimiter = detectDelimiter(data);
		loadDisplaySettings();

		if (autoStart) {
			void startImportWizard();
		} else {
			renderContent();
		}
	}

	function setSavedConfig(config: SavedImportConfig): void {
		state.pendingSavedConfig = config;
	}

	function destroy(): void {
		for (const unsub of unsubscribes) unsub();
		unsubscribes = [];
		rootEl = null;
		topBarEl = null;
		landingEl = null;
		workspaceEl = null;
		csvDeps = null;
		landingPage = null;
		configPage = null;
		previewPage = null;
		resultPage = null;
	}

	return { onDataChanged, setSavedConfig, destroy };
}
