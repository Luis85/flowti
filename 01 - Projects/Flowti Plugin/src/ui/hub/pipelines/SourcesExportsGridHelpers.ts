/**
 * Export card rendering — extracted from SourcesExportsGrid for max-lines compliance.
 */

import { TFile, setIcon } from "obsidian";
import type { SavedMultiImportPipeline } from "../../../domain/dataExchange/types";
import { ConfirmModal } from "../../modals";
import type { PipelineComponentDeps } from "./types";

export function renderExportCard(
	container: HTMLElement,
	pipe: SavedMultiImportPipeline,
	exportId: string,
	deps: PipelineComponentDeps,
): void {
	const exportCfg = deps.dataExchangeService.getExportConfig(exportId);
	const card = container.createDiv({ cls: "ft-card ft-mt-1 ft-card-compact" });

	const headerRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
	const icon = headerRow.createSpan();
	setIcon(icon, "file-output");
	icon.addClass("ft-icon-muted");
	icon.addClass("ft-flex-shrink-0");

	if (exportCfg) {
		renderExistingExportCard(card, headerRow, pipe, exportId, exportCfg, deps);
	} else {
		renderDeletedExportCard(card, headerRow, pipe, exportId, deps);
	}
}

function renderExistingExportCard(
	card: HTMLElement,
	headerRow: HTMLElement,
	pipe: SavedMultiImportPipeline,
	exportId: string,
	exportCfg: NonNullable<ReturnType<PipelineComponentDeps["dataExchangeService"]["getExportConfig"]>>,
	deps: PipelineComponentDeps,
): void {
	const nameEl = headerRow.createEl("span", {
		text: exportCfg.name,
		cls: "ft-heading ft-heading-sm ft-nav-link ft-flex-1 ft-text-ellipsis",
	});
	nameEl.addClass("ft-master-text-block");
	nameEl.addEventListener("click", () => {
		deps.setState({ selectedExportId: exportCfg.id });
		deps.navigation.navigateTo("exports");
	});

	headerRow.createSpan({
		text: exportCfg.format === "tab" ? "TAB" : "CSV",
		cls: "ft-badge ft-badge-muted",
	});

	if (exportCfg.sourcePath) {
		renderSourceInfo(card, exportCfg, deps);
	}

	const targetRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-1" });
	targetRow.createSpan({ text: "Target:", cls: "ft-text-muted ft-text-sm" });
	targetRow.createSpan({
		text: exportCfg.outputPath || "(no output path)",
		cls: "ft-text-sm",
	});

	if (exportCfg.isExternal) {
		const extRow = card.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		extRow.createSpan({ text: "external", cls: "ft-badge ft-badge-muted" });
	}

	renderRemoveButton(card, pipe, exportId, exportCfg.name, deps);
}

function renderSourceInfo(
	card: HTMLElement,
	exportCfg: NonNullable<ReturnType<PipelineComponentDeps["dataExchangeService"]["getExportConfig"]>>,
	deps: PipelineComponentDeps,
): void {
	const sourceRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-1" });
	const sourceLabel = exportCfg.sourceType === "base" ? "Base:" : "Folder:";
	sourceRow.createSpan({ text: sourceLabel, cls: "ft-text-muted ft-text-sm" });
	const sourceFile = deps.app.vault.getAbstractFileByPath(exportCfg.sourcePath);
	if (sourceFile instanceof TFile) {
		const sourceLink = sourceRow.createEl("span", {
			text: exportCfg.sourcePath,
			cls: "ft-nav-link ft-text-sm",
		});
		sourceLink.addEventListener("click", () => {
			void deps.app.workspace.getLeaf(false).openFile(sourceFile);
		});
	} else {
		sourceRow.createSpan({
			text: exportCfg.sourcePath,
			cls: "ft-text-muted ft-text-sm",
		});
	}

	if (exportCfg.sourceType === "base") {
		const viewRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-1" });
		viewRow.createSpan({ text: "View:", cls: "ft-text-muted ft-text-sm" });
		const viewNameEl = viewRow.createSpan({
			text: `#${exportCfg.baseViewIndex ?? 0}`,
			cls: "ft-text-sm",
		});
		const baseFile = deps.app.vault.getAbstractFileByPath(exportCfg.sourcePath);
		if (baseFile instanceof TFile) {
			void deps.app.vault.read(baseFile).then((content) => {
				const parsed = deps.dataExchangeService.getExportService().getBaseEngine().parseBaseFile(content);
				const idx = exportCfg.baseViewIndex ?? 0;
				const view = parsed.views[idx] ?? parsed.views[0];
				if (view) {
					viewNameEl.textContent = view.name || `View ${idx}`;
					if (view.type) {
						viewRow.createSpan({
							text: view.type,
							cls: "ft-badge ft-badge-muted ft-text-sm",
						});
					}
				}
			}).catch((err) => console.warn("[Flowti] Failed to parse base file:", err));
		}
	}
}

function renderDeletedExportCard(
	card: HTMLElement,
	headerRow: HTMLElement,
	pipe: SavedMultiImportPipeline,
	exportId: string,
	deps: PipelineComponentDeps,
): void {
	headerRow.createSpan({ text: "(deleted)", cls: "ft-heading ft-heading-sm ft-text-muted" });
	card.createDiv({
		text: "Export config has been deleted",
		cls: "ft-text-muted ft-text-sm ft-mt-1",
	});
	renderRemoveButton(card, pipe, exportId, exportId, deps);
}

function renderRemoveButton(
	card: HTMLElement,
	pipe: SavedMultiImportPipeline,
	exportId: string,
	name: string,
	deps: PipelineComponentDeps,
): void {
	const actionsRow = card.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-1" });
	const removeLink = actionsRow.createEl("span", { cls: "ft-nav-link ft-text-sm ft-text-error" });
	const removeIcon = removeLink.createSpan();
	setIcon(removeIcon, "x");
	removeLink.appendText(" Remove");
	removeLink.addEventListener("click", () => {
		new ConfirmModal(deps.app, {
			message: `Remove export step "${name}" from pipeline?`,
			confirmLabel: "Remove",
			onConfirm: () => {
				const updatedIds = (pipe.exportConfigIds ?? []).filter((id) => id !== exportId);
				void deps.dataExchangeService
					.updatePipeline(pipe.id, { exportConfigIds: updatedIds })
					.then(() => deps.scheduleRender());
			},
		}).open();
	});
}
