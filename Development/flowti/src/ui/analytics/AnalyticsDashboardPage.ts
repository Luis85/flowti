/**
 * Dashboard page for the Analytics Hub.
 *
 * If a default dashboard is configured, renders its tiles directly (zero-click to metrics).
 * Otherwise shows overview stats + "Set a default dashboard" prompt.
 * Includes a favorites quick-nav section for secondary dashboards and queries.
 */

import { setIcon } from "obsidian";
import type { Dashboard, DashboardTile } from "../../domain/analytics/types";
import { computeFreshnessSummary, getFreshnessLevel, getFreshnessColor } from "../../domain/analytics/freshnessUtils";
import type { AnalyticsHubDeps } from "./types";
import { DashboardTileRenderer, type TileRenderContext } from "./DashboardTileRenderer";

export class AnalyticsDashboardPage {
	constructor(
		private containerEl: HTMLElement,
		private deps: AnalyticsHubDeps,
	) {}

	render(): void {
		this.containerEl.empty();

		this.renderNavLinks();
		this.renderFavoritesSection();

		// Resolve which dashboard to display: explicit homepage selection > default
		const state = this.deps.getState();
		const homepageId = state.homepageDashboardId;
		const activeDashboard = homepageId
			? state.dashboards.find((d) => d.id === homepageId) ?? this.deps.analyticsService.getDefaultDashboard()
			: this.deps.analyticsService.getDefaultDashboard();

		if (activeDashboard) {
			this.renderDefaultDashboard(activeDashboard);
		} else {
			this.renderFallback();
		}
	}

	// ── Navigation links ─────────────────────────────────────

	private renderNavLinks(): void {
		const nav = this.containerEl.createDiv({ cls: "ft-flex ft-gap-2 ft-mb-2" });
		nav.style.flexWrap = "wrap";
		nav.style.alignItems = "center";

		// Home icon — return to default dashboard
		const state = this.deps.getState();
		const homeLink = nav.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const homeIcon = homeLink.createSpan();
		setIcon(homeIcon, "home");
		homeLink.appendText(" Home");
		if (!state.homepageDashboardId) {
			homeLink.style.color = "var(--text-accent)";
		}
		homeLink.addEventListener("click", () => {
			this.deps.setState({ homepageDashboardId: null });
			this.deps.scheduleRender();
		});

		// Favorite dashboards — load on homepage
		const favDashboards = state.dashboards.filter((d) => d.isFavorite);
		for (const d of favDashboards) {
			const link = nav.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const icon = link.createSpan();
			setIcon(icon, "layout-grid");
			link.appendText(` ${d.name}`);
			if (state.homepageDashboardId === d.id) {
				link.style.color = "var(--text-accent)";
			}
			link.addEventListener("click", () => {
				this.deps.setState({ homepageDashboardId: d.id });
				this.deps.scheduleRender();
			});
		}

		// Separator when there are favorites
		if (favDashboards.length > 0) {
			const sep = nav.createSpan({ cls: "ft-text-muted" });
			sep.style.cssText = "width:1px;height:14px;background:var(--background-modifier-border);flex-shrink:0";
		}

		const dashLink = nav.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const dIcon = dashLink.createSpan();
		setIcon(dIcon, "layout-grid");
		dashLink.appendText(" Dashboards");
		dashLink.addEventListener("click", () => {
			this.deps.navigation.navigateTo("dashboards");
		});

		const queryLink = nav.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const qIcon = queryLink.createSpan();
		setIcon(qIcon, "search");
		queryLink.appendText(" Queries");
		queryLink.addEventListener("click", () => {
			this.deps.navigation.navigateTo("queries");
		});
	}

	// ── Default dashboard tile grid ──────────────────────────

