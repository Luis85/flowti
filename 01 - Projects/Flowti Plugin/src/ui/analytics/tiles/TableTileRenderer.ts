/**
 * Table tile sub-renderer — sortable columns, search, KPI stat cards,
 * conditional formatting, column reorder, pagination, and drill-down.
 *
 * Extracted from DashboardTileRenderer (PBI-ANA-141, Cycle 44).
 */

import type { AnalyticsResult } from "../../../domain/analytics/types";
import { evaluateConditionalRules } from "../../../domain/analytics/conditionalFormatting";
import { getNumericColumns } from "../dashboardUtils";
import type { TileRenderer, TileRenderContext } from "./types";
import { fmtNum } from "./types";

/** Default page size when rowLimit is unset (undefined). 0 = show all. */
const DEFAULT_PAGE_SIZE = 15;

export class TableTileRenderer implements TileRenderer {
	/** Ephemeral sort state (not persisted — reset on full tile re-render). */
	private tableSort: { column: string; ascending: boolean } | null = null;
	/** Ephemeral search filter (not persisted). */
	private tableSearchText = "";

	render(container: HTMLElement, result: AnalyticsResult, ctx: TileRenderContext): void {
		const rules = ctx.tile.conditionalRules;

		if (result.rows.length === 0) {
			container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" });
			return;
		}

		// ── Compact aggregate stat cards (full result — not paginated) ──
		const numericCols = getNumericColumns(result);
		if (result.rows.length > 1 && ctx.tile.showTableKpis !== false) {
			const kpiCount = 1 + numericCols.length; // "Items" + numeric columns
			const grid = container.createDiv({ cls: "ft-table-kpi-grid" });
			grid.style.gridTemplateColumns = `repeat(${Math.min(kpiCount, 4)}, 1fr)`;

			// Items count card
			const itemsCard = grid.createDiv({ cls: "ft-table-kpi-card" });
			const itemsVal = itemsCard.createDiv({ cls: "ft-catalog-stat-value ft-table-kpi-value" });
			itemsVal.textContent = String(result.rows.length);
			itemsCard.createDiv({ text: ctx.tile.tableKpiLabel || "Items", cls: "ft-catalog-stat-label" });

			for (const col of numericCols) {
				const sum = result.rows.reduce((acc, r) => {
					const v = r[col];
					return acc + (typeof v === "number" ? v : 0);
				}, 0);

				const card = grid.createDiv({ cls: "ft-table-kpi-card" });

				const valEl = card.createDiv({ cls: "ft-catalog-stat-value ft-table-kpi-value" });
				valEl.textContent = fmtNum(sum, ctx, result.columnTypeHints, col);

				if (rules && rules.length > 0) {
					const colRules = rules.filter((r) => r.column === col);
					if (colRules.length > 0) {
						const color = evaluateConditionalRules(sum, colRules);
						if (color) valEl.style.color = color;
					}
				}

				card.createDiv({ text: col, cls: "ft-catalog-stat-label" });
			}
		}

		// ── Search input ─────────────────────────────────────
		const searchRow = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-table-search-row" });
		const searchInput = searchRow.createEl("input", { type: "text", cls: "ft-text-xs ft-table-search-input" });
		searchInput.placeholder = "Search rows...";
		searchInput.value = this.tableSearchText;

		// ── Apply column order ────────────────────────────────
		const displayColumns = this.applyColumnOrder(result.columns, ctx.tile.columnOrder);

		// ── Filtered + sorted rows (full set) ────────────────
		const displayRows = (): Record<string, unknown>[] => {
			let rows = result.rows;
			const search = this.tableSearchText.trim().toLowerCase();
			if (search) {
				rows = rows.filter((row) =>
					displayColumns.some((col) => {
						const val = row[col];
						return val !== null && val !== undefined && String(val).toLowerCase().includes(search);
					}),
				);
			}
			if (this.tableSort && displayColumns.includes(this.tableSort.column)) {
				const sortCol = this.tableSort.column;
				const asc = this.tableSort.ascending;
				rows = [...rows].sort((a, b) => {
					const va = a[sortCol];
					const vb = b[sortCol];
					if (va == null && vb == null) return 0;
					if (va == null) return asc ? -1 : 1;
					if (vb == null) return asc ? 1 : -1;
					if (typeof va === "number" && typeof vb === "number") return asc ? va - vb : vb - va;
					return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
				});
			}
			return rows;
		};

		// ── Pagination state ─────────────────────────────────
		const pageSize = ctx.tile.rowLimit === 0 ? 0 : (ctx.tile.rowLimit ?? DEFAULT_PAGE_SIZE);
		let internalPage = ctx.currentPage ?? 1;

		/** Compute page slice from full row set, clamping page to valid range. */
		const paginateRows = (allRows: Record<string, unknown>[]): { rows: Record<string, unknown>[]; page: number; totalPages: number } => {
			if (pageSize <= 0) return { rows: allRows, page: 1, totalPages: 1 };
			const totalPages = Math.max(1, Math.ceil(allRows.length / pageSize));
			const page = Math.min(Math.max(internalPage, 1), totalPages);
			return { rows: allRows.slice((page - 1) * pageSize, page * pageSize), page, totalPages };
		};

		// ── Table structure ───────────────────────────────────
		const table = container.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		const tableBody = table.createEl("tbody");
		const paginationHost = container.createDiv();

		/** Rebuild table body + pagination bar from current sort/search/page state. */
		const rebuildAll = () => {
			const allRows = displayRows();
			const { rows: pageRows, page, totalPages } = paginateRows(allRows);
			internalPage = page;
			this.rebuildTableBody(tableBody, pageRows, displayColumns, ctx);
			this.renderPaginationBar(paginationHost, page, totalPages, allRows.length, pageSize, ctx);
		};

		// Wire search to rebuild with page reset
		searchInput.addEventListener("input", () => {
			this.tableSearchText = searchInput.value;
			internalPage = 1; // Reset to first page on search
			rebuildAll();
		});

		this.renderTableHeaders(headerRow, displayColumns, ctx, rebuildAll);
		rebuildAll();
	}

