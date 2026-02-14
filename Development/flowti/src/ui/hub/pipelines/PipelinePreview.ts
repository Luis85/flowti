/**
 * Pipeline preview component — async data gathering + preview content rendering.
 */

import { Notice, TFile, setIcon } from "obsidian";
import type { SavedMultiImportPipeline } from "../../../domain/dataExchange/types";
import { basename } from "../../../utils/pathUtils";
import type { PipelineComponentDeps } from "./types";

interface PreviewSource {
	sourceId: string;
	csvName: string;
	rowCount: number;
	columns: string[];
	mergeKeyValues: string[];
	error?: string;
}

interface PreviewEntry {
	key: string;
	filename: string;
	exists: boolean;
}

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
		loadSpinner.style.opacity = "0.6";
		loadSpinner.addClass("ft-spin");
		loadingRow.createSpan({ text: "Preparing preview...", cls: "ft-text-sm" });

		try {
			const importService = this.deps.dataExchangeService.getImportService();
			const previewSources: PreviewSource[] = [];

			for (const source of pipe.sources) {
				try {
					const parsed = await importService.parseFile(source.csvPath);
					const mergeKeyIndex = parsed.headers.indexOf(source.mergeKeyColumn);
					if (mergeKeyIndex < 0) {
						previewSources.push({
							sourceId: source.id,
							csvName: basename(source.csvPath) || source.csvPath,
							rowCount: 0,
							columns: [],
							mergeKeyValues: [],
							error: `Merge key column "${source.mergeKeyColumn}" not found`,
						});
						continue;
					}

					const mergeKeyValues = parsed.rows
						.map((row) => row[mergeKeyIndex])
						.filter((v): v is string => v !== undefined && v !== "");

					const columns = source.columnMappings
						.filter((m) => m.included && m.csvColumn !== source.mergeKeyColumn)
						.map((m) => m.frontmatterKey);

					previewSources.push({
						sourceId: source.id,
						csvName: basename(source.csvPath) || source.csvPath,
						rowCount: parsed.rows.length,
						columns,
						mergeKeyValues,
					});
				} catch (err) {
					previewSources.push({
						sourceId: source.id,
						csvName: basename(source.csvPath) || source.csvPath,
						rowCount: 0,
						columns: [],
						mergeKeyValues: [],
						error: err instanceof Error ? err.message : String(err),
					});
				}
			}

			const allKeys = new Set<string>();
			for (const src of previewSources) {
				for (const v of src.mergeKeyValues) allKeys.add(v);
			}

			const entries: PreviewEntry[] = [];
			for (const key of allKeys) {
				const sanitized = importService.sanitizeFilename(key);
				if (!sanitized) continue;
				const prefix = pipe.namePrefix ?? "";
				const suffix = pipe.nameSuffix ?? "";
				const filename = `${prefix}${sanitized}${suffix}`;
				const notePath = `${pipe.targetFolder}/${filename}.md`;
				const exists = this.deps.app.vault.getAbstractFileByPath(notePath) instanceof TFile;
				entries.push({ key, filename, exists });
			}

			const toCreate = entries.filter((e) => !e.exists).length;
			const toUpdate = entries.filter((e) => e.exists).length;

			section.empty();
			this.renderContent(section, pipe, previewSources, entries, toCreate, toUpdate);
		} catch (err) {
			section.empty();
			const errRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
			const errIcon = errRow.createSpan();
			setIcon(errIcon, "x-circle");
			errIcon.style.color = "var(--text-error)";
			errRow.createSpan({
				text: `Preview failed: ${err instanceof Error ? err.message : String(err)}`,
				cls: "ft-text-sm",
			});
		}
	}

	private renderContent(
		section: HTMLElement,
		pipe: SavedMultiImportPipeline,
		previewSources: PreviewSource[],
		entries: PreviewEntry[],
		toCreate: number,
		toUpdate: number,
	): void {
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-p-2" });
		const headerIcon = header.createSpan();
		setIcon(headerIcon, "eye");
		header.createEl("span", { text: "Pipeline Preview", cls: "ft-text-sm ft-font-medium" });

		const stats = section.createDiv({ cls: "ft-flex ft-gap-3 ft-px-2 ft-pb-2" });
		stats.createSpan({
			text: `${entries.length} items`,
			cls: "ft-badge ft-badge-muted ft-text-sm",
		});
		if (toCreate > 0) {
			const createBadge = stats.createSpan({ cls: "ft-badge ft-text-sm" });
			createBadge.style.color = "var(--text-success)";
			createBadge.textContent = `${toCreate} new`;
		}
		if (toUpdate > 0) {
			const updateBadge = stats.createSpan({ cls: "ft-badge ft-text-sm" });
			updateBadge.style.color = "var(--text-accent)";
			updateBadge.textContent = `${toUpdate} update`;
		}

		const sourcesDiv = section.createDiv({ cls: "ft-px-2 ft-pb-2" });
		for (const src of previewSources) {
			const srcRow = sourcesDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			if (src.error) {
				const errIcon = srcRow.createSpan();
				setIcon(errIcon, "alert-triangle");
				errIcon.style.color = "var(--text-error)";
				srcRow.createSpan({ text: src.csvName, cls: "ft-text-sm" });
				srcRow.createSpan({ text: src.error, cls: "ft-text-sm ft-text-muted" });
			} else {
				const srcIcon = srcRow.createSpan();
				setIcon(srcIcon, "file-spreadsheet");
				srcIcon.style.opacity = "0.6";
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
					expIcon.style.opacity = "0.6";
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
					warnIcon.style.color = "var(--text-warning)";
					expRow.createSpan({ text: "(deleted config)", cls: "ft-text-sm ft-text-muted" });
				}
			}
		}

		if (entries.length > 0) {
			section.createDiv({
				text: "Items",
				cls: "ft-detail-section-header ft-px-2 ft-mt-1",
			});
			const tableDiv = section.createDiv({ cls: "ft-px-2 ft-pb-2" });
			tableDiv.style.maxHeight = "200px";
			tableDiv.style.overflowY = "auto";

			for (const entry of entries) {
				const row = tableDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
				row.style.borderBottom = "1px solid var(--background-modifier-border)";

				const dot = row.createSpan({ cls: "ft-text-sm" });
				dot.style.color = entry.exists ? "var(--text-accent)" : "var(--text-success)";
				dot.textContent = entry.exists ? "○" : "●";

				const keySpan = row.createSpan({ text: entry.key, cls: "ft-text-sm" });
				keySpan.addClass("ft-flex-1");
				keySpan.style.overflow = "hidden";
				keySpan.style.textOverflow = "ellipsis";
				keySpan.style.whiteSpace = "nowrap";

				const badge = row.createSpan({
					text: entry.exists ? "Update" : "New",
					cls: "ft-badge ft-badge-muted ft-text-sm",
				});
				if (!entry.exists) badge.style.color = "var(--text-success)";
			}
		}

		const footer = section.createDiv({ cls: "ft-flex ft-items-center ft-justify-end ft-gap-2 ft-p-2" });
		footer.style.borderTop = "1px solid var(--background-modifier-border)";

		const cancelBtn = footer.createEl("button", { cls: "mod-muted", text: "Cancel" });
		cancelBtn.addEventListener("click", () => section.remove());

		const hasErrors = previewSources.some((s) => s.error);
		const runBtn = footer.createEl("button", { cls: "mod-cta", text: "Run Pipeline" });
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