	private renderDefaultDashboard(dashboard: Dashboard): void {
		// Dashboard title header
		const header = this.containerEl.createDiv({ cls: "ft-detail-header" });
		header.style.display = "flex";
		header.style.alignItems = "center";
		header.style.justifyContent = "space-between";
		header.style.marginBottom = "0.75rem";

		const titleLeft = header.createDiv();
		titleLeft.style.display = "flex";
		titleLeft.style.alignItems = "center";
		titleLeft.style.gap = "0.5rem";
		titleLeft.style.flex = "1";
		titleLeft.style.minWidth = "0";

		const titleInput = titleLeft.createEl("input", { type: "text" });
		titleInput.value = dashboard.name;
		titleInput.style.cssText = "font-weight:600;font-size:var(--font-ui-medium);border:none;background:transparent;color:var(--text-normal);padding:0;flex:1;min-width:0";
		titleInput.addEventListener("blur", () => {
			const val = titleInput.value.trim();
			if (val && val !== dashboard.name) {
				void this.deps.analyticsService.updateDashboard(dashboard.id, { name: val });
			}
		});
		titleInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") { e.preventDefault(); titleInput.blur(); }
		});

		const defaultDashboard = this.deps.analyticsService.getDefaultDashboard();
		const isDefault = defaultDashboard?.id === dashboard.id;

		if (isDefault) {
			const badge = titleLeft.createSpan({ text: "Default", cls: "ft-badge ft-text-xs" });
			badge.style.flexShrink = "0";
		} else {
			// Back link to return to default dashboard
			const backLink = titleLeft.createEl("span", { cls: "ft-nav-link ft-text-xs" });
			backLink.style.flexShrink = "0";
			const backIcon = backLink.createSpan();
			setIcon(backIcon, "arrow-left");
			backIcon.style.width = "12px";
			backIcon.style.height = "12px";
			backLink.appendText(" Back");
			backLink.addEventListener("click", () => {
				this.deps.setState({ homepageDashboardId: null });
				this.deps.scheduleRender();
			});
		}

		// Freshness summary
		const tileTimestamps = dashboard.tiles.map((t) => this.deps.tileResultCache.getTimestamp(t.queryId));
		const summaryText = computeFreshnessSummary(tileTimestamps);
		if (summaryText) {
			const worstLevel = tileTimestamps.some((t) => t !== undefined && getFreshnessLevel(t) === "stale")
				? "stale"
				: tileTimestamps.some((t) => t !== undefined && getFreshnessLevel(t) === "aging")
					? "aging"
					: "fresh";
			const summaryEl = header.createSpan({ text: summaryText, cls: "ft-text-xs" });
			summaryEl.style.color = getFreshnessColor(worstLevel);
		}

		// Dashboard description
		if (dashboard.description) {
			const descEl = this.containerEl.createDiv({ cls: "ft-text-sm ft-text-muted" });
			descEl.style.marginBottom = "0.75rem";
			descEl.textContent = dashboard.description;
		}

		if (dashboard.tiles.length === 0) {
			const empty = this.containerEl.createDiv({ cls: "ft-text-muted ft-text-sm" });
			empty.style.textAlign = "center";
			empty.style.padding = "2rem 1rem";
			const emptyIcon = empty.createDiv();
			setIcon(emptyIcon, "grid-3x3");
			emptyIcon.style.opacity = "0.4";
			emptyIcon.style.marginBottom = "0.5rem";
			empty.createDiv({ text: "No tiles yet" });
			empty.createDiv({
				text: "Go to the Dashboards tab to add tiles to this dashboard",
				cls: "ft-text-xs ft-mt-05",
			});
			return;
		}

		// Tile grid
		const grid = this.containerEl.createDiv({ cls: "ft-dashboard-grid" });
		grid.style.display = "grid";
		grid.style.gridTemplateColumns = "repeat(5, 1fr)";
		grid.style.gridAutoRows = "auto";
		grid.style.gap = "1rem";

		const state = this.deps.getState();

		for (const tile of dashboard.tiles) {
			const query = state.queries.find((q) => q.id === tile.queryId);
			const tileHost = grid.createDiv();
			tileHost.style.gridColumn = `span ${Math.min(tile.width, 5)}`;
			const isAutoHeight = tile.autoHeight && tile.width >= 3;
			const rowSpan = Math.min(tile.height, 5);
			tileHost.style.gridRow = isAutoHeight ? "auto" : `span ${rowSpan}`;
			if (!isAutoHeight) tileHost.style.minHeight = `${rowSpan * 180}px`;

			const tileResult = this.deps.tileResultCache.tryRun(
				tile.queryId,
				(id) => this.deps.analyticsService.runSavedQuery(id),
				() => this.deps.scheduleRender(),
			);

			const renderer = new DashboardTileRenderer(tileHost);
			renderer.render({
				tile,
				query,
				result: tileResult.result,
				error: tileResult.error,
				refreshedAt: this.deps.tileResultCache.getTimestamp(tile.queryId),
				onRemove: () => {
					this.deps.navigation.navigateTo("dashboards");
				},
				onRefresh: () => {
					this.deps.tileResultCache.clearOne(tile.queryId);
					this.deps.scheduleRender();
				},
				onChartValueColumnChange: (tileId, column) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { chartValueColumn: column } as Partial<DashboardTile>).then(() => {
						this.deps.scheduleRender();
					});
				},
				onViewQuery: (queryId) => {
					this.deps.setState({ selectedQueryId: queryId });
					this.deps.navigation.navigateTo("queries");
					this.deps.scheduleRender();
				},
			} satisfies TileRenderContext);
		}
	}

	// ── Fallback (no default dashboard) ──────────────────────

	private renderFallback(): void {
		const state = this.deps.getState();
		const queryCount = state.queries.length;
		const dashboardCount = state.dashboards.length;

		// Stats grid
		const statsGrid = this.containerEl.createDiv({ cls: "ft-stats-grid" });
		this.renderStat(statsGrid, "search", "Saved Queries", String(queryCount), "queries");
		this.renderStat(statsGrid, "layout-grid", "Dashboards", String(dashboardCount), "dashboards");

		// Set default prompt
		if (dashboardCount > 0) {
			const prompt = this.containerEl.createDiv({ cls: "ft-detail-actions ft-mt-3" });
			prompt.style.textAlign = "center";
			prompt.style.padding = "1rem";
			prompt.style.background = "var(--background-secondary)";
			prompt.style.borderRadius = "6px";

			const iconEl = prompt.createDiv();
			setIcon(iconEl, "star");
			iconEl.style.opacity = "0.5";
			iconEl.style.marginBottom = "0.5rem";

			prompt.createDiv({
				text: "Set a default dashboard to see your metrics here on open",
				cls: "ft-text-sm ft-text-muted",
			});

			const link = prompt.createEl("span", { cls: "ft-nav-link ft-text-sm ft-mt-1" });
			link.style.display = "inline-block";
			link.style.marginTop = "0.5rem";
			const linkIcon = link.createSpan();
			setIcon(linkIcon, "layout-grid");
			link.appendText(" Go to Dashboards");
			link.addEventListener("click", () => {
				this.deps.navigation.navigateTo("dashboards");
			});
		} else {
			// No dashboards at all
			const prompt = this.containerEl.createDiv({ cls: "ft-detail-actions ft-mt-3" });
			prompt.style.textAlign = "center";

			const newDashLink = prompt.createEl("span", { cls: "ft-nav-link" });
			const dIcon = newDashLink.createSpan();
			setIcon(dIcon, "layout-grid");
			newDashLink.appendText(" Create your first dashboard");
			newDashLink.addEventListener("click", () => {
				this.deps.navigation.navigateTo("dashboards");
			});
		}
	}

	// ── Favorites section ────────────────────────────────────

	private renderFavoritesSection(): void {
		const state = this.deps.getState();
		const favQueries = state.queries.filter((q) => q.isFavorite);

		if (favQueries.length === 0) return;

		const cardGrid = this.containerEl.createDiv();
		cardGrid.style.display = "grid";
		cardGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(160px, 1fr))";
		cardGrid.style.gap = "0.5rem";
		cardGrid.style.marginBottom = "1.25rem";

		for (const q of favQueries) {
			this.renderFavoriteCard(cardGrid, "search", q.name, () => {
				this.deps.setState({ selectedQueryId: q.id });
				this.deps.navigation.navigateTo("queries");
				this.deps.scheduleRender();
			});
		}
	}

	private renderFavoriteCard(container: HTMLElement, icon: string, name: string, onClick: () => void): void {
		const card = container.createDiv({ cls: "ft-stat-card" });
		card.style.cursor = "pointer";
		card.style.padding = "0.75rem";
		card.style.display = "flex";
		card.style.alignItems = "center";
		card.style.gap = "0.5rem";

		const iconEl = card.createSpan();
		setIcon(iconEl, icon);
		iconEl.style.width = "14px";
		iconEl.style.height = "14px";
		iconEl.style.flexShrink = "0";

		const nameEl = card.createSpan({ text: name, cls: "ft-text-sm" });
		nameEl.style.overflow = "hidden";
		nameEl.style.textOverflow = "ellipsis";
		nameEl.style.whiteSpace = "nowrap";

		card.addEventListener("click", onClick);
	}

	private renderStat(container: HTMLElement, icon: string, label: string, value: string, tabId: string): void {
		const card = container.createDiv({ cls: "ft-stat-card" });
		card.style.cursor = "pointer";
		card.addEventListener("click", () => {
			this.deps.navigation.navigateTo(tabId as "queries" | "dashboards");
		});

		const iconEl = card.createDiv({ cls: "ft-stat-icon" });
		setIcon(iconEl, icon);

		const valEl = card.createDiv({ cls: "ft-stat-value" });
		valEl.textContent = value;

		const labelEl = card.createDiv({ cls: "ft-stat-label" });
		labelEl.textContent = label;
	}
}
