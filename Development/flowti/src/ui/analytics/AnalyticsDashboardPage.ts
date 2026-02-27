/**
 * Dashboard page for the Analytics Hub.
 *
 * If a default dashboard is configured, renders its tiles directly (zero-click to metrics).
 * Otherwise shows overview stats + "Set a default dashboard" prompt.
 * Includes a favorites quick-nav section for secondary dashboards and queries.
 */

import { setIcon } from "obsidian";
import type { Dashboard, DashboardTile } from "../../domain/analytics/types";
import type { OnboardingChecklist } from "../../domain/onboarding/types";
import { resolveDateRangeFilter } from "../../domain/analytics/dateUtils";
import { computeFreshnessSummary, getFreshnessLevel, getFreshnessColor } from "../../domain/analytics/freshnessUtils";
import { seedSupplierDashboard } from "../../domain/installer/seedDashboard";
import type { AnalyticsHubDeps } from "./types";
import { DashboardTileRenderer, type TileRenderContext } from "./DashboardTileRenderer";
import { buildFilterCacheKey, discoverDateColumns, filterResultForMeasurement, mergeCrossTileFilter } from "./DashboardsTab";
import { DashboardFilterBar } from "./DashboardFilterBar";

export class AnalyticsDashboardPage {
	private tilePages = new Map<string, number>();

	constructor(
		private containerEl: HTMLElement,
		private deps: AnalyticsHubDeps,
	) {}

	render(): void {
		this.containerEl.empty();

		// Resolve which dashboard to display: explicit homepage selection > default
		const state = this.deps.getState();
		const homepageId = state.homepageDashboardId;
		const activeDashboard = homepageId
			? state.dashboards.find((d) => d.id === homepageId) ?? this.deps.analyticsService.getDefaultDashboard()
			: this.deps.analyticsService.getDefaultDashboard();

		if (activeDashboard) {
			this.renderNavLinks();
			this.renderOnboardingChecklist(activeDashboard);
			this.renderDefaultDashboard(activeDashboard);
		} else {
			this.renderFallback();
		}

		// Favourite queries below the dashboard tiles
		this.renderFavoritesSection();
	}

	// ── Navigation links ─────────────────────────────────────

	private renderNavLinks(): void {
		const nav = this.containerEl.createDiv({ cls: "ft-flex ft-gap-2 ft-mb-2 ft-nav-bar" });

		// Home icon — return to default dashboard
		const state = this.deps.getState();
		const homeLink = nav.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const homeIcon = homeLink.createSpan();
		setIcon(homeIcon, "home");
		homeLink.appendText(" Home");
		if (!state.homepageDashboardId) {
			homeLink.addClass("ft-text-accent");
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
				link.addClass("ft-text-accent");
			}
			link.addEventListener("click", () => {
				this.deps.setState({ homepageDashboardId: d.id });
				this.deps.scheduleRender();
			});
		}

