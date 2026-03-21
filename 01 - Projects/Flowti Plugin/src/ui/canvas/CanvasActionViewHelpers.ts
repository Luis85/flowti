/**
 * Helper functions for CanvasActionView — config building and import execution.
 * Extracted to reduce CanvasActionView.ts line count.
 */

import type { CanvasConfigInput, CanvasService } from "../../domain/canvas/CanvasService";
import type { IEventBus } from "../../infrastructure/events/types";
import type { CanvasViewState } from "./types";
import { revealFolderInExplorer } from "../hub/helpers";
import type { App } from "obsidian";

export function buildConfigInput(state: CanvasViewState): CanvasConfigInput {
	return {
		name: state.configName.trim() || `Import ${state.canvasPath.split("/").pop() ?? "canvas"}`,
		canvasPath: state.canvasPath,
		targetFolder: state.targetFolder,
		colorMap: state.colorMap,
		shapeMap: state.shapeMap,
		excludedTypes: state.excludedTypes,
		conflictStrategy: state.conflictStrategy,
		hierarchyMode: state.hierarchyMode,
		subfolderName: state.subfolderName,
		createCanvas: state.createCanvas,
		createBase: state.createBase,
	};
}

export async function executeImport(
	state: CanvasViewState,
	canvasService: CanvasService,
	eventBus: IEventBus,
	app: App,
	resolveArtifactPaths: () => { canvasPath?: string; basePath?: string },
): Promise<void> {
	const input = buildConfigInput(state);

	let configId: string;
	if (state.loadedConfigId) {
		await canvasService.updateConfig(state.loadedConfigId, input);
		configId = state.loadedConfigId;
	} else {
		const config = await canvasService.saveConfig(input);
		state.loadedConfigId = config.id;
		configId = config.id;
	}

	const result = await canvasService.runImport(configId);

	state.importResult = result;
	state.importSuccess = true;
	state.artifactPaths = resolveArtifactPaths();
	const errorNote = result.errors.length > 0 ? `, ${result.errors.length} errors` : "";
	state.importMessage =
		`Imported ${result.imported} of ${result.totalNodes} nodes (${result.skipped} skipped${errorNote}) in ${result.duration}ms`;
	void eventBus.emit("notice.success", { message: state.importMessage });
	revealFolderInExplorer(app, result.targetFolder);
}

export async function executeSavedImport(
	state: CanvasViewState,
	configId: string,
	canvasService: CanvasService,
	eventBus: IEventBus,
	app: App,
	resolveArtifactPaths: () => { canvasPath?: string; basePath?: string },
): Promise<void> {
	const result = await canvasService.runImport(configId);

	state.importResult = result;
	state.importSuccess = true;
	state.artifactPaths = resolveArtifactPaths();
	const errorNote = result.errors.length > 0 ? `, ${result.errors.length} errors` : "";
	state.importMessage =
		`Imported ${result.imported} of ${result.totalNodes} nodes (${result.skipped} skipped${errorNote}) in ${result.duration}ms`;
	void eventBus.emit("notice.success", { message: state.importMessage });
	revealFolderInExplorer(app, result.targetFolder);
}
