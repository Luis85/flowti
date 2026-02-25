/**
 * Renders a single dashboard tile — table with aggregate KPIs, stat-card summary,
 * or chart with value column selector.
 */

import { setIcon } from "obsidian";
import type { AnalyticsResult, DashboardTile, SavedAnalyticsQuery, TileDisplayMode, ConditionalRule } from "../../domain/analytics/types";
import { formatRelativeTime, getFreshnessColor, getFreshnessLevel } from "../../domain/analytics/freshnessUtils";
import { evaluateConditionalRules } from "../../domain/analytics/conditionalFormatting";
import { rowsToCsv, downloadCsvFile } from "../../utils/csvUtils";
import { ChartRenderer } from "./ChartRenderer";
import { TileSettingsPanel, getNumericColumns } from "./TileSettingsPanel";

const DISPLAY_MODE_CYCLE: TileDisplayMode[] = ["table", "stat-card", "line-chart", "bar-chart", "area-chart", "pie-chart"];

const MAX_STAT_CARD_GROUPS = 20;

export interface TileRenderContext {
	tile: DashboardTile;
	query: SavedAnalyticsQuery | undefined;
	result: AnalyticsResult | null;
	error: string | null;
	onRemove: (tileId: string) => void;
	onRefresh?: (tileId: string) => void;
	onReorder?: (tileId: string, direction: "up" | "down") => void;
	onTitleChange?: (tileId: string, newTitle: string) => void;
	onDisplayModeToggle?: (tileId: string, newMode: TileDisplayMode) => void;
	onRulesChange?: (tileId: string, rules: ConditionalRule[]) => void;
	/** Timestamp of last refresh (for freshness display). */
	refreshedAt?: number;
	/** Whether the tile settings panel is open. */
	settingsOpen?: boolean;
	/** Toggle settings panel open/closed. */
	onToggleSettings?: (tileId: string) => void;
	/** Called when the user selects a different value column for chart display. */
	onChartValueColumnChange?: (tileId: string, column: string) => void;
	/** All saved queries — used in settings panel to change the tile's query. */
	queries?: SavedAnalyticsQuery[];
	/** Called when the user changes which saved query this tile references. */
	onQueryChange?: (tileId: string, newQueryId: string) => void;
	/** Called when the user changes tile width (1–6 columns). */
	onWidthChange?: (tileId: string, width: number) => void;
	/** Called when the user changes tile height (1–6 rows). */
	onHeightChange?: (tileId: string, height: number) => void;
	/** Called when the user toggles sparkline visibility on stat-card tiles. */
	onSparklineToggle?: (tileId: string, show: boolean) => void;
	/** Called when the user changes the max row limit for this tile. */
	onRowLimitChange?: (tileId: string, limit: number | undefined) => void;
	/** Called when the user toggles auto-height (content-driven height at max width). */
	onAutoHeightToggle?: (tileId: string, auto: boolean) => void;
	/** Called when the user clicks "View Query" — navigates to the Queries tab. */
	onViewQuery?: (queryId: string) => void;
	/** Called when the user clicks a string value to drill down (toggles dashboard filter). */
	onDrillDown?: (column: string, value: string) => void;
	/** Active dashboard filters — used for visual feedback on matching cells. */
	activeFilters?: Array<{ column: string; values: string[] }>;
}

export class DashboardTileRenderer {
	constructor(private container: HTMLElement) {}

