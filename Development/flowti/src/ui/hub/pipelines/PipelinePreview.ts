/**
 * Pipeline preview component — renders preview results from PipelineExecutor.buildPreview().
 *
 * Data gathering is delegated to the domain layer (PipelineExecutor.buildPreview).
 * This component only handles rendering and user interactions.
 */

import { Notice, TFile, setIcon } from "obsidian";
import type { SavedMultiImportPipeline, PipelinePreviewResult } from "../../../domain/dataExchange/types";
import { basename } from "../../../utils/pathUtils";
import type { PipelineComponentDeps } from "./types";

export class PipelinePreview {
	constructor(
		private container: HTMLElement,
		private deps: PipelineComponentDeps,
	) {}

	async run(pipe: SavedMultiImportPipeline): Promise<void> {
		if (pipe.sources.length === 0) {
			new Notice("Pipeline has no sources. Add CSV sources first.");
			return;
		}

		const existing = this.container.querySelector(".ft-pipeline-progress") as HTMLElement | null;
		if (existing) existing.remove();

		const section = createDiv({ cls: "ft-pipeline-progress ft-card ft-mt-3" });
		const actionsBar = this.container.querySelector(".ft-detail-actions");
		if (actionsBar?.nextSibling) {
			this.container.insertBefore(section, actionsBar.nextSibling);
		} else {
			this.container.appendChild(section);
		}

		const loadingRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
		const loadSpinner = loadingRow.createSpan();
		setIcon(loadSpinner, "loader");
		loadSpinner.addClass("ft-opacity-60");
		loadSpinner.addClass("ft-spin");
		loadingRow.createSpan({ text: "Preparing preview...", cls: "ft-text-sm" });

		try {
			const executor = this.deps.dataExchangeService.getPipelineExecutor();
			const fileExists = (path: string): boolean =>
				this.deps.app.vault.getAbstractFileByPath(path) instanceof TFile;

			const result = await executor.buildPreview(pipe, fileExists);

			section.empty();
			this.renderContent(section, pipe, result);
		} catch (err) {
			section.empty();
			const errRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
			const errIcon = errRow.createSpan();
			setIcon(errIcon, "x-circle");
			errIcon.addClass("ft-text-error");
			errRow.createSpan({
				text: `Preview failed: ${err instanceof Error ? err.message : String(err)}`,
				cls: "ft-text-sm",
			});
		}
	}

	private renderContent(
		section: HTMLElement,
		pipe: SavedMultiImportPipeline,
		result: PipelinePreviewResult,
	): void {
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
		const headerIcon = header.createSpan();
		setIcon(headerIcon, "eye");
		header.createEl("span", { text: "Pipeline preview", cls: "ft-text-sm ft-font-medium" });

		const stats = section.createDiv({ cls: "ft-flex ft-gap-3 ft-px-2 ft-pb-2" });
		stats.createSpan({
			text: `${result.entries.length} items`,
			cls: "ft-badge ft-badge-muted ft-text-sm",
		});
		if (result.toCreate > 0) {
			const createBadge = stats.createSpan({ cls: "ft-badge ft-text-sm ft-text-success" });
			createBadge.textContent = `${result.toCreate} new`;
		}
		if (result.toUpdate > 0) {
			const updateBadge = stats.createSpan({ cls: "ft-badge ft-text-sm ft-text-accent" });
			updateBadge.textContent = `${result.toUpdate} update`;
		}

		const sourcesDiv = section.createDiv({ cls: "ft-px-2 ft-pb-2" });
		for (const src of result.sources) {
			const srcRow = sourcesDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			if (src.error) {
				const errIcon = srcRow.createSpan();
				setIcon(errIcon, "alert-triangle");
				errIcon.addClass("ft-text-error");
				srcRow.createSpan({ text: src.csvName, cls: "ft-text-sm" });
				srcRow.createSpan({ text: src.error, cls: "ft-text-sm ft-text-muted" });
			} else {
				const srcIcon = srcRow.createSpan();
				setIcon(srcIcon, "file-spreadsheet");
				srcIcon.addClass("ft-opacity-60");
				srcRow.createSpan({ text: src.csvName, cls: "ft-text-sm" });
				srcRow.createSpan({
					text: `${src.rowCount} rows · ${src.columns.length} columns`,
					cls: "ft-text-muted ft-text-sm",
				});
			}
		}

		if (pipe.exportConfigIds && pipe.exportConfigIds.length > 0) {
			const exportsDiv = section.createDiv({ cls: "ft-px-2 ft-pb-2" });
			exportsDiv.createDiv({ text: "Export Steps", cls: "ft-detail-section-header ft-mb-1" });
			for (const exportId of pipe.exportConfigIds) {
				const exportCfg = this.deps.dataExchangeService.getExportConfig(exportId);
				const expRow = exportsDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
				if (exportCfg) {
					const expIcon = expRow.createSpan();
					setIcon(expIcon, "file-output");
					expIcon.addClass("ft-opacity-60");
					expRow.createSpan({ text: exportCfg.name, cls: "ft-text-sm" });
					const details: string[] = [];
					details.push(exportCfg.format.toUpperCase());
					details.push(basename(exportCfg.outputPath) || exportCfg.outputPath);
					if (exportCfg.isExternal) details.push("external");
					expRow.createSpan({
						text: details.join(" · "),
						cls: "ft-text-muted ft-text-sm",
					});
				} else {
					const warnIcon = expRow.createSpan();
					setIcon(warnIcon, "alert-triangle");
					warnIcon.addClass("ft-text-warning");
					expRow.createSpan({ text: "(deleted config)", cls: "ft-text-sm ft-text-muted" });
				}
			}
		}

		if (result.entries.length > 0) {
			section.createDiv({
				text: "Items",
				cls: "ft-detail-section-header ft-px-2 ft-mt-1",
			});
			const tableDiv = section.createDiv({ cls: "ft-px-2 ft-pb-2 ft-preview-scroll" });

			for (const entry of result.entries) {
				const row = tableDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1 ft-border-bottom" });

				const dot = row.createSpan({ cls: "ft-text-sm" });
				dot.addClass(entry.exists ? "ft-text-accent" : "ft-text-success");
				dot.textContent = entry.exists ? "○" : "●";

				row.createSpan({ text: entry.key, cls: "ft-text-sm ft-flex-1 ft-text-ellipsis" });

				const badge = row.createSpan({
					text: entry.exists ? "Update" : "New",
					cls: "ft-badge ft-badge-muted ft-text-sm",
				});
				if (!entry.exists) badge.addClass("ft-text-success");
			}
		}

		const footer = section.createDiv({ cls: "ft-flex ft-items-center ft-justify-end ft-gap-2 ft-p-2 ft-footer-bordered" });

		const cancelBtn = footer.createEl("button", { cls: "mod-muted", text: "Cancel" });
		cancelBtn.addEventListener("click", () => section.remove());

		const hasErrors = result.sources.some((s) => s.error);
		const runBtn = footer.createEl("button", { cls: "mod-cta", text: "Run pipeline" });
		if (hasErrors) {
			runBtn.disabled = true;
			runBtn.title = "Fix source errors before running";
		}
		runBtn.addEventListener("click", () => {
			section.remove();
			this.deps.executePipeline(pipe);
		});
	}
}
