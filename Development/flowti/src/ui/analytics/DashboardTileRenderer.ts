/**
 * Renders a single dashboard tile — either as a results table or stat-card summary.
 *
 * Delegates to AnalyticsResultsPanel for table mode;
 * stat-card mode shows ALL dimension groups as grouped cards.
 */

import { setIcon } from "obsidian";
import type { AnalyticsResult, DashboardTile, SavedAnalyticsQuery, TileDisplayMode, ConditionalRule } from "../../domain/analytics/types";
import { formatRelativeTime, getFreshnessColor, getFreshnessLevel } from "../../domain/analytics/freshnessUtils";
import { evaluateConditionalRules } from "../../domain/analytics/conditionalFormatting";
import { AnalyticsResultsPanel } from "../hub/AnalyticsResultsPanel";
import { ChartRenderer } from "./ChartRenderer";

const DISPLAY_MODE_CYCLE: TileDisplayMode[] = ["table", "stat-card", "line-chart", "bar-chart"];

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
	/** Timestamp of last refresh (for freshness display). */
	refreshedAt?: number;
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

		// ── Header ──────────────────────────────────────
		const header = tileEl.createDiv({ cls: "ft-dashboard-tile-header" });
		header.style.display = "flex";
		header.style.alignItems = "center";
		header.style.justifyContent = "space-between";
		header.style.padding = "0.5rem 0.75rem";
		header.style.borderBottom = "1px solid var(--background-modifier-border)";
		header.style.background = "var(--background-secondary)";

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
		}

		// Freshness badge
		if (ctx.refreshedAt) {
			const level = getFreshnessLevel(ctx.refreshedAt);
			const badge = header.createSpan({
				text: formatRelativeTime(ctx.refreshedAt),
				cls: "ft-text-xs",
			});
			badge.style.color = getFreshnessColor(level);
			badge.style.flexShrink = "0";
			badge.style.marginLeft = "0.5rem";
		} else if (ctx.result) {
			const badge = header.createSpan({ text: "Not yet refreshed", cls: "ft-text-xs ft-text-muted" });
			badge.style.flexShrink = "0";
			badge.style.marginLeft = "0.5rem";
		}

		const actions = header.createDiv();
		actions.style.display = "flex";
		actions.style.alignItems = "center";
		actions.style.gap = "0.25rem";
		actions.style.flexShrink = "0";

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

		// Display mode toggle (cycles: table → stat-card → line-chart → bar-chart)
		if (ctx.onDisplayModeToggle) {
			const toggleBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
			const toggleIcon = toggleBtn.createSpan();
			const curIdx = DISPLAY_MODE_CYCLE.indexOf(ctx.tile.displayMode);
			const nextMode = DISPLAY_MODE_CYCLE[(curIdx + 1) % DISPLAY_MODE_CYCLE.length];
			const modeIcons: Record<TileDisplayMode, string> = { "table": "table", "stat-card": "bar-chart-2", "line-chart": "trending-up", "bar-chart": "bar-chart" };
			setIcon(toggleIcon, modeIcons[nextMode]);
			toggleIcon.style.width = "14px";
			toggleIcon.style.height = "14px";
			toggleBtn.style.cursor = "pointer";
			toggleBtn.setAttribute("aria-label", `Switch to ${nextMode}`);
			toggleBtn.addEventListener("click", (e) => { e.stopPropagation(); ctx.onDisplayModeToggle!(ctx.tile.id, nextMode); });
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

		const removeBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
		const removeIcon = removeBtn.createSpan();
		setIcon(removeIcon, "x");
		removeIcon.style.width = "14px";
		removeIcon.style.height = "14px";
		removeBtn.style.cursor = "pointer";
		removeBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			ctx.onRemove(ctx.tile.id);
		});

		// ── Body ────────────────────────────────────────
		const body = tileEl.createDiv({ cls: "ft-dashboard-tile-body" });
		body.style.flex = "1";
		body.style.overflow = "auto";
		body.style.padding = "0.5rem";

		try {
			if (ctx.error) {
				this.renderError(body, ctx.error);
			} else if (!ctx.query) {
				this.renderError(body, "Query not found — it may have been deleted");
			} else if (!ctx.result) {
				this.renderLoading(body);
			} else if (ctx.tile.displayMode === "stat-card") {
				this.renderStatCard(body, ctx.result, ctx.tile.conditionalRules, ctx.tile.showSparkline !== false);
			} else if (ctx.tile.displayMode === "line-chart") {
				ChartRenderer.renderLineChart(body, ctx.result);
			} else if (ctx.tile.displayMode === "bar-chart") {
				ChartRenderer.renderBarChart(body, ctx.result);
			} else {
				this.renderTable(body, ctx.result, ctx.tile.conditionalRules);
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

	private renderStatCard(container: HTMLElement, result: AnalyticsResult, rules?: ConditionalRule[], showSparkline = true): void {
		if (result.rows.length === 0) {
			container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" });
			return;
		}

		// Identify dimension columns (non-numeric in first row) and measure columns (numeric)
		const measureCols = result.columns.filter((col) => typeof result.rows[0][col] === "number");
		const dimCols = result.columns.filter((col) => typeof result.rows[0][col] !== "number");

		const rowsToShow = Math.min(result.rows.length, MAX_STAT_CARD_GROUPS);

		for (let i = 0; i < rowsToShow; i++) {
			const row = result.rows[i];

			// Dimension label (group header)
			if (dimCols.length > 0) {
				const label = dimCols.map((col) => String(row[col] ?? "")).join(" · ");
				const labelEl = container.createDiv({ cls: "ft-text-sm" });
				labelEl.style.fontWeight = "600";
				labelEl.style.marginTop = i > 0 ? "0.75rem" : "0";
				labelEl.style.marginBottom = "0.25rem";
				labelEl.textContent = label;
			}

			// Stat cards for this group
			const grid = container.createDiv({ cls: "ft-stat-card-grid" });
			grid.style.display = "grid";
			grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(100px, 1fr))";
			grid.style.gap = "0.5rem";

			for (const col of measureCols) {
				const val = row[col];
				if (typeof val !== "number") continue;

				const card = grid.createDiv({ cls: "ft-stat-card-mini" });
				card.style.textAlign = "center";
				card.style.padding = "0.5rem 0.25rem";
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
			const more = container.createDiv({ cls: "ft-text-muted ft-text-xs ft-mt-1 ft-text-center" });
			more.textContent = `and ${result.rows.length - MAX_STAT_CARD_GROUPS} more groups...`;
		}
	}

	private renderTable(container: HTMLElement, result: AnalyticsResult, rules?: ConditionalRule[]): void {
		if (!rules || rules.length === 0) {
			new AnalyticsResultsPanel(container, { result }).render();
			return;
		}

		// Custom table with conditional formatting background tints
		if (result.rows.length === 0) {
			container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" });
			return;
		}

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

				// Apply background tint for matching rules
				if (typeof val === "number") {
					const colRules = rules.filter((r) => r.column === col);
					if (colRules.length > 0) {
						const color = evaluateConditionalRules(val, colRules);
						if (color) {
							td.style.backgroundColor = color;
							td.style.opacity = "0.85";
						}
					}
				}
			}
		}
	}
}
