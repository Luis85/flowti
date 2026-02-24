/**
 * Inline dialog for adding a tile to a dashboard.
 *
 * Presents a saved-query picker and display mode toggle,
 * then calls the provided callback with the user's selections.
 */

import { setIcon } from "obsidian";
import type { SavedAnalyticsQuery, TileDisplayMode } from "../../domain/analytics/types";

export interface AddTileDialogOptions {
	container: HTMLElement;
	queries: SavedAnalyticsQuery[];
	onAdd: (queryId: string, displayMode: TileDisplayMode, title?: string) => void;
	onCancel: () => void;
}

export class AddTileDialog {
	private selectedQueryId: string | null = null;
	private displayMode: TileDisplayMode = "table";

	constructor(private options: AddTileDialogOptions) {}

	render(): void {
		const { container, queries } = this.options;
		container.empty();

		const dialog = container.createDiv({ cls: "ft-add-tile-dialog" });
		dialog.style.padding = "1rem";
		dialog.style.border = "1px solid var(--background-modifier-border)";
		dialog.style.borderRadius = "6px";
		dialog.style.background = "var(--background-secondary)";

		dialog.createDiv({ text: "Add Tile", cls: "ft-text-sm" }).style.fontWeight = "600";

		// ── Query picker ──────────────────────────────────
		const queryLabel = dialog.createDiv({ cls: "ft-text-muted ft-text-xs ft-mt-1" });
		queryLabel.textContent = "Query";

		const select = dialog.createEl("select", { cls: "dropdown ft-mt-05" });
		select.style.width = "100%";

		const placeholder = select.createEl("option", { text: "Select a query..." });
		placeholder.value = "";
		placeholder.disabled = true;
		placeholder.selected = true;

		for (const q of queries) {
			const opt = select.createEl("option", { text: q.name });
			opt.value = q.id;
		}

		select.addEventListener("change", () => {
			this.selectedQueryId = select.value || null;
		});

		// ── Display mode toggle ───────────────────────────
		const modeLabel = dialog.createDiv({ cls: "ft-text-muted ft-text-xs ft-mt-1" });
		modeLabel.textContent = "Display mode";

		const modeRow = dialog.createDiv({ cls: "ft-mt-05" });
		modeRow.style.display = "flex";
		modeRow.style.gap = "0.5rem";

		const modeButtons: Array<{ el: HTMLElement; mode: TileDisplayMode }> = [
			{ el: this.createModeButton(modeRow, "table", "Table", "table"), mode: "table" },
			{ el: this.createModeButton(modeRow, "bar-chart-2", "Stat Card", "stat-card"), mode: "stat-card" },
			{ el: this.createModeButton(modeRow, "trending-up", "Line", "line-chart"), mode: "line-chart" },
			{ el: this.createModeButton(modeRow, "bar-chart", "Bar", "bar-chart"), mode: "bar-chart" },
		];
		modeButtons[0].el.addClass("ft-active");

		for (const btn of modeButtons) {
			btn.el.addEventListener("click", () => {
				this.displayMode = btn.mode;
				for (const other of modeButtons) {
					if (other === btn) other.el.addClass("ft-active");
					else other.el.removeClass("ft-active");
				}
			});
		}

		// ── Action buttons ────────────────────────────────
		const actions = dialog.createDiv({ cls: "ft-mt-1" });
		actions.style.display = "flex";
		actions.style.gap = "0.5rem";
		actions.style.justifyContent = "flex-end";

		const cancelBtn = actions.createEl("button", { text: "Cancel", cls: "ft-text-sm" });
		cancelBtn.addEventListener("click", () => this.options.onCancel());

		const addBtn = actions.createEl("button", { text: "Add", cls: "mod-cta ft-text-sm" });
		addBtn.addEventListener("click", () => {
			if (!this.selectedQueryId) return;
			this.options.onAdd(this.selectedQueryId, this.displayMode);
		});
	}

	private createModeButton(parent: HTMLElement, icon: string, label: string, _mode: TileDisplayMode): HTMLElement {
		const btn = parent.createEl("button", { cls: "ft-text-sm" });
		btn.style.display = "flex";
		btn.style.alignItems = "center";
		btn.style.gap = "0.25rem";
		btn.style.flex = "1";
		const iconEl = btn.createSpan();
		setIcon(iconEl, icon);
		iconEl.style.width = "14px";
		iconEl.style.height = "14px";
		btn.createSpan({ text: label });
		return btn;
	}
}