	/** Re-render table body (used by sort/search/pagination to avoid full tile re-render). */
	private rebuildTableBody(
		tbody: HTMLElement,
		rows: Record<string, unknown>[],
		columns: string[],
		ctx: TileRenderContext,
	): void {
		tbody.empty();
		for (const row of rows) {
			const tr = tbody.createEl("tr");
			for (const col of columns) {
				this.renderCell(tr, row[col], col, ctx);
			}
		}
	}

	private renderCell(tr: HTMLElement, val: unknown, col: string, ctx: TileRenderContext): void {
		const td = tr.createEl("td", { cls: "ft-text-sm" });
		td.textContent = typeof val === "number" ? fmtNum(val, ctx, ctx.result?.columnTypeHints, col) : String(val ?? "");
		if (typeof val === "number") {
			this.applyConditionalFormat(td, val, col, ctx);
		} else if (typeof val === "string" && (ctx.onCrossTileFilter || ctx.onDrillDown)) {
			td.addClass("ft-table-cell-clickable");
			if (ctx.activeFilters?.some((f) => f.column === col && f.values.includes(val))) td.addClass("ft-table-cell-active-filter");
			td.addEventListener("click", () => {
				if (ctx.onCrossTileFilter) ctx.onCrossTileFilter(ctx.tile.id, col, val);
				else ctx.onDrillDown!(col, val);
			});
		}
	}

	private applyConditionalFormat(td: HTMLElement, val: number, col: string, ctx: TileRenderContext): void {
		const rules = ctx.tile.conditionalRules;
		if (!rules || rules.length === 0) return;
		const colRules = rules.filter((r) => r.column === col);
		if (colRules.length === 0) return;
		const color = evaluateConditionalRules(val, colRules);
		if (color) { td.style.backgroundColor = color; td.addClass("ft-table-cond-format"); }
	}

