/**
 * Stat-card tile sub-renderer — KPI values, sparklines, and drill-down.
 *
 * Extracted from DashboardTileRenderer (PBI-ANA-141, Cycle 44).
 */

import type { AnalyticsResult } from "../../../domain/analytics/types";
import { evaluateConditionalRules } from "../../../domain/analytics/conditionalFormatting";
import { ChartRenderer } from "../ChartRenderer";
import type { TileRenderer, TileRenderContext } from "./types";
import { fmtNum } from "./types";

const MAX_STAT_CARD_GROUPS = 20;

export class StatCardTileRenderer implements TileRenderer {
	render(container: HTMLElement, result: AnalyticsResult, ctx: TileRenderContext): void {
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
				const label = dimCols.map((col) => String(row[col] ?? "")).join(" \u00B7 ");
				const labelEl = wrapper.createDiv({ cls: "ft-text-sm" });
				labelEl.style.fontWeight = "600";
				labelEl.style.marginTop = i > 0 ? "0.4rem" : "0";
				labelEl.style.marginBottom = "0.15rem";
				labelEl.textContent = label;

				// Drill-down: click dimension label to filter
				if ((ctx.onCrossTileFilter || ctx.onDrillDown) && dimCols.length === 1) {
					const col = dimCols[0];
					const val = String(row[col] ?? "");
					labelEl.style.cursor = "pointer";
					labelEl.style.textDecoration = "underline";
					labelEl.style.textDecorationStyle = "dotted";
					labelEl.style.textUnderlineOffset = "3px";

					const isActive = ctx.activeFilters?.some((f) => f.column === col && f.values.includes(val));
					if (isActive) {
						labelEl.style.color = "var(--text-accent)";
					}

					labelEl.addEventListener("click", () => {
						if (ctx.onCrossTileFilter) {
							ctx.onCrossTileFilter(ctx.tile.id, col, val);
						} else {
							ctx.onDrillDown!(col, val);
						}
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
				valueEl.textContent = fmtNum(val, ctx, result.columnTypeHints, col);

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
					sparkHost.style.cssText = "margin-top:0.25rem;display:flex;justify-content:center";
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
}
