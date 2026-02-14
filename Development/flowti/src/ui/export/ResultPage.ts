/**
 * Result page for the ExportView wizard.
 * Shows progress, success, error, or skipped states plus "what's next" actions.
 */

import { Notice, setIcon } from "obsidian";
import { STRATEGY_LABELS } from "./types";
import type { ExportComponentDeps } from "./types";

export class ResultPage {
	constructor(
		private container: HTMLElement,
		private deps: ExportComponentDeps,
	) {}

	render(): void {
		const ws = this.container;
		ws.empty();

		const state = this.deps.getState();
		const container = ws.createDiv({ cls: "ft-table-scroll" });

		if (state.exportResult) {
			this.renderExportResult(container);
			return;
		}

		if (state.exportError) {
			this.renderError(container);
			return;
		}

		// ── In-progress state ──
		container.createEl("h3", { text: "Exporting...", cls: "ft-heading ft-heading-sm" });
		const progressContainer = container.createDiv({ cls: "ft-flex-col ft-gap-2 ft-mt-3" });
		progressContainer.createDiv({
			text: "Writing export file...",
			cls: "ft-text-muted",
		});
		const bar = progressContainer.createDiv({ cls: "ft-progress-bar" });
		const fill = bar.createDiv({ cls: "ft-progress-bar-fill" });
		fill.style.width = "100%";
		fill.style.animation = "ft-pulse 1.5s infinite";
	}

	private renderError(container: HTMLElement): void {
		const state = this.deps.getState();

		const headerRow = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		const hIcon = headerRow.createSpan();
		setIcon(hIcon, "x-circle");
		hIcon.style.color = "var(--text-error)";
		headerRow.createEl("h3", { text: "Export Failed", cls: "ft-heading ft-heading-sm" });

		const errorCard = container.createDiv({ cls: "ft-card ft-mt-2" });
		errorCard.style.borderLeft = "3px solid var(--text-error)";
		errorCard.createDiv({ text: "Error", cls: "ft-detail-section-header ft-mb-2" });
		errorCard.createDiv({ text: state.exportError!, cls: "ft-text-sm" });

		this.renderWhatsNextCard(container, true);
	}

	private renderExportResult(container: HTMLElement): void {
		const state = this.deps.getState();
		const r = state.exportResult!;

		// ── Status header ──
		const isSkipped = !!r.skipped;
		const statusIcon = isSkipped ? "minus-circle" : "check-circle";
		const statusText = isSkipped
			? "Export skipped — file already exists"
			: `Successfully exported ${r.totalRows} row${r.totalRows !== 1 ? "s" : ""}`;

		const headerRow = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		const hIcon = headerRow.createSpan();
		setIcon(hIcon, statusIcon);
		if (isSkipped) {
			hIcon.style.color = "var(--text-muted)";
		} else {
			hIcon.style.color = "var(--text-success, var(--interactive-accent))";
		}
		headerRow.createEl("h3", { text: statusText, cls: "ft-heading ft-heading-sm" });

		// ── "What happened" card ──
		const card = container.createDiv({ cls: "ft-card ft-mt-2" });
		card.createDiv({ text: "What happened", cls: "ft-detail-section-header ft-mb-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		const addRow = (label: string, value: string) => {
			grid.createDiv({ text: label, cls: "ft-detail-info-label" });
			grid.createDiv({ text: value, cls: "ft-detail-info-value" });
		};

		if (isSkipped) {
			addRow("Rows exported", "0 (skipped)");
			addRow("Output file", r.outputPath);
			addRow("Reason", "File already exists and conflict strategy was set to \"skip\"");
		} else {
			addRow("Rows exported", String(r.totalRows));
			addRow("Columns", String(r.totalColumns));
			addRow("Output file", r.outputPath);
		}

		addRow("Format", state.format === "tab" ? "Tab-delimited" : "CSV");
		addRow("Conflict strategy", STRATEGY_LABELS[state.conflictStrategy] ?? state.conflictStrategy);

		if (state.loadedConfigId) {
			const cfg = state.savedConfigs.find((c) => c.id === state.loadedConfigId);
			if (cfg) addRow("Config used", cfg.name);
		}

		new Notice(
			isSkipped
				? `Export skipped: ${r.outputPath} already exists`
				: `Export complete: ${r.totalRows} rows written to ${r.outputPath}`,
		);

		// ── "What's next" actions ──
		this.renderWhatsNextCard(container, false);
	}

	private renderWhatsNextCard(container: HTMLElement, isError: boolean): void {
		const state = this.deps.getState();

		const actionsCard = container.createDiv({ cls: "ft-card ft-mt-3" });
		actionsCard.createDiv({ text: "What's next", cls: "ft-detail-section-header ft-mb-2" });
		const actions = actionsCard.createDiv({ cls: "ft-flex ft-gap-2" });
		actions.style.flexWrap = "wrap";

		if (isError) {
			// Retry
			const retryBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
			setIcon(retryBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "refresh-cw");
			retryBtn.appendText(" Retry");
			retryBtn.addEventListener("click", () => {
				this.deps.setState({
					exportResult: null,
					exportError: null,
					currentPage: "result",
				});
				this.deps.renderPage();
				this.deps.runExport();
			});
		} else {
			// Open output file (vault only)
			if (!state.isExternal && state.outputPath) {
				const openOutputBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
				setIcon(openOutputBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "file-output");
				openOutputBtn.appendText(" Open Output");
				openOutputBtn.addEventListener("click", () => {
					void this.deps.app.workspace.openLinkText(state.outputPath, "", false);
				});
			}

			// Open source
			const sourceIcon = state.sourceType === "base" ? "table" : "folder-open";
			const sourceLabel = state.sourceType === "base" ? " Open Source" : " Open Source Folder";
			const openSourceBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
			setIcon(openSourceBtn.createSpan({ cls: "flowti-csv-btn-icon" }), sourceIcon);
			openSourceBtn.appendText(sourceLabel);
			openSourceBtn.addEventListener("click", () => {
				void this.deps.app.workspace.openLinkText(state.sourcePath, "", false);
			});

			// Run again
			const rerunBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
			setIcon(rerunBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "refresh-cw");
			rerunBtn.appendText(" Run Again");
			rerunBtn.addEventListener("click", () => {
				this.deps.setState({
					exportResult: null,
					exportError: null,
					currentPage: "result",
				});
				this.deps.renderPage();
				this.deps.runExport();
			});
		}

		// Edit config
		const editBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(editBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "settings");
		editBtn.appendText(" Edit Config");
		editBtn.addEventListener("click", () => {
			this.deps.setState({
				exportResult: null,
				exportError: null,
				currentPage: "configure",
			});
			this.deps.renderPage();
		});

		// Close
		const closeBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(closeBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "x");
		closeBtn.appendText(" Close");
		closeBtn.addEventListener("click", () => this.deps.detachLeaf());
	}
}
