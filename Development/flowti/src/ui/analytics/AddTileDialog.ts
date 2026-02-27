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

		const dialog = container.createDiv({ cls: "ft-add-tile-dialog" });
		dialog.style.cssText = "padding:1rem 1.25rem;border:1px solid var(--background-modifier-border);border-radius:8px;background:var(--background-secondary);margin-bottom:1rem";

		// ── Header ────────────────────────────────────
		const header = dialog.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.style.marginBottom = "0.75rem";
		const headerIcon = header.createSpan();
		headerIcon.style.display = "inline-flex";
		headerIcon.style.alignItems = "center";
		setIcon(headerIcon, "plus-square");
		const headerSvg = headerIcon.querySelector("svg");
		if (headerSvg) { headerSvg.style.width = "16px"; headerSvg.style.height = "16px"; headerSvg.style.opacity = "0.7"; }
		header.createSpan({ text: "Add Tile", cls: "ft-text-sm" }).style.fontWeight = "600";

		// ── Source selection ──────────────────────────
		const hasMeasurements = (this.options.measurements ?? []).length > 0;

		if (hasMeasurements) {
			this.renderSourceTabs(dialog);
		}

		const sourceArea = dialog.createDiv();
		sourceArea.style.marginTop = "0.5rem";
		if (this.sourceType === "query") {
			this.renderQueryPicker(sourceArea);
		} else {
			this.renderMeasurementPicker(sourceArea);
		}

		// ── Title input ──────────────────────────────
		const titleArea = dialog.createDiv();
		titleArea.style.marginTop = "0.75rem";
		titleArea.createDiv({ text: "Title (optional)", cls: "ft-text-muted ft-text-xs" });
		const titleInput = titleArea.createEl("input", { type: "text" });
		titleInput.value = this.tileTitle;
		titleInput.placeholder = "Auto-generated from source name";
		titleInput.style.cssText = "width:100%;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);font-size:var(--font-ui-small);margin-top:0.25rem";
		titleInput.addEventListener("input", () => { this.tileTitle = titleInput.value; });

		// ── Display mode ─────────────────────────────
		const dmLabel = dialog.createDiv({ text: "Display Mode", cls: "ft-text-muted ft-text-xs" });
		dmLabel.style.marginTop = "0.75rem";
		const grid = dialog.createDiv();
		grid.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;margin-top:0.35rem";

		for (const dm of DISPLAY_MODES) {
			const card = grid.createDiv();
			card.style.cssText = "padding:0.5rem;border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;text-align:center;transition:border-color 0.15s";
			if (dm.mode === this.displayMode) {
				card.style.borderColor = "var(--interactive-accent)";
				card.style.background = "var(--background-primary-alt)";
			}
			card.addEventListener("click", () => {
				this.displayMode = dm.mode;
				this.render();
			});

			const iconEl = card.createDiv();
			iconEl.style.display = "flex";
			iconEl.style.justifyContent = "center";
			const iconSpan = iconEl.createSpan();
			iconSpan.style.display = "inline-flex";
			iconSpan.style.alignItems = "center";
			setIcon(iconSpan, dm.icon);
			const svg = iconSpan.querySelector("svg");
			if (svg) { svg.style.width = "20px"; svg.style.height = "20px"; }
			if (dm.mode === this.displayMode) iconSpan.style.color = "var(--interactive-accent)";

			card.createDiv({ text: dm.label, cls: "ft-text-xs" }).style.cssText = "font-weight:500;margin-top:0.15rem";
			card.createDiv({ text: dm.description, cls: "ft-text-xs ft-text-muted" }).style.cssText = "opacity:0.7;line-height:1.2";
		}

		// ── Actions ──────────────────────────────────
		const actions = dialog.createDiv({ cls: "ft-flex ft-gap-2" });
		actions.style.cssText = "justify-content:flex-end;margin-top:0.75rem";

		const cancelBtn = actions.createEl("button", { text: "Cancel", cls: "ft-text-sm" });
		cancelBtn.addEventListener("click", () => this.options.onCancel());

		const addBtn = actions.createEl("button", { text: "Add tile", cls: "mod-cta ft-text-sm" });
		const canAdd = this.sourceType === "query" ? !!this.selectedQueryId : !!this.selectedMeasurementId;
		if (!canAdd) {
			addBtn.disabled = true;
			addBtn.style.opacity = "0.5";
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
		const tabs = dialog.createDiv({ cls: "ft-flex ft-gap-2" });
		tabs.style.cssText = "border-bottom:1px solid var(--background-modifier-border);padding-bottom:0.35rem;margin-top:0.25rem";

		const queryTab = tabs.createSpan({ text: "From Query", cls: "ft-text-xs" });
		queryTab.style.cssText = `cursor:pointer;padding:0.25rem 0;font-weight:${this.sourceType === "query" ? "600" : "400"};color:${this.sourceType === "query" ? "var(--text-accent)" : "var(--text-muted)"};border-bottom:${this.sourceType === "query" ? "2px solid var(--text-accent)" : "2px solid transparent"};margin-bottom:-1px`;

		const measTab = tabs.createSpan({ text: "From Measurement", cls: "ft-text-xs" });
		measTab.style.cssText = `cursor:pointer;padding:0.25rem 0;font-weight:${this.sourceType === "measurement" ? "600" : "400"};color:${this.sourceType === "measurement" ? "var(--text-accent)" : "var(--text-muted)"};border-bottom:${this.sourceType === "measurement" ? "2px solid var(--text-accent)" : "2px solid transparent"};margin-bottom:-1px`;

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
			area.createDiv({ text: "No saved queries yet. Create a query first.", cls: "ft-text-muted ft-text-sm" }).style.padding = "0.5rem 0";
			return;
		}

		// Favorites first, then alphabetical
		const sorted = [...queries].sort((a, b) => {
			if (a.isFavorite && !b.isFavorite) return -1;
			if (!a.isFavorite && b.isFavorite) return 1;
			return a.name.localeCompare(b.name);
		});

		const list = area.createDiv();
		list.style.cssText = "max-height:160px;overflow-y:auto;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary)";

		for (const q of sorted) {
			const item = list.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			item.style.cssText = "padding:0.35rem 0.5rem;cursor:pointer;border-bottom:1px solid var(--background-modifier-border)";
			if (q.id === this.selectedQueryId) {
				item.style.background = "var(--background-primary-alt)";
				item.style.borderLeft = "2px solid var(--interactive-accent)";
			}
			item.addEventListener("click", () => {
				this.selectedQueryId = q.id;
				this.render();
			});

			if (q.isFavorite) {
				const star = item.createSpan();
				star.style.cssText = "display:inline-flex;align-items:center;flex-shrink:0";
				setIcon(star, "star");
				const sSvg = star.querySelector("svg");
				if (sSvg) { sSvg.style.width = "12px"; sSvg.style.height = "12px"; sSvg.style.color = "var(--text-accent)"; }
			}

			const icon = item.createSpan();
			icon.style.cssText = "display:inline-flex;align-items:center;opacity:0.5;flex-shrink:0";
			setIcon(icon, "search");
			const iSvg = icon.querySelector("svg");
			if (iSvg) { iSvg.style.width = "12px"; iSvg.style.height = "12px"; }

			const nameEl = item.createSpan({ text: q.name, cls: "ft-text-sm" });
			nameEl.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";

			const meta = item.createSpan({ cls: "ft-text-xs ft-text-muted" });
			meta.style.flexShrink = "0";
			const parts: string[] = [`${q.measures.length}m`];
			if (q.lastRowCount !== undefined) parts.push(`${q.lastRowCount}r`);
			meta.textContent = parts.join(" ");
		}
	}

	private renderMeasurementPicker(area: HTMLElement): void {
		const measurements = this.options.measurements ?? [];

		if (measurements.length === 0) {
			area.createDiv({ text: "No measurements yet. Save a query to auto-create measurements.", cls: "ft-text-muted ft-text-sm" }).style.padding = "0.5rem 0";
			return;
		}

		const sorted = [...measurements].sort((a, b) => {
			if (a.isFavorite && !b.isFavorite) return -1;
			if (!a.isFavorite && b.isFavorite) return 1;
			return a.name.localeCompare(b.name);
		});

		const list = area.createDiv();
		list.style.cssText = "max-height:160px;overflow-y:auto;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary)";

		for (const m of sorted) {
			const item = list.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			item.style.cssText = "padding:0.35rem 0.5rem;cursor:pointer;border-bottom:1px solid var(--background-modifier-border)";
			if (m.id === this.selectedMeasurementId) {
				item.style.background = "var(--background-primary-alt)";
				item.style.borderLeft = "2px solid var(--interactive-accent)";
			}
			item.addEventListener("click", () => {
				this.selectedMeasurementId = m.id;
				this.render();
			});

			if (m.isFavorite) {
				const star = item.createSpan();
				star.style.cssText = "display:inline-flex;align-items:center;flex-shrink:0";
				setIcon(star, "star");
				const sSvg = star.querySelector("svg");
				if (sSvg) { sSvg.style.width = "12px"; sSvg.style.height = "12px"; sSvg.style.color = "var(--text-accent)"; }
			}

			const icon = item.createSpan();
			icon.style.cssText = "display:inline-flex;align-items:center;opacity:0.5;flex-shrink:0";
			setIcon(icon, "ruler");
			const iSvg = icon.querySelector("svg");
			if (iSvg) { iSvg.style.width = "12px"; iSvg.style.height = "12px"; }

			const nameEl = item.createSpan({ text: m.name, cls: "ft-text-sm" });
			nameEl.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";

			const typeBadge = item.createSpan({ text: m.type, cls: "ft-badge ft-badge-muted" });
			typeBadge.style.cssText = "font-size:0.6rem;flex-shrink:0";
		}
	}
}
