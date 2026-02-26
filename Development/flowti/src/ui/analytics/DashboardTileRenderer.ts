/**
 * Dashboard tile frame orchestrator — renders the tile chrome (header, settings,
 * body container) and delegates body rendering to sub-renderers via factory.
 *
 * Decomposed from 829 LOC monolith into focused sub-renderers (PBI-ANA-141, Cycle 44):
 * - TableTileRenderer (table + KPI cards + search + sort + conditional formatting)
 * - StatCardTileRenderer (stat-card grid + sparklines + drill-down)
 * - ChartTileRenderer (value column selector + chart delegation)
 * - PieChartTileRenderer (direct pie chart delegation)
 */

import { setIcon } from "obsidian";
import type { TileDisplayMode } from "../../domain/analytics/types";
import { formatRelativeTime, getFreshnessColor, getFreshnessLevel } from "../../domain/analytics/freshnessUtils";
import { rowsToCsv, downloadCsvFile } from "../../utils/csvUtils";
import { TileSettingsPanel } from "./TileSettingsPanel";
import { createTileRenderer } from "./tiles/TileRendererFactory";
import { DISPLAY_MODE_CYCLE } from "./tiles/types";
import type { TileRenderContext } from "./tiles/types";

// Re-export context types from canonical location for external consumers
export type { TileDataContext, TileUIContext, TileNavContext, TileRenderContext } from "./tiles/types";

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
		if (!ctx.tile.autoHeight) tileEl.style.height = "100%";

		// ── Header ──────────────────────────────────────
		this.renderHeader(tileEl, ctx);

		// ── Settings panel (collapsible) ────────────────
		if (ctx.settingsOpen) {
			const settingsPanel = tileEl.createDiv({ cls: "ft-tile-settings" });
			settingsPanel.style.padding = "0.5rem 0.75rem";
			settingsPanel.style.borderBottom = "1px solid var(--background-modifier-border)";
			settingsPanel.style.background = "var(--background-secondary-alt)";
			settingsPanel.style.overflowY = "auto";
			settingsPanel.style.minHeight = "0";

			new TileSettingsPanel(settingsPanel, ctx).render();
		}

		// ── Body ────────────────────────────────────────
		const isChart = ctx.tile.displayMode === "line-chart" || ctx.tile.displayMode === "bar-chart" || ctx.tile.displayMode === "area-chart" || ctx.tile.displayMode === "pie-chart";
		const body = tileEl.createDiv({ cls: "ft-dashboard-tile-body" });
		if (ctx.tile.autoHeight) {
			body.style.overflow = "visible";
		} else {
			body.style.flex = "1";
			body.style.overflow = isChart ? "hidden" : "auto";
			body.style.minHeight = "0";
		}
		body.style.padding = ctx.tile.displayMode === "table" ? "0.35rem" : "0.5rem 0.35rem";
		if (isChart || ctx.tile.displayMode === "stat-card") {
			body.style.display = "flex";
			body.style.flexDirection = "column";
		}

		// Apply per-tile column exclusion (row-limit is handled by TableTileRenderer as pagination)
		const tileExcluded = ctx.tile.excludedColumns;
		const filteredResult = ctx.result && tileExcluded && tileExcluded.length > 0
			? { ...ctx.result, columns: ctx.result.columns.filter((c) => !tileExcluded.includes(c)) }
			: ctx.result;

		// ── Dispatch to sub-renderer ────────────────────
		try {
			if (ctx.error) {
				this.renderError(body, ctx.error);
			} else if (!ctx.query) {
				this.renderBrokenRef(body, ctx);
			} else if (!filteredResult) {
				this.renderLoading(body);
			} else {
				const renderer = createTileRenderer(ctx.tile.displayMode);
				if (renderer) {
					renderer.render(body, filteredResult, ctx);
				} else {
					this.renderError(body, `Unknown display mode: ${ctx.tile.displayMode}`);
				}
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.renderError(body, `Render failed: ${message}`);
		}
	}

	// ── Header ──────────────────────────────────────────────

	private renderHeader(tileEl: HTMLElement, ctx: TileRenderContext): void {
		const header = tileEl.createDiv({ cls: "ft-tile-header" });
		header.style.flexWrap = "wrap";

		// Editable title
		if (ctx.onTitleChange) {
			const titleInput = header.createEl("input", { type: "text" });
			titleInput.value = ctx.tile.title || ctx.query?.name || "Untitled Tile";
			titleInput.style.cssText = "font-weight:600;font-size:var(--font-ui-small);border:none;background:transparent;color:var(--text-normal);padding:0;flex:1;min-width:0";
			titleInput.addEventListener("blur", () => {
				const val = titleInput.value.trim();
				if (val) ctx.onTitleChange!(ctx.tile.id, val);
			});
			titleInput.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					titleInput.blur();
				}
			});
		} else {
			header.createSpan({
				text: ctx.tile.title || ctx.query?.name || "Untitled Tile",
				cls: "ft-text-sm ft-font-semibold ft-flex-1-min ft-text-ellipsis",
			});
		}

		// Right-side group: indicators + action buttons
		const actions = header.createDiv();
		actions.style.display = "flex";
		actions.style.alignItems = "center";
		actions.style.gap = "0.25rem";
		actions.style.flexWrap = "wrap";
		actions.style.justifyContent = "flex-end";
		actions.style.fontSize = "var(--font-ui-smaller)";

		this.renderHeaderIndicators(actions, ctx);
		this.renderHeaderActions(actions, ctx);
	}

	private renderHeaderIndicators(actions: HTMLElement, ctx: TileRenderContext): void {
		// Measurement badge
		if (ctx.tile.measurementId && ctx.measurements) {
			const m = ctx.measurements.find((mm) => mm.id === ctx.tile.measurementId);
			if (m) {
				const mBadge = actions.createSpan({ text: m.name, cls: "ft-tag ft-text-xs" });
				mBadge.style.flexShrink = "0";
				mBadge.style.fontSize = "10px";
			}
		}

		// Row count badge
		if (ctx.result && ctx.result.rows.length > 0) {
			const rowBadge = actions.createSpan({
				text: `${ctx.result.rows.length} rows`,
				cls: "ft-text-xs ft-text-muted",
			});
			rowBadge.style.cssText = "flex-shrink:0;font-size:0.65rem";
		}

		// Conditional rule indicator dot
		if (ctx.tile.conditionalRules && ctx.tile.conditionalRules.length > 0) {
			const dot = actions.createSpan();
			dot.style.cssText = "width:8px;height:8px;border-radius:50%;background:var(--text-accent);flex-shrink:0";
			dot.setAttribute("aria-label", `${ctx.tile.conditionalRules.length} formatting rule(s)`);
		}

		// Freshness badge
		if (ctx.refreshedAt) {
			const level = getFreshnessLevel(ctx.refreshedAt);
			const badge = actions.createSpan({
				text: formatRelativeTime(ctx.refreshedAt),
				cls: "ft-text-xs",
			});
			badge.style.cssText = `color:${getFreshnessColor(level)};flex-shrink:0;font-size:0.65rem`;
		} else if (ctx.result) {
			const badge = actions.createSpan({ text: "Not yet refreshed", cls: "ft-text-xs ft-text-muted" });
			badge.style.cssText = "flex-shrink:0;font-size:0.65rem";
		}
	}

	private renderHeaderActions(actions: HTMLElement, ctx: TileRenderContext): void {
		// Reorder buttons
		if (ctx.onReorder) {
			const upBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
			const upIcon = upBtn.createSpan();
			setIcon(upIcon, "chevron-up");
			upIcon.style.width = "14px";
			upIcon.style.height = "14px";
			upBtn.style.cursor = "pointer";
			upBtn.setAttribute("aria-label", "Move up");
			upBtn.addEventListener("click", (e) => { e.stopPropagation(); ctx.onReorder!(ctx.tile.id, "up"); });

			const downBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
			const downIcon = downBtn.createSpan();
			setIcon(downIcon, "chevron-down");
			downIcon.style.width = "14px";
			downIcon.style.height = "14px";
			downBtn.style.cursor = "pointer";
			downBtn.setAttribute("aria-label", "Move down");
			downBtn.addEventListener("click", (e) => { e.stopPropagation(); ctx.onReorder!(ctx.tile.id, "down"); });
		}

		// Display mode dropdown
		if (ctx.onDisplayModeToggle) {
			const modeSelect = actions.createEl("select", { cls: "ft-text-xs" });
			modeSelect.style.cssText = "padding:1px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary);cursor:pointer;font-size:var(--font-ui-smaller)";
			const modeLabels: Record<TileDisplayMode, string> = { "table": "Table", "stat-card": "Stat Card", "line-chart": "Line Chart", "bar-chart": "Bar Chart", "area-chart": "Area Chart", "pie-chart": "Pie Chart" };
			for (const mode of DISPLAY_MODE_CYCLE) {
				const opt = modeSelect.createEl("option");
				opt.value = mode;
				opt.textContent = modeLabels[mode];
				if (mode === ctx.tile.displayMode) opt.selected = true;
			}
			modeSelect.addEventListener("change", (e) => {
				e.stopPropagation();
				ctx.onDisplayModeToggle!(ctx.tile.id, modeSelect.value as TileDisplayMode);
			});
		}

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

		// CSV export button
		if (ctx.result && ctx.result.rows.length > 0) {
			const csvBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
			const csvIcon = csvBtn.createSpan();
			setIcon(csvIcon, "download");
			csvIcon.style.width = "14px";
			csvIcon.style.height = "14px";
			csvBtn.style.cursor = "pointer";
			csvBtn.setAttribute("aria-label", "Export CSV");
			csvBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				const title = ctx.tile.title || ctx.query?.name || "tile-export";
				downloadCsvFile(rowsToCsv(ctx.result!.columns, ctx.result!.rows), title);
			});
		}

		// View query button
		if (ctx.onViewQuery && ctx.tile.queryId) {
			const viewBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
			const viewIcon = viewBtn.createSpan();
			setIcon(viewIcon, "external-link");
			viewIcon.style.width = "14px";
			viewIcon.style.height = "14px";
			viewBtn.style.cursor = "pointer";
			viewBtn.setAttribute("aria-label", "View Query");
			viewBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				ctx.onViewQuery!(ctx.tile.queryId);
			});
		}

		// Settings gear icon
		if (ctx.onToggleSettings) {
			const gearBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
			const gearIcon = gearBtn.createSpan();
			setIcon(gearIcon, "settings");
			gearIcon.style.width = "14px";
			gearIcon.style.height = "14px";
			gearBtn.style.cursor = "pointer";
			if (ctx.settingsOpen) gearBtn.style.color = "var(--text-accent)";
			gearBtn.setAttribute("aria-label", "Tile settings");
			gearBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				ctx.onToggleSettings!(ctx.tile.id);
			});
		}

		// Remove button (only in management context, not on homepage)
		if (ctx.onToggleSettings) {
			const removeBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted" });
			const removeIcon = removeBtn.createSpan();
			setIcon(removeIcon, "trash-2");
			removeIcon.style.width = "14px";
			removeIcon.style.height = "14px";
			removeBtn.style.cursor = "pointer";
			removeBtn.setAttribute("aria-label", "Remove tile");
			removeBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				ctx.onRemove(ctx.tile.id);
			});
		}
	}

	// ── Error / loading states ──────────────────────────────

	private renderError(container: HTMLElement, message: string): void {
		const el = container.createDiv({ cls: "ft-text-muted ft-text-sm" });
		el.style.textAlign = "center";
		el.style.padding = "1rem";
		const iconEl = el.createDiv();
		setIcon(iconEl, "alert-triangle");
		iconEl.style.marginBottom = "0.25rem";
		el.createDiv({ text: message });
	}

	/** Enhanced error for broken query/measurement references with Fix action. */
	private renderBrokenRef(container: HTMLElement, ctx: TileRenderContext): void {
		const el = container.createDiv({ cls: "ft-text-sm" });
		el.style.textAlign = "center";
		el.style.padding = "1rem";
		el.style.color = "var(--text-error)";
		const iconEl = el.createDiv();
		setIcon(iconEl, "alert-triangle");
		iconEl.style.marginBottom = "0.25rem";
		el.createDiv({ text: "Query not found \u2014 it may have been deleted" });
		el.createDiv({ text: `ID: ${ctx.tile.queryId}`, cls: "ft-text-xs ft-text-muted" }).style.marginTop = "0.25rem";
		if (ctx.onToggleSettings) {
			const fixBtn = el.createEl("button", { text: "Fix Reference", cls: "ft-text-xs" });
			fixBtn.style.cssText = "margin-top:0.5rem;padding:4px 12px;border-radius:4px;cursor:pointer";
			fixBtn.addEventListener("click", () => {
				ctx.onToggleSettings!(ctx.tile.id);
			});
		}
	}

	private renderLoading(container: HTMLElement): void {
		const el = container.createDiv({ cls: "ft-text-muted ft-text-sm" });
		el.style.textAlign = "center";
		el.style.padding = "1rem";
		el.createDiv({ text: "Loading..." });
	}
}
