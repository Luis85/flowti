/**
 * Results section sub-component.
 *
 * Renders query error messages and the results panel
 * (delegating to AnalyticsResultsPanel).
 */

import type { QueriesSubDeps } from "./types";
import { AnalyticsResultsPanel } from "../../hub/AnalyticsResultsPanel";

export class ResultsSection {
	constructor(
		private container: HTMLElement,
		private deps: QueriesSubDeps,
	) {}

	render(): void {
		const lastError = this.deps.lastError();
		const lastResult = this.deps.lastResult();

		if (lastError) {
			const errCard = this.container.createDiv({ cls: "ft-alert ft-alert-warning ft-mt-3" });
			errCard.createDiv({ text: lastError, cls: "ft-text-sm" });
		}

		if (lastResult) {
			const resultsContainer = this.container.createDiv({ cls: "ft-mt-3" });
			const panel = new AnalyticsResultsPanel(resultsContainer, {
				result: lastResult,
				durationMs: this.deps.lastDurationMs(),
				onExportCsv: (csv) => this.deps.handleExportCsv(csv),
			});
			panel.render();
		}
	}
}
