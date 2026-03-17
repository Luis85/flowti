/**
 * Chart tile sub-renderer — value column selector + delegates to ChartRenderer.
 *
 * Handles line-chart, bar-chart, area-chart display modes.
 * Pie-chart is dispatched directly by the factory (no value selector).
 *
 * Extracted from DashboardTileRenderer (PBI-ANA-141, Cycle 44).
 */

import type { AnalyticsResult } from "../../../domain/analytics/types";
import { ChartRenderer, type ChartOptions } from "../ChartRenderer";
import { getNumericColumns } from "../dashboardUtils";
import type { TileRenderer, TileRenderContext } from "./types";

/** Resolve effective columns from tile config, validated against available numeric columns. */
function resolveEffectiveColumns(ctx: TileRenderContext, numericCols: string[]): string[] {
	// Prefer chartValueColumns (multi-select) over chartValueColumn (legacy single-select)
	const stored = ctx.tile.chartValueColumns;
	if (stored && stored.length > 0) {
		const valid = stored.filter((c) => numericCols.includes(c));
		return valid.length > 0 ? valid : [numericCols[0]].filter(Boolean);
	}
	// Legacy fallback
	const single = ctx.tile.chartValueColumn;
	if (single && numericCols.includes(single)) return [single];
	return numericCols.length > 0 ? [numericCols[0]] : [];
}

export class ChartTileRenderer implements TileRenderer {
	render(container: HTMLElement, result: AnalyticsResult, ctx: TileRenderContext): void {
		const numericCols = getNumericColumns(result);
		const effectiveCols = resolveEffectiveColumns(ctx, numericCols);

		// Value column selector — checkboxes when multiple numeric columns
		if (numericCols.length > 1 && ctx.onChartValueColumnsChange) {
			const bar = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-chart-col-bar" });

			bar.createSpan({ text: "Values:", cls: "ft-text-xs ft-text-muted" });

			for (const col of numericCols) {
				const lbl = bar.createEl("label", { cls: "ft-chart-checkbox-label" });

				const cb = lbl.createEl("input", { type: "checkbox", cls: "ft-chart-checkbox" });
				cb.checked = effectiveCols.includes(col);
				cb.addEventListener("change", () => {
					const next = numericCols.filter((c) => {
						if (c === col) return cb.checked;
						return effectiveCols.includes(c);
					});
					// Ensure at least one column remains selected
					if (next.length === 0) { cb.checked = true; return; }
					ctx.onChartValueColumnsChange!(ctx.tile.id, next);
				});

				lbl.appendText(col);
			}
		} else if (numericCols.length === 1) {
			const bar = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-chart-col-bar-single" });
			bar.createSpan({ text: numericCols[0], cls: "ft-text-xs ft-text-muted" });
		}

		const chartHost = container.createDiv({ cls: "ft-chart-host" });

		const singleCol = effectiveCols[0];
		const multiCols = effectiveCols.length > 1 ? effectiveCols : undefined;

		// Build chart options with hidden series toggle support
		const opts: ChartOptions = {
			valueColumns: multiCols,
			hiddenSeries: ctx.tile.hiddenSeries,
			onToggleSeries: ctx.onHiddenSeriesChange
				? (seriesName) => {
					const current = ctx.tile.hiddenSeries ?? [];
					const next = current.includes(seriesName)
						? current.filter((s) => s !== seriesName)
						: [...current, seriesName];
					ctx.onHiddenSeriesChange!(ctx.tile.id, next);
				}
				: undefined,
		};

		if (ctx.tile.displayMode === "line-chart") {
			ChartRenderer.renderLineChart(chartHost, result, singleCol, opts);
		} else if (ctx.tile.displayMode === "area-chart") {
			ChartRenderer.renderAreaChart(chartHost, result, singleCol, opts);
		} else {
			ChartRenderer.renderBarChart(chartHost, result, singleCol, opts);
		}
	}
}

/** Pie chart sub-renderer — simple delegation, no value column selector. */
export class PieChartTileRenderer implements TileRenderer {
	render(container: HTMLElement, result: AnalyticsResult, ctx: TileRenderContext): void {
		ChartRenderer.renderPieChart(container, result, ctx.tile.chartValueColumn);
	}
}
