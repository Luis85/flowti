/**
 * Preview page for the ExportView wizard.
 * Shows an impact summary and a preview table of the first 25 rows.
 */

import { setIcon } from "obsidian";
import { getFilePropertyLabel, resolveFileProperty, resolveColumnValue } from "./exportUtils";
import { STRATEGY_LABELS } from "./types";
import type { ExportComponentDeps } from "./types";
import type { VaultFileInfo } from "../../domain/dataExchange/types";

export class PreviewPage {
	constructor(
		private container: HTMLElement,
		private deps: ExportComponentDeps,
	) {}

	render(): void {
		const ws = this.container;
		ws.empty();

		const state = this.deps.getState();
		const dn = state.displayNames;

		// Unified column descriptors when available; legacy split otherwise
		let allHeaders: string[];
		let renderCell: (file: VaultFileInfo, colIndex: number) => string;

		if (state.resolvedColumns && state.resolvedColumns.length > 0) {
			const cols = state.resolvedColumns;
			allHeaders = cols.map((rc) => rc.header);
			renderCell = (file, i) => resolveColumnValue(file, cols[i]);
		} else {
			const fileHeaders: { key: string; label: string }[] =
				state.selectedFileProperties.map((key) => ({
					key,
					label: dn[key] ?? getFilePropertyLabel(key),
				}));
			const columnHeaders: { key: string; label: string }[] =
				state.selectedColumns.map((col) => ({
					key: col,
					label: dn[col] ?? dn[`note.${col}`] ?? col,
				}));
			allHeaders = [
				...fileHeaders.map((h) => h.label),
				...columnHeaders.map((h) => h.label),
			];
			renderCell = (file, i) => {
				if (i < fileHeaders.length) {
					return resolveFileProperty(file, fileHeaders[i].key);
				}
				const ch = columnHeaders[i - fileHeaders.length];
				const val = file.frontmatter?.[ch.key];
				return val !== undefined && val !== null ? String(val) : "";
			};
		}

		// Action bar
		const statsBar = ws.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-py-2" });
		statsBar.style.borderBottom = "1px solid var(--background-modifier-border)";
		statsBar.addClass("ft-flex-shrink-0");

		// Validation
		const issues: string[] = [];
		if (!state.outputPath.trim()) issues.push("Output path is required");
		if (allHeaders.length === 0) issues.push("At least one column is required");

		if (issues.length > 0) {
			const alert = statsBar.createDiv({ cls: "ft-alert-warning ft-p-2 ft-text-sm" });
			for (const issue of issues) {
				alert.createSpan({ text: issue });
				alert.createEl("br");
			}
		}

		const configBtn = statsBar.createEl("span", { cls: "ft-nav-link" });
		setIcon(configBtn.createSpan(), "settings");
		configBtn.appendText(" Edit Config");
		configBtn.addEventListener("click", () => {
			this.deps.setState({ currentPage: "configure" });
			this.deps.renderPage();
		});

		statsBar.createDiv({ cls: "ft-flex-1" });

		if (issues.length === 0) {
			const exportBtn = statsBar.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
			setIcon(exportBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "play");
			exportBtn.appendText(" Run Export");
			exportBtn.addEventListener("click", () => {
				this.deps.setState({ currentPage: "result" });
				this.deps.renderPage();
				this.deps.runExport();
			});
		}

		// ── Impact summary ──
		const summary = ws.createDiv({ cls: "ft-card ft-mt-3 ft-mb-2" });
		summary.createDiv({ text: "What will happen", cls: "ft-detail-section-header ft-mb-2" });
		const grid = summary.createDiv({ cls: "ft-detail-info-grid" });

		const addRow = (label: string, value: string) => {
			grid.createDiv({ text: label, cls: "ft-detail-info-label" });
			grid.createDiv({ text: value, cls: "ft-detail-info-value" });
		};

		addRow("Source", state.sourcePath);
		if (state.sourceType === "base") {
			addRow("Source type", `Base view (view ${state.baseViewIndex + 1})`);
		} else {
			addRow("Source type", "Folder");
		}
		addRow("Files to export", `${state.previewFiles.length} note${state.previewFiles.length !== 1 ? "s" : ""}`);
		const outputLabel = state.isExternal
			? `${state.outputPath} (external)`
			: state.outputPath || "(not set)";
		addRow("Output file", outputLabel);
		addRow("Format", state.format === "tab" ? "Tab-delimited" : "CSV");
		addRow(
			"Columns",
			`${state.selectedColumns.length} frontmatter + ${state.selectedFileProperties.length} file properties`,
		);
		addRow("Conflict strategy", STRATEGY_LABELS[state.conflictStrategy] ?? state.conflictStrategy);
		const dnCount = Object.keys(state.displayNames).length;
		if (dnCount > 0) {
			addRow("Display names", `${dnCount} override${dnCount !== 1 ? "s" : ""}`);
		}

		// Count bar
		const countBar = ws.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
		countBar.addClass("ft-flex-shrink-0");
		countBar.createSpan({
			text: `${state.previewFiles.length} rows`,
			cls: "ft-badge ft-badge-muted",
		});
		countBar.createSpan({
			text: `${allHeaders.length} columns`,
			cls: "ft-badge ft-badge-muted",
		});
		if (state.previewFiles.length > 25) {
			countBar.createSpan({
				text: "Showing first 25 rows",
				cls: "ft-text-sm ft-text-muted",
			});
		}

		if (allHeaders.length === 0) {
			const scroll = ws.createDiv({ cls: "ft-table-scroll" });
			scroll.createEl("p", {
				text: "No columns selected. Go back and select at least one column.",
				cls: "ft-text-muted ft-p-3",
			});
			return;
		}

		// Table scroll area
		const scroll = ws.createDiv({ cls: "ft-table-scroll" });
		const table = scroll.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const h of allHeaders) {
			headerRow.createEl("th", { text: h });
		}

		const tbody = table.createEl("tbody");
		const maxPreview = 25;
		const previewSlice = state.previewFiles.slice(0, maxPreview);

		for (const file of previewSlice) {
			const tr = tbody.createEl("tr");
			for (let i = 0; i < allHeaders.length; i++) {
				tr.createEl("td", { text: renderCell(file, i) });
			}
		}

		if (state.previewFiles.length > maxPreview) {
			scroll.createEl("p", {
				text: `Showing ${maxPreview} of ${state.previewFiles.length} rows`,
				cls: "ft-text-muted ft-text-sm ft-mt-2",
			});
		} else {
			scroll.createEl("p", {
				text: `${state.previewFiles.length} rows total`,
				cls: "ft-text-muted ft-text-sm ft-mt-2",
			});
		}
	}
}
