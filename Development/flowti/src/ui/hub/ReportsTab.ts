/**
 * Reports tab component for the Data Exchange Hub.
 * Renders the master list of CsvDoc reports and the detail panel.
 */

import { Notice, setIcon } from "obsidian";
import { ConfirmModal } from "../modals";
import { addInfoRow, renderEmptyDetail, getEmptyDetailStats } from "./helpers";
import type { HubComponentDeps, ReportEntry } from "./types";

export class ReportsTab {
	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: HubComponentDeps,
	) {}

	// ─────────────────────────────────────────────────────────
	// Master list
	// ─────────────────────────────────────────────────────────

	renderMaster(): void {
		this.masterEl.empty();

		const state = this.deps.getState();
		let reports = state.reportEntries;
		if (state.filterText) {
			reports = reports.filter((r) => r.name.toLowerCase().includes(state.filterText));
		}

		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Reports" });
		header.createSpan({
			text: `${reports.length}`,
			cls: "ft-master-category-count",
		});

		if (reports.length === 0) {
			const empty = this.masterEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			empty.textContent = state.filterText ? "No matching reports" : "No documented CSV files yet";
			return;
		}

		for (const report of reports) {
			const isSelected = state.selectedReportPath === report.path;
			const item = this.masterEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});

			const iconEl = item.createSpan();
			setIcon(iconEl, "file-spreadsheet");
			iconEl.addClass("ft-icon-muted");
			iconEl.addClass("ft-flex-shrink-0");

			item.createSpan({ text: report.name, cls: "ft-master-event-name" });

			const cols = report.frontmatter.columns;
			if (cols !== undefined) {
				item.createSpan({
					text: `${cols} cols`,
					cls: "ft-badge ft-badge-muted",
				});
			}

			item.addEventListener("click", () => {
				this.deps.setState({ selectedReportPath: report.path });
				this.renderMaster();
				this.renderDetail();
			});
		}
	}

	// ─────────────────────────────────────────────────────────
	// Detail panel
	// ─────────────────────────────────────────────────────────

	renderDetail(): void {
		this.detailEl.empty();
		const state = this.deps.getState();

		if (!state.selectedReportPath) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "file-spreadsheet", "Select a report to view details", count, label);
			return;
		}

		const report = state.reportEntries.find((r) => r.path === state.selectedReportPath);
		if (!report) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "file-spreadsheet", "Report not found", count, label);
			return;
		}

		this.renderReportDetailContent(report);
	}

	private renderReportDetailContent(report: ReportEntry): void {
		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: report.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: "CSV Report", cls: "ft-operation-badge ft-operation-badge-import" });

		// Frontmatter properties
		const fm = report.frontmatter;
		const skipKeys = new Set(["position", "type"]);
		const entries = Object.entries(fm).filter(([k]) => !skipKeys.has(k));

		if (entries.length > 0) {
			const card = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
			const grid = card.createDiv({ cls: "ft-detail-info-grid" });
			for (const [key, value] of entries) {
				const displayValue = Array.isArray(value) ? value.join(", ") : String(value ?? "");
				addInfoRow(grid, key, displayValue);
			}
		}

		// Headers list
		const headers = fm.headers;
		if (Array.isArray(headers) && headers.length > 0) {
			const section = this.detailEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
			section.createDiv({ text: `Columns (${headers.length})`, cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			chips.style.flexWrap = "wrap";
			for (const h of headers) {
				chips.createSpan({ text: String(h), cls: "ft-badge ft-badge-muted" });
			}
		}

		// Actions
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions ft-mt-3" });

		const openLink = actions.createEl("span", { cls: "ft-nav-link" });
		const openIcon = openLink.createSpan();
		setIcon(openIcon, "file-text");
		openLink.appendText(" Open Documentation");
		openLink.addEventListener("click", () => {
			void this.deps.app.workspace.openLinkText(report.path, "", false);
		});

		// Open the CSV file itself
		const csvFile = fm.csvFile;
		if (typeof csvFile === "string") {
			const match = csvFile.match(/\[\[(.+?)\]\]/);
			const csvPath = match ? match[1] : csvFile;
			const openCsvLink = actions.createEl("span", { cls: "ft-nav-link" });
			const csvIcon = openCsvLink.createSpan();
			setIcon(csvIcon, "file-spreadsheet");
			openCsvLink.appendText(" Open CSV");
			openCsvLink.addEventListener("click", () => {
				void this.deps.app.workspace.openLinkText(csvPath, "", false);
			});
		}

		// Configs referencing this CSV
		const csvFileFm = fm.csvFile;
		if (typeof csvFileFm === "string") {
			const csvMatch = csvFileFm.match(/\[\[(.+?)\]\]/);
			const csvPath = csvMatch ? csvMatch[1] : csvFileFm;
			const importConfigs = this.deps.dataExchangeService.getImportConfigsForFile(csvPath);
			if (importConfigs.length > 0) {
				const cfgSection = this.detailEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
				cfgSection.createDiv({ text: "Import Configs", cls: "ft-detail-section-header" });
				for (const cfg of importConfigs) {
					const item = cfgSection.createDiv({ cls: "ft-master-event-item" });
					const iconEl = item.createSpan();
					setIcon(iconEl, "file-input");
					iconEl.addClass("ft-icon-muted");
					iconEl.addClass("ft-flex-shrink-0");
					item.createSpan({ text: cfg.name, cls: "ft-master-event-name" });
					item.createSpan({ text: `→ ${cfg.targetFolder}`, cls: "ft-badge ft-badge-muted" });
					item.addEventListener("click", () => {
						this.deps.setState({ selectedImportId: cfg.id });
						this.deps.navigation.navigateTo("imports");
					});
				}
			}
		}

		// Delete doc
		const deleteLink = actions.createEl("span", { cls: "ft-nav-link" });
		deleteLink.style.color = "var(--text-error)";
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Delete Doc");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Delete documentation "${report.name}"?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					void this.deps.eventBus.emit("doc.delete", {
						path: report.path,
						source: "ReportsTab",
					}).then(() => {
						this.deps.setState({ selectedReportPath: null });
						this.deps.scheduleRender();
						new Notice("Report documentation deleted");
					});
				},
			}).open();
		});
	}
}
