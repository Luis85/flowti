/**
 * Renders a single dashboard tile — either as a results table or stat-card summary.
 *
 * Delegates to AnalyticsResultsPanel for table mode;
 * stat-card mode shows key aggregates from the query result.
 */

import { setIcon } from "obsidian";
import type { AnalyticsResult, DashboardTile, SavedAnalyticsQuery } from "../../domain/analytics/types";
import { AnalyticsResultsPanel } from "../hub/AnalyticsResultsPanel";

export interface TileRenderContext {
	tile: DashboardTile;
	query: SavedAnalyticsQuery | undefined;
	result: AnalyticsResult | null;
	error: string | null;
	onRemove: (tileId: string) => void;
	onRefresh?: (tileId: string) => void;
}

export class DashboardTileRenderer {
	constructor(private container: HTMLElement) {}

	render(ctx: TileRenderContext): void {
		this.container.empty();

		const tileEl = this.container.createDiv({ cls: "ft-dashboard-tile" });
		tileEl.style.border = "1px solid var(--background-modifier-border)";
		tileEl.style.borderRadius = "6px";
		tileEl.style.overflow = "hidden";
		tileEl.style.display = "flex";
		tileEl.style.flexDirection = "column";

		// ── Header ──────────────────────────────────────
		const header = tileEl.createDiv({ cls: "ft-dashboard-tile-header" });
		header.style.display = "flex";
		header.style.alignItems = "center";
		header.style.justifyContent = "space-between";
		header.style.padding = "0.5rem 0.75rem";
		header.style.borderBottom = "1px solid var(--background-modifier-border)";
		header.style.background = "var(--background-secondary)";

		const titleEl = header.createSpan({
			text: ctx.tile.title || ctx.query?.name || "Untitled Tile",
			cls: "ft-text-sm",
		});
		titleEl.style.fontWeight = "600";

		const actions = header.createDiv();
		actions.style.display = "flex";
		actions.style.alignItems = "center";
		actions.style.gap = "0.25rem";

		if (ctx.onRefresh) {
			const refreshBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
			const refreshIcon = refreshBtn.createSpan();
			setIcon(refreshIcon, "refresh-cw");
			refreshIcon.style.width = "14px";
			refreshIcon.style.height = "14px";
			refreshBtn.style.cursor = "pointer";
			refreshBtn.setAttribute("aria-label", "Refresh tile");
			refreshBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				ctx.onRefresh!(ctx.tile.id);
			});
		}

		const removeBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
		const removeIcon = removeBtn.createSpan();
		setIcon(removeIcon, "x");
		removeIcon.style.width = "14px";
		removeIcon.style.height = "14px";
		removeBtn.style.cursor = "pointer";
		removeBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			ctx.onRemove(ctx.tile.id);
		});

		// ── Body ────────────────────────────────────────
		const body = tileEl.createDiv({ cls: "ft-dashboard-tile-body" });
		body.style.flex = "1";
		body.style.overflow = "auto";
		body.style.padding = "0.5rem";

		try {
			if (ctx.error) {
				this.renderError(body, ctx.error);
			} else if (!ctx.query) {
				this.renderError(body, "Query not found — it may have been deleted");
			} else if (!ctx.result) {
				this.renderLoading(body);
			} else if (ctx.tile.displayMode === "stat-card") {
				this.renderStatCard(body, ctx.result, ctx.query.name);
			} else {
				this.renderTable(body, ctx.result);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.renderError(body, `Render failed: ${message}`);
		}
	}

	private renderError(container: HTMLElement, message: string): void {
		const el = container.createDiv({ cls: "ft-text-muted ft-text-sm" });
		el.style.textAlign = "center";
		el.style.padding = "1rem";
		const iconEl = el.createDiv();
		setIcon(iconEl, "alert-triangle");
		iconEl.style.marginBottom = "0.25rem";
		el.createDiv({ text: message });
	}

	private renderLoading(container: HTMLElement): void {
		const el = container.createDiv({ cls: "ft-text-muted ft-text-sm" });
		el.style.textAlign = "center";
		el.style.padding = "1rem";
		el.createDiv({ text: "Loading..." });
	}

	private renderStatCard(container: HTMLElement, result: AnalyticsResult, queryName: string): void {
		if (result.rows.length === 0) {
			container.createDiv({ text: "No data", cls: "ft-text-muted ft-text-sm ft-text-center" });
			return;
		}

		const grid = container.createDiv({ cls: "ft-stat-card-grid" });
		grid.style.display = "grid";
		grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(120px, 1fr))";
		grid.style.gap = "0.5rem";

		// Show first row's numeric values as stat cards
		const row = result.rows[0];
		for (const col of result.columns) {
			const val = row[col];
			if (typeof val !== "number") continue;

			const card = grid.createDiv({ cls: "ft-stat-card-mini" });
			card.style.textAlign = "center";
			card.style.padding = "0.75rem 0.5rem";
			card.style.background = "var(--background-primary)";
			card.style.borderRadius = "4px";

			const valueEl = card.createDiv({ cls: "ft-text-lg" });
			valueEl.style.fontWeight = "700";
			valueEl.textContent = val.toLocaleString();

			card.createDiv({ text: col, cls: "ft-text-muted ft-text-xs" });
		}

		if (result.rows.length > 1) {
			container.createDiv({
				text: `${result.rows.length} rows · showing first row summary`,
				cls: "ft-text-muted ft-text-xs ft-mt-1 ft-text-center",
			});
		}
	}

	private renderTable(container: HTMLElement, result: AnalyticsResult): void {
		new AnalyticsResultsPanel(container, { result }).render();
	}
}
