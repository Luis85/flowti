/**
 * Dashboard page for the Analytics Hub.
 *
 * If a default dashboard is configured, renders its tiles directly (zero-click to metrics).
 * Otherwise shows overview stats + "Set a default dashboard" prompt.
 * Includes a favorites quick-nav section for secondary dashboards and queries.
 */

import { setIcon } from "obsidian";
import type { Dashboard } from "../../domain/analytics/types";
import type { AnalyticsHubDeps } from "./types";
import { DashboardTileRenderer, type TileRenderContext } from "./DashboardTileRenderer";

export class AnalyticsDashboardPage {
	constructor(
		private containerEl: HTMLElement,
		private deps: AnalyticsHubDeps,
	) {}

	render(): void {
		this.containerEl.empty();

		const defaultDashboard = this.deps.analyticsService.getDefaultDashboard();

		if (defaultDashboard) {
			this.renderDefaultDashboard(defaultDashboard);
		} else {
			this.renderFallback();
		}

		this.renderFavoritesSection();
	}

	// ── Default dashboard tile grid ──────────────────────────

	private renderDefaultDashboard(dashboard: Dashboard): void {
		// Dashboard title header
		const header = this.containerEl.createDiv({ cls: "ft-detail-header" });
		header.style.display = "flex";
		header.style.alignItems = "center";
		header.style.justifyContent = "space-between";
		header.style.marginBottom = "0.75rem";

		const titleEl = header.createSpan({ text: dashboard.name, cls: "ft-text-lg" });
		titleEl.style.fontWeight = "600";

		const badge = header.createSpan({ text: "Default", cls: "ft-badge ft-text-xs" });
		badge.style.marginLeft = "0.5rem";

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
		grid.style.gridTemplateColumns = "repeat(2, 1fr)";
		grid.style.gap = "0.75rem";

		const state = this.deps.getState();

		for (const tile of dashboard.tiles) {
			const query = state.queries.find((q) => q.id === tile.queryId);
			const tileHost = grid.createDiv();
			tileHost.style.gridColumn = `span ${Math.min(tile.width, 2)}`;

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
				onRemove: () => {
					// Navigate to dashboards tab for tile management
					this.deps.navigation.navigateTo("dashboards");
				},
				onRefresh: () => {
					this.deps.tileResultCache.clearOne(tile.queryId);
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
		const favDashboards = state.dashboards.filter((d) => d.isFavorite);
		const favQueries = state.queries.filter((q) => q.isFavorite);

		if (favDashboards.length === 0 && favQueries.length === 0) return;

		const section = this.containerEl.createDiv({ cls: "ft-mt-3" });

		const header = section.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Favorites" });
		header.createSpan({
			text: `${favDashboards.length + favQueries.length}`,
			cls: "ft-master-category-count",
		});

		const cardGrid = section.createDiv();
		cardGrid.style.display = "grid";
		cardGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(160px, 1fr))";
		cardGrid.style.gap = "0.5rem";
		cardGrid.style.marginTop = "0.5rem";

		for (const d of favDashboards) {
			this.renderFavoriteCard(cardGrid, "layout-grid", d.name, () => {
				this.deps.setState({ selectedDashboardId: d.id });
				this.deps.navigation.navigateTo("dashboards");
			});
		}

		for (const q of favQueries) {
			this.renderFavoriteCard(cardGrid, "search", q.name, () => {
				this.deps.setState({ selectedQueryId: q.id });
				this.deps.navigation.navigateTo("queries");
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
