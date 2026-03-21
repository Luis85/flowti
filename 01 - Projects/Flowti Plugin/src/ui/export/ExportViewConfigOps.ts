/**
 * Config save/load and export execution operations for ExportView.
 * Extracted to keep ExportView under the max-lines limit.
 */

import type { DataExchangeService } from "../../domain/dataExchange/DataExchangeService";
import type { ExportService } from "../../domain/dataExchange/ExportService";
import type { IEventBus } from "../../infrastructure/events/types";
import type { SavedExportConfig } from "../../domain/dataExchange/types";
import { ConfigChooserModal, ConfirmModal, InputModal } from "../modals";
import { getFilenameFromPath } from "./exportUtils";
import type { App } from "obsidian";

export interface ExportConfigOpsContext {
	app: App;
	eventBus: IEventBus;
	dataExchangeService: DataExchangeService;
	exportService: ExportService;
	getSourcePath: () => string;
	getSourceType: () => "folder" | "base";
	getFormat: () => "csv" | "tab";
	getOutputPath: () => string;
	getSelectedColumns: () => string[];
	getSelectedFileProperties: () => string[];
	getBaseViewIndex: () => number;
	getConflictStrategy: () => "overwrite" | "skip" | "append";
	getIsExternal: () => boolean;
	getDisplayNames: () => Record<string, string>;
	getResolvedColumns: () => unknown[] | null;
	getNoteType: () => string;
	getLoadedConfigId: () => string | null;
	getSavedConfigs: () => SavedExportConfig[];
	setLoadedConfigId: (id: string | null) => void;
	setSavedConfigs: (configs: SavedExportConfig[]) => void;
	setExportResult: (result: unknown) => void;
	setExportError: (error: string | null) => void;
	renderTopBar: () => void;
	renderPage: () => void;
	updateUnsavedHint: () => void;
}

export function promptSaveConfig(ctx: ExportConfigOpsContext): void {
	let defaultName = "My export config";
	const loadedId = ctx.getLoadedConfigId();
	if (loadedId) {
		const loaded = ctx.getSavedConfigs().find((c) => c.id === loadedId);
		if (loaded) defaultName = loaded.name;
	} else {
		defaultName = getFilenameFromPath(ctx.getSourcePath()).replace(/\.\w+$/, "");
	}

	new InputModal(ctx.app, {
		title: "Save Export Config",
		inputName: "Config name",
		inputDesc: "A descriptive name for this export configuration",
		placeholder: "My export config",
		defaultValue: defaultName,
		submitLabel: "Save",
		onSubmit: (name) => {
			const configData = buildConfigData(ctx, name);
			const existing = ctx.dataExchangeService
				.getSavedExportConfigs()
				.find((c) => c.name === name);

			if (existing) {
				new ConfirmModal(ctx.app, {
					message: `A config named "${name}" already exists. Update it?`,
					confirmLabel: "Update",
					onConfirm: () => {
						void ctx.dataExchangeService
							.updateExportConfig(existing.id, configData)
							.then((updated) => {
								ctx.setSavedConfigs(ctx.dataExchangeService.getSavedExportConfigs());
								ctx.setLoadedConfigId(existing.id);
								void ctx.eventBus.emit("notice.success", { message: `Config updated: ${updated?.name ?? name}` });
								ctx.renderTopBar();
								ctx.updateUnsavedHint();
							})
							.catch((err) =>
								console.error("[Flowti] Failed to update export config", err),
							);
					},
				}).open();
				return;
			}

			void ctx.dataExchangeService
				.saveExportConfig(configData)
				.then((saved) => {
					ctx.setSavedConfigs(ctx.dataExchangeService.getSavedExportConfigs());
					ctx.setLoadedConfigId(saved.id);
					void ctx.eventBus.emit("notice.success", { message: `Config saved: ${saved.name}` });
					ctx.renderTopBar();
					ctx.updateUnsavedHint();
				})
				.catch((err) =>
					console.error("[Flowti] Failed to save export config", err),
				);
		},
	}).open();
}

export async function runExport(ctx: ExportConfigOpsContext): Promise<void> {
	try {
		const result = await ctx.exportService.executeExport({
			sourcePath: ctx.getSourcePath(),
			sourceType: ctx.getSourceType(),
			format: ctx.getFormat(),
			outputPath: ctx.getOutputPath(),
			columns: ctx.getSelectedColumns(),
			fileProperties: [...ctx.getSelectedFileProperties()],
			baseViewIndex: ctx.getBaseViewIndex(),
			displayNames: Object.keys(ctx.getDisplayNames()).length > 0
				? ctx.getDisplayNames()
				: undefined,
			isExternal: ctx.getIsExternal() || undefined,
			conflictStrategy: ctx.getConflictStrategy(),
			resolvedColumns: (ctx.getResolvedColumns() as Parameters<typeof ctx.exportService.executeExport>[0]["resolvedColumns"]) ?? undefined,
		});
		ctx.setExportResult(result);
		await autoSaveConfigIfNeeded(ctx);
	} catch (error) {
		ctx.setExportError(
			error instanceof Error ? error.message : String(error),
		);
	}
	ctx.renderPage();
}

async function autoSaveConfigIfNeeded(ctx: ExportConfigOpsContext): Promise<void> {
	if (ctx.getLoadedConfigId()) return;
	const existing = ctx.dataExchangeService.getExportConfigsForSource(ctx.getSourcePath());
	if (existing.length > 0) return;
	try {
		const name = getFilenameFromPath(ctx.getSourcePath()).replace(/\.\w+$/, "");
		const saved = await ctx.dataExchangeService.saveExportConfig(
			buildConfigData(ctx, name),
		);
		ctx.setSavedConfigs(ctx.dataExchangeService.getSavedExportConfigs());
		ctx.setLoadedConfigId(saved.id);
		void ctx.eventBus.emit("notice.success", { message: `Config auto-saved: ${saved.name}` });
		ctx.renderTopBar();
	} catch (err) {
		console.error("[Flowti] Failed to auto-save export config", err);
	}
}

export function showConfigChooser(
	ctx: ExportConfigOpsContext,
	matchingConfigs: SavedExportConfig[],
	onComplete: (appliedId: string | null) => void,
): void {
	new ConfigChooserModal(
		ctx.app,
		matchingConfigs.map((c) => ({ id: c.id, name: c.name })),
		(id) => onComplete(id),
	).open();
}

function buildConfigData(ctx: ExportConfigOpsContext, name: string): {
	name: string;
	sourcePath: string;
	sourceType: "folder" | "base";
	format: "csv" | "tab";
	outputPath: string;
	columns: string[];
	fileProperties: string[];
	baseViewIndex: number;
	conflictStrategy: "overwrite" | "skip" | "append";
	isExternal?: boolean;
	noteType?: string;
} {
	return {
		name,
		sourcePath: ctx.getSourcePath(),
		sourceType: ctx.getSourceType(),
		format: ctx.getFormat(),
		outputPath: ctx.getOutputPath(),
		columns: [...ctx.getSelectedColumns()],
		fileProperties: [...ctx.getSelectedFileProperties()],
		baseViewIndex: ctx.getBaseViewIndex(),
		conflictStrategy: ctx.getConflictStrategy(),
		isExternal: ctx.getIsExternal() || undefined,
		noteType: ctx.getNoteType() || undefined,
	};
}
