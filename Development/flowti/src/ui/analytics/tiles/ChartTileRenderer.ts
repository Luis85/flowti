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
import { getNumericColumns } from "../TileSettingsPanel";
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

const CHECKBOX_CSS = "cursor:pointer;accent-color:var(--interactive-accent)";
const LABEL_CSS = "display:inline-flex;align-items:center;gap:3px;cursor:pointer;font-size:var(--font-ui-smaller);user-select:none";

export class ChartTileRenderer implements TileRenderer {
	render(container: HTMLElement, result: AnalyticsResult, ctx: TileRenderContext): void {
		const numericCols = getNumericColumns(result);
		const effectiveCols = resolveEffectiveColumns(ctx, numericCols);

		// Value column selector — checkboxes when multiple numeric columns
		if (numericCols.length > 1 && ctx.onChartValueColumnsChange) {
			const bar = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			bar.style.padding = "0.25rem 0.5rem";
			bar.style.borderBottom = "1px solid var(--background-modifier-border)";
			bar.style.flexWrap = "wrap";

			bar.createSpan({ text: "Values:", cls: "ft-text-xs ft-text-muted" });

			for (const col of numericCols) {
				const lbl = bar.createEl("label");
				lbl.style.cssText = LABEL_CSS;

				const cb = lbl.createEl("input", { type: "checkbox" });
				cb.style.cssText = CHECKBOX_CSS;
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
			const bar = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			bar.style.padding = "0.25rem 0.5rem";
			bar.createSpan({ text: numericCols[0], cls: "ft-text-xs ft-text-muted" });
		}

		const chartHost = container.createDiv();
		chartHost.style.flex = "1";
		chartHost.style.minHeight = "0";
		chartHost.style.paddingBottom = "0.5rem";

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
