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
import { discoverFilterDimensions, buildFilterCacheKey, filterResultForMeasurement } from "./DashboardsTab";

export class AnalyticsDashboardPage {
	constructor(
		private containerEl: HTMLElement,
		private deps: AnalyticsHubDeps,
	) {}

	render(): void {
		this.containerEl.empty();

		this.renderNavLinks();

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

		// Favourite queries below the dashboard tiles
		this.renderFavoritesSection();
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

		const measLink = nav.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const mIcon = measLink.createSpan();
		setIcon(mIcon, "ruler");
		measLink.appendText(" Measurements");
		measLink.addEventListener("click", () => {
			this.deps.navigation.navigateTo("measurements");
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

		// Freshness summary + Refresh All
		const headerRight = header.createDiv();
		headerRight.style.display = "flex";
		headerRight.style.alignItems = "center";
		headerRight.style.gap = "0.5rem";
		headerRight.style.flexShrink = "0";

		const tileTimestamps = dashboard.tiles.map((t) => this.deps.tileResultCache.getTimestamp(t.queryId));
		const summaryText = computeFreshnessSummary(tileTimestamps);
		if (summaryText) {
			const worstLevel = tileTimestamps.some((t) => t !== undefined && getFreshnessLevel(t) === "stale")
				? "stale"
				: tileTimestamps.some((t) => t !== undefined && getFreshnessLevel(t) === "aging")
					? "aging"
					: "fresh";
			const summaryEl = headerRight.createSpan({ text: summaryText, cls: "ft-text-xs" });
			summaryEl.style.color = getFreshnessColor(worstLevel);
		}

		if (dashboard.tiles.length > 0) {
			const refreshBtn = headerRight.createEl("button", { cls: "ft-text-sm" });
			refreshBtn.style.display = "flex";
			refreshBtn.style.alignItems = "center";
			refreshBtn.style.gap = "0.25rem";
			const rIcon = refreshBtn.createSpan();
			setIcon(rIcon, "refresh-cw");
			rIcon.style.width = "14px";
			rIcon.style.height = "14px";
			refreshBtn.createSpan({ text: "Refresh All" });
			refreshBtn.addEventListener("click", () => {
				this.deps.tileResultCache.clear();
				this.deps.scheduleRender();
			});
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

		// Filter bar
		this.renderFilterBar(dashboard);

		// Tile grid
		const grid = this.containerEl.createDiv({ cls: "ft-dashboard-grid" });
		grid.style.display = "grid";
		grid.style.gridTemplateColumns = "repeat(6, 1fr)";
		grid.style.gridAutoRows = "auto";
		grid.style.gap = "1rem";

		const state = this.deps.getState();

		for (const tile of dashboard.tiles) {
			// Resolve effective queryId: measurement's queryId takes precedence
			let effectiveQueryId = tile.queryId;
			const measurement = tile.measurementId
				? (state.measurements ?? []).find((m) => m.id === tile.measurementId)
				: undefined;
			if (measurement) effectiveQueryId = measurement.queryId;

			const query = state.queries.find((q) => q.id === effectiveQueryId);
			const tileHost = grid.createDiv();
			tileHost.style.gridColumn = `span ${Math.min(tile.width, 6)}`;
			const isAutoHeight = tile.autoHeight && tile.width >= 3;
			const rowSpan = Math.min(tile.height, 6);
			tileHost.style.gridRow = isAutoHeight ? "auto" : `span ${rowSpan}`;
			if (!isAutoHeight) tileHost.style.minHeight = `${rowSpan * 180}px`;

			const dashboardFilters = state.dashboardFilters;
			const cacheKey = buildFilterCacheKey(effectiveQueryId, dashboardFilters);
			const tileResult = this.deps.tileResultCache.tryRun(
				cacheKey,
				() => dashboardFilters.length > 0
					? this.deps.analyticsService.runSavedQueryWithFilters(effectiveQueryId, dashboardFilters)
					: this.deps.analyticsService.runSavedQuery(effectiveQueryId),
				() => this.deps.scheduleRender(),
			);

			const filteredResult = filterResultForMeasurement(tileResult.result, measurement, query);

			const renderer = new DashboardTileRenderer(tileHost);
			renderer.render({
				tile,
				query,
				result: filteredResult,
				error: tileResult.error,
				refreshedAt: this.deps.tileResultCache.getTimestamp(cacheKey),
				onRemove: () => {
					this.deps.navigation.navigateTo("dashboards");
				},
				onRefresh: () => {
					this.deps.tileResultCache.clearOne(effectiveQueryId);
					this.deps.scheduleRender();
				},
				measurements: state.measurements ?? [],
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
				onDrillDown: (column, value) => {
					const filters = [...dashboardFilters.map((f) => ({ ...f, values: [...f.values] }))];
					const existing = filters.find((f) => f.column === column);
					if (existing) {
						const idx = existing.values.indexOf(value);
						if (idx >= 0) {
							existing.values.splice(idx, 1);
							if (existing.values.length === 0) {
								filters.splice(filters.indexOf(existing), 1);
							}
						} else {
							existing.values.push(value);
						}
					} else {
						filters.push({ column, values: [value] });
					}
					this.deps.setState({ dashboardFilters: filters });
					this.deps.scheduleRender();
				},
				activeFilters: dashboardFilters,
			} satisfies TileRenderContext);
		}
	}

	// ── Filter bar ──────────────────────────────────────────

	private renderFilterBar(dashboard: Dashboard): void {
		const state = this.deps.getState();
		const filters = state.dashboardFilters;

		// Discover dimensions from filtered tile results (cascading filters)
		const activeFilterColumns = filters.map((f) => f.column);
		const dimensions = discoverFilterDimensions(
			dashboard.tiles,
			(queryId) => {
				const cacheKey = buildFilterCacheKey(queryId, filters);
				return this.deps.tileResultCache.tryRun(
					cacheKey,
					() => filters.length > 0
						? this.deps.analyticsService.runSavedQueryWithFilters(queryId, filters)
						: this.deps.analyticsService.runSavedQuery(queryId),
					() => this.deps.scheduleRender(),
				).result;
			},
			activeFilterColumns,
		);

		if (dimensions.length === 0 && filters.length === 0) return;

		const bar = this.containerEl.createDiv({ cls: "ft-filter-bar" });
		bar.style.display = "flex";
		bar.style.flexWrap = "wrap";
		bar.style.alignItems = "center";
		bar.style.gap = "0.5rem";
		bar.style.marginBottom = "0.75rem";
		bar.style.padding = "0.5rem 0.75rem";
		bar.style.background = "var(--background-secondary)";
		bar.style.borderRadius = "6px";

		bar.createSpan({ text: "Filters:", cls: "ft-text-sm" }).style.fontWeight = "600";

		const shownDimensions = dimensions.slice(0, 4);
		for (const dim of shownDimensions) {
			const activeFilter = filters.find((f) => f.column === dim.column);
			const selectedCount = activeFilter ? activeFilter.values.length : 0;

			const select = bar.createEl("select", { cls: "ft-text-xs" });
			select.style.cssText = "padding:2px 6px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary);cursor:pointer";

			const allOpt = select.createEl("option");
			allOpt.value = "";
			allOpt.textContent = selectedCount > 0
				? `${dim.column}: ${selectedCount} selected`
				: `${dim.column}: All`;
			allOpt.selected = true;

			for (const val of dim.values) {
				const opt = select.createEl("option");
				opt.value = val;
				const isSelected = activeFilter?.values.includes(val);
				opt.textContent = isSelected ? `\u2713 ${val}` : val;
			}

			select.addEventListener("change", () => {
				if (!select.value) {
					const updated = filters.filter((f) => f.column !== dim.column);
					this.deps.setState({ dashboardFilters: updated });
					this.deps.scheduleRender();
					return;
				}
				const value = select.value;
				const updated = filters.map((f) => ({ ...f, values: [...f.values] }));
				const existing = updated.find((f) => f.column === dim.column);
				if (existing) {
					const idx = existing.values.indexOf(value);
					if (idx >= 0) {
						existing.values.splice(idx, 1);
						if (existing.values.length === 0) {
							const filterIdx = updated.indexOf(existing);
							updated.splice(filterIdx, 1);
						}
					} else {
						existing.values.push(value);
					}
				} else {
					updated.push({ column: dim.column, values: [value] });
				}
				this.deps.setState({ dashboardFilters: updated });
				this.deps.scheduleRender();
			});
		}

		if (filters.length > 0) {
			const clearBtn = bar.createEl("span", { cls: "ft-nav-link ft-text-xs" });
			clearBtn.style.cursor = "pointer";
			clearBtn.style.marginLeft = "auto";
			clearBtn.textContent = "Clear all";
			clearBtn.addEventListener("click", () => {
				this.deps.setState({ dashboardFilters: [] });
				this.deps.scheduleRender();
			});
		}

		// Breadcrumb chips — one chip per value
		if (filters.length > 0) {
			const breadcrumb = this.containerEl.createDiv({ cls: "ft-filter-breadcrumb" });
			breadcrumb.style.display = "flex";
			breadcrumb.style.flexWrap = "wrap";
			breadcrumb.style.gap = "0.35rem";
			breadcrumb.style.marginBottom = "0.75rem";

			breadcrumb.createSpan({ text: "Showing:", cls: "ft-text-xs ft-text-muted" });

			for (const f of filters) {
				for (const val of f.values) {
					const chip = breadcrumb.createSpan({ cls: "ft-badge ft-text-xs" });
					chip.style.cssText = "display:inline-flex;align-items:center;gap:0.25rem;padding:2px 8px;border-radius:10px;background:var(--interactive-accent);color:var(--text-on-accent);cursor:default";
					chip.textContent = `${f.column} = ${val}`;

					const closeBtn = chip.createSpan({ text: " \u00d7" });
					closeBtn.style.cursor = "pointer";
					closeBtn.style.fontWeight = "bold";
					closeBtn.addEventListener("click", (e) => {
						e.stopPropagation();
						const updated = filters
							.map((x) => x.column === f.column
								? { ...x, values: x.values.filter((v) => v !== val) }
								: { ...x, values: [...x.values] },
							)
							.filter((x) => x.values.length > 0);
						this.deps.setState({ dashboardFilters: updated });
						this.deps.scheduleRender();
					});
				}
			}
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
		this.renderStat(statsGrid, "ruler", "Measurements", String(state.measurements?.length ?? 0), "measurements");
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
		const favMeasurements = (state.measurements ?? []).filter((m) => m.isFavorite);

		if (favQueries.length === 0 && favMeasurements.length === 0) return;

		// Section container with spacing from dashboard tiles
		const section = this.containerEl.createDiv();
		section.style.marginTop = "2.5rem";
		section.style.paddingTop = "1.5rem";
		section.style.borderTop = "1px solid var(--background-modifier-border)";

		// Headline
		const heading = section.createDiv({ cls: "ft-text-sm" });
		heading.style.fontWeight = "600";
		heading.style.marginBottom = "0.25rem";
		heading.textContent = "Favourite Queries";

		// Description
		section.createDiv({
			text: "Quick access to your starred queries — click to open in the Queries tab",
			cls: "ft-text-xs ft-text-muted",
		}).style.marginBottom = "0.75rem";

		const cardGrid = section.createDiv();
		cardGrid.style.display = "grid";
		cardGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(160px, 1fr))";
		cardGrid.style.gap = "0.5rem";

		for (const q of favQueries) {
			this.renderFavoriteCard(cardGrid, "search", q.name, q.description, () => {
				this.deps.setState({ selectedQueryId: q.id });
				this.deps.navigation.navigateTo("queries");
				this.deps.scheduleRender();
			});
		}

		for (const m of favMeasurements) {
			this.renderFavoriteCard(cardGrid, "ruler", m.name, m.description, () => {
				this.deps.setState({ selectedMeasurementId: m.id });
				this.deps.navigation.navigateTo("measurements");
				this.deps.scheduleRender();
			});
		}
	}

	private renderFavoriteCard(container: HTMLElement, icon: string, name: string, description: string | undefined, onClick: () => void): void {
		const card = container.createDiv({ cls: "ft-stat-card" });
		card.style.cursor = "pointer";
		card.style.padding = "0.75rem";
		card.style.display = "flex";
		card.style.alignItems = "flex-start";
		card.style.gap = "0.5rem";

		const iconEl = card.createSpan();
		setIcon(iconEl, icon);
		iconEl.style.width = "14px";
		iconEl.style.height = "14px";
		iconEl.style.flexShrink = "0";
		iconEl.style.marginTop = "2px";

		const textBlock = card.createDiv();
		textBlock.style.overflow = "hidden";
		textBlock.style.flex = "1";
		textBlock.style.minWidth = "0";

		const nameEl = textBlock.createDiv({ text: name, cls: "ft-text-sm" });
		nameEl.style.fontWeight = "500";
		nameEl.style.overflow = "hidden";
		nameEl.style.textOverflow = "ellipsis";
		nameEl.style.whiteSpace = "nowrap";

		if (description) {
			const descEl = textBlock.createDiv({ text: description, cls: "ft-text-xs ft-text-muted" });
			descEl.style.overflow = "hidden";
			descEl.style.textOverflow = "ellipsis";
			descEl.style.whiteSpace = "nowrap";
			descEl.style.marginTop = "0.15rem";
		}

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
