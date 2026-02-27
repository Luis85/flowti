/**
 * View Select page for the ExportView wizard.
 * Shown only for .base source files — lets the user pick which base view to export.
 */

import { setIcon } from "obsidian";
import type { ExportComponentDeps } from "./types";

export class ViewSelectPage {
	constructor(
		private container: HTMLElement,
		private deps: ExportComponentDeps,
	) {}

	render(): void {
		const ws = this.container;
		ws.empty();

		const state = this.deps.getState();
		const container = ws.createDiv({ cls: "ft-table-scroll" });
		container.addClass("ft-view-select-padding");

		if (!state.baseFile || state.baseFile.views.length === 0) {
			container.createEl("p", {
				text: "No views found in this base file.",
				cls: "ft-text-muted",
			});
			const nav = container.createDiv({ cls: "ft-detail-actions ft-mt-4" });
			const closeBtn = nav.createEl("span", { cls: "ft-nav-link" });
			setIcon(closeBtn.createSpan(), "x");
			closeBtn.appendText(" Close");
			closeBtn.addEventListener("click", () => this.deps.detachLeaf());
			return;
		}

		// Action bar
		const actions = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-py-3 ft-mb-3" });
		actions.addClass("ft-action-bar-border");

		const closeBtn = actions.createEl("span", { cls: "ft-nav-link" });
		setIcon(closeBtn.createSpan(), "x");
		closeBtn.appendText(" Close");
		closeBtn.addEventListener("click", () => this.deps.detachLeaf());

		actions.createDiv({ cls: "ft-flex-1" });

		const nextBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
		setIcon(nextBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "arrow-right");
		nextBtn.appendText(" Configure");
		nextBtn.addEventListener("click", async () => {
			const files = await this.deps.exportService.resolveExportFiles(
				state.sourcePath,
				state.sourceType,
				state.baseViewIndex,
			);

			// Try unified resolved columns (preserves view order and headers)
			const resolved = await this.deps.exportService.scanResolvedColumns(
				state.sourcePath,
				state.baseViewIndex,
			);

			if (resolved) {
				const availableColumns = resolved
					.filter((rc) => rc.source !== "file")
					.map((rc) => rc.resolveKey);
				const fileProps = resolved
					.filter((rc) => rc.source === "file" || (rc.source === "formula" && rc.resolveSource === "file"))
					.map((rc) => rc.resolveKey);
				const displayNames: Record<string, string> = {};
				for (const rc of resolved) {
					if (rc.header !== rc.resolveKey) {
						displayNames[rc.key] = rc.header;
					}
				}
				this.deps.setState({
					availableColumns,
					selectedColumns: [...availableColumns],
					previewFiles: files,
					selectedFileProperties: fileProps,
					resolvedColumns: resolved,
					displayNames,
					currentPage: "configure",
				});
			} else {
				// Fallback: legacy scan
				const cols = await this.deps.exportService.scanColumns(
					state.sourcePath,
					state.sourceType,
					state.baseViewIndex,
				);
				const viewFileProps = await this.deps.exportService.scanViewFileProperties(
					state.sourcePath,
					state.baseViewIndex,
				);
				const displayNames = await this.deps.exportService.scanDisplayNames(state.sourcePath);
				this.deps.setState({
					availableColumns: cols,
					selectedColumns: [...cols],
					previewFiles: files,
					selectedFileProperties: viewFileProps,
					resolvedColumns: null,
					displayNames,
					currentPage: "configure",
				});
			}

			this.deps.renderPage();
		});

		// Header
		container.createEl("h3", {
			text: "Select a view",
			cls: "ft-heading ft-heading-sm ft-mb-2",
		});
		const subtitle = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		const parts = state.sourcePath.replace(/\\/g, "/").split("/");
		subtitle.createSpan({
			text: parts[parts.length - 1] || state.sourcePath,
			cls: "ft-text-muted ft-text-sm",
		});
		subtitle.createSpan({
			text: `${state.baseFile.views.length} view${state.baseFile.views.length !== 1 ? "s" : ""}`,
			cls: "ft-badge ft-badge-muted",
		});

		// View cards
		for (let i = 0; i < state.baseFile.views.length; i++) {
			const view = state.baseFile.views[i];
			const isSelected = i === state.baseViewIndex;

			const card = container.createDiv({
				cls: `ft-card ${isSelected ? "ft-card-selected" : ""}`,
			});
			card.addClass("ft-cursor-pointer");
			card.addClass("ft-view-card-padding");

			const row = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-3" });

			// Icon
			const iconEl = row.createSpan();
			setIcon(iconEl, "table");
			if (!isSelected) iconEl.addClass("ft-opacity-04");
			iconEl.addClass("ft-flex-shrink-0");

			// Text
			const text = row.createDiv();
			text.addClass("ft-flex-1");
			text.addClass("ft-view-text-minw0");
			text.createDiv({ text: view.name, cls: "ft-font-bold" });
			const meta: string[] = [view.type];
			if (view.order) meta.push(`${view.order.length} columns`);
			if (view.filters) meta.push("filtered");
			text.createDiv({ text: meta.join(" \u00B7 "), cls: "ft-text-muted ft-text-sm" });

			// Selected indicator
			if (isSelected) {
				const check = row.createSpan();
				setIcon(check, "check");
				check.addClass("ft-text-accent-color");
				check.addClass("ft-flex-shrink-0");
			}

			const viewIndex = i;
			card.addEventListener("click", () => {
				this.deps.setState({ baseViewIndex: viewIndex });
				this.deps.renderPage();
			});
		}
	}
}
