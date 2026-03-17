/**
 * Results section sub-component.
 *
 * Renders chart visualization (auto-detects multi-series),
 * value column selector, query error messages, and the results table
 * (delegating to AnalyticsResultsPanel).
 */

import { setIcon } from "obsidian";
import type { QueriesSubDeps } from "./types";

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
			const errCard = this.container.createDiv({ cls: "ft-card ft-mt-2 ft-results-err-card" });
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
		const section = this.container.createDiv({ cls: "ft-mt-2 ft-results-chart-section" });

		// Header with value column selector + line/bar toggle
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const iconEl = header.createSpan({ cls: "ft-icon-sm ft-opacity-60" });
		setIcon(iconEl, "bar-chart-2");
		header.createSpan({ text: "Chart", cls: "ft-text-sm ft-text-muted" });

		// Value column selector — only show when multiple numeric columns
		const firstRow = result.rows[0];
		const numericCols = result.columns.filter((c) => typeof firstRow[c] === "number");

		const selectedCol = this.deps.chartValueColumn();
		const effectiveCol = selectedCol && numericCols.includes(selectedCol) ? selectedCol : numericCols[0] ?? null;

		if (numericCols.length > 1) {
			const colSelect = header.createEl("select", { cls: "ft-chart-col-select" });
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
		header.createSpan({ cls: "ft-flex-1" });

		const currentMode = this.deps.chartMode();

		const lineBtn = header.createEl("span", { cls: `ft-nav-link ft-text-sm${currentMode === "line" ? " ft-text-accent" : ""}` });
		const lineIcon = lineBtn.createSpan();
		setIcon(lineIcon, "trending-up");
		lineBtn.appendText(" Line");

		const barBtn = header.createEl("span", { cls: `ft-nav-link ft-text-sm${currentMode === "bar" ? " ft-text-accent" : ""}` });
		const barIcon = barBtn.createSpan();
		setIcon(barIcon, "bar-chart-2");
		barBtn.appendText(" Bar");

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
