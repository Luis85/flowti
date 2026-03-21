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
import { ConfigChooserModal } from "../../../ui/modals";
import { renderStepBar, renderConfigDropdown } from "../../../ui/hub/helpers";
import {
	CsvLanding, CsvConfigPage, CsvPreviewPage, CsvResultPage,
	STEP_LABELS, detectDelimiter, getBaseFilename,
} from "../../../ui/csv";
import type { CsvViewState, CsvComponentDeps, CsvPage } from "../../../ui/csv";
import {
	promptSaveConfig, applySavedImportConfig, runImport,
	hasUnsavedChanges, loadDisplaySettings, persistDisplaySettings,
} from "./csv-action-helpers";

// ── Deps ──────────────────────────────────────────────────────

export interface CsvActionHandlerDeps {
	eventBus: IEventBus;
	dataExchangeService: DataExchangeService;
	app: App;
	getFile: () => TFile | null;
	getData: () => string;
	detachLeaf: () => void;
	openHubImportConfig?: (configId: string) => void;
	getQueriesBySource?: (csvPath: string) => import("../../../domain/analytics/types").SavedAnalyticsQuery[];
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
	onDataChanged(data: string, autoStart: boolean): void;
	setSavedConfig(config: SavedImportConfig): void;
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
			runImport: () => doRunImport(),
			promptSaveConfig: () => doPromptSaveConfig(),
			hasUnsavedChanges: () => hasUnsavedChanges(state),
			updateUnsavedHint: () => updateUnsavedHint(),
			getUnsavedHintEl: () => unsavedHintEl,
			setUnsavedHintEl: (el) => { unsavedHintEl = el; },
			getFile: () => deps.getFile(),
			getData: () => deps.getData(),
			getQueriesBySource: deps.getQueriesBySource,
			openAnalyticsHub: deps.openAnalyticsHub,
		};
	}

	// ── Delegating wrappers ─────────────────────────────

	function doPromptSaveConfig(): void {
		promptSaveConfig(app, eventBus, dataExchangeService, state, () => deps.getFile(), () => renderContent());
	}

	async function doRunImport(): Promise<void> {
		await runImport(
			eventBus, dataExchangeService, app, state,
			() => deps.getFile(), () => renderContent(),
			() => doPersistDisplaySettings(),
		);
	}

	function doPersistDisplaySettings(): void {
		persistDisplaySettings(dataExchangeService, state, () => deps.getFile());
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
		saveBtn.addEventListener("click", () => doPromptSaveConfig());
		saveBtn.classList.toggle("ft-hidden", !hasUnsavedChanges(state));
		saveBtnEl = saveBtn;

		const fileConfigs = state.savedConfigs.filter((c) => c.sourcePath === file?.path);
		renderConfigDropdown(stepRow, {
			onSave: () => doPromptSaveConfig(),
			configs: fileConfigs,
			onLoad: (id) => { applySavedImportConfig(eventBus, state, id); renderContent(); },
		});
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
			applySavedImportConfig(eventBus, state, state.pendingSavedConfig.id);
			state.pendingSavedConfig = null;
			state.currentPage = "preview";
			renderContent();
			return;
		}

		if (!skipAutoDetect) {
			const matchingConfigs = dataExchangeService.getImportConfigsForFile(file!.path);
			if (matchingConfigs.length === 1) {
				applySavedImportConfig(eventBus, state, matchingConfigs[0].id);
				state.currentPage = "preview";
				renderContent();
				return;
			}
			if (matchingConfigs.length > 1) {
				new ConfigChooserModal(
					app,
					matchingConfigs.map((c) => ({ id: c.id, name: c.name })),
					(id) => {
						if (id) { applySavedImportConfig(eventBus, state, id); state.currentPage = "preview"; }
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

	function updateUnsavedHint(): void {
		const changed = hasUnsavedChanges(state);
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
		loadDisplaySettings(dataExchangeService, state, () => deps.getFile());

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