	render(ctx: TileRenderContext): void {
		this.container.empty();

		const tileEl = this.container.createDiv({ cls: "ft-dashboard-tile" });
		tileEl.style.border = "1px solid var(--background-modifier-border)";
		tileEl.style.borderRadius = "6px";
		tileEl.style.overflow = "hidden";
		tileEl.style.display = "flex";
		tileEl.style.flexDirection = "column";
		if (!ctx.tile.autoHeight) tileEl.style.height = "100%";

		// ── Header ──────────────────────────────────────
		const header = tileEl.createDiv({ cls: "ft-dashboard-tile-header" });
		header.style.display = "flex";
		header.style.alignItems = "center";
		header.style.justifyContent = "space-between";
		header.style.padding = "0.5rem 0.75rem";
		header.style.borderBottom = "1px solid var(--background-modifier-border)";
		header.style.background = "var(--background-secondary)";
		header.style.flexWrap = "wrap";
		header.style.gap = "0.25rem";

		// Editable title
		if (ctx.onTitleChange) {
			const titleInput = header.createEl("input", { type: "text" });
			titleInput.value = ctx.tile.title || ctx.query?.name || "Untitled Tile";
			titleInput.style.cssText = "font-weight:600;font-size:var(--font-ui-small);border:none;background:transparent;color:var(--text-normal);padding:0;flex:1;min-width:0";
			titleInput.addEventListener("blur", () => {
				const val = titleInput.value.trim();
				if (val) ctx.onTitleChange!(ctx.tile.id, val);
			});
			titleInput.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					titleInput.blur();
				}
			});
		} else {
			const titleEl = header.createSpan({
				text: ctx.tile.title || ctx.query?.name || "Untitled Tile",
				cls: "ft-text-sm",
			});
			titleEl.style.fontWeight = "600";
			titleEl.style.flex = "1";
			titleEl.style.minWidth = "0";
			titleEl.style.overflow = "hidden";
			titleEl.style.textOverflow = "ellipsis";
			titleEl.style.whiteSpace = "nowrap";
		}

		// Right-side group: indicators + action buttons
		const actions = header.createDiv();
		actions.style.display = "flex";
		actions.style.alignItems = "center";
		actions.style.gap = "0.25rem";
		actions.style.flexWrap = "wrap";
		actions.style.justifyContent = "flex-end";

		// Row count badge
		if (ctx.result && ctx.result.rows.length > 0) {
			const rowBadge = actions.createSpan({
				text: `${ctx.result.rows.length} rows`,
				cls: "ft-text-xs ft-text-muted",
			});
			rowBadge.style.flexShrink = "0";
		}

		// Conditional rule indicator dot
		if (ctx.tile.conditionalRules && ctx.tile.conditionalRules.length > 0) {
			const dot = actions.createSpan();
			dot.style.cssText = "width:8px;height:8px;border-radius:50%;background:var(--text-accent);flex-shrink:0";
			dot.setAttribute("aria-label", `${ctx.tile.conditionalRules.length} formatting rule(s)`);
		}

		// Freshness badge
		if (ctx.refreshedAt) {
			const level = getFreshnessLevel(ctx.refreshedAt);
			const badge = actions.createSpan({
				text: formatRelativeTime(ctx.refreshedAt),
				cls: "ft-text-xs",
			});
			badge.style.color = getFreshnessColor(level);
			badge.style.flexShrink = "0";
		} else if (ctx.result) {
			const badge = actions.createSpan({ text: "Not yet refreshed", cls: "ft-text-xs ft-text-muted" });
			badge.style.flexShrink = "0";
		}

		// Reorder buttons
		if (ctx.onReorder) {
			const upBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
			const upIcon = upBtn.createSpan();
			setIcon(upIcon, "chevron-up");
			upIcon.style.width = "14px";
			upIcon.style.height = "14px";
			upBtn.style.cursor = "pointer";
			upBtn.setAttribute("aria-label", "Move up");
			upBtn.addEventListener("click", (e) => { e.stopPropagation(); ctx.onReorder!(ctx.tile.id, "up"); });

			const downBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
			const downIcon = downBtn.createSpan();
			setIcon(downIcon, "chevron-down");
			downIcon.style.width = "14px";
			downIcon.style.height = "14px";
			downBtn.style.cursor = "pointer";
			downBtn.setAttribute("aria-label", "Move down");
			downBtn.addEventListener("click", (e) => { e.stopPropagation(); ctx.onReorder!(ctx.tile.id, "down"); });
		}

		// Display mode dropdown
		if (ctx.onDisplayModeToggle) {
			const modeSelect = actions.createEl("select", { cls: "ft-text-xs" });
			modeSelect.style.cssText = "padding:1px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary);cursor:pointer;font-size:var(--font-ui-smaller)";
			const modeLabels: Record<TileDisplayMode, string> = { "table": "Table", "stat-card": "Stat Card", "line-chart": "Line Chart", "bar-chart": "Bar Chart", "area-chart": "Area Chart", "pie-chart": "Pie Chart" };
			for (const mode of DISPLAY_MODE_CYCLE) {
				const opt = modeSelect.createEl("option");
				opt.value = mode;
				opt.textContent = modeLabels[mode];
				if (mode === ctx.tile.displayMode) opt.selected = true;
			}
			modeSelect.addEventListener("change", (e) => {
				e.stopPropagation();
				ctx.onDisplayModeToggle!(ctx.tile.id, modeSelect.value as TileDisplayMode);
			});
		}

		if (ctx.onRefresh) {
			const refreshBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
			const refreshIcon = refreshBtn.createSpan();
			setIcon(refreshIcon, "refresh-cw");
			refreshIcon.style.width = "14px";
			refreshIcon.style.height = "14px";
			refreshBtn.style.cursor = "pointer";
			refreshBtn.setAttribute("aria-label", "Refresh tile");
			refreshBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				ctx.onRefresh!(ctx.tile.id);
			});
		}

		// CSV export button
		if (ctx.result && ctx.result.rows.length > 0) {
			const csvBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
			const csvIcon = csvBtn.createSpan();
			setIcon(csvIcon, "download");
			csvIcon.style.width = "14px";
			csvIcon.style.height = "14px";
			csvBtn.style.cursor = "pointer";
			csvBtn.setAttribute("aria-label", "Export CSV");
			csvBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				const title = ctx.tile.title || ctx.query?.name || "tile-export";
				downloadCsvFile(rowsToCsv(ctx.result!.columns, ctx.result!.rows), title);
			});
		}

		// View query button
		if (ctx.onViewQuery && ctx.tile.queryId) {
			const viewBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
			const viewIcon = viewBtn.createSpan();
			setIcon(viewIcon, "external-link");
			viewIcon.style.width = "14px";
			viewIcon.style.height = "14px";
			viewBtn.style.cursor = "pointer";
			viewBtn.setAttribute("aria-label", "View Query");
			viewBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				ctx.onViewQuery!(ctx.tile.queryId);
			});
		}

		// Settings gear icon
		if (ctx.onToggleSettings) {
			const gearBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
			const gearIcon = gearBtn.createSpan();
			setIcon(gearIcon, "settings");
			gearIcon.style.width = "14px";
			gearIcon.style.height = "14px";
			gearBtn.style.cursor = "pointer";
			if (ctx.settingsOpen) gearBtn.style.color = "var(--text-accent)";
			gearBtn.setAttribute("aria-label", "Tile settings");
			gearBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				ctx.onToggleSettings!(ctx.tile.id);
			});
		}

		// Remove button (only in management context, not on homepage)
		if (ctx.onToggleSettings) {
			const removeBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
			const removeIcon = removeBtn.createSpan();
			setIcon(removeIcon, "trash-2");
			removeIcon.style.width = "14px";
			removeIcon.style.height = "14px";
			removeBtn.style.cursor = "pointer";
			removeBtn.setAttribute("aria-label", "Remove tile");
			removeBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				ctx.onRemove(ctx.tile.id);
			});
		}

		// ── Settings panel (collapsible, scrollable when tile is small) ──
		if (ctx.settingsOpen) {
			const settingsPanel = tileEl.createDiv({ cls: "ft-tile-settings" });
			settingsPanel.style.padding = "0.5rem 0.75rem";
			settingsPanel.style.borderBottom = "1px solid var(--background-modifier-border)";
			settingsPanel.style.background = "var(--background-secondary-alt)";
			settingsPanel.style.overflowY = "auto";
			settingsPanel.style.minHeight = "0";

			new TileSettingsPanel(settingsPanel, ctx).render();
		}

		// ── Body ────────────────────────────────────────
		const isChart = ctx.tile.displayMode === "line-chart" || ctx.tile.displayMode === "bar-chart" || ctx.tile.displayMode === "area-chart" || ctx.tile.displayMode === "pie-chart";
		const body = tileEl.createDiv({ cls: "ft-dashboard-tile-body" });
		if (ctx.tile.autoHeight) {
			body.style.overflow = "visible";
		} else {
			body.style.flex = "1";
			body.style.overflow = isChart ? "hidden" : "auto";
			body.style.minHeight = "0";
		}
		body.style.padding = ctx.tile.displayMode === "table" ? "0.35rem" : "0.5rem 0.35rem";
		if (isChart) {
			body.style.display = "flex";
			body.style.flexDirection = "column";
		}

		// Apply per-tile row limit
		const limitedResult = ctx.result && ctx.tile.rowLimit && ctx.tile.rowLimit > 0
			? { ...ctx.result, rows: ctx.result.rows.slice(0, ctx.tile.rowLimit) }
			: ctx.result;

		try {
			if (ctx.error) {
				this.renderError(body, ctx.error);
			} else if (!ctx.query) {
				this.renderError(body, "Query not found — it may have been deleted");
			} else if (!limitedResult) {
				this.renderLoading(body);
			} else if (ctx.tile.displayMode === "stat-card") {
				this.renderStatCard(body, limitedResult, ctx);
			} else if (ctx.tile.displayMode === "pie-chart") {
				ChartRenderer.renderPieChart(body, limitedResult, ctx.tile.chartValueColumn);
			} else if (isChart) {
				this.renderChartWithSelector(body, { ...ctx, result: limitedResult });
			} else {
				this.renderTable(body, limitedResult, ctx);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.renderError(body, `Render failed: ${message}`);
		}
	}

	private renderError(container: HTMLElement, message: string): void {
		const el = container.createDiv({ cls: "ft-text-muted ft-text-sm" });
		el.style.textAlign = "center";
		el.style.padding = "1rem";
		const iconEl = el.createDiv();
		setIcon(iconEl, "alert-triangle");
		iconEl.style.marginBottom = "0.25rem";
		el.createDiv({ text: message });
	}

	private renderLoading(container: HTMLElement): void {
		const el = container.createDiv({ cls: "ft-text-muted ft-text-sm" });
		el.style.textAlign = "center";
		el.style.padding = "1rem";
		el.createDiv({ text: "Loading..." });
	}

	private renderChartWithSelector(container: HTMLElement, ctx: TileRenderContext): void {
		const result = ctx.result!;
		const numericCols = getNumericColumns(result);
		const selectedCol = ctx.tile.chartValueColumn;
		const effectiveCol = selectedCol && numericCols.includes(selectedCol) ? selectedCol : numericCols[0] ?? undefined;

		// Value column selector — only when multiple numeric columns
		if (numericCols.length > 1 && ctx.onChartValueColumnChange) {
			const bar = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			bar.style.padding = "0.25rem 0.5rem";
			bar.style.borderBottom = "1px solid var(--background-modifier-border)";

			bar.createSpan({ text: "Value:", cls: "ft-text-xs ft-text-muted" });

			const colSelect = bar.createEl("select", { cls: "ft-text-xs" });
			colSelect.style.cssText = "padding:1px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary);cursor:pointer;font-size:var(--font-ui-smaller)";
			for (const col of numericCols) {
				const opt = colSelect.createEl("option");
				opt.value = col;
				opt.textContent = col;
				if (col === effectiveCol) opt.selected = true;
			}
			colSelect.addEventListener("change", () => {
				ctx.onChartValueColumnChange!(ctx.tile.id, colSelect.value);
			});
		} else if (numericCols.length === 1) {
			const bar = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			bar.style.padding = "0.25rem 0.5rem";
			bar.createSpan({ text: numericCols[0], cls: "ft-text-xs ft-text-muted" });
		}

		const chartHost = container.createDiv();
		chartHost.style.flex = "1";
		chartHost.style.minHeight = "0";
		chartHost.style.paddingBottom = "0.5rem";
		if (ctx.tile.displayMode === "line-chart") {
			ChartRenderer.renderLineChart(chartHost, result, effectiveCol);
		} else if (ctx.tile.displayMode === "area-chart") {
			ChartRenderer.renderAreaChart(chartHost, result, effectiveCol);
		} else {
			ChartRenderer.renderBarChart(chartHost, result, effectiveCol);
		}
	}

	private renderStatCard(container: HTMLElement, result: AnalyticsResult, ctx: TileRenderContext): void {
		const rules = ctx.tile.conditionalRules;
		const showSparkline = ctx.tile.showSparkline !== false;

		if (result.rows.length === 0) {
			container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" });
			return;
		}

		const wrapper = container.createDiv();
		wrapper.style.margin = "auto 0";

		const measureCols = result.columns.filter((col) => typeof result.rows[0][col] === "number");
		const dimCols = result.columns.filter((col) => typeof result.rows[0][col] !== "number");

		const rowsToShow = Math.min(result.rows.length, MAX_STAT_CARD_GROUPS);

		for (let i = 0; i < rowsToShow; i++) {
			const row = result.rows[i];

			// Dimension label (group header) — clickable for drill-down
			if (dimCols.length > 0) {
				const label = dimCols.map((col) => String(row[col] ?? "")).join(" · ");
				const labelEl = wrapper.createDiv({ cls: "ft-text-sm" });
				labelEl.style.fontWeight = "600";
				labelEl.style.marginTop = i > 0 ? "0.4rem" : "0";
				labelEl.style.marginBottom = "0.15rem";
				labelEl.textContent = label;

				// Drill-down: click dimension label to filter
				if (ctx.onDrillDown && dimCols.length === 1) {
					const col = dimCols[0];
					const val = String(row[col] ?? "");
					labelEl.style.cursor = "pointer";
					labelEl.style.textDecoration = "underline";
					labelEl.style.textDecorationStyle = "dotted";
					labelEl.style.textUnderlineOffset = "3px";

					// Highlight if this value matches an active filter
					const isActive = ctx.activeFilters?.some((f) => f.column === col && f.values.includes(val));
					if (isActive) {
						labelEl.style.color = "var(--text-accent)";
					}

					labelEl.addEventListener("click", () => {
						ctx.onDrillDown!(col, val);
					});
				}
			}

			// Stat cards for this group
			const grid = wrapper.createDiv({ cls: "ft-stat-card-grid" });
			grid.style.display = "grid";
			grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(100px, 1fr))";
			grid.style.gap = "0.25rem";

			for (const col of measureCols) {
				const val = row[col];
				if (typeof val !== "number") continue;

				const card = grid.createDiv({ cls: "ft-stat-card-mini" });
				card.style.textAlign = "center";
				card.style.padding = "0.25rem 0.25rem";
				card.style.background = "var(--background-primary)";
				card.style.borderRadius = "4px";

				const valueEl = card.createDiv({ cls: "ft-text-lg" });
				valueEl.style.fontWeight = "700";
				valueEl.textContent = val.toLocaleString();

				// Conditional formatting: color stat-card text
				const colRules = rules?.filter((r) => r.column === col);
				if (colRules && colRules.length > 0) {
					const color = evaluateConditionalRules(val, colRules);
					if (color) valueEl.style.color = color;
				}

				// Sparkline: show trend across all rows for this measure
				if (showSparkline && result.rows.length >= 3) {
					const sparkValues = result.rows.map((r) => {
						const v = r[col];
						return typeof v === "number" ? v : 0;
					});
					const sparkHost = card.createDiv();
					sparkHost.style.marginTop = "0.25rem";
					ChartRenderer.renderSparkline(sparkHost, sparkValues);
				}

				card.createDiv({ text: col, cls: "ft-text-muted ft-text-xs" });
			}
		}

		if (result.rows.length > MAX_STAT_CARD_GROUPS) {
			const more = wrapper.createDiv({ cls: "ft-text-muted ft-text-xs ft-mt-1 ft-text-center" });
			more.textContent = `and ${result.rows.length - MAX_STAT_CARD_GROUPS} more groups...`;
		}
	}

	private renderTable(container: HTMLElement, result: AnalyticsResult, ctx: TileRenderContext): void {
		const rules = ctx.tile.conditionalRules;

		if (result.rows.length === 0) {
			container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" });
			return;
		}

		// ── Compact aggregate stat cards ─────────────────────
		const numericCols = getNumericColumns(result);
		if (numericCols.length > 0 && result.rows.length > 1) {
			const grid = container.createDiv();
			grid.style.display = "grid";
			grid.style.gridTemplateColumns = `repeat(${Math.min(numericCols.length, 4)}, 1fr)`;
			grid.style.gap = "0.35rem";

			for (const col of numericCols) {
				const sum = result.rows.reduce((acc, r) => {
					const v = r[col];
					return acc + (typeof v === "number" ? v : 0);
				}, 0);

				const card = grid.createDiv();
				card.style.textAlign = "center";
				card.style.padding = "0.35rem 0.25rem";
				card.style.background = "var(--background-primary)";
				card.style.borderRadius = "4px";
				card.style.border = "1px solid var(--background-modifier-border)";

				const valEl = card.createDiv({ cls: "ft-catalog-stat-value" });
				valEl.style.fontSize = "1.1rem";
				valEl.textContent = sum.toLocaleString();

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

		// ── Table ────────────────────────────────────────────
		const table = container.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const col of result.columns) {
			headerRow.createEl("th", { text: col, cls: "ft-text-xs" });
		}

		const tbody = table.createEl("tbody");
		for (const row of result.rows) {
			const tr = tbody.createEl("tr");
			for (const col of result.columns) {
				const val = row[col];
				const td = tr.createEl("td", { cls: "ft-text-sm" });
				td.textContent = typeof val === "number" ? val.toLocaleString() : String(val ?? "");

				if (typeof val === "number") {
					// Apply background tint for matching conditional formatting rules
					if (rules && rules.length > 0) {
						const colRules = rules.filter((r) => r.column === col);
						if (colRules.length > 0) {
							const color = evaluateConditionalRules(val, colRules);
							if (color) {
								td.style.backgroundColor = color;
								td.style.opacity = "0.85";
							}
						}
					}
				} else if (typeof val === "string" && ctx.onDrillDown) {
					// String cells are clickable for drill-down
					td.style.cursor = "pointer";
					td.style.textDecoration = "underline";
					td.style.textDecorationStyle = "dotted";
					td.style.textUnderlineOffset = "3px";

					// Highlight if this value matches an active filter
					const isActive = ctx.activeFilters?.some((f) => f.column === col && f.values.includes(val));
					if (isActive) {
						td.style.color = "var(--text-accent)";
						td.style.fontWeight = "600";
					}

					td.addEventListener("click", () => {
						ctx.onDrillDown!(col, val);
					});
				}
			}
		}
	}
}
