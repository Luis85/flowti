/**
 * Pipeline detail sections — Inputs row (CSV sources + canvas configs)
 * and Outputs row (export steps).
 */

import { Notice, TFile, setIcon } from "obsidian";
import type { SavedMultiImportPipeline } from "../../../domain/dataExchange/types";
import { basename } from "../../../utils/pathUtils";
import { ConfigChooserModal, ConfirmModal } from "../../modals";
import { PipelineSourceModal } from "../../PipelineSourceModal";
import { addInfoRow } from "../helpers";
import type { PipelineComponentDeps } from "./types";

export class SourcesExportsGrid {
	constructor(
		private container: HTMLElement,
		private deps: PipelineComponentDeps,
	) {}

	render(pipe: SavedMultiImportPipeline): void {
		// Sources & Export Steps side by side
		this.renderSourcesAndExports(pipe);

		// Custom property conflict warnings
		this.renderConflictWarnings(pipe);

		// Custom properties summary
		this.renderCustomPropertiesSummary(pipe);
	}

	private renderSourcesAndExports(pipe: SavedMultiImportPipeline): void {
		// --- Inputs row ---
		const inputsRow = this.container.createDiv({ cls: "ft-mt-3" });
		inputsRow.createDiv({ text: "Inputs", cls: "ft-detail-section-header" });

		if (pipe.sources.length === 0 && !(pipe.canvasConfigIds?.length)) {
			inputsRow.createDiv({
				text: "No inputs configured yet.",
				cls: "ft-text-muted ft-text-sm ft-p-2",
			});
		}

		// CSV sources
		for (let i = 0; i < pipe.sources.length; i++) {
			this.renderSourceCard(inputsRow, pipe, pipe.sources[i], i);
		}

		const addSourceRow = inputsRow.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-2" });
		const addSourceLink = addSourceRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addSourceIcon = addSourceLink.createSpan();
		setIcon(addSourceIcon, "plus");
		addSourceLink.appendText(" Add Source");
		addSourceLink.addEventListener("click", () => {
			new PipelineSourceModal({
				app: this.deps.app,
				importService: this.deps.dataExchangeService.getImportService(),
				mergeKey: pipe.mergeKey,
				otherSources: pipe.sources,
				savedImportConfigs: this.deps.dataExchangeService.getSavedImportConfigs().filter((c) => c.sourcePath),
				hiddenCsvPaths: this.deps.dataExchangeService.getHiddenCsvPaths(),
				onSave: (newSource) => {
					const updatedSources = [...pipe.sources, newSource];
					void this.deps.dataExchangeService
						.updatePipeline(pipe.id, { sources: updatedSources })
						.then(() => this.deps.scheduleRender());
				},
			}).open();
		});

		// Canvas configs (same Inputs row)
		this.renderCanvasSteps(inputsRow, pipe);

		// --- Outputs row ---
		const outputsRow = this.container.createDiv({ cls: "ft-mt-3" });
		outputsRow.createDiv({ text: "Outputs", cls: "ft-detail-section-header" });

		if (!pipe.exportConfigIds?.length) {
			outputsRow.createDiv({
				text: "No outputs configured.",
				cls: "ft-text-muted ft-text-sm ft-p-2",
			});
		} else {
			for (const exportId of pipe.exportConfigIds) {
				this.renderExportCard(outputsRow, pipe, exportId);
			}
		}

		const addExportRow = outputsRow.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-2" });
		const addExportLink = addExportRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addExportIcon = addExportLink.createSpan();
		setIcon(addExportIcon, "plus");
		addExportLink.appendText(" Add Export Step");
		addExportLink.addEventListener("click", () => {
			const allExportConfigs = this.deps.dataExchangeService.getSavedExportConfigs();
			const available = allExportConfigs.filter((c) => !(pipe.exportConfigIds ?? []).includes(c.id));
			if (available.length === 0) {
				new Notice("No export configs available. Create one first.");
				return;
			}
			new ConfigChooserModal(
				this.deps.app,
				available.map((c) => ({ id: c.id, name: c.name })),
				(id: string | null) => {
					if (id === null) return;
					const updatedIds = [...(pipe.exportConfigIds ?? []), id];
					void this.deps.dataExchangeService
						.updatePipeline(pipe.id, { exportConfigIds: updatedIds })
						.then(() => this.deps.scheduleRender());
				},
			).open();
		});
	}

