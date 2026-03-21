/**
 * CSV Action handler helpers — config management, import execution, and display settings.
 *
 * Extracted from csv-action-handler.ts to stay under max-lines.
 */

import { TFile } from "obsidian";
import type { App } from "obsidian";
import type { IEventBus } from "../../events/types";
import type { DataExchangeService } from "../../../domain/dataExchange/DataExchangeService";
import type { SavedImportConfig } from "../../../domain/dataExchange/types";
import type { CsvViewState } from "../../../ui/csv";
import { ConfirmModal, InputModal } from "../../../ui/modals";
import { generateBaseYaml, getBaseFilename } from "../../../ui/csv";
import { basename } from "../../../utils/pathUtils";

// ── Config management ────────────────────────────────

export function promptSaveConfig(
	app: App,
	eventBus: IEventBus,
	dataExchangeService: DataExchangeService,
	state: CsvViewState,
	getFile: () => TFile | null,
	renderContent: () => void,
): void {
	const file = getFile();
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

export function applySavedImportConfig(
	eventBus: IEventBus,
	state: CsvViewState,
	id: string,
): void {
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

// ── Import execution ────────────────────────────────

export async function runImport(
	eventBus: IEventBus,
	dataExchangeService: DataExchangeService,
	app: App,
	state: CsvViewState,
	getFile: () => TFile | null,
	renderContent: () => void,
	persistDisplaySettings: () => void,
): Promise<void> {
	const file = getFile();
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
		await autoSaveConfigIfNeeded(dataExchangeService, eventBus, state, getFile);
		await syncBaseFile(app, eventBus, state, getFile);
	} catch (error) {
		state.importError = error instanceof Error ? error.message : String(error);
	}
	renderContent();
}

export async function autoSaveConfigIfNeeded(
	dataExchangeService: DataExchangeService,
	eventBus: IEventBus,
	state: CsvViewState,
	getFile: () => TFile | null,
): Promise<void> {
	const file = getFile();
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

export async function syncBaseFile(
	app: App,
	eventBus: IEventBus,
	state: CsvViewState,
	getFile: () => TFile | null,
): Promise<void> {
	if (!state.createBase) return;
	const file = getFile();
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

export function hasUnsavedChanges(state: CsvViewState): boolean {
	if (!state.loadedConfigId) return false;
	const cfg = state.savedConfigs.find((c) => c.id === state.loadedConfigId);
	if (!cfg) return false;
	return hasScalarChanges(cfg, state) || hasMappingChanges(cfg, state);
}

function hasScalarChanges(cfg: SavedImportConfig, state: CsvViewState): boolean {
	if (cfg.targetFolder !== state.targetFolder) return true;
	if (cfg.nameColumn !== state.nameColumn) return true;
	if ((cfg.namePrefix ?? "") !== state.namePrefix) return true;
	if ((cfg.nameSuffix ?? "") !== state.nameSuffix) return true;
	if (cfg.conflictStrategy !== state.conflictStrategy) return true;
	if (JSON.stringify(cfg.customProperties ?? {}) !== JSON.stringify(state.customProperties)) return true;
	if ((cfg.createBase ?? false) !== state.createBase) return true;
	if ((cfg.basePath ?? "") !== state.basePath) return true;
	return false;
}

function hasMappingChanges(cfg: SavedImportConfig, state: CsvViewState): boolean {
	for (const mapping of state.columnMappings) {
		const saved = cfg.columnMappings.find((s) => s.csvColumn === mapping.csvColumn);
		if (saved && (saved.included !== mapping.included || saved.frontmatterKey !== mapping.frontmatterKey)) return true;
	}
	return false;
}

// ── Display settings ─────────────────────────────────

export function loadDisplaySettings(
	dataExchangeService: DataExchangeService,
	state: CsvViewState,
	getFile: () => TFile | null,
): void {
	const file = getFile();
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

export function persistDisplaySettings(
	dataExchangeService: DataExchangeService,
	state: CsvViewState,
	getFile: () => TFile | null,
): void {
	const file = getFile();
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
