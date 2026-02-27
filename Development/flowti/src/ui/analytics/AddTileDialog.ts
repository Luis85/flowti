/**
 * Redesigned Add Tile dialog for dashboard building.
 *
 * Two-step flow: pick a source (query or measurement), then configure
 * display mode with visual cards. Auto-suggests the best display mode
 * based on the query's shape.
 */

import { setIcon } from "obsidian";
import type {
	SavedAnalyticsQuery,
	TileDisplayMode,
	Measurement,
} from "../../domain/analytics/types";

const DISPLAY_MODES: Array<{ mode: TileDisplayMode; icon: string; label: string; description: string }> = [
	{ mode: "stat-card", icon: "bar-chart-2", label: "Stat Card", description: "Single value with sparkline" },
	{ mode: "table", icon: "table", label: "Table", description: "Rows and columns" },
	{ mode: "bar-chart", icon: "bar-chart", label: "Bar Chart", description: "Compare categories" },
	{ mode: "line-chart", icon: "trending-up", label: "Line Chart", description: "Trends over time" },
	{ mode: "area-chart", icon: "mountain", label: "Area Chart", description: "Filled trend line" },
	{ mode: "pie-chart", icon: "pie-chart", label: "Pie Chart", description: "Part of a whole" },
];

export interface AddTileDialogOptions {
	container: HTMLElement;
	queries: SavedAnalyticsQuery[];
	measurements?: Measurement[];
	onAdd: (queryId: string, displayMode: TileDisplayMode, title?: string, measurementId?: string) => void;
	onCancel: () => void;
}

type SourceType = "query" | "measurement";

export class AddTileDialog {
	private sourceType: SourceType = "query";
	private selectedQueryId: string | null = null;
	private selectedMeasurementId: string | null = null;
	private displayMode: TileDisplayMode = "table";
	private tileTitle = "";

	constructor(private options: AddTileDialogOptions) {}

	render(): void {
		const { container } = this.options;
		const scrollParent = container.closest(".ft-dashboard-tile-body") ?? container.parentElement;
		const scrollTop = scrollParent?.scrollTop ?? 0;
		container.empty();

		const dialog = container.createDiv({ cls: "ft-add-tile-dialog ft-add-tile-dialog-box" });

		// ── Header ────────────────────────────────────
		const header = dialog.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-add-tile-dialog-header" });
		const headerIcon = header.createSpan({ cls: "ft-inline-flex-center ft-add-tile-icon-16" });
		setIcon(headerIcon, "plus-square");
		header.createSpan({ text: "Add Tile", cls: "ft-text-sm ft-font-semibold" });

		// ── Source selection ──────────────────────────
		const hasMeasurements = (this.options.measurements ?? []).length > 0;

		if (hasMeasurements) {
			this.renderSourceTabs(dialog);
		}

		const sourceArea = dialog.createDiv({ cls: "ft-add-tile-source-area" });
		if (this.sourceType === "query") {
			this.renderQueryPicker(sourceArea);
		} else {
			this.renderMeasurementPicker(sourceArea);
		}

		// ── Title input ──────────────────────────────
		const titleArea = dialog.createDiv({ cls: "ft-add-tile-title-area" });
		titleArea.createDiv({ text: "Title (optional)", cls: "ft-text-muted ft-text-xs" });
		const titleInput = titleArea.createEl("input", { type: "text", cls: "ft-add-tile-title-input" });
		titleInput.value = this.tileTitle;
		titleInput.placeholder = "Auto-generated from source name";
		titleInput.addEventListener("input", () => { this.tileTitle = titleInput.value; });

		// ── Display mode ─────────────────────────────
		dialog.createDiv({ text: "Display Mode", cls: "ft-text-muted ft-text-xs ft-add-tile-dm-label" });
		const grid = dialog.createDiv({ cls: "ft-add-tile-dm-grid" });

		for (const dm of DISPLAY_MODES) {
			const cardCls = dm.mode === this.displayMode
				? "ft-add-tile-dm-card ft-add-tile-dm-card-active"
				: "ft-add-tile-dm-card";
			const card = grid.createDiv({ cls: cardCls });
			card.addEventListener("click", () => {
				this.displayMode = dm.mode;
				this.render();
			});

			const iconEl = card.createDiv({ cls: "ft-flex-center" });
			const iconSpanCls = dm.mode === this.displayMode
				? "ft-inline-flex-center ft-add-tile-dm-icon-20 ft-add-tile-dm-icon-active"
				: "ft-inline-flex-center ft-add-tile-dm-icon-20";
			const iconSpan = iconEl.createSpan({ cls: iconSpanCls });
			setIcon(iconSpan, dm.icon);

			card.createDiv({ text: dm.label, cls: "ft-text-xs ft-add-tile-dm-card-label" });
			card.createDiv({ text: dm.description, cls: "ft-text-xs ft-text-muted ft-add-tile-dm-card-desc" });
		}

		// ── Actions ──────────────────────────────────
		const actions = dialog.createDiv({ cls: "ft-flex ft-gap-2 ft-add-tile-actions" });

		const cancelBtn = actions.createEl("button", { text: "Cancel", cls: "ft-text-sm" });
		cancelBtn.addEventListener("click", () => this.options.onCancel());

		const addBtn = actions.createEl("button", { text: "Add tile", cls: "mod-cta ft-text-sm" });
		const canAdd = this.sourceType === "query" ? !!this.selectedQueryId : !!this.selectedMeasurementId;
		if (!canAdd) {
			addBtn.disabled = true;
			addBtn.addClass("ft-disabled-half");
		}
		addBtn.addEventListener("click", () => {
			if (!canAdd) return;
			const title = this.tileTitle.trim() || undefined;
			if (this.sourceType === "measurement" && this.selectedMeasurementId) {
				const m = this.options.measurements?.find((mm) => mm.id === this.selectedMeasurementId);
				if (m) {
					this.options.onAdd(m.queryId, this.displayMode, title, m.id);
					return;
				}
			}
			if (this.selectedQueryId) {
				this.options.onAdd(this.selectedQueryId, this.displayMode, title);
			}
		});

		// Restore scroll position after DOM rebuild
		if (scrollParent) scrollParent.scrollTop = scrollTop;
	}

