/**
 * Dashboard inline import executor — progress row, event listeners, auto-dismiss.
 * Extracted from HubDashboard to reduce its LOC.
 */

import { Notice, setIcon } from "obsidian";
import type { SavedImportConfig } from "../../domain/dataExchange/types";
import type { HubComponentDeps } from "./types";

export class DashboardImportExecutor {
	constructor(private deps: HubComponentDeps) {}

	run(cfg: SavedImportConfig, csvPath: string, row: HTMLTableRowElement): void {
		// Remove any existing progress row
		const existing = row.parentElement?.querySelector(".ft-dashboard-progress-row");
		if (existing) existing.remove();

		// Insert a progress row after the triggering row
		const progressRow = document.createElement("tr");
		progressRow.className = "ft-dashboard-progress-row";
		const progressTd = document.createElement("td");
		progressTd.colSpan = 4;
		progressRow.appendChild(progressTd);
		row.after(progressRow);

		const statusRow = progressTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
		const spinnerIcon = statusRow.createSpan();
		setIcon(spinnerIcon, "loader");
		spinnerIcon.style.opacity = "0.6";
		spinnerIcon.addClass("ft-spin");
		const statusText = statusRow.createSpan({ text: `Running "${cfg.name}"...`, cls: "ft-text-sm" });

		const barBg = progressTd.createDiv();
		barBg.style.cssText = "height:3px;background:var(--background-modifier-border);border-radius:2px;overflow:hidden";
		const barFill = barBg.createDiv();
		barFill.style.cssText = "height:100%;width:0%;background:var(--interactive-accent);border-radius:2px;transition:width 0.15s ease";

		// Listen for progress
		const offProgress = this.deps.eventBus.on("dataExchange.import.progress", (event) => {
			const { current, total, lastFilename } = event.payload;
			const pct = total > 0 ? Math.round((current / total) * 100) : 0;
			barFill.style.width = `${pct}%`;
			statusText.textContent = `Importing... ${current} / ${total}`;
			if (lastFilename) {
				statusText.textContent += ` — ${lastFilename}`;
			}
		});

		const cleanup = (success: boolean, message: string) => {
			offProgress();
			progressTd.empty();
			const resultRow = progressTd.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			const icon = resultRow.createSpan();
			setIcon(icon, success ? "check-circle" : "x-circle");
			icon.style.color = success ? "var(--text-success)" : "var(--text-error)";
			resultRow.createSpan({ text: message, cls: "ft-text-sm" });

			// Auto-dismiss after 5s
			setTimeout(() => {
				progressRow.remove();
				if (success) this.deps.scheduleRender();
			}, 5000);
		};

		const offComplete = this.deps.eventBus.on("dataExchange.import.completed", (event) => {
			offComplete();
			offFailed();
			const r = event.payload.result;
			const msg = `Done: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped` +
				(r.failed > 0 ? `, ${r.failed} failed` : "");
			cleanup(true, msg);
			new Notice(msg);
		});
		const offFailed = this.deps.eventBus.on("dataExchange.import.failed", (event) => {
			offComplete();
			offFailed();
			cleanup(false, `Failed: ${event.payload.error}`);
			new Notice(`Import failed: ${event.payload.error}`);
		});

		// Merge noteType into customProperties if set
		const importCustomProps = { ...cfg.customProperties };
		if (cfg.noteType) {
			importCustomProps.type = cfg.noteType;
		}

		void this.deps.eventBus.emit("dataExchange.import.execute", {
			config: {
				sourcePath: csvPath,
				targetFolder: cfg.targetFolder,
				nameColumn: cfg.nameColumn,
				namePrefix: cfg.namePrefix,
				nameSuffix: cfg.nameSuffix,
				columnMappings: cfg.columnMappings,
				conflictStrategy: cfg.conflictStrategy,
				customProperties: Object.keys(importCustomProps).length > 0 ? importCustomProps : undefined,
			},
		});
	}
}