	/** Render pagination bar below the table (prev/next + page indicator). */
	private renderPaginationBar(
		host: HTMLElement,
		currentPage: number,
		totalPages: number,
		totalRows: number,
		pageSize: number,
		ctx: TileRenderContext,
	): void {
		host.empty();
		if (totalPages <= 1 || pageSize <= 0) return;

		const bar = host.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-table-pagination-bar" });

		const prevBtn = bar.createEl("button", { text: "\u25C0 prev", cls: "ft-text-xs ft-table-page-btn" });
		if (currentPage <= 1) {
			prevBtn.disabled = true;
			prevBtn.addClass("ft-disabled-faint");
		} else if (ctx.onPageChange) {
			prevBtn.addEventListener("click", () => ctx.onPageChange!(ctx.tile.id, currentPage - 1));
		}

		const startRow = (currentPage - 1) * pageSize + 1;
		const endRow = Math.min(currentPage * pageSize, totalRows);
		bar.createSpan({ text: `${startRow}\u2013${endRow} of ${totalRows}`, cls: "ft-text-xs ft-text-muted" });

		const nextBtn = bar.createEl("button", { text: "Next \u25B6", cls: "ft-text-xs ft-table-page-btn" });
		if (currentPage >= totalPages) {
			nextBtn.disabled = true;
			nextBtn.addClass("ft-disabled-faint");
		} else if (ctx.onPageChange) {
			nextBtn.addEventListener("click", () => ctx.onPageChange!(ctx.tile.id, currentPage + 1));
		}
	}

	/** Re-render table header row (used when sort changes). */
	private renderTableHeaders(
		headerRow: HTMLElement,
		displayColumns: string[],
		ctx: TileRenderContext,
		onSortChanged: () => void,
	): void {
		headerRow.empty();
		for (let i = 0; i < displayColumns.length; i++) {
			const col = displayColumns[i];
			const th = headerRow.createEl("th", { cls: "ft-text-xs ft-table-th-sortable" });

			th.createSpan({ text: col });

			if (this.tableSort?.column === col) {
				const arrow = th.createSpan({ cls: "ft-text-muted ft-table-sort-arrow" });
				arrow.textContent = this.tableSort.ascending ? "\u25B2" : "\u25BC";
			}

			th.addEventListener("click", () => {
				if (this.tableSort?.column === col) {
					if (this.tableSort.ascending) {
						this.tableSort.ascending = false;
					} else {
						this.tableSort = null;
					}
				} else {
					this.tableSort = { column: col, ascending: true };
				}
				onSortChanged();
				this.renderTableHeaders(headerRow, displayColumns, ctx, onSortChanged);
			});

			if (ctx.onColumnOrderChange && displayColumns.length > 1) {
				if (i > 0) {
					const leftBtn = th.createSpan({ cls: "ft-text-muted ft-table-col-move-btn" });
					leftBtn.textContent = "\u25C0";
					leftBtn.setAttribute("aria-label", "Move column left");
					leftBtn.addEventListener("click", (e) => {
						e.stopPropagation();
						const cols = [...displayColumns];
						[cols[i - 1], cols[i]] = [cols[i], cols[i - 1]];
						ctx.onColumnOrderChange!(ctx.tile.id, cols);
					});
				}
				if (i < displayColumns.length - 1) {
					const rightBtn = th.createSpan({ cls: "ft-text-muted ft-table-col-move-btn-tight" });
					rightBtn.textContent = "\u25B6";
					rightBtn.setAttribute("aria-label", "Move column right");
					rightBtn.addEventListener("click", (e) => {
						e.stopPropagation();
						const cols = [...displayColumns];
						[cols[i], cols[i + 1]] = [cols[i + 1], cols[i]];
						ctx.onColumnOrderChange!(ctx.tile.id, cols);
					});
				}
			}
		}
	}

	/** Apply custom column order — preserves any new columns not in saved order. */
	private applyColumnOrder(resultColumns: string[], savedOrder: string[] | undefined): string[] {
		if (!savedOrder || savedOrder.length === 0) return resultColumns;
		const resultSet = new Set(resultColumns);
		const ordered = savedOrder.filter((c) => resultSet.has(c));
		for (const col of resultColumns) {
			if (!savedOrder.includes(col)) ordered.push(col);
		}
		return ordered;
	}
}
