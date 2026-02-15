/**
 * Reports tab component for the Data Exchange Hub.
 * Unified list of all CSV files with documentation status, config badges,
 * and encouragement to create docs for undocumented files.
 *
 * Detail rendering is delegated to ReportDetailPanel.
 */

import { setIcon } from "obsidian";
import { renderScanIssuesBanner } from "./helpers";
import type { CsvFileEntry, HubComponentDeps } from "./types";
import {
	ReportDetailPanel,
	reportMatchesCsv, findReportForCsv, sortCsvUsedFirst, createDocForCsvEntry,
} from "./ReportDetailPanel";

export class ReportsTab {
	private detailPanel: ReportDetailPanel;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: HubComponentDeps,
	) {
		this.detailPanel = new ReportDetailPanel(detailEl, deps);
	}

	// ─────────────────────────────────────────────────────────
	// Master list
	// ─────────────────────────────────────────────────────────

	renderMaster(): void {
		this.masterEl.empty();

		const state = this.deps.getState();
		const hiddenPaths = this.deps.dataExchangeService.getHiddenCsvPaths();
		const hiddenSet = new Set(hiddenPaths);

		// All CSV files, filtered by search
		let allCsv = state.csvFileEntries;
		if (state.filterText) {
			allCsv = allCsv.filter((e) =>
				e.name.toLowerCase().includes(state.filterText)
				|| e.displayName.toLowerCase().includes(state.filterText),
			);
		}

		// Partition: documented / undocumented / hidden
		const visible = allCsv.filter((e) => !hiddenSet.has(e.path));
		const hidden = allCsv.filter((e) => hiddenSet.has(e.path));
		const documented = sortCsvUsedFirst(visible.filter((e) => e.hasDoc));
		const undocumented = sortCsvUsedFirst(visible.filter((e) => !e.hasDoc));

		// ── Scan issues banner (only report-folder issues) ──
		const reportsFolder = this.deps.dataExchangeService.getReportsFolderPath();
		const reportIssues = state.frontmatterIssues.filter((i) => i.filePath.startsWith(reportsFolder));
		renderScanIssuesBanner(this.masterEl, reportIssues);

		// ── Coverage summary ──
		const totalVisible = state.showHiddenCsvs ? allCsv.length : visible.length;
		const docCount = state.showHiddenCsvs
			? allCsv.filter((e) => e.hasDoc).length
			: documented.length;
		this.renderCoverageSummary(totalVisible, docCount);

		// ── Documented section (first) ──
		if (documented.length > 0 || undocumented.length === 0) {
			const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
			header.style.marginTop = "0.75rem";
			header.createSpan({ text: "Documented" });
			header.createSpan({
				text: `${documented.length}`,
				cls: "ft-master-category-count",
			});

			if (documented.length === 0) {
				this.masterEl.createDiv({
					text: state.filterText ? "No matching documented reports" : "No documented CSV files yet",
					cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm",
				});
			} else {
				for (const entry of documented) {
					this.renderCsvItem(entry, false);
				}
			}
		}

		// ── Undocumented section ──
		if (undocumented.length > 0) {
			const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
			header.style.marginTop = "1rem";
			header.createSpan({ text: "Undocumented" });
			header.createSpan({
				text: `${undocumented.length}`,
				cls: "ft-master-category-count",
			});

			for (const entry of undocumented) {
				this.renderCsvItem(entry, false);
			}
		}

		// ── Hidden section ──
		if (hidden.length > 0) {
			const toggleRow = this.masterEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-px-2" });
			toggleRow.style.marginTop = "1rem";
			const toggleChip = toggleRow.createSpan({
				cls: `ft-badge ${state.showHiddenCsvs ? "" : "ft-badge-muted"}`,
			});
			toggleChip.addClass("ft-cursor-pointer");
			const eyeIcon = toggleChip.createSpan();
			setIcon(eyeIcon, state.showHiddenCsvs ? "eye" : "eye-off");
			eyeIcon.style.marginRight = "0.25rem";
			toggleChip.appendText(`${state.showHiddenCsvs ? "Hide" : "Show"} hidden (${hidden.length})`);
			toggleChip.addEventListener("click", () => {
				this.deps.setState({ showHiddenCsvs: !state.showHiddenCsvs });
				this.deps.scheduleRender();
			});

			if (state.showHiddenCsvs) {
				for (const entry of hidden) {
					this.renderCsvItem(entry, true);
				}
			}
		}

		// ── Empty state ──
		if (visible.length === 0 && hidden.length === 0) {
			this.masterEl.createDiv({
				text: state.filterText ? "No matching CSV files" : "No CSV files found in vault",
				cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm",
			});
		}
	}

	private renderCoverageSummary(total: number, documented: number): void {
		const summary = this.masterEl.createDiv({ cls: "ft-card ft-p-3 ft-mb-2" });
		summary.style.margin = "0.5rem";

		const row = summary.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const iconEl = row.createSpan();
		setIcon(iconEl, "file-spreadsheet");
		iconEl.addClass("ft-icon-muted");
		row.createSpan({
			text: `${documented} / ${total} documented`,
			cls: "ft-text-sm",
		});

		// Progress bar
		const pct = total > 0 ? Math.round((documented / total) * 100) : 100;
		const bar = summary.createDiv({ cls: "ft-progress-bar ft-mt-1" });
		bar.style.height = "4px";
		const fill = bar.createDiv({ cls: "ft-progress-bar-fill" });
		fill.style.width = `${pct}%`;
	}

	private renderCsvItem(entry: CsvFileEntry, isHidden: boolean): void {
		const state = this.deps.getState();
		const isSelected = state.selectedCsvFilePath === entry.path
			|| (entry.hasDoc && state.selectedReportPath !== null
				&& state.reportEntries.some((r) => r.path === state.selectedReportPath && reportMatchesCsv(r, entry)));
		const item = this.masterEl.createDiv({
			cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
		});
		if (isHidden) {
			item.addClass("ft-icon-muted");
		}

		// Icon
		const iconEl = item.createSpan();
		setIcon(iconEl, "file-spreadsheet");
		iconEl.addClass(entry.hasDoc ? "ft-icon-muted" : "ft-icon-faint");
		iconEl.addClass("ft-flex-shrink-0");

		// Name (with folder disambiguation when colliding)
		item.createSpan({ text: entry.displayName, cls: "ft-master-event-name" });

		// Status badges
		if (!entry.hasDoc && !isHidden) {
			const docHint = item.createSpan({ cls: "ft-badge ft-badge-muted ft-cursor-pointer" });
			docHint.style.gap = "0.2rem";
			const plusIcon = docHint.createSpan();
			plusIcon.style.display = "inline-flex";
			plusIcon.style.width = "12px";
			plusIcon.style.height = "12px";
			plusIcon.style.flexShrink = "0";
			setIcon(plusIcon, "plus");
			docHint.createSpan({ text: "doc" });
			docHint.addEventListener("click", (e) => {
				e.stopPropagation();
				createDocForCsvEntry(this.deps, entry);
			});
		}

		// NoteType badge for documented reports
		if (entry.hasDoc) {
			const report = findReportForCsv(state.reportEntries, entry);
			const nt = report?.frontmatter?.noteType;
			if (typeof nt === "string" && nt) {
				item.createSpan({ text: nt, cls: "ft-badge" });
			}
			if (report && report.frontmatterIssues.length > 0) {
				const warnIcon = item.createSpan();
				setIcon(warnIcon, "alert-triangle");
				warnIcon.style.color = "rgb(250, 204, 21)";
				warnIcon.style.flexShrink = "0";
				warnIcon.title = report.frontmatterIssues.join("\n");
			}
		}

		if (entry.importConfigs.length > 0) {
			item.createSpan({
				text: `${entry.importConfigs.length} imp`,
				cls: "ft-badge ft-badge-muted",
			});
		}

		if (entry.exportConfigs.length > 0) {
			item.createSpan({
				text: `${entry.exportConfigs.length} exp`,
				cls: "ft-badge ft-badge-muted",
			});
		}

		item.addEventListener("click", () => {
			if (entry.hasDoc) {
				const report = findReportForCsv(state.reportEntries, entry);
				if (report) {
					this.deps.setState({ selectedReportPath: report.path, selectedCsvFilePath: null });
				} else {
					this.deps.setState({ selectedCsvFilePath: entry.path, selectedReportPath: null });
				}
			} else {
				this.deps.setState({ selectedCsvFilePath: entry.path, selectedReportPath: null });
			}
			this.renderMaster();
			this.renderDetail();
		});
	}

	// ─────────────────────────────────────────────────────────
	// Detail panel — delegated to ReportDetailPanel
	// ─────────────────────────────────────────────────────────

	renderDetail(): void {
		this.detailPanel.render();
	}
}