	private renderSourceTabs(dialog: HTMLElement): void {
		const tabs = dialog.createDiv({ cls: "ft-flex ft-gap-2 ft-add-tile-source-tabs" });

		const queryTabCls = this.sourceType === "query"
			? "ft-text-xs ft-add-tile-tab ft-add-tile-tab-active"
			: "ft-text-xs ft-add-tile-tab ft-add-tile-tab-inactive";
		const queryTab = tabs.createSpan({ text: "From Query", cls: queryTabCls });

		const measTabCls = this.sourceType === "measurement"
			? "ft-text-xs ft-add-tile-tab ft-add-tile-tab-active"
			: "ft-text-xs ft-add-tile-tab ft-add-tile-tab-inactive";
		const measTab = tabs.createSpan({ text: "From Measurement", cls: measTabCls });

		queryTab.addEventListener("click", () => {
			this.sourceType = "query";
			this.selectedMeasurementId = null;
			this.render();
		});
		measTab.addEventListener("click", () => {
			this.sourceType = "measurement";
			this.selectedQueryId = null;
			this.render();
		});
	}

	private renderQueryPicker(area: HTMLElement): void {
		const { queries } = this.options;

		if (queries.length === 0) {
			area.createDiv({ text: "No saved queries yet. Create a query first.", cls: "ft-text-muted ft-text-sm ft-add-tile-picker-empty" });
			return;
		}

		// Favorites first, then alphabetical
		const sorted = [...queries].sort((a, b) => {
			if (a.isFavorite && !b.isFavorite) return -1;
			if (!a.isFavorite && b.isFavorite) return 1;
			return a.name.localeCompare(b.name);
		});

		const list = area.createDiv({ cls: "ft-add-tile-picker-list" });

		for (const q of sorted) {
			const itemCls = q.id === this.selectedQueryId
				? "ft-flex ft-items-center ft-gap-2 ft-add-tile-picker-item ft-add-tile-picker-item-selected"
				: "ft-flex ft-items-center ft-gap-2 ft-add-tile-picker-item";
			const item = list.createDiv({ cls: itemCls });
			item.addEventListener("click", () => {
				this.selectedQueryId = q.id;
				this.render();
			});

			if (q.isFavorite) {
				const star = item.createSpan({ cls: "ft-add-tile-picker-star" });
				setIcon(star, "star");
			}

			const icon = item.createSpan({ cls: "ft-add-tile-picker-icon" });
			setIcon(icon, "search");

			item.createSpan({ text: q.name, cls: "ft-text-sm ft-add-tile-picker-name" });

			const meta = item.createSpan({ cls: "ft-text-xs ft-text-muted ft-add-tile-picker-meta" });
			const parts: string[] = [`${q.measures.length}m`];
			if (q.lastRowCount !== undefined) parts.push(`${q.lastRowCount}r`);
			meta.textContent = parts.join(" ");
		}
	}

	private renderMeasurementPicker(area: HTMLElement): void {
		const measurements = this.options.measurements ?? [];

		if (measurements.length === 0) {
			area.createDiv({ text: "No measurements yet. Save a query to auto-create measurements.", cls: "ft-text-muted ft-text-sm ft-add-tile-picker-empty" });
			return;
		}

		const sorted = [...measurements].sort((a, b) => {
			if (a.isFavorite && !b.isFavorite) return -1;
			if (!a.isFavorite && b.isFavorite) return 1;
			return a.name.localeCompare(b.name);
		});

		const list = area.createDiv({ cls: "ft-add-tile-picker-list" });

		for (const m of sorted) {
			const itemCls = m.id === this.selectedMeasurementId
				? "ft-flex ft-items-center ft-gap-2 ft-add-tile-picker-item ft-add-tile-picker-item-selected"
				: "ft-flex ft-items-center ft-gap-2 ft-add-tile-picker-item";
			const item = list.createDiv({ cls: itemCls });
			item.addEventListener("click", () => {
				this.selectedMeasurementId = m.id;
				this.render();
			});

			if (m.isFavorite) {
				const star = item.createSpan({ cls: "ft-add-tile-picker-star" });
				setIcon(star, "star");
			}

			const icon = item.createSpan({ cls: "ft-add-tile-picker-icon" });
			setIcon(icon, "ruler");

			item.createSpan({ text: m.name, cls: "ft-text-sm ft-add-tile-picker-name" });

			item.createSpan({ text: m.type, cls: "ft-badge ft-badge-muted ft-add-tile-picker-type-badge" });
		}
	}
}
