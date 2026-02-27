/**
 * Preview page for the CsvActionView import wizard.
 * Shows impact summary and a preview table of the first 25 rows.
 */

import { setIcon } from "obsidian";
import type { CsvComponentDeps } from "./types";

export class CsvPreviewPage {
	constructor(
		private container: HTMLElement,
		private deps: CsvComponentDeps,
	) {}

	render(): void {
		const ws = this.container;
		ws.empty();

		const state = this.deps.getState();
		if (!state.parsedCsv) return;

		const includedMappings = state.columnMappings.filter((m) => m.included);
		const customPropCount = Object.keys(state.customProperties).length;

		// Action bar
		const statsBar = ws.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-py-2" });
		statsBar.addClass("ft-border-bottom");
		statsBar.addClass("ft-flex-shrink-0");

		// Validation
		const issues: string[] = [];
		if (!state.targetFolder.trim()) issues.push("Target folder is required");
		if (!state.nameColumn) issues.push("Name column is required");

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
			this.deps.setState({ currentPage: "config" });
			this.deps.renderContent();
		});

		statsBar.createDiv({ cls: "ft-flex-1" });

		if (issues.length === 0) {
			const importBtn = statsBar.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
			setIcon(importBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "play");
			importBtn.appendText(" Run Import");
			importBtn.addEventListener("click", () => {
				this.deps.setState({ currentPage: "result" });
				this.deps.renderContent();
				void this.deps.runImport();
			});
		}

		// ── Impact summary ──────────────────────────────────
		const summary = ws.createDiv({ cls: "ft-card ft-mt-3 ft-mb-2" });
		summary.createDiv({ text: "What will happen", cls: "ft-detail-section-header ft-mb-2" });
		const grid = summary.createDiv({ cls: "ft-detail-info-grid" });

		const addRow = (label: string, value: string) => {
			grid.createDiv({ text: label, cls: "ft-detail-info-label" });
			grid.createDiv({ text: value, cls: "ft-detail-info-value" });
		};

		addRow("Target folder", state.targetFolder || "(not set)");
		addRow("Notes to create", `${state.parsedCsv.rowCount} (from ${state.parsedCsv.rowCount} CSV rows)`);
		addRow("Filename pattern", `${state.namePrefix || ""}[${state.nameColumn}]${state.nameSuffix || ""}.md`);
		addRow("Frontmatter keys", `${includedMappings.length} mapped column${includedMappings.length !== 1 ? "s" : ""}`);
		if (customPropCount > 0) {
			addRow("Custom properties", `${customPropCount} extra key${customPropCount !== 1 ? "s" : ""} on every note`);
		}
		const strategyLabels: Record<string, string> = {
			skip: "Skip — existing notes will not be touched",
			update: "Update — merge frontmatter into existing notes",
			overwrite: "Overwrite — replace existing notes entirely",
		};
		addRow("Conflict strategy", strategyLabels[state.conflictStrategy] ?? state.conflictStrategy);

		// Base file info
		let basePath = state.basePath.trim();
		if (basePath && !basePath.endsWith(".base")) basePath += ".base";
		if (basePath && this.deps.app.vault.getAbstractFileByPath(basePath)) {
			addRow("Base view", `Exists: ${basePath} (will not be overwritten)`);
		} else if (state.createBase && basePath) {
			addRow("Base view", `Create ${basePath}`);
		}

		// Count summary (outside scroll container)
		const customProps = Object.entries(state.customProperties);
		const totalCols = 1 + includedMappings.length + customProps.length;
		const countBar = ws.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
		countBar.addClass("ft-flex-shrink-0");
		countBar.createSpan({
			text: `${state.parsedCsv.rowCount} rows`,
			cls: "ft-badge ft-badge-muted",
		});
		countBar.createSpan({
			text: `${totalCols} columns`,
			cls: "ft-badge ft-badge-muted",
		});
		if (customProps.length > 0) {
			countBar.createSpan({
				text: `${customProps.length} custom prop${customProps.length !== 1 ? "s" : ""}`,
				cls: "ft-badge ft-badge-accent",
			});
		}
		if (state.parsedCsv.rowCount > 25) {
			countBar.createSpan({
				text: "Showing first 25 rows",
				cls: "ft-text-sm ft-text-muted",
			});
		}

		// Table scroll area
		const scroll = ws.createDiv({ cls: "ft-table-scroll" });
		const table = scroll.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		headerRow.createEl("th", { text: "Filename" });
		for (const m of includedMappings) {
			headerRow.createEl("th", { text: m.frontmatterKey });
		}
		for (const [key] of customProps) {
			headerRow.createEl("th", { text: key, cls: "ft-preview-custom-col" });
		}

		const tbody = table.createEl("tbody");
		const nameIndex = state.parsedCsv.headers.indexOf(state.nameColumn);
		const previewRows = state.parsedCsv.rows.slice(0, 25);

		for (const row of previewRows) {
			const tr = tbody.createEl("tr");
			const baseName = state.importService!.sanitizeFilename(
				row[nameIndex] ?? "",
			);
			const filename = `${state.namePrefix}${baseName}${state.nameSuffix}`;
			tr.createEl("td", { text: filename || "(empty)" });

			for (const m of includedMappings) {
				const colIdx = state.parsedCsv!.headers.indexOf(m.csvColumn);
				tr.createEl("td", { text: row[colIdx] ?? "" });
			}
			for (const [, value] of customProps) {
				tr.createEl("td", { text: value, cls: "ft-preview-custom-cell" });
			}
		}
	}
}
