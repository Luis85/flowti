/**
 * Actions bar sub-component for the query builder.
 *
 * Renders Run, Reset, Save, and Export CSV actions.
 * Save button only appears when the query has unsaved changes.
 */

import { setIcon } from "obsidian";
import type { AnalyticsResult, TileDisplayMode } from "../../../domain/analytics/types";

/** Auto-suggest display mode based on result shape. */
export function suggestDisplayMode(result: AnalyticsResult, hasTimeBucket: boolean): TileDisplayMode {
	if (hasTimeBucket) return "line-chart";
	if (result.rows.length <= 5 && result.columns.length <= 3) return "stat-card";
	const numericCols = result.columns.filter((c) => typeof result.rows[0]?.[c] === "number");
	if (result.rows.length > 5 && numericCols.length > 0 && result.groupCount > 1 && result.groupCount <= 12) return "bar-chart";
	return "table";
}

export interface ActionsBarDeps {
	container: HTMLElement;
	running: boolean;
	hasMeasures: boolean;
	hasLoadedSources: boolean;
	lastResult: AnalyticsResult | null;
	isEditing: boolean;
	hasChanges: boolean;
	selectedQueryId: string | null;
	queryName: string;

	onRunQuery: () => void;
	onReset: () => void;
	onSave: () => void;
	onExportCsv: (result: AnalyticsResult) => void;
	onRenderDetail: () => void;
}

export class ActionsBar {
	constructor(private deps: ActionsBarDeps) {}

	render(): void {
		const { container, running, hasMeasures } = this.deps;
		const actions = container.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		// Run
		const runLink = actions.createEl("span", { cls: "ft-nav-link" });
		const runIcon = runLink.createSpan();
		setIcon(runIcon, "play");
		runLink.appendText(running ? " Running..." : " Run Query");
		if (running || !hasMeasures || !this.deps.hasLoadedSources) {
			runLink.style.opacity = "0.4";
			runLink.style.pointerEvents = "none";
		}
		runLink.addEventListener("click", () => this.deps.onRunQuery());

		// Reset
		const clearLink = actions.createEl("span", { cls: "ft-nav-link" });
		const clearIcon = clearLink.createSpan();
		setIcon(clearIcon, "rotate-ccw");
		clearLink.appendText(" Reset");
		clearLink.addEventListener("click", () => this.deps.onReset());

		// Save Query — only when there are unsaved changes
		if (hasMeasures && this.deps.hasChanges) {
			const saveLink = actions.createEl("span", { cls: "ft-nav-link" });
			saveLink.style.cssText = "background:rgba(76,175,80,0.15);color:var(--text-normal);padding:2px 8px;border-radius:4px;font-weight:600";
			const saveIcon = saveLink.createSpan();
			setIcon(saveIcon, "save");
			saveLink.appendText(" Save Query");
			saveLink.addEventListener("click", () => this.deps.onSave());
		}

		// Export CSV (only with results)
		if (hasMeasures && this.deps.lastResult && this.deps.lastResult.rows.length > 0) {
			const csvLink = actions.createEl("span", { cls: "ft-nav-link" });
			const csvIcon = csvLink.createSpan();
			setIcon(csvIcon, "download");
			csvLink.appendText(" Save to CSV");
			csvLink.addEventListener("click", () => {
				if (this.deps.lastResult) this.deps.onExportCsv(this.deps.lastResult);
			});
		}
	}
}
