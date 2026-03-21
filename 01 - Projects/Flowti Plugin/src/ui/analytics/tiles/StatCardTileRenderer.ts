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
		if (result.rows.length === 0) {
			container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" });
			return;
		}

		const wrapper = container.createDiv({ cls: "ft-stat-wrapper" });
		const measureCols = result.columns.filter((col) => typeof result.rows[0][col] === "number");
		const dimCols = result.columns.filter((col) => typeof result.rows[0][col] !== "number");
		const rowsToShow = Math.min(result.rows.length, MAX_STAT_CARD_GROUPS);

		for (let i = 0; i < rowsToShow; i++) {
			if (dimCols.length > 0) this.renderDimLabel(wrapper, result.rows[i], dimCols, i, ctx);
			this.renderMeasureCards(wrapper, result.rows[i], measureCols, result, ctx);
		}

		if (result.rows.length > MAX_STAT_CARD_GROUPS) {
			wrapper.createDiv({ text: `and ${result.rows.length - MAX_STAT_CARD_GROUPS} more groups...`, cls: "ft-text-muted ft-text-xs ft-mt-1 ft-text-center" });
		}
	}

	private renderDimLabel(wrapper: HTMLElement, row: Record<string, unknown>, dimCols: string[], index: number, ctx: TileRenderContext): void {
		const label = dimCols.map((col) => String(row[col] ?? "")).join(" \u00B7 ");
		const drillable = (ctx.onCrossTileFilter || ctx.onDrillDown) && dimCols.length === 1;
		const labelCls = ["ft-text-sm", "ft-stat-dim-label"];
		if (index > 0) labelCls.push("ft-stat-dim-label-gap");
		if (drillable) labelCls.push("ft-stat-dim-drillable");
		const labelEl = wrapper.createDiv({ cls: labelCls.join(" ") });
		labelEl.textContent = label;
		if (drillable) {
			const col = dimCols[0];
			const val = String(row[col] ?? "");
			if (ctx.activeFilters?.some((f) => f.column === col && f.values.includes(val))) labelEl.addClass("ft-text-accent");
			labelEl.addEventListener("click", () => {
				if (ctx.onCrossTileFilter) ctx.onCrossTileFilter(ctx.tile.id, col, val);
				else ctx.onDrillDown!(col, val);
			});
		}
	}

	private renderMeasureCards(wrapper: HTMLElement, row: Record<string, unknown>, measureCols: string[], result: AnalyticsResult, ctx: TileRenderContext): void {
		const rules = ctx.tile.conditionalRules;
		const showSparkline = ctx.tile.showSparkline !== false;
		const grid = wrapper.createDiv({ cls: "ft-stat-card-grid ft-stat-grid" });
		for (const col of measureCols) {
			const val = row[col];
			if (typeof val !== "number") continue;
			const card = grid.createDiv({ cls: "ft-stat-card-mini ft-stat-card" });
			const valueEl = card.createDiv({ cls: "ft-text-lg ft-stat-value" });
			valueEl.textContent = fmtNum(val, ctx, result.columnTypeHints, col);
			const colRules = rules?.filter((r) => r.column === col);
			if (colRules && colRules.length > 0) {
				const color = evaluateConditionalRules(val, colRules);
				if (color) valueEl.style.color = color;
			}
			if (showSparkline && result.rows.length >= 3) {
				const sparkValues = result.rows.map((r) => { const v = r[col]; return typeof v === "number" ? v : 0; });
				ChartRenderer.renderSparkline(card.createDiv({ cls: "ft-stat-sparkline-host" }), sparkValues);
			}
			card.createDiv({ text: col, cls: "ft-text-muted ft-text-xs" });
		}
	}
}
