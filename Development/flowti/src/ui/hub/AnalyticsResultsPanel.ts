/**
 * Analytics results panel — stat cards, sortable table, and CSV export.
 *
 * Rendered inside the AnalyticsTab detail area after a query executes.
 */

import { setIcon } from "obsidian";
import { renderStatGrid, type StatCardItem } from "../shared/StatCard";
import type { AnalyticsResult, ResultRow } from "../../domain/analytics/types";
import { formatDisplayNumber } from "../../domain/analytics/localeUtils";
import { rowsToCsv } from "../../utils/csvUtils";

export interface AnalyticsResultsPanelOptions {
	result: AnalyticsResult;
	durationMs?: number;
	onExportCsv?: (csv: string) => void;
	/** Hide the stat cards row (when summary is shown elsewhere). */
	hideStats?: boolean;
}

interface SortState {
	column: string;
	ascending: boolean;
}

export class AnalyticsResultsPanel {
	private sort: SortState | null = null;

	constructor(
		private container: HTMLElement,
		private options: AnalyticsResultsPanelOptions,
	) {}

	render(): void {
		this.container.empty();
		const { result, durationMs } = this.options;

		// ── Stat cards ──────────────────────────────────────
		if (!this.options.hideStats) {
			const cards: StatCardItem[] = [
				{ icon: "rows-3", value: String(result.rows.length), label: "Result Rows" },
				{ icon: "layers", value: String(result.groupCount), label: "Groups" },
				{ icon: "database", value: String(result.sourceRowCount), label: "Source Rows" },
			];
			if (durationMs !== undefined) {
				cards.push({ icon: "timer", value: `${durationMs}ms`, label: "Duration" });
			}
			renderStatGrid(this.container, cards, cards.length);
		}

		// ── Actions ──────────────────────────────────────────
		if (result.rows.length > 0) {
			const actions = this.container.createDiv({ cls: "ft-detail-actions ft-mt-2" });

			if (this.options.onExportCsv) {
				const exportLink = actions.createEl("span", { cls: "ft-nav-link" });
				const exportIcon = exportLink.createSpan();
				setIcon(exportIcon, "download");
				exportLink.appendText(" Export CSV");
				exportLink.addEventListener("click", () => {
					const csv = this.generateCsv();
					this.options.onExportCsv?.(csv);
				});
			}
		}

		// ── Results table ────────────────────────────────────
		if (result.rows.length === 0) {
			this.container.createDiv({
				text: "Query returned no results",
				cls: "ft-text-muted ft-text-sm ft-p-3 ft-text-center",
			});
			return;
		}

		const rows = this.getSortedRows();
		const maxRows = Math.min(rows.length, 100);

		const scrollWrapper = this.container.createDiv({ cls: "ft-table-scroll ft-mt-2" });
		const table = scrollWrapper.createEl("table", { cls: "ft-preview-table" });

		// Header row with sort controls
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const col of result.columns) {
			const th = headerRow.createEl("th");
			th.style.cursor = "pointer";
			th.style.userSelect = "none";
			th.style.whiteSpace = "nowrap";

			th.createSpan({ text: col });

			if (this.sort?.column === col) {
				const arrow = th.createSpan({ cls: "ft-text-muted" });
				arrow.style.marginLeft = "4px";
				arrow.textContent = this.sort.ascending ? " \u25B2" : " \u25BC";
			}

			th.addEventListener("click", () => {
				if (this.sort?.column === col) {
					this.sort.ascending = !this.sort.ascending;
				} else {
					this.sort = { column: col, ascending: true };
				}
				this.render();
			});
		}

		// Data rows
		const tbody = table.createEl("tbody");
		for (let i = 0; i < maxRows; i++) {
			const tr = tbody.createEl("tr");
			const row = rows[i];
			for (const col of result.columns) {
				const val = row[col];
				const hint = result.columnTypeHints?.find((h) => h.column === col || h.alias === col);
				tr.createEl("td", {
					text: typeof val === "number" ? formatDisplayNumber(val, undefined, hint?.currencySymbol) : String(val ?? ""),
					cls: "ft-text-sm",
				});
			}
		}

		// Totals row
		const numericCols = result.columns.filter((col) => typeof result.rows[0]?.[col] === "number");
		if (numericCols.length > 0 && result.rows.length > 1) {
			const tfoot = table.createEl("tfoot");
			const totalsRow = tfoot.createEl("tr");
			totalsRow.style.borderTop = "2px solid var(--background-modifier-border)";
			totalsRow.style.fontWeight = "600";
			for (const col of result.columns) {
				const td = totalsRow.createEl("td", { cls: "ft-text-sm" });
				if (numericCols.includes(col)) {
					const sum = result.rows.reduce((acc, r) => {
						const v = r[col];
						return acc + (typeof v === "number" ? v : 0);
					}, 0);
					const hint = result.columnTypeHints?.find((h) => h.column === col || h.alias === col);
					td.textContent = formatDisplayNumber(sum, undefined, hint?.currencySymbol);
				} else {
					td.textContent = col === result.columns[0] ? "Total" : "";
				}
			}
		}

		if (rows.length > maxRows) {
			this.container.createDiv({
				text: `Showing ${maxRows} of ${rows.length} rows`,
				cls: "ft-text-muted ft-text-sm ft-p-2 ft-text-center",
			});
		}
	}

	private getSortedRows(): ResultRow[] {
		const { result } = this.options;
		if (!this.sort) return result.rows;

		const { column, ascending } = this.sort;
		return [...result.rows].sort((a, b) => {
			const va = a[column];
			const vb = b[column];
			if (va === vb) return 0;
			if (va === undefined || va === null) return 1;
			if (vb === undefined || vb === null) return -1;

			let cmp: number;
			if (typeof va === "number" && typeof vb === "number") {
				cmp = va - vb;
			} else {
				cmp = String(va).localeCompare(String(vb));
			}
			return ascending ? cmp : -cmp;
		});
	}

	private generateCsv(): string {
		const { result } = this.options;
		return rowsToCsv(result.columns, result.rows);
	}
}
