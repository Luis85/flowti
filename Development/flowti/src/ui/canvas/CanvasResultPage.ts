/**
 * Result page for the Canvas Action View import wizard.
 * Shows progress indicator during import, then "What happened" summary with
 * per-type breakdown, error details, artifact links, and "What's next" actions.
 */

import { TFile, setIcon } from "obsidian";
import { TYPE_ORDER } from "../../domain/canvas/types";
import { revealFolderInExplorer } from "../hub/helpers";
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
		const hasErrors = result ? result.errors.length > 0 : false;
		const allSkipped = result ? result.skipped === result.totalNodes : false;

		// ── Status header ──
		const statusIcon = hasErrors ? "alert-triangle" : allSkipped ? "minus-circle" : "check-circle";
		const statusText = hasErrors
			? `Import completed with ${result!.errors.length} error${result!.errors.length !== 1 ? "s" : ""}`
			: allSkipped
				? "All nodes skipped — notes already exist"
				: "Import Complete";
		const headerRow = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		const hIcon = headerRow.createSpan();
		setIcon(hIcon, statusIcon);
		if (hasErrors) hIcon.addClass("ft-text-error-color");
		else if (allSkipped) hIcon.addClass("ft-text-muted");
		else hIcon.addClass("ft-text-success-color");
		headerRow.createEl("h3", { text: statusText, cls: "ft-heading ft-heading-sm" });

		// ── "What happened" card ──
		const card = container.createDiv({ cls: "ft-card ft-mt-2" });
		card.createDiv({ text: "What happened", cls: "ft-detail-section-header ft-mb-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		if (result) {
			this.addRow(grid, "Nodes processed", String(result.totalNodes));
			if (result.imported > 0) this.addRow(grid, "Notes created", String(result.imported));
			if (result.skipped > 0) this.addRow(grid, "Notes skipped", `${result.skipped} (already exist)`);
			if (result.errors.length > 0) {
				grid.createDiv({ text: "Errors", cls: "ft-detail-info-label ft-text-error-color" });
				grid.createDiv({ text: String(result.errors.length), cls: "ft-detail-info-value ft-text-error-color" });
			}

			// Excluded by type
			const excludedCount = state.excludedTypes.length;
			if (excludedCount > 0) {
				this.addRow(grid, "Excluded types", state.excludedTypes.join(", "));
			}

			this.addRow(grid, "Duration", `${result.duration}ms`);
			this.addRow(grid, "Target folder", result.targetFolder);

			if (state.configName) this.addRow(grid, "Config", state.configName);
		} else {
			// Fallback to legacy message
			card.createDiv({ text: state.importMessage, cls: "ft-text-sm ft-p-3" });
		}

		// ── Per-type breakdown ──
		if (result && result.imported > 0) {
			const typeCounts = new Map<string, { imported: number; skipped: number; errors: number }>();
			// Count imported items from importedPaths
			for (const path of Object.values(result.importedPaths)) {
				// We don't have per-item type in the result, but we have preview items
				const previewItem = state.previewItems.find(
					(i) => path.includes(i.title.replace(/[#":/\\|?*<>]/g, "").trim()),
				);
				const type = previewItem?.type ?? "Unknown";
				const entry = typeCounts.get(type) ?? { imported: 0, skipped: 0, errors: 0 };
				entry.imported++;
				typeCounts.set(type, entry);
			}
			// Count errors
			for (const err of result.errors) {
				const previewItem = state.previewItems.find((i) => i.id === err.nodeId);
				const type = previewItem?.type ?? "Unknown";
				const entry = typeCounts.get(type) ?? { imported: 0, skipped: 0, errors: 0 };
				entry.errors++;
				typeCounts.set(type, entry);
			}

			if (typeCounts.size > 1) {
				const typeSection = container.createDiv({ cls: "ft-card ft-mt-2" });
				typeSection.createDiv({ text: "Per-type breakdown", cls: "ft-detail-section-header ft-mb-2" });
				const table = typeSection.createEl("table", { cls: "ft-preview-table" });
				const thead = table.createEl("tr");
				thead.createEl("th", { text: "Type" });
				thead.createEl("th", { text: "Imported" });
				thead.createEl("th", { text: "Errors" });

				const sorted = [...typeCounts.entries()].sort(
					(a, b) => (TYPE_ORDER[a[0]] ?? 98) - (TYPE_ORDER[b[0]] ?? 98),
				);
				for (const [type, counts] of sorted) {
					const tr = table.createEl("tr");
					tr.createEl("td", { text: type, cls: "ft-text-sm" });
					tr.createEl("td", { text: String(counts.imported), cls: "ft-text-sm" });
					const errTd = tr.createEl("td", { text: String(counts.errors), cls: "ft-text-sm" });
					if (counts.errors > 0) errTd.addClass("ft-text-error-color");
				}
			}
		}

		// ── Error details ──
		if (result && result.errors.length > 0) {
			const errorSection = container.createDiv({ cls: "ft-card ft-mt-2 ft-result-error-border" });
			errorSection.createDiv({ text: `Errors (${result.errors.length})`, cls: "ft-detail-section-header ft-mb-2" });

			const errorList = errorSection.createDiv({ cls: "ft-flex-col ft-gap-1 ft-text-sm" });
			for (const err of result.errors.slice(0, 20)) {
				const row = errorList.createDiv({ cls: "ft-flex ft-gap-2" });
				row.createSpan({ text: err.title || err.nodeId, cls: "ft-font-medium" });
				row.createSpan({ text: err.error, cls: "ft-text-error" });
			}
			if (result.errors.length > 20) {
				errorList.createDiv({
					text: `...and ${result.errors.length - 20} more errors`,
					cls: "ft-text-muted ft-mt-1",
				});
			}
		}

		// ── Artifacts created ──
		const { canvasPath, basePath } = state.artifactPaths;
		if (canvasPath || basePath) {
			const artifactSection = container.createDiv({ cls: "ft-card ft-mt-2" });
			artifactSection.createDiv({ text: "Artifacts", cls: "ft-detail-section-header ft-mb-2" });
			const artifactGrid = artifactSection.createDiv({ cls: "ft-detail-info-grid" });

			if (canvasPath) {
				const file = this.deps.app.vault.getAbstractFileByPath(canvasPath);
				artifactGrid.createDiv({ text: "Rebuilt canvas", cls: "ft-detail-info-label" });
				const val = artifactGrid.createDiv({ cls: "ft-detail-info-value" });
				if (file instanceof TFile) {
					const link = val.createEl("span", { text: canvasPath, cls: "ft-nav-link ft-text-sm" });
					link.addEventListener("click", () => {
						void this.deps.app.workspace.getLeaf(false).openFile(file);
					});
				} else {
					val.createSpan({ text: canvasPath, cls: "ft-text-sm ft-text-muted" });
				}
			}

			if (basePath) {
				const file = this.deps.app.vault.getAbstractFileByPath(basePath);
				artifactGrid.createDiv({ text: "Base index", cls: "ft-detail-info-label" });
				const val = artifactGrid.createDiv({ cls: "ft-detail-info-value" });
				if (file instanceof TFile) {
					const link = val.createEl("span", { text: basePath, cls: "ft-nav-link ft-text-sm" });
					link.addEventListener("click", () => {
						void this.deps.app.workspace.getLeaf(false).openFile(file);
					});
				} else {
					val.createSpan({ text: basePath, cls: "ft-text-sm ft-text-muted" });
				}
			}
		}

		// ── "What's next" actions ──
		const actionsCard = container.createDiv({ cls: "ft-card ft-mt-3" });
		actionsCard.createDiv({ text: "What's next", cls: "ft-detail-section-header ft-mb-2" });
		const actions = actionsCard.createDiv({ cls: "ft-flex ft-gap-2 ft-flex-wrap" });

		// Open target folder
		if (result) {
			const openFolderBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
			setIcon(openFolderBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "folder-open");
			openFolderBtn.appendText(" Open Target Folder");
			openFolderBtn.addEventListener("click", () => {
				revealFolderInExplorer(this.deps.app, result.targetFolder);
			});
		}

		// Open rebuilt canvas (if exists)
		if (canvasPath) {
			const file = this.deps.app.vault.getAbstractFileByPath(canvasPath);
			if (file instanceof TFile) {
				const openCanvasBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
				setIcon(openCanvasBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "layout-dashboard");
				openCanvasBtn.appendText(" Open Canvas");
				openCanvasBtn.addEventListener("click", () => {
					void this.deps.app.workspace.getLeaf(false).openFile(file);
				});
			}
		}

		// Open .base view (if exists)
		if (basePath) {
			const file = this.deps.app.vault.getAbstractFileByPath(basePath);
			if (file instanceof TFile) {
				const openBaseBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
				setIcon(openBaseBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "table");
				openBaseBtn.appendText(" Open Base View");
				openBaseBtn.addEventListener("click", () => {
					void this.deps.app.workspace.getLeaf(false).openFile(file);
				});
			}
		}

		// Run again
		const rerunBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(rerunBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "refresh-cw");
		rerunBtn.appendText(" Run Again");
		rerunBtn.addEventListener("click", () => {
			this.deps.setState({
				importDone: false, importResult: null, importMessage: "",
				artifactPaths: {}, currentPage: "result",
			});
			this.deps.renderContent();
			void this.deps.runImport();
		});

		// Edit config
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

		// Close
		const closeBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(closeBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "x");
		closeBtn.appendText(" Close");
		closeBtn.addEventListener("click", () => this.deps.detachLeaf());
	}

	private renderError(container: HTMLElement): void {
		const headerRow = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		const hIcon = headerRow.createSpan();
		setIcon(hIcon, "x-circle");
		hIcon.addClass("ft-text-error-color");
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