	private renderSourceCard(
		container: HTMLElement,
		pipe: SavedMultiImportPipeline,
		source: SavedMultiImportPipeline["sources"][0],
		index: number,
	): void {
		const card = container.createDiv({ cls: "ft-card ft-mt-1 ft-card-compact" });

		const csvName = basename(source.csvPath) || source.csvPath;

		const headerRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const csvIcon = headerRow.createSpan();
		setIcon(csvIcon, "file-spreadsheet");
		csvIcon.addClass("ft-icon-muted");
		csvIcon.addClass("ft-flex-shrink-0");

		const nameEl = headerRow.createEl("span", {
			text: csvName,
			cls: "ft-heading ft-heading-sm ft-nav-link ft-flex-1 ft-text-ellipsis",
		});
		nameEl.addClass("ft-master-text-block");
		nameEl.addEventListener("click", () => {
			new PipelineSourceModal({
				app: this.deps.app,
				importService: this.deps.dataExchangeService.getImportService(),
				mergeKey: pipe.mergeKey,
				existingSource: source,
				otherSources: pipe.sources.filter((s) => s.id !== source.id),
				savedImportConfigs: this.deps.dataExchangeService.getSavedImportConfigs().filter((c) => c.sourcePath),
				hiddenCsvPaths: this.deps.dataExchangeService.getHiddenCsvPaths(),
				onSave: (updated) => {
					const updatedSources = pipe.sources.map((s) => (s.id === updated.id ? updated : s));
					void this.deps.dataExchangeService
						.updatePipeline(pipe.id, { sources: updatedSources })
						.then(() => this.deps.scheduleRender());
				},
			}).open();
		});

		headerRow.createSpan({
			text: `${source.mergeKeyColumn} → ${pipe.mergeKey}`,
			cls: "ft-badge ft-badge-muted",
		});

		const included = source.columnMappings.filter((m) => m.included).length;
		const total = source.columnMappings.length;
		headerRow.createSpan({
			text: `${included}/${total} cols`,
			cls: "ft-badge ft-badge-muted",
		});

		const infoRow = card.createDiv({ cls: "ft-text-muted ft-text-sm ft-mt-1" });
		infoRow.textContent = source.csvPath;

		if (source.customProperties && Object.keys(source.customProperties).length > 0) {
			const propsRow = card.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1 ft-flex-wrap" });
			for (const [key, value] of Object.entries(source.customProperties)) {
				const chip = propsRow.createSpan({ cls: "ft-badge ft-badge-muted" });
				chip.textContent = `${key}: ${value}`;
			}
		}

		const actionsRow = card.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-1" });
		const removeLink = actionsRow.createEl("span", { cls: "ft-nav-link ft-text-sm ft-text-error" });
		const removeIcon = removeLink.createSpan();
		setIcon(removeIcon, "x");
		removeLink.appendText(" Remove");
		removeLink.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Remove source "${csvName}" from pipeline?`,
				confirmLabel: "Remove",
				onConfirm: () => {
					const updatedSources = pipe.sources.filter((_, idx) => idx !== index);
					void this.deps.dataExchangeService
						.updatePipeline(pipe.id, { sources: updatedSources })
						.then(() => this.deps.scheduleRender());
				},
			}).open();
		});
	}

	private renderExportCard(
		container: HTMLElement,
		pipe: SavedMultiImportPipeline,
		exportId: string,
	): void {
		const exportCfg = this.deps.dataExchangeService.getExportConfig(exportId);
		const card = container.createDiv({ cls: "ft-card ft-mt-1 ft-card-compact" });

		const headerRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = headerRow.createSpan();
		setIcon(icon, "file-output");
		icon.addClass("ft-icon-muted");
		icon.addClass("ft-flex-shrink-0");

		if (exportCfg) {
			const nameEl = headerRow.createEl("span", {
				text: exportCfg.name,
				cls: "ft-heading ft-heading-sm ft-nav-link ft-flex-1 ft-text-ellipsis",
			});
			nameEl.addClass("ft-master-text-block");
			nameEl.addEventListener("click", () => {
				this.deps.setState({ selectedExportId: exportCfg.id });
				this.deps.navigation.navigateTo("exports");
			});

			headerRow.createSpan({
				text: exportCfg.format === "tab" ? "TAB" : "CSV",
				cls: "ft-badge ft-badge-muted",
			});

			if (exportCfg.sourcePath) {
				const sourceRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-1" });
				const sourceLabel = exportCfg.sourceType === "base" ? "Base:" : "Folder:";
				sourceRow.createSpan({ text: sourceLabel, cls: "ft-text-muted ft-text-sm" });
				const sourceFile = this.deps.app.vault.getAbstractFileByPath(exportCfg.sourcePath);
				if (sourceFile instanceof TFile) {
					const sourceLink = sourceRow.createEl("span", {
						text: exportCfg.sourcePath,
						cls: "ft-nav-link ft-text-sm",
					});
					sourceLink.addEventListener("click", () => {
						void this.deps.app.workspace.getLeaf(false).openFile(sourceFile);
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
					const baseFile = this.deps.app.vault.getAbstractFileByPath(exportCfg.sourcePath);
					if (baseFile instanceof TFile) {
						void this.deps.app.vault.read(baseFile).then((content) => {
							const parsed = this.deps.dataExchangeService.getExportService().getBaseEngine().parseBaseFile(content);
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

			const actionsRow = card.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-1" });
			const removeLink = actionsRow.createEl("span", { cls: "ft-nav-link ft-text-sm ft-text-error" });
			const removeIcon = removeLink.createSpan();
			setIcon(removeIcon, "x");
			removeLink.appendText(" Remove");
			removeLink.addEventListener("click", () => {
				new ConfirmModal(this.deps.app, {
					message: `Remove export step "${exportCfg.name}" from pipeline?`,
					confirmLabel: "Remove",
					onConfirm: () => {
						const updatedIds = (pipe.exportConfigIds ?? []).filter((id) => id !== exportId);
						void this.deps.dataExchangeService
							.updatePipeline(pipe.id, { exportConfigIds: updatedIds })
							.then(() => this.deps.scheduleRender());
					},
				}).open();
			});
		} else {
			headerRow.createSpan({ text: "(deleted)", cls: "ft-heading ft-heading-sm ft-text-muted" });
			card.createDiv({
				text: "Export config has been deleted",
				cls: "ft-text-muted ft-text-sm ft-mt-1",
			});
			const actionsRow = card.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-1" });
			const removeLink = actionsRow.createEl("span", { cls: "ft-nav-link ft-text-sm ft-text-error" });
			const removeIcon = removeLink.createSpan();
			setIcon(removeIcon, "x");
			removeLink.appendText(" Remove");
			removeLink.addEventListener("click", () => {
				const updatedIds = (pipe.exportConfigIds ?? []).filter((id) => id !== exportId);
				void this.deps.dataExchangeService
					.updatePipeline(pipe.id, { exportConfigIds: updatedIds })
					.then(() => this.deps.scheduleRender());
			});
		}
	}

	private renderCanvasSteps(sourcesCol: HTMLElement, pipe: SavedMultiImportPipeline): void {
		const canvasService = this.deps.canvasService;
		if (!canvasService) return;

		const canvasConfigIds = pipe.canvasConfigIds ?? [];

		if (canvasConfigIds.length > 0) {
			sourcesCol.createDiv({ text: "Canvas Steps", cls: "ft-detail-section-header ft-mt-3" });
			for (let i = 0; i < canvasConfigIds.length; i++) {
				this.renderCanvasCard(sourcesCol, pipe, canvasConfigIds[i], i);
			}
		}

		const addCanvasRow = sourcesCol.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-2" });
		const addCanvasLink = addCanvasRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addCanvasIcon = addCanvasLink.createSpan();
		setIcon(addCanvasIcon, "plus");
		addCanvasLink.appendText(" Add Canvas Step");
		addCanvasLink.addEventListener("click", () => {
			const allConfigs = canvasService.getConfigs();
			const existing = new Set(canvasConfigIds);
			const available = allConfigs.filter((c) => !existing.has(c.id));
			if (available.length === 0) {
				new Notice("No canvas configs available. Create one first in the canvas tab.");
				return;
			}
			new ConfigChooserModal(
				this.deps.app,
				available.map((c) => ({ id: c.id, name: c.name })),
				(id: string | null) => {
					if (id === null) return;
					const updatedIds = [...canvasConfigIds, id];
					void this.deps.dataExchangeService
						.updatePipeline(pipe.id, { canvasConfigIds: updatedIds })
						.then(() => this.deps.scheduleRender());
				},
			).open();
		});
	}

	private renderCanvasCard(
		container: HTMLElement,
		pipe: SavedMultiImportPipeline,
		configId: string,
		index: number,
	): void {
		const canvasService = this.deps.canvasService;
		const config = canvasService?.getConfig(configId);
		const card = container.createDiv({ cls: "ft-card ft-mt-1 ft-card-compact" });

		const headerRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = headerRow.createSpan();
		setIcon(icon, "square");
		icon.addClass("ft-icon-muted");
		icon.addClass("ft-flex-shrink-0");

		if (config) {
			const nameEl = headerRow.createEl("span", {
				text: config.name,
				cls: "ft-heading ft-heading-sm ft-nav-link ft-flex-1 ft-text-ellipsis",
			});
			nameEl.addClass("ft-master-text-block");
			nameEl.addEventListener("click", () => {
				this.deps.setState({ selectedCanvasId: config.id });
				this.deps.navigation.navigateTo("canvas");
			});

			headerRow.createSpan({
				text: config.hierarchyMode,
				cls: "ft-badge ft-badge-muted",
			});

			const infoRow = card.createDiv({ cls: "ft-text-muted ft-text-sm ft-mt-1" });
			infoRow.textContent = config.canvasPath;

			const targetRow = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mt-1" });
			targetRow.createSpan({ text: "Target:", cls: "ft-text-muted ft-text-sm" });
			const subfolder = config.subfolderName || (config.canvasPath.split("/").pop()?.replace(/\.canvas$/, "") ?? "canvas");
			const effectiveTarget = config.targetFolder ? `${config.targetFolder}/${subfolder}` : subfolder;
			targetRow.createSpan({ text: effectiveTarget, cls: "ft-text-sm" });
		} else {
			headerRow.createSpan({ text: "(deleted)", cls: "ft-heading ft-heading-sm ft-text-muted" });
			card.createDiv({
				text: "Canvas config has been deleted",
				cls: "ft-text-muted ft-text-sm ft-mt-1",
			});
		}

		const actionsRow = card.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-1" });
		const removeLink = actionsRow.createEl("span", { cls: "ft-nav-link ft-text-sm ft-text-error" });
		const removeIcon = removeLink.createSpan();
		setIcon(removeIcon, "x");
		removeLink.appendText(" Remove");
		removeLink.addEventListener("click", () => {
			const name = config?.name ?? configId;
			new ConfirmModal(this.deps.app, {
				message: `Remove canvas step "${name}" from pipeline?`,
				confirmLabel: "Remove",
				onConfirm: () => {
					const updatedIds = (pipe.canvasConfigIds ?? []).filter((_, idx) => idx !== index);
					void this.deps.dataExchangeService
						.updatePipeline(pipe.id, { canvasConfigIds: updatedIds })
						.then(() => this.deps.scheduleRender());
				},
			}).open();
		});
	}

	private renderConflictWarnings(pipe: SavedMultiImportPipeline): void {
		if (pipe.sources.length <= 1) return;

		const propMap = new Map<string, Array<{ sourceLabel: string; value: string }>>();
		for (const src of pipe.sources) {
			if (!src.customProperties) continue;
			const label = basename(src.csvPath) || src.csvPath;
			for (const [key, value] of Object.entries(src.customProperties)) {
				if (!propMap.has(key)) propMap.set(key, []);
				propMap.get(key)!.push({ sourceLabel: label, value });
			}
		}
		const conflicts: Array<{ key: string; entries: Array<{ sourceLabel: string; value: string }> }> = [];
		for (const [key, entries] of propMap) {
			if (entries.length > 1) {
				const values = new Set(entries.map((e) => e.value));
				if (values.size > 1) {
					conflicts.push({ key, entries });
				}
			}
		}

		if (conflicts.length === 0) return;

		const warnSection = this.container.createDiv({ cls: "ft-card ft-mt-3 ft-card-warning-border" });
		const warnHeader = warnSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
		const warnIcon = warnHeader.createSpan();
		setIcon(warnIcon, "alert-triangle");
		warnIcon.addClass("ft-text-warning");
		warnIcon.addClass("ft-flex-shrink-0");
		warnHeader.createSpan({
			text: `${conflicts.length} custom property conflict${conflicts.length !== 1 ? "s" : ""}`,
			cls: "ft-heading ft-heading-sm",
		});
		const warnDesc = warnSection.createDiv({ cls: "ft-text-muted ft-text-sm ft-px-2 ft-pb-2" });
		warnDesc.textContent = "Multiple sources define the same key with different values. The last source processed will win.";

		const grid = warnSection.createDiv({ cls: "ft-detail-info-grid ft-px-2 ft-pb-2" });
		for (const c of conflicts) {
			addInfoRow(grid, c.key, c.entries.map((e) => `"${e.value}" (${e.sourceLabel})`).join(" vs "));
		}
	}

	private renderCustomPropertiesSummary(pipe: SavedMultiImportPipeline): void {
		if (!pipe.sources.some((s) => s.customProperties && Object.keys(s.customProperties).length > 0)) return;

		const propsSection = this.container.createDiv({ cls: "ft-detail-section ft-mt-3" });
		propsSection.createDiv({ text: "Custom Properties", cls: "ft-detail-section-header" });
		const allProps = new Map<string, string>();
		for (const src of pipe.sources) {
			if (!src.customProperties) continue;
			for (const [key, value] of Object.entries(src.customProperties)) {
				allProps.set(key, value);
			}
		}
		const propGrid = propsSection.createDiv({ cls: "ft-detail-info-grid" });
		for (const [key, value] of allProps) {
			addInfoRow(propGrid, key, value);
		}
	}
}
