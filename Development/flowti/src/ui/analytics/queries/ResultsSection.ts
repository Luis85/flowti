/**
 * Results section sub-component.
 *
 * Renders chart visualization (auto-detects multi-series),
 * value column selector, query error messages, and the results table
 * (delegating to AnalyticsResultsPanel).
 */

import { setIcon } from "obsidian";
import type { QueriesSubDeps } from "./types";
import { SELECT_CSS } from "./types";
import type { AnalyticsResult } from "../../../domain/analytics/types";
import { AnalyticsResultsPanel } from "../../hub/AnalyticsResultsPanel";
import { ChartRenderer } from "../ChartRenderer";

export class ResultsSection {
	constructor(
		private container: HTMLElement,
		private deps: QueriesSubDeps,
	) {}

	render(): void {
		const lastError = this.deps.lastError();
		const lastResult = this.deps.lastResult();

		// Error detail (execution summary callout shows the headline)
		if (lastError) {
			const errCard = this.container.createDiv({ cls: "ft-card ft-mt-2" });
			errCard.style.padding = "0.5rem 0.75rem";
			errCard.createDiv({ text: lastError, cls: "ft-text-sm ft-text-muted" });
		}

		// Chart visualization (above table)
		if (lastResult && lastResult.rows.length > 1) {
			this.renderChart(lastResult);
		}

		if (lastResult) {
			const resultsContainer = this.container.createDiv({ cls: "ft-mt-2" });
			const panel = new AnalyticsResultsPanel(resultsContainer, {
				result: lastResult,
				hideStats: true,
			});
			panel.render();
		}
	}

	private renderChart(result: AnalyticsResult): void {
		const section = this.container.createDiv({ cls: "ft-mt-2" });
		section.style.borderBottom = "1px solid var(--background-modifier-border)";
		section.style.paddingBottom = "0.5rem";

		// Header with value column selector + line/bar toggle
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const iconEl = header.createSpan();
		setIcon(iconEl, "bar-chart-2");
		iconEl.style.width = "14px";
		iconEl.style.height = "14px";
		iconEl.style.opacity = "0.6";
		header.createSpan({ text: "Chart", cls: "ft-text-sm ft-text-muted" });

		// Value column selector — only show when multiple numeric columns
		const firstRow = result.rows[0];
		const numericCols = result.columns.filter((c) => typeof firstRow[c] === "number");

		const selectedCol = this.deps.chartValueColumn();
		const effectiveCol = selectedCol && numericCols.includes(selectedCol) ? selectedCol : numericCols[0] ?? null;

		if (numericCols.length > 1) {
			const colSelect = header.createEl("select");
			colSelect.style.cssText = SELECT_CSS + ";flex-shrink:0;max-width:180px";
			for (const col of numericCols) {
				const opt = colSelect.createEl("option");
				opt.value = col;
				opt.textContent = col;
				if (col === effectiveCol) opt.selected = true;
			}
			colSelect.addEventListener("change", () => {
				this.deps.setChartValueColumn(colSelect.value);
				this.deps.renderDetail();
			});
		} else if (numericCols.length === 1) {
			header.createSpan({ text: numericCols[0], cls: "ft-text-xs ft-text-muted" });
		}

		// Spacer to push toggles right
		const spacer = header.createSpan();
		spacer.style.flex = "1";

		const currentMode = this.deps.chartMode();

		const lineBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const lineIcon = lineBtn.createSpan();
		setIcon(lineIcon, "trending-up");
		lineBtn.appendText(" Line");
		lineBtn.style.color = currentMode === "line" ? "var(--text-accent)" : "";

		const barBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const barIcon = barBtn.createSpan();
		setIcon(barIcon, "bar-chart-2");
		barBtn.appendText(" Bar");
		barBtn.style.color = currentMode === "bar" ? "var(--text-accent)" : "";

		lineBtn.addEventListener("click", () => {
			this.deps.setChartMode("line");
			this.deps.renderDetail();
		});
		barBtn.addEventListener("click", () => {
			this.deps.setChartMode("bar");
			this.deps.renderDetail();
		});

		const chartHost = section.createDiv({ cls: "ft-mt-1" });

		if (currentMode === "line") {
			ChartRenderer.renderLineChart(chartHost, result, effectiveCol ?? undefined);
		} else {
			ChartRenderer.renderBarChart(chartHost, result, effectiveCol ?? undefined);
		}
	}
}
