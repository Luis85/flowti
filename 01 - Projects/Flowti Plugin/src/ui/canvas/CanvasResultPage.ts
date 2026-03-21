/**
 * Result page for the Canvas Action View import wizard.
 * Shows progress indicator during import, then "What happened" summary with
 * per-type breakdown, error details, artifact links, and "What's next" actions.
 */

import { TFile, setIcon } from "obsidian";
import { TYPE_ORDER } from "../../domain/canvas/types";
import { revealFolderInExplorer } from "../hub/helpers";
import type { CanvasImportResult } from "../../domain/canvas/types";
import type { CanvasComponentDeps } from "./types";

export class CanvasResultPage {
	constructor(
		private container: HTMLElement,
		private deps: CanvasComponentDeps,
	) {}

	render(): void {
		const ws = this.container;
		ws.empty();

		const state = this.deps.getState();
		const container = ws.createDiv({ cls: "ft-table-scroll" });

		if (state.importDone) {
			if (state.importSuccess) {
				this.renderSuccess(container);
			} else {
				this.renderError(container);
			}
			return;
		}

		// Progress indicator
		container.createEl("h3", { text: "Importing...", cls: "ft-heading ft-heading-sm" });
		container.createEl("p", {
			text: "Importing canvas nodes as vault notes. This may take a moment.",
			cls: "ft-text-muted",
		});
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

		const pct = state.importProgress.total > 0
			? Math.round((state.importProgress.current / state.importProgress.total) * 100)
			: 0;

		const label = document.createElement("p");
		label.className = "ft-text-sm";
		label.textContent = state.importProgress.total > 0
			? `Processing node ${state.importProgress.current} of ${state.importProgress.total} (${pct}%)` +
				(state.importProgress.title ? ` — ${state.importProgress.title}` : "")
			: "Starting...";
		wrapper.appendChild(label);

		const bar = document.createElement("div");
		bar.className = "ft-progress-bar";
		const fill = document.createElement("div");
		fill.className = "ft-progress-bar-fill";
		fill.style.width = `${pct}%`;
		bar.appendChild(fill);
		wrapper.appendChild(bar);

		progressEl.appendChild(wrapper);
	}

	private renderSuccess(container: HTMLElement): void {
		const state = this.deps.getState();
		const result = state.importResult;
		this.renderSuccessHeader(container, result, state);
		this.renderWhatHappened(container, result, state);
		if (result && result.imported > 0) this.renderTypeBreakdown(container, result, state);
		if (result && result.errors.length > 0) this.renderErrorDetails(container, result);
		this.renderArtifacts(container, state);
		this.renderSuccessActions(container, result, state);
	}

	private renderSuccessHeader(container: HTMLElement, result: CanvasImportResult | null, state: ReturnType<typeof this.deps.getState>): void {
		const hasErrors = result ? result.errors.length > 0 : false;
		const allSkipped = result ? result.skipped === result.totalNodes : false;
		const statusIcon = hasErrors ? "alert-triangle" : allSkipped ? "minus-circle" : "check-circle";
		const statusText = hasErrors
			? `Import completed with ${result!.errors.length} error${result!.errors.length !== 1 ? "s" : ""}`
			: allSkipped ? "All nodes skipped \u2014 notes already exist" : "Import Complete";
		const headerRow = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		const hIcon = headerRow.createSpan();
		setIcon(hIcon, statusIcon);
		if (hasErrors) hIcon.addClass("ft-text-error");
		else if (allSkipped) hIcon.addClass("ft-text-muted");
		else hIcon.addClass("ft-text-success-color");
		headerRow.createEl("h3", { text: statusText, cls: "ft-heading ft-heading-sm" });
	}

