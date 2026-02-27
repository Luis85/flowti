/**
 * Result page for the CsvActionView import wizard.
 * Shows progress indicator, success result, or error state.
 */

import { setIcon } from "obsidian";
import { revealFolderInExplorer } from "../hub/helpers";
import type { CsvComponentDeps } from "./types";

export class CsvResultPage {
	constructor(
		private container: HTMLElement,
		private deps: CsvComponentDeps,
	) {}

	render(): void {
		const ws = this.container;
		ws.empty();

		const state = this.deps.getState();
		const container = ws.createDiv({ cls: "ft-table-scroll" });

		if (state.importResult) {
			this.renderImportResult(container);
			return;
		}

		if (state.importError) {
			this.renderError(container);
			return;
		}

		// Progress indicator
		container.createEl("h3", { text: "Importing...", cls: "ft-heading ft-heading-sm" });
		container.createDiv({ cls: "ft-import-progress ft-mt-3" });
		this.renderProgressIndicator();
	}

	/** Updates the progress bar without re-rendering the entire page. */
	renderProgressIndicator(): void {
		const progressEl = this.container.querySelector(".ft-import-progress");
		if (!progressEl) return;
		while (progressEl.firstChild) progressEl.removeChild(progressEl.firstChild);

		const state = this.deps.getState();

		const wrapper = document.createElement("div");
		wrapper.className = "ft-flex-col ft-gap-2";

		const label = document.createElement("p");
		label.textContent = `Processing row ${state.importProgress.current} of ${state.importProgress.total}...`;
		wrapper.appendChild(label);

		const bar = document.createElement("div");
		bar.className = "ft-progress-bar";
		const fill = document.createElement("div");
		fill.className = "ft-progress-bar-fill";
		const pct =
			state.importProgress.total > 0
				? (state.importProgress.current / state.importProgress.total) * 100
				: 0;
		fill.style.width = `${pct}%`;
		bar.appendChild(fill);
		wrapper.appendChild(bar);

		progressEl.appendChild(wrapper);
	}

	private renderError(container: HTMLElement): void {
		const state = this.deps.getState();

		const headerRow = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		const hIcon = headerRow.createSpan();
		setIcon(hIcon, "x-circle");
		hIcon.style.color = "var(--text-error)";
		headerRow.createEl("h3", { text: "Import failed", cls: "ft-heading ft-heading-sm" });

		const errorCard = container.createDiv({ cls: "ft-card ft-mt-2" });
		errorCard.style.borderLeft = "3px solid var(--text-error)";
		errorCard.createDiv({ text: "Error", cls: "ft-detail-section-header ft-mb-2" });
		errorCard.createDiv({ text: state.importError!, cls: "ft-text-sm" });

		const actionsCard = container.createDiv({ cls: "ft-card ft-mt-3" });
		actionsCard.createDiv({ text: "What's next", cls: "ft-detail-section-header ft-mb-2" });
		const actions = actionsCard.createDiv({ cls: "ft-flex ft-gap-2" });
		actions.style.flexWrap = "wrap";

		const retryBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
		setIcon(retryBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "refresh-cw");
		retryBtn.appendText(" Retry");
		retryBtn.addEventListener("click", () => {
			this.deps.setState({ importResult: null, importError: null, currentPage: "result" });
			this.deps.renderContent();
			void this.deps.runImport();
		});

		const editBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(editBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "settings");
		editBtn.appendText(" Edit Config");
		editBtn.addEventListener("click", () => {
			this.deps.setState({ importError: null, currentPage: "config" });
			this.deps.renderContent();
		});

		const csvBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(csvBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "file-spreadsheet");
		csvBtn.appendText(" CSV Detail");
		csvBtn.addEventListener("click", () => {
			this.deps.resetImportState();
			this.deps.setState({ currentPage: "landing" });
			this.deps.renderContent();
		});
	}

