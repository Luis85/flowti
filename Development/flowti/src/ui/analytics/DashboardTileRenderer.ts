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

		const tileEl = this.container.createDiv({ cls: `ft-dashboard-tile ft-tile-frame${ctx.tile.autoHeight ? "" : " ft-tile-frame-full"}` });

		// ── Header ──────────────────────────────────────
		this.renderHeader(tileEl, ctx);

		// ── Settings panel (collapsible) ────────────────
		if (ctx.settingsOpen) {
			const settingsPanel = tileEl.createDiv({ cls: "ft-tile-settings ft-tile-settings-panel" });

			new TileSettingsPanel(settingsPanel, ctx).render();
		}

		// ── Body ────────────────────────────────────────
		const isChart = ctx.tile.displayMode === "line-chart" || ctx.tile.displayMode === "bar-chart" || ctx.tile.displayMode === "area-chart" || ctx.tile.displayMode === "pie-chart";
		const bodyCls = ["ft-dashboard-tile-body"];
		if (ctx.tile.autoHeight) {
			bodyCls.push("ft-tile-body-auto");
		} else {
			bodyCls.push("ft-tile-body-fixed");
			bodyCls.push(isChart ? "ft-tile-body-overflow-hidden" : "ft-tile-body-overflow-auto");
		}
		bodyCls.push(ctx.tile.displayMode === "table" ? "ft-tile-body-padding-table" : "ft-tile-body-padding-default");
		if (isChart || ctx.tile.displayMode === "stat-card") {
			bodyCls.push("ft-tile-body-flex-col");
		}
		const body = tileEl.createDiv({ cls: bodyCls.join(" ") });

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
		const header = tileEl.createDiv({ cls: "ft-tile-header ft-tile-header-wrap" });

		// Editable title
		if (ctx.onTitleChange) {
			const titleInput = header.createEl("input", { type: "text", cls: "ft-tile-header-input" });
			titleInput.value = ctx.tile.title || ctx.query?.name || "Untitled Tile";
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
		const actions = header.createDiv({ cls: "ft-tile-actions" });

		this.renderHeaderIndicators(actions, ctx);
		this.renderHeaderActions(actions, ctx);
	}

	private renderHeaderIndicators(actions: HTMLElement, ctx: TileRenderContext): void {
		// Measurement badge
		if (ctx.tile.measurementId && ctx.measurements) {
			const m = ctx.measurements.find((mm) => mm.id === ctx.tile.measurementId);
			if (m) {
				actions.createSpan({ text: m.name, cls: "ft-tag ft-text-xs ft-badge-shrink" });
			}
		}

		// Row count badge
		if (ctx.result && ctx.result.rows.length > 0) {
			actions.createSpan({
				text: `${ctx.result.rows.length} rows`,
				cls: "ft-text-xs ft-text-muted ft-badge-compact",
			});
		}

		// Conditional rule indicator dot
		if (ctx.tile.conditionalRules && ctx.tile.conditionalRules.length > 0) {
			const dot = actions.createSpan({ cls: "ft-conditional-dot" });
			dot.setAttribute("aria-label", `${ctx.tile.conditionalRules.length} formatting rule(s)`);
		}

		// Freshness badge
		if (ctx.refreshedAt) {
			const level = getFreshnessLevel(ctx.refreshedAt);
			const badge = actions.createSpan({
				text: formatRelativeTime(ctx.refreshedAt),
				cls: "ft-text-xs ft-badge-compact",
			});
			badge.style.color = getFreshnessColor(level);
		} else if (ctx.result) {
			actions.createSpan({ text: "Not yet refreshed", cls: "ft-text-xs ft-text-muted ft-badge-compact" });
		}
	}

	private renderHeaderActions(actions: HTMLElement, ctx: TileRenderContext): void {
		// Reorder buttons
		if (ctx.onReorder) {
			const upBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted ft-cursor-pointer" });
			const upIcon = upBtn.createSpan({ cls: "ft-icon-sm" });
			setIcon(upIcon, "chevron-up");
			upBtn.setAttribute("aria-label", "Move up");
			upBtn.addEventListener("click", (e) => { e.stopPropagation(); ctx.onReorder!(ctx.tile.id, "up"); });

			const downBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted ft-cursor-pointer" });
			const downIcon = downBtn.createSpan({ cls: "ft-icon-sm" });
			setIcon(downIcon, "chevron-down");
			downBtn.setAttribute("aria-label", "Move down");
			downBtn.addEventListener("click", (e) => { e.stopPropagation(); ctx.onReorder!(ctx.tile.id, "down"); });
		}

		// Display mode dropdown
		if (ctx.onDisplayModeToggle) {
			const modeSelect = actions.createEl("select", { cls: "ft-text-xs ft-tile-mode-select" });
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
			const refreshBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted ft-cursor-pointer" });
			const refreshIcon = refreshBtn.createSpan({ cls: "ft-icon-sm" });
			setIcon(refreshIcon, "refresh-cw");
			refreshBtn.setAttribute("aria-label", "Refresh tile");
			refreshBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				ctx.onRefresh!(ctx.tile.id);
			});
		}

		// CSV export button
		if (ctx.result && ctx.result.rows.length > 0) {
			const csvBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted ft-cursor-pointer" });
			const csvIcon = csvBtn.createSpan({ cls: "ft-icon-sm" });
			setIcon(csvIcon, "download");
			csvBtn.setAttribute("aria-label", "Export CSV");
			csvBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				const title = ctx.tile.title || ctx.query?.name || "tile-export";
				downloadCsvFile(rowsToCsv(ctx.result!.columns, ctx.result!.rows), title);
			});
		}

		// View query button
		if (ctx.onViewQuery && ctx.tile.queryId) {
			const viewBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted ft-cursor-pointer" });
			const viewIcon = viewBtn.createSpan({ cls: "ft-icon-sm" });
			setIcon(viewIcon, "external-link");
			viewBtn.setAttribute("aria-label", "View query");
			viewBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				ctx.onViewQuery!(ctx.tile.queryId);
			});
		}

		// Settings gear icon
		if (ctx.onToggleSettings) {
			const gearBtn = actions.createSpan({ cls: `ft-nav-link ft-text-muted ft-cursor-pointer${ctx.settingsOpen ? " ft-text-accent" : ""}` });
			const gearIcon = gearBtn.createSpan({ cls: "ft-icon-sm" });
			setIcon(gearIcon, "settings");
			gearBtn.setAttribute("aria-label", "Tile settings");
			gearBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				ctx.onToggleSettings!(ctx.tile.id);
			});
		}

		// Remove button (only in management context, not on homepage)
		if (ctx.onToggleSettings) {
			const removeBtn = actions.createSpan({ cls: "ft-nav-link ft-text-muted ft-cursor-pointer" });
			const removeIcon = removeBtn.createSpan({ cls: "ft-icon-sm" });
			setIcon(removeIcon, "trash-2");
			removeBtn.setAttribute("aria-label", "Remove tile");
			removeBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				ctx.onRemove(ctx.tile.id);
			});
		}
	}

	// ── Error / loading states ──────────────────────────────

	private renderError(container: HTMLElement, message: string): void {
		const el = container.createDiv({ cls: "ft-text-muted ft-text-sm ft-tile-status" });
		const iconEl = el.createDiv({ cls: "ft-tile-status-icon-mb" });
		setIcon(iconEl, "alert-triangle");
		el.createDiv({ text: message });
	}

	/** Enhanced error for broken query/measurement references with Fix action. */
	private renderBrokenRef(container: HTMLElement, ctx: TileRenderContext): void {
		const el = container.createDiv({ cls: "ft-text-sm ft-tile-status ft-text-error" });
		const iconEl = el.createDiv({ cls: "ft-tile-status-icon-mb" });
		setIcon(iconEl, "alert-triangle");
		el.createDiv({ text: "Query not found \u2014 it may have been deleted" });
		el.createDiv({ text: `ID: ${ctx.tile.queryId}`, cls: "ft-text-xs ft-text-muted ft-broken-ref-id" });
		if (ctx.onToggleSettings) {
			const fixBtn = el.createEl("button", { text: "Fix reference", cls: "ft-text-xs ft-fix-btn" });
			fixBtn.addEventListener("click", () => {
				ctx.onToggleSettings!(ctx.tile.id);
			});
		}
	}

	private renderLoading(container: HTMLElement): void {
		const el = container.createDiv({ cls: "ft-text-muted ft-text-sm ft-tile-status" });
		el.createDiv({ text: "Loading..." });
	}
}