		// Separator when there are favorites
		if (favDashboards.length > 0) {
			nav.createSpan({ cls: "ft-text-muted ft-nav-separator" });
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

	// ── Onboarding checklist (Cycle 46, PBI-ONB-007) ────────

	private renderOnboardingChecklist(_dashboard: Dashboard): void {
		const checklist = this.deps.onboardingService.getChecklist();
		if (!checklist || checklist.dismissed) return;

		// Auto-update milestones based on current state
		this.autoUpdateMilestones(checklist);

		// Check if all milestones are complete → auto-dismiss
		const ms = checklist.milestones;
		const allComplete = ms.installed && ms.dashboardExplored && ms.sampleDataReviewed && ms.ownDataImported && ms.customQueryBuilt;
		if (allComplete) {
			void this.deps.onboardingService.dismissChecklist();
			return;
		}

		// Mark dashboardExplored since we're rendering a dashboard
		if (!ms.dashboardExplored) {
			ms.dashboardExplored = true;
			void this.deps.onboardingService.updateChecklist({ milestones: ms });
		}

		const container = this.containerEl.createDiv({ cls: "ft-card ft-p-3 ft-mb-3 ft-onboarding-card" });

		// Header row: title + collapse/dismiss buttons
		const header = container.createDiv({ cls: `ft-flex ft-justify-between ft-items-center ${checklist.collapsed ? "ft-mb-0" : "ft-mb-05"}` });

		const titleRow = header.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center" });
		const titleIcon = titleRow.createSpan({ cls: "ft-onboarding-icon" });
		setIcon(titleIcon, "rocket");
		titleRow.createSpan({ text: "Getting Started", cls: "ft-font-medium ft-text-sm" });

		const completedCount = Object.values(ms).filter(Boolean).length;
		titleRow.createSpan({
			text: `${completedCount} of 5`,
			cls: "ft-text-xs ft-text-muted",
		});

		const actions = header.createDiv({ cls: "ft-flex ft-gap-1" });

		// Collapse toggle
		const collapseBtn = actions.createEl("span", { cls: "ft-nav-link ft-text-xs" });
		collapseBtn.textContent = checklist.collapsed ? "Expand" : "Collapse";
		collapseBtn.addEventListener("click", () => {
			void this.deps.onboardingService.updateChecklist({ collapsed: !checklist.collapsed });
			this.deps.scheduleRender();
		});

		// Dismiss button
		const dismissBtn = actions.createEl("span", { cls: "ft-nav-link ft-text-xs" });
		dismissBtn.textContent = "\u2715";
		dismissBtn.title = "Dismiss checklist";
		dismissBtn.addEventListener("click", () => {
			void this.deps.onboardingService.dismissChecklist();
			this.deps.scheduleRender();
		});

		if (checklist.collapsed) return;

		// Milestone list
		const list = container.createDiv({ cls: "ft-flex ft-flex-col ft-gap-1" });
		const milestones: Array<{ key: keyof typeof ms; label: string }> = [
			{ key: "installed", label: "Install Flowti" },
			{ key: "dashboardExplored", label: "Explore your Supplier Dashboard" },
			{ key: "sampleDataReviewed", label: "Review the sample data in your queries" },
			{ key: "ownDataImported", label: "Import your own CSV data" },
			{ key: "customQueryBuilt", label: "Build a custom query" },
		];

		for (const { key, label } of milestones) {
			const done = ms[key];
			const row = list.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center" });
			row.createSpan({
				text: done ? "\u2705" : "\u2610",
				cls: "ft-text-sm",
			});
			const textEl = row.createSpan({ text: label, cls: "ft-text-sm" });
			if (done) {
				textEl.addClass("ft-checklist-done");
			}
		}
	}

	private autoUpdateMilestones(checklist: OnboardingChecklist): void {
		const ms = checklist.milestones;
		const state = this.deps.getState();
		let changed = false;

		// sampleDataReviewed: set when user has viewed query results (queries tab visited with results)
		if (!ms.sampleDataReviewed && state.selectedQueryId) {
			ms.sampleDataReviewed = true;
			changed = true;
		}

		// ownDataImported: set when a non-seed query source exists
		const seedQueryNames = new Set(["Supplier Overview - By Supplier", "Supplier Trend - Monthly Spend"]);
		const hasNonSeedQuery = state.queries.some((q) => !seedQueryNames.has(q.name));
		if (!ms.ownDataImported && hasNonSeedQuery) {
			ms.ownDataImported = true;
			changed = true;
		}

		// customQueryBuilt: set when query count > 2 (the seed queries)
		if (!ms.customQueryBuilt && state.queries.length > 2) {
			ms.customQueryBuilt = true;
			changed = true;
		}

		if (changed) {
			void this.deps.onboardingService.updateChecklist({ milestones: ms });
		}
	}

	// ── Default dashboard tile grid ──────────────────────────

	private renderDefaultDashboard(dashboard: Dashboard): void {
		// Dashboard title header
		const header = this.containerEl.createDiv({ cls: "ft-detail-header ft-dashboard-page-header" });

		const titleLeft = header.createDiv({ cls: "ft-dashboard-title-left" });

		const titleInput = titleLeft.createEl("input", { type: "text", cls: "ft-title-input" });
		titleInput.value = dashboard.name;
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
			titleLeft.createSpan({ text: "Default", cls: "ft-badge ft-text-xs ft-flex-shrink-0" });
		} else {
			// Back link to return to default dashboard
			const backLink = titleLeft.createEl("span", { cls: "ft-nav-link ft-text-xs ft-flex-shrink-0" });
			const backIcon = backLink.createSpan({ cls: "ft-icon-xs" });
			setIcon(backIcon, "arrow-left");
			backLink.appendText(" Back");
			backLink.addEventListener("click", () => {
				this.deps.setState({ homepageDashboardId: null });
				this.deps.scheduleRender();
			});
		}

		// Freshness summary + Refresh All
		const headerRight = header.createDiv({ cls: "ft-dashboard-header-right" });

		const tileTimestamps = dashboard.tiles.map((t) => this.deps.tileResultCache.getTimestamp(t.queryId));
		const summaryText = computeFreshnessSummary(tileTimestamps);
		if (summaryText) {
			const worstLevel = tileTimestamps.some((t) => t !== undefined && getFreshnessLevel(t) === "stale")
				? "stale"
				: tileTimestamps.some((t) => t !== undefined && getFreshnessLevel(t) === "aging")
					? "aging"
					: "fresh";
			const summaryEl = headerRight.createSpan({ text: summaryText, cls: "ft-text-xs ft-freshness-summary" });
			summaryEl.style.color = getFreshnessColor(worstLevel);
		}

		if (dashboard.tiles.length > 0) {
			const refreshBtn = headerRight.createEl("button", { cls: "ft-text-xs ft-refresh-btn" });
			const rIcon = refreshBtn.createSpan({ cls: "ft-inline-icon ft-icon-xs" });
			setIcon(rIcon, "refresh-cw");
			refreshBtn.createSpan({ text: "Refresh All" });
			refreshBtn.addEventListener("click", () => {
				this.deps.tileResultCache.clear();
				this.deps.scheduleRender();
			});
		}

		// Dashboard description
		if (dashboard.description) {
			const descEl = this.containerEl.createDiv({ cls: "ft-text-sm ft-text-muted ft-desc-mb" });
			descEl.textContent = dashboard.description;
		}

		if (dashboard.tiles.length === 0) {
			const empty = this.containerEl.createDiv({ cls: "ft-text-muted ft-text-sm ft-empty-tile-state" });
			const emptyIcon = empty.createDiv({ cls: "ft-empty-tile-icon" });
			setIcon(emptyIcon, "grid-3x3");
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
		const grid = this.containerEl.createDiv({ cls: "ft-dashboard-grid ft-tile-grid" });

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
			const crossFilter = state.crossTileFilter;
			const effectiveFilters = crossFilter
				? mergeCrossTileFilter(dashboardFilters, crossFilter)
				: dashboardFilters;
			const resolvedDateRange = state.dateRangeFilter && query
				? resolveDateRangeFilter(state.dateRangeFilter, query.columnTypeHints)
				: null;
			const cacheKey = buildFilterCacheKey(effectiveQueryId, effectiveFilters, resolvedDateRange);
			const hasFilters = effectiveFilters.length > 0 || resolvedDateRange !== null;
			const tileResult = this.deps.tileResultCache.tryRun(
				cacheKey,
				() => hasFilters
					? this.deps.analyticsService.runSavedQueryWithFilters(effectiveQueryId, effectiveFilters, resolvedDateRange ?? undefined)
					: this.deps.analyticsService.runSavedQuery(effectiveQueryId),
				() => this.deps.scheduleRender(),
			);

			const filteredResult = filterResultForMeasurement(tileResult.result, measurement, query);

			// Cross-tile filter source indicator
			if (crossFilter && crossFilter.sourceTileId === tile.id) {
				tileHost.classList.add("ft-tile-filter-source");
			}

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
					this.deps.tileResultCache.clearByQueryId(effectiveQueryId);
					this.deps.scheduleRender();
				},
				currentPage: this.tilePages.get(tile.id) ?? 1,
				onPageChange: (tileId, page) => {
					this.tilePages.set(tileId, page);
					this.deps.scheduleRender();
				},
				measurements: state.measurements ?? [],
				onChartValueColumnChange: (tileId, column) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { chartValueColumn: column } as Partial<DashboardTile>).then(() => {
						this.deps.scheduleRender();
					});
				},
				onChartValueColumnsChange: (tileId, columns) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { chartValueColumns: columns } as Partial<DashboardTile>).then(() => {
						this.deps.scheduleRender();
					});
				},
				onHiddenSeriesChange: (tileId, hiddenSeries) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { hiddenSeries } as Partial<DashboardTile>).then(() => {
						this.deps.scheduleRender();
					});
				},
				onExcludedColumnsChange: (tileId, columns) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { excludedColumns: columns } as Partial<DashboardTile>).then(() => {
						this.deps.scheduleRender();
					});
				},
				onTableKpisToggle: (tileId, show) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { showTableKpis: show } as Partial<DashboardTile>).then(() => {
						this.deps.scheduleRender();
					});
				},
				onColumnOrderChange: (tileId, columns) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { columnOrder: columns } as Partial<DashboardTile>).then(() => {
						this.deps.scheduleRender();
					});
				},
				onViewQuery: (queryId) => {
					this.deps.setState({ selectedQueryId: queryId });
					this.deps.navigation.navigateTo("queries");
					this.deps.scheduleRender();
				},
				onCrossTileFilter: (sourceTileId, column, value) => {
					const current = state.crossTileFilter;
					if (current && current.sourceTileId === sourceTileId && current.column === column && current.value === value) {
						this.deps.setState({ crossTileFilter: null });
					} else {
						this.deps.setState({ crossTileFilter: { sourceTileId, column, value } });
					}
					this.deps.tileResultCache.clear();
					this.deps.scheduleRender();
				},
				activeFilters: effectiveFilters,
			} satisfies TileRenderContext);
		}
	}

	// ── Filter bar ──────────────────────────────────────────

	private renderFilterBar(dashboard: Dashboard): void {
		const state = this.deps.getState();
		const dateColumns = discoverDateColumns(dashboard.tiles, state.queries);
		new DashboardFilterBar(this.containerEl, {
			tiles: dashboard.tiles,
			filters: state.dashboardFilters,
			tileResultCache: this.deps.tileResultCache,
			runQuery: (qid) => this.deps.analyticsService.runSavedQuery(qid),
			runQueryWithFilters: (qid, f) => this.deps.analyticsService.runSavedQueryWithFilters(qid, f),
			onFiltersChanged: (filters) => {
				this.deps.setState({ dashboardFilters: filters });
				this.deps.scheduleRender();
			},
			scheduleRender: () => this.deps.scheduleRender(),
			presets: dashboard.savedFilterPresets,
			onSavePreset: (name, filters) => {
				void this.deps.analyticsService.saveFilterPreset(dashboard.id, name, filters).then(() => this.deps.scheduleRender());
			},
			onDeletePreset: (presetId) => {
				void this.deps.analyticsService.deleteFilterPreset(dashboard.id, presetId).then(() => this.deps.scheduleRender());
			},
			dateRangeFilter: state.dateRangeFilter,
			dateColumns,
			onDateRangeChanged: (filter) => {
				this.deps.setState({ dateRangeFilter: filter });
				this.deps.tileResultCache.clear();
				this.deps.scheduleRender();
			},
			crossTileFilter: state.crossTileFilter,
			onCrossTileFilterClear: () => {
				this.deps.setState({ crossTileFilter: null });
				this.deps.tileResultCache.clear();
				this.deps.scheduleRender();
			},
		}).render();
	}

	// ── Fallback (no default dashboard) ──────────────────────

	private renderFallback(): void {
		const state = this.deps.getState();
		const queryCount = state.queries.length;
		const dashboardCount = state.dashboards.length;

		if (dashboardCount === 0 && queryCount === 0) {
			this.renderEmptyState();
			return;
		}

		// Has some content but no default dashboard — show stats + prompt
		this.renderNavLinks();

		// Stats grid
		const statsGrid = this.containerEl.createDiv({ cls: "ft-stats-grid" });
		this.renderStat(statsGrid, "search", "Saved Queries", String(queryCount), "queries");
		this.renderStat(statsGrid, "ruler", "Measurements", String(state.measurements?.length ?? 0), "measurements");
		this.renderStat(statsGrid, "layout-grid", "Dashboards", String(dashboardCount), "dashboards");

		// Set default prompt
		if (dashboardCount > 0) {
			const prompt = this.containerEl.createDiv({ cls: "ft-detail-actions ft-mt-3 ft-fallback-prompt" });

			const iconEl = prompt.createDiv({ cls: "ft-fallback-icon" });
			setIcon(iconEl, "star");

			prompt.createDiv({
				text: "Set a default dashboard to see your metrics here on open",
				cls: "ft-text-sm ft-text-muted",
			});

			const link = prompt.createEl("span", { cls: "ft-nav-link ft-text-sm ft-mt-1 ft-inline-block ft-mt-05" });
			const linkIcon = link.createSpan();
			setIcon(linkIcon, "layout-grid");
			link.appendText(" Go to Dashboards");
			link.addEventListener("click", () => {
				this.deps.navigation.navigateTo("dashboards");
			});
		}
	}

	// ── Empty state (no dashboards, no queries) ─────────────

	private renderEmptyState(): void {
		const wrapper = this.containerEl.createDiv({ cls: "ft-empty-state-wrapper" });

		// Hero icon
		const iconEl = wrapper.createDiv({ cls: "ft-empty-state-icon ft-icon-lg" });
		setIcon(iconEl, "bar-chart-big");

		// Heading
		wrapper.createDiv({ text: "Welcome to the Analytics Hub", cls: "ft-empty-state-heading" });

		// Subtitle
		wrapper.createDiv({
			text: "Build queries from your vault data, then pin them to dashboards for at-a-glance metrics.",
			cls: "ft-text-sm ft-text-muted ft-mb-15",
		});

		// Action cards grid
		const grid = wrapper.createDiv({ cls: "ft-action-cards-grid" });

		// Card 1: Build a Query
		this.renderActionCard(grid, {
			icon: "search",
			title: "Build a Query",
			description: "Add a CSV source and create your first query in the Query Builder",
			onClick: () => this.deps.navigation.navigateTo("queries"),
		});

		// Card 2: Load Sample Hub
		this.renderActionCard(grid, {
			icon: "zap",
			title: "Load Sample Hub",
			description: "Seed the hub with a supplier dashboard, sample queries, and KPI cards",
			onClick: () => {
				void seedSupplierDashboard(this.deps.analyticsService).then(() => {
					// Refresh state from service so the new dashboard renders
					this.deps.setState({
						queries: this.deps.analyticsService.listQueries(),
						dashboards: this.deps.analyticsService.listDashboards(),
					});
					this.deps.scheduleRender();
				});
			},
		});

		// How it works
		const howSection = wrapper.createDiv({ cls: "ft-text-muted ft-how-section" });

		howSection.createSpan({ text: "How it works", cls: "ft-text-xs ft-how-label" });

		this.renderStep(howSection, "file-spreadsheet", "Add CSV");
		howSection.createSpan({ text: "\u2192", cls: "ft-text-xs" });
		this.renderStep(howSection, "search", "Build Query");
		howSection.createSpan({ text: "\u2192", cls: "ft-text-xs" });
		this.renderStep(howSection, "layout-grid", "Pin to Dashboard");
	}

	private renderActionCard(
		container: HTMLElement,
		opts: { icon: string; title: string; description: string; onClick: () => void },
	): void {
		const card = container.createDiv({ cls: "ft-stat-card ft-action-card" });

		const titleRow = card.createDiv({ cls: "ft-action-card-title" });
		const iconEl = titleRow.createSpan({ cls: "ft-inline-icon ft-icon-sm" });
		setIcon(iconEl, opts.icon);
		titleRow.createSpan({ text: opts.title });

		card.createDiv({ text: opts.description, cls: "ft-text-xs ft-text-muted" });

		card.addEventListener("click", opts.onClick);
	}

	private renderStep(container: HTMLElement, icon: string, label: string): void {
		const step = container.createSpan({ cls: "ft-text-xs ft-step" });
		const iconEl = step.createSpan({ cls: "ft-step-icon ft-icon-xs" });
		setIcon(iconEl, icon);
		step.createSpan({ text: label });
	}

	// ── Favorites section ────────────────────────────────────

	private renderFavoritesSection(): void {
		const state = this.deps.getState();
		const favQueries = state.queries.filter((q) => q.isFavorite);
		const favMeasurements = (state.measurements ?? []).filter((m) => m.isFavorite);

		if (favQueries.length === 0 && favMeasurements.length === 0) return;

		// Section container with spacing from dashboard tiles
		const section = this.containerEl.createDiv({ cls: "ft-favorites-section" });

		// Headline
		const heading = section.createDiv({ cls: "ft-text-sm ft-favorites-heading" });
		heading.textContent = "Favourite queries";

		// Description
		section.createDiv({
			text: "Quick access to your starred queries \u2014 click to open in the Queries tab",
			cls: "ft-text-xs ft-text-muted ft-desc-mb",
		});

		const cardGrid = section.createDiv({ cls: "ft-favorites-card-grid" });

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
		const card = container.createDiv({ cls: "ft-stat-card ft-favorite-card" });

		const iconEl = card.createSpan({ cls: "ft-favorite-card-icon" });
		setIcon(iconEl, icon);

		const textBlock = card.createDiv({ cls: "ft-favorite-card-text" });

		textBlock.createDiv({ text: name, cls: "ft-text-sm ft-favorite-card-name" });

		if (description) {
			textBlock.createDiv({ text: description, cls: "ft-text-xs ft-text-muted ft-favorite-card-desc" });
		}

		card.addEventListener("click", onClick);
	}

	private renderStat(container: HTMLElement, icon: string, label: string, value: string, tabId: string): void {
		const card = container.createDiv({ cls: "ft-stat-card ft-cursor-pointer" });
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