	private renderImportResult(container: HTMLElement): void {
		const state = this.deps.getState();
		const r = state.importResult!;
		const hasErrors = r.failed > 0;
		const allSkipped = r.skipped === r.totalRows;

		// ── Status header ──
		const statusIcon = hasErrors ? "alert-triangle" : allSkipped ? "minus-circle" : "check-circle";
		const statusText = hasErrors
			? `Import completed with ${r.failed} error${r.failed !== 1 ? "s" : ""}`
			: allSkipped
				? "All rows skipped — notes already exist"
				: `Successfully imported ${r.created + r.updated} note${(r.created + r.updated) !== 1 ? "s" : ""}`;

		const headerRow = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		const hIcon = headerRow.createSpan();
		setIcon(hIcon, statusIcon);
		if (hasErrors) hIcon.style.color = "var(--text-error)";
		else if (!allSkipped) hIcon.style.color = "var(--text-success, var(--interactive-accent))";
		else hIcon.style.color = "var(--text-muted)";
		headerRow.createEl("h3", { text: statusText, cls: "ft-heading ft-heading-sm" });

		// ── Outcome summary card ──
		const card = container.createDiv({ cls: "ft-card ft-mt-2" });
		card.createDiv({ text: "What happened", cls: "ft-detail-section-header ft-mb-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		const addRow = (label: string, value: string, cls?: string) => {
			grid.createDiv({ text: label, cls: "ft-detail-info-label" });
			const v = grid.createDiv({ text: value, cls: "ft-detail-info-value" });
			if (cls) v.addClass(cls);
		};

		addRow("CSV rows processed", String(r.totalRows));
		if (r.created > 0) addRow("Notes created", String(r.created));
		if (r.updated > 0) addRow("Notes updated", String(r.updated));
		if (r.skipped > 0) addRow("Notes skipped", `${r.skipped} (already exist)`);
		if (r.failed > 0) addRow("Failed", String(r.failed), "ft-text-error");
		addRow("Target folder", state.targetFolder);
		addRow("Conflict strategy", state.conflictStrategy);

		// .base file info
		let checkPath = state.basePath.trim();
		if (checkPath && !checkPath.endsWith(".base")) checkPath += ".base";
		if (checkPath && this.deps.app.vault.getAbstractFileByPath(checkPath)) {
			addRow("Base view", checkPath);
		}

		// Loaded config
		if (state.loadedConfigId) {
			const cfg = state.savedConfigs.find((c) => c.id === state.loadedConfigId);
			if (cfg) addRow("Config used", cfg.name);
		}

		// ── Error details ──
		if (r.errors.length > 0) {
			const errorSection = container.createDiv({ cls: "ft-card ft-mt-2" });
			errorSection.style.borderLeft = "3px solid var(--text-error)";
			errorSection.createDiv({ text: `Errors (${r.errors.length})`, cls: "ft-detail-section-header ft-mb-2" });

			const errorList = errorSection.createDiv({ cls: "ft-flex-col ft-gap-1 ft-text-sm" });
			for (const err of r.errors.slice(0, 20)) {
				const row = errorList.createDiv({ cls: "ft-flex ft-gap-2" });
				row.createSpan({ text: `Row ${err.row}`, cls: "ft-text-muted" });
				row.createSpan({ text: err.filename });
				row.createSpan({ text: err.error, cls: "ft-text-error" });
			}
			if (r.errors.length > 20) {
				errorList.createDiv({
					text: `...and ${r.errors.length - 20} more errors`,
					cls: "ft-text-muted ft-mt-1",
				});
			}
		}

		// ── Call to actions ──
		const actionsCard = container.createDiv({ cls: "ft-card ft-mt-3" });
		actionsCard.createDiv({ text: "What's next", cls: "ft-detail-section-header ft-mb-2" });
		const actions = actionsCard.createDiv({ cls: "ft-flex ft-gap-2" });
		actions.style.flexWrap = "wrap";

		// Open target folder
		const openFolderBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(openFolderBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "folder-open");
		openFolderBtn.appendText(" Open Target Folder");
		openFolderBtn.addEventListener("click", () => {
			revealFolderInExplorer(this.deps.app, state.targetFolder);
		});

		// Open .base view if exists
		if (checkPath && this.deps.app.vault.getAbstractFileByPath(checkPath)) {
			const bp = checkPath;
			const openBaseBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
			setIcon(openBaseBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "table");
			openBaseBtn.appendText(" Open Base View");
			openBaseBtn.addEventListener("click", () => {
				void this.deps.app.workspace.openLinkText(bp, "", false);
			});
		}

		// Run again (same config)
		const rerunBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(rerunBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "refresh-cw");
		rerunBtn.appendText(" Run Again");
		rerunBtn.addEventListener("click", () => {
			this.deps.setState({ importResult: null, importError: null, currentPage: "result" });
			this.deps.renderContent();
			void this.deps.runImport();
		});

		// Edit config
		const editBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(editBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "settings");
		editBtn.appendText(" Edit Config");
		editBtn.addEventListener("click", () => {
			this.deps.setState({ importResult: null, importError: null, currentPage: "config" });
			this.deps.renderContent();
		});

		// Back to CSV detail
		const csvBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(csvBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "file-spreadsheet");
		csvBtn.appendText(" CSV Detail");
		csvBtn.addEventListener("click", () => {
			this.deps.resetImportState();
			this.deps.setState({ currentPage: "landing" });
			this.deps.renderContent();
		});
	}
}