	private renderWhatHappened(container: HTMLElement, result: CanvasImportResult | null, state: ReturnType<typeof this.deps.getState>): void {
		const card = container.createDiv({ cls: "ft-card ft-mt-2" });
		card.createDiv({ text: "What happened", cls: "ft-detail-section-header ft-mb-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });
		if (!result) { card.createDiv({ text: state.importMessage, cls: "ft-text-sm ft-p-3" }); return; }
		this.addRow(grid, "Nodes processed", String(result.totalNodes));
		if (result.imported > 0) this.addRow(grid, "Notes created", String(result.imported));
		if (result.skipped > 0) this.addRow(grid, "Notes skipped", `${result.skipped} (already exist)`);
		if (result.errors.length > 0) {
			grid.createDiv({ text: "Errors", cls: "ft-detail-info-label ft-text-error" });
			grid.createDiv({ text: String(result.errors.length), cls: "ft-detail-info-value ft-text-error" });
		}
		if (state.excludedTypes.length > 0) this.addRow(grid, "Excluded types", state.excludedTypes.join(", "));
		this.addRow(grid, "Duration", `${result.duration}ms`);
		this.addRow(grid, "Target folder", result.targetFolder);
		if (state.configName) this.addRow(grid, "Config", state.configName);
	}

	private renderTypeBreakdown(container: HTMLElement, result: NonNullable<ReturnType<typeof this.deps.getState>["importResult"]>, state: ReturnType<typeof this.deps.getState>): void {
		const typeCounts = new Map<string, { imported: number; skipped: number; errors: number }>();
		for (const path of Object.values(result.importedPaths)) {
			const previewItem = state.previewItems.find((i) => path.includes(i.title.replace(/[#":/\\|?*<>]/g, "").trim()));
			const type = previewItem?.type ?? "Unknown";
			const entry = typeCounts.get(type) ?? { imported: 0, skipped: 0, errors: 0 };
			entry.imported++;
			typeCounts.set(type, entry);
		}
		for (const err of result.errors) {
			const previewItem = state.previewItems.find((i) => i.id === err.nodeId);
			const type = previewItem?.type ?? "Unknown";
			const entry = typeCounts.get(type) ?? { imported: 0, skipped: 0, errors: 0 };
			entry.errors++;
			typeCounts.set(type, entry);
		}
		if (typeCounts.size <= 1) return;
		const typeSection = container.createDiv({ cls: "ft-card ft-mt-2" });
		typeSection.createDiv({ text: "Per-type breakdown", cls: "ft-detail-section-header ft-mb-2" });
		const table = typeSection.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("tr");
		thead.createEl("th", { text: "Type" }); thead.createEl("th", { text: "Imported" }); thead.createEl("th", { text: "Errors" });
		const sorted = [...typeCounts.entries()].sort((a, b) => (TYPE_ORDER[a[0]] ?? 98) - (TYPE_ORDER[b[0]] ?? 98));
		for (const [type, counts] of sorted) {
			const tr = table.createEl("tr");
			tr.createEl("td", { text: type, cls: "ft-text-sm" });
			tr.createEl("td", { text: String(counts.imported), cls: "ft-text-sm" });
			const errTd = tr.createEl("td", { text: String(counts.errors), cls: "ft-text-sm" });
			if (counts.errors > 0) errTd.addClass("ft-text-error");
		}
	}

	private renderErrorDetails(container: HTMLElement, result: NonNullable<ReturnType<typeof this.deps.getState>["importResult"]>): void {
		const errorSection = container.createDiv({ cls: "ft-card ft-mt-2 ft-result-error-border" });
		errorSection.createDiv({ text: `Errors (${result.errors.length})`, cls: "ft-detail-section-header ft-mb-2" });
		const errorList = errorSection.createDiv({ cls: "ft-flex-col ft-gap-1 ft-text-sm" });
		for (const err of result.errors.slice(0, 20)) {
			const row = errorList.createDiv({ cls: "ft-flex ft-gap-2" });
			row.createSpan({ text: err.title || err.nodeId, cls: "ft-font-medium" });
			row.createSpan({ text: err.error, cls: "ft-text-error" });
		}
		if (result.errors.length > 20) {
			errorList.createDiv({ text: `...and ${result.errors.length - 20} more errors`, cls: "ft-text-muted ft-mt-1" });
		}
	}

	private renderArtifacts(container: HTMLElement, state: ReturnType<typeof this.deps.getState>): void {
		const { canvasPath, basePath } = state.artifactPaths;
		if (!canvasPath && !basePath) return;
		const artifactSection = container.createDiv({ cls: "ft-card ft-mt-2" });
		artifactSection.createDiv({ text: "Artifacts", cls: "ft-detail-section-header ft-mb-2" });
		const artifactGrid = artifactSection.createDiv({ cls: "ft-detail-info-grid" });
		if (canvasPath) this.renderArtifactLink(artifactGrid, "Rebuilt canvas", canvasPath);
		if (basePath) this.renderArtifactLink(artifactGrid, "Base index", basePath);
	}

	private renderArtifactLink(grid: HTMLElement, label: string, path: string): void {
		const file = this.deps.app.vault.getAbstractFileByPath(path);
		grid.createDiv({ text: label, cls: "ft-detail-info-label" });
		const val = grid.createDiv({ cls: "ft-detail-info-value" });
		if (file instanceof TFile) {
			const link = val.createEl("span", { text: path, cls: "ft-nav-link ft-text-sm" });
			link.addEventListener("click", () => { void this.deps.app.workspace.getLeaf(false).openFile(file); });
		} else {
			val.createSpan({ text: path, cls: "ft-text-sm ft-text-muted" });
		}
	}

	private renderSuccessActions(container: HTMLElement, result: CanvasImportResult | null, state: ReturnType<typeof this.deps.getState>): void {
		const actionsCard = container.createDiv({ cls: "ft-card ft-mt-3" });
		actionsCard.createDiv({ text: "What's next", cls: "ft-detail-section-header ft-mb-2" });
		const actions = actionsCard.createDiv({ cls: "ft-flex ft-gap-2 ft-flex-wrap" });
		const { canvasPath, basePath } = state.artifactPaths;
		if (result) this.addActionBtn(actions, "folder-open", "Open Target Folder", () => revealFolderInExplorer(this.deps.app, result.targetFolder));
		if (canvasPath) { const f = this.deps.app.vault.getAbstractFileByPath(canvasPath); if (f instanceof TFile) this.addActionBtn(actions, "layout-dashboard", "Open Canvas", () => void this.deps.app.workspace.getLeaf(false).openFile(f)); }
		if (basePath) { const f = this.deps.app.vault.getAbstractFileByPath(basePath); if (f instanceof TFile) this.addActionBtn(actions, "table", "Open Base View", () => void this.deps.app.workspace.getLeaf(false).openFile(f)); }
		this.addActionBtn(actions, "refresh-cw", "Run Again", () => { this.deps.setState({ importDone: false, importResult: null, importMessage: "", artifactPaths: {}, currentPage: "result" }); this.deps.renderContent(); void this.deps.runImport(); });
		this.addActionBtn(actions, "settings", "Edit Config", () => { this.deps.setState({ importDone: false, importResult: null, importMessage: "", artifactPaths: {}, currentPage: "config" }); this.deps.renderContent(); });
		this.addActionBtn(actions, "x", "Close", () => this.deps.detachLeaf());
	}

	private addActionBtn(container: HTMLElement, icon: string, label: string, onClick: () => void): void {
		const btn = container.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(btn.createSpan({ cls: "flowti-csv-btn-icon" }), icon);
		btn.appendText(` ${label}`);
		btn.addEventListener("click", onClick);
	}

	private renderError(container: HTMLElement): void {
		const headerRow = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		const hIcon = headerRow.createSpan();
		setIcon(hIcon, "x-circle");
		hIcon.addClass("ft-text-error");
		headerRow.createEl("h3", { text: "Import failed", cls: "ft-heading ft-heading-sm" });

		const card = container.createDiv({ cls: "ft-card ft-mt-2 ft-result-error-border" });
		card.createDiv({ text: "Error", cls: "ft-detail-section-header ft-mb-2" });
		card.createDiv({ text: this.deps.getState().importMessage, cls: "ft-text-sm" });

		// ── "What's next" actions ──
		const actionsCard = container.createDiv({ cls: "ft-card ft-mt-3" });
		actionsCard.createDiv({ text: "What's next", cls: "ft-detail-section-header ft-mb-2" });
		const actions = actionsCard.createDiv({ cls: "ft-flex ft-gap-2 ft-flex-wrap" });

		const retryBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
		setIcon(retryBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "refresh-cw");
		retryBtn.appendText(" Retry");
		retryBtn.addEventListener("click", () => {
			this.deps.setState({
				importDone: false, importResult: null, importMessage: "",
				artifactPaths: {}, currentPage: "result",
			});
			this.deps.renderContent();
			void this.deps.runImport();
		});

		const editBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(editBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "settings");
		editBtn.appendText(" Edit Config");
		editBtn.addEventListener("click", () => {
			this.deps.setState({
				importDone: false, importResult: null, importMessage: "",
				artifactPaths: {}, currentPage: "config",
			});
			this.deps.renderContent();
		});

		const closeBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(closeBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "x");
		closeBtn.appendText(" Close");
		closeBtn.addEventListener("click", () => this.deps.detachLeaf());
	}

	private addRow(grid: HTMLElement, label: string, value: string): void {
		grid.createDiv({ text: label, cls: "ft-detail-info-label" });
		grid.createDiv({ text: value, cls: "ft-detail-info-value" });
	}
}
