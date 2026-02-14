/**
 * Pipeline execution component with real-time progress bar and result display.
 */

import { Notice, setIcon } from "obsidian";
import type { MultiImportResult, SavedMultiImportPipeline } from "../../../domain/dataExchange/types";
import { basename } from "../../../utils/pathUtils";
import type { PipelineComponentDeps } from "./types";

export class PipelineExecution {
	constructor(
		private container: HTMLElement,
		private deps: PipelineComponentDeps,
	) {}

	execute(pipe: SavedMultiImportPipeline): void {
		const existing = this.container.querySelector(".ft-pipeline-progress") as HTMLElement | null;
		if (existing) existing.remove();
		const section = createDiv({ cls: "ft-pipeline-progress ft-card ft-mt-3" });
		const actionsBar = this.container.querySelector(".ft-detail-actions");
		if (actionsBar?.nextSibling) {
			this.container.insertBefore(section, actionsBar.nextSibling);
		} else {
			this.container.appendChild(section);
		}

		const statusRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
		const spinnerIcon = statusRow.createSpan();
		setIcon(spinnerIcon, "loader");
		spinnerIcon.style.opacity = "0.6";
		spinnerIcon.addClass("ft-spin");
		const statusText = statusRow.createSpan({
			text: `Running pipeline: ${pipe.name}...`,
			cls: "ft-text-sm",
		});

		const barBg = section.createDiv();
		barBg.style.cssText = "height:4px;background:var(--background-modifier-border);border-radius:2px;margin:0 0.5rem 0.5rem;overflow:hidden";
		const barFill = barBg.createDiv();
		barFill.style.cssText = "height:100%;width:0%;background:var(--interactive-accent);border-radius:2px;transition:width 0.15s ease";

		const detailText = section.createDiv({ cls: "ft-text-muted ft-text-sm ft-px-2 ft-pb-2" });

		const offSourceCompleted = this.deps.eventBus.on("dataExchange.pipeline.sourceCompleted", (event) => {
			const { sourceIndex, totalSources, sourceResult } = event.payload;
			const pct = totalSources > 0 ? Math.round(((sourceIndex + 1) / totalSources) * 100) : 0;
			barFill.style.width = `${pct}%`;
			statusText.textContent = `Processing source ${sourceIndex + 1} of ${totalSources}...`;
			const csvName = basename(sourceResult.csvPath) || sourceResult.csvPath;
			detailText.textContent = `${csvName}: ${sourceResult.result.created} created, ${sourceResult.result.updated} updated`;
		});

		const cleanup = (success: boolean, message: string, result?: MultiImportResult) => {
			offSourceCompleted();
			section.empty();

			const resultRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
			const icon = resultRow.createSpan();
			setIcon(icon, success ? "check-circle" : "x-circle");
			icon.style.color = success ? "var(--text-success)" : "var(--text-error)";
			resultRow.createSpan({ text: message, cls: "ft-text-sm" });

			if (success && result) {
				const statsGrid = section.createDiv({ cls: "ft-px-2 ft-pb-2" });
				statsGrid.style.display = "grid";
				statsGrid.style.gridTemplateColumns = "repeat(4, 1fr)";
				statsGrid.style.gap = "0.5rem";
				const statItems: Array<{ label: string; value: number; color?: string }> = [
					{ label: "Created", value: result.created, color: "var(--text-success)" },
					{ label: "Updated", value: result.updated },
					{ label: "Skipped", value: result.skipped },
					{ label: "Failed", value: result.failed, color: result.failed > 0 ? "var(--text-error)" : undefined },
				];
				for (const stat of statItems) {
					const cell = statsGrid.createDiv({ cls: "ft-text-center" });
					const val = cell.createDiv({ cls: "ft-heading ft-heading-sm" });
					val.textContent = String(stat.value);
					if (stat.color) val.style.color = stat.color;
					cell.createDiv({ text: stat.label, cls: "ft-text-muted ft-text-sm" });
				}

				if (result.sourceResults.length > 1) {
					const breakdown = section.createDiv({ cls: "ft-px-2 ft-pb-2" });
					for (const sr of result.sourceResults) {
						const row = breakdown.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
						row.style.borderTop = "1px solid var(--background-modifier-border)";
						const csvName = basename(sr.csvPath) || sr.csvPath;
						row.createSpan({ text: csvName, cls: "ft-text-sm ft-flex-1" });
						const counts = [];
						if (sr.result.created > 0) counts.push(`${sr.result.created} created`);
						if (sr.result.updated > 0) counts.push(`${sr.result.updated} updated`);
						if (sr.result.skipped > 0) counts.push(`${sr.result.skipped} skipped`);
						if (sr.result.failed > 0) counts.push(`${sr.result.failed} failed`);
						row.createSpan({ text: counts.join(", "), cls: "ft-text-muted ft-text-sm" });
					}
				}

				if (pipe.exportConfigIds?.length) {
					for (const exportId of pipe.exportConfigIds) {
						const exportRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-px-2 ft-py-2" });
						exportRow.style.borderTop = "1px solid var(--background-modifier-border)";
						const eIcon = exportRow.createSpan();
						setIcon(eIcon, "file-output");
						eIcon.style.opacity = "0.6";
						const exportCfg = this.deps.dataExchangeService.getExportConfig(exportId);
						exportRow.createSpan({
							text: `Export: ${exportCfg?.name ?? "(deleted)"}`,
							cls: "ft-text-sm",
						});
						const checkIcon = exportRow.createSpan();
						setIcon(checkIcon, "check");
						checkIcon.style.color = "var(--text-success)";
					}
				}

				this.deps.scheduleRender();
			}
		};

		const offComplete = this.deps.eventBus.on("dataExchange.pipeline.completed", (event) => {
			offComplete();
			offFailed();
			const r = event.payload.result;
			const msg = `${r.created} created, ${r.updated} updated, ${r.skipped} skipped` +
				(r.failed > 0 ? `, ${r.failed} failed` : "");
			cleanup(true, msg, r);
			new Notice(`Pipeline complete: ${msg}`);
		});
		const offFailed = this.deps.eventBus.on("dataExchange.pipeline.failed", (event) => {
			offComplete();
			offFailed();
			cleanup(false, `Pipeline failed: ${event.payload.error}`);
			new Notice(`Pipeline failed: ${event.payload.error}`);
		});

		void this.deps.eventBus.emit("dataExchange.pipeline.execute", {
			pipelineId: pipe.id,
		});
	}
}
