/**
 * Dashboards tab — master/detail split for dashboard management.
 *
 * Master panel: dashboard list with name, tile count, create/delete.
 * Detail panel: CSS Grid tile layout for the selected dashboard.
 */

import { Notice, setIcon, type EventRef } from "obsidian";
import type { CrossTileFilter, Dashboard, DashboardTile, Measurement, AnalyticsResult, QueryDateRangeFilter, ResultRow, SavedAnalyticsQuery } from "../../domain/analytics/types";
import { resolveDateRangeFilter } from "../../domain/analytics/dateUtils";
import { computeFreshnessSummary, getFreshnessLevel, getFreshnessColor } from "../../domain/analytics/freshnessUtils";
import type { AnalyticsHubDeps, NavigationStackEntry } from "./types";
import { MAX_BREADCRUMB_DEPTH } from "./types";
import { DashboardBreadcrumbs } from "./DashboardBreadcrumbs";
import { DashboardTileRenderer, type TileRenderContext } from "./DashboardTileRenderer";
import { AddTileDialog } from "./AddTileDialog";
import { DashboardNameModal } from "./DashboardNameModal";
import { DashboardQueryMap, getSourceBasenames } from "./DashboardQueryMap";
import { DashboardFilterBar } from "./DashboardFilterBar";
import { FolderPickerModal, getVaultFolders } from "../FolderPickerModal";

type DashboardSortKey = "name" | "tiles" | "updated";

export class DashboardsTab {
	private addTileDialogVisible = false;
	private openSettingsTileId: string | null = null;
	private tilePages = new Map<string, number>();
	private queryMapCollapsed = false;
	private sortKey: DashboardSortKey = "name";
	private navigationStack: NavigationStackEntry[] = [];

	// ── File watcher state (PBI-ANA-133) ────────────────────
	private fileWatcherRef: EventRef | null = null;
	private watcherDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	private watchedDashboardId: string | null = null;
	private modifiedSourcePaths = new Set<string>();

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: AnalyticsHubDeps,
	) {}

	// ── Master panel ─────────────────────────────────────────

	renderMaster(): void {
		this.masterEl.empty();

		const state = this.deps.getState();

		// Consume pending entity ID from cross-tab navigation
		if (state.pendingEntityId) {
			this.deps.setState({ selectedDashboardId: state.pendingEntityId, pendingEntityId: null });
		}

		let dashboards = state.dashboards;
		if (state.filterText) {
			dashboards = dashboards.filter((d) =>
				d.name.toLowerCase().includes(state.filterText.toLowerCase()),
			);
		}

		// Header
		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Dashboards" });
		header.createSpan({
			text: `${dashboards.length}`,
			cls: "ft-master-category-count",
		});
		const spacer = header.createDiv();
		spacer.addClass("ft-flex-1");
		const importBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const importIcon = importBtn.createSpan();
		setIcon(importIcon, "download");
		importBtn.setAttribute("aria-label", "Import JSON");
		importBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.importFromJson();
		});

		// Sort dropdown
		const sortSelect = header.createEl("select", { cls: "ft-text-xs" });
		sortSelect.style.cssText = "padding:1px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary);cursor:pointer;font-size:var(--font-ui-smaller)";
		for (const opt of [{ v: "name", l: "Name" }, { v: "tiles", l: "Tiles" }, { v: "updated", l: "Updated" }]) {
			const o = sortSelect.createEl("option");
			o.value = opt.v;
			o.textContent = opt.l;
			if (opt.v === this.sortKey) o.selected = true;
		}
		sortSelect.addEventListener("change", () => {
			this.sortKey = sortSelect.value as DashboardSortKey;
			this.renderMaster();
		});

		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.setAttribute("aria-label", "New Dashboard");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.createDashboard();
		});

		// Sort: favorites first, then by selected key
		dashboards = [...dashboards].sort((a, b) => {
			if (a.isFavorite && !b.isFavorite) return -1;
			if (!a.isFavorite && b.isFavorite) return 1;
			if (this.sortKey === "tiles") return (b.tiles?.length ?? 0) - (a.tiles?.length ?? 0);
			if (this.sortKey === "updated") return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
			return a.name.localeCompare(b.name);
		});

		// List
		if (dashboards.length === 0) {
			const empty = this.masterEl.createDiv({ cls: "ft-text-muted ft-text-sm" });
			empty.style.padding = "1rem";
			empty.style.textAlign = "center";
			empty.textContent = "No dashboards yet";
		} else {
			for (const d of dashboards) {
				this.renderDashboardRow(d);
			}
		}
	}

	private renderDashboardRow(dashboard: Dashboard): void {
		const state = this.deps.getState();
		const isSelected = state.selectedDashboardId === dashboard.id;

		const row = this.masterEl.createDiv({ cls: "ft-master-item" });
		if (isSelected) row.addClass("ft-active");
		row.style.cursor = "pointer";
		row.style.display = "flex";
		row.style.alignItems = "center";
		row.style.justifyContent = "space-between";

		const left = row.createDiv();
		left.style.display = "flex";
		left.style.alignItems = "center";
		left.style.gap = "0.5rem";
		left.style.flex = "1";
		left.style.minWidth = "0";

		// Star toggle
		const starBtn = left.createSpan({ cls: "ft-nav-link" });
		starBtn.style.flexShrink = "0";
		starBtn.style.cursor = "pointer";
		const starIcon = starBtn.createSpan();
		setIcon(starIcon, "star");
		starIcon.style.width = "14px";
		starIcon.style.height = "14px";
		if (!dashboard.isFavorite) {
			starBtn.style.opacity = "0.3";
		}
		starBtn.setAttribute("aria-label", dashboard.isFavorite ? "Unfavorite" : "Favorite");
		starBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.deps.analyticsService.toggleDashboardFavorite(dashboard.id);
		});

		const iconEl = left.createSpan();
		setIcon(iconEl, "layout-grid");
		iconEl.style.width = "14px";
		iconEl.style.height = "14px";
		iconEl.style.flexShrink = "0";

		const nameEl = left.createSpan({ text: dashboard.name, cls: "ft-text-sm" });
		nameEl.style.overflow = "hidden";
		nameEl.style.textOverflow = "ellipsis";
		nameEl.style.whiteSpace = "nowrap";

		const tileCount = left.createSpan({
			text: `${dashboard.tiles.length}`,
			cls: "ft-badge ft-text-xs",
		});
		tileCount.style.flexShrink = "0";

		// Default badge
		const defaultDashboard = this.deps.analyticsService.getDefaultDashboard();
		if (defaultDashboard?.id === dashboard.id) {
			const defaultBadge = left.createSpan({ text: "Default", cls: "ft-badge ft-text-xs" });
			defaultBadge.style.flexShrink = "0";
			defaultBadge.style.background = "var(--interactive-accent)";
			defaultBadge.style.color = "var(--text-on-accent)";
		}

		// Delete button
		const deleteBtn = row.createSpan({ cls: "ft-nav-link ft-text-muted" });
		deleteBtn.style.flexShrink = "0";
		const deleteIcon = deleteBtn.createSpan();
		setIcon(deleteIcon, "trash-2");
		deleteIcon.style.width = "14px";
		deleteIcon.style.height = "14px";
		deleteBtn.style.cursor = "pointer";
		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.deleteDashboard(dashboard);
		});

		row.addEventListener("click", () => {
			this.pushNavigation({ level: "dashboard", label: dashboard.name, dashboardId: dashboard.id });
			this.tilePages.clear();
			this.deps.setState({ selectedDashboardId: dashboard.id, dashboardFilters: [], dateRangeFilter: null, crossTileFilter: null });
			this.deps.scheduleRender();
		});
	}

	// ── Detail panel ─────────────────────────────────────────

	renderDetail(): void {
		const scrollParent = this.detailEl.parentElement;
		const scrollTop = scrollParent?.scrollTop ?? 0;

		this.detailEl.empty();

		const state = this.deps.getState();
		const dashboard = state.dashboards.find((d) => d.id === state.selectedDashboardId);

		if (!dashboard) {
			this.renderEmptyDetail();
			return;
		}

		this.renderDashboardDetail(dashboard);

		if (scrollParent && scrollTop > 0) {
			requestAnimationFrame(() => { scrollParent.scrollTop = scrollTop; });
		}
	}

	private renderEmptyDetail(): void {
		this.clearFileWatcher();
		const empty = this.detailEl.createDiv({ cls: "ft-empty-detail" });
		empty.style.textAlign = "center";
		empty.style.padding = "3rem 1.5rem";
		const iconEl = empty.createDiv();
		setIcon(iconEl, "layout-grid");
		iconEl.style.fontSize = "2rem";
		iconEl.style.opacity = "0.5";
		iconEl.style.marginBottom = "0.5rem";
		empty.createDiv({ text: "Select a dashboard", cls: "ft-text-muted" });
		empty.createDiv({
			text: "Pick a dashboard from the list, or create a new one",
			cls: "ft-text-muted ft-text-sm ft-mt-1",
		});
	}

	private renderDashboardDetail(dashboard: Dashboard): void {
		// Register file watcher for auto-refresh (re-registers on dashboard switch)
		this.registerFileWatcher(dashboard);

		// Breadcrumb navigation bar (hidden at root level)
		new DashboardBreadcrumbs(this.detailEl, {
			stack: this.navigationStack,
			onNavigate: (targetIndex) => this.navigateToBreadcrumb(targetIndex),
			onBack: () => this.navigateBack(),
		}).render();

		// Header row
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		header.style.display = "flex";
		header.style.alignItems = "center";
		header.style.justifyContent = "space-between";
		header.style.marginBottom = "0.5rem";

		const titleLeft = header.createDiv();
		titleLeft.style.display = "flex";
		titleLeft.style.alignItems = "center";
		titleLeft.style.gap = "0.5rem";
		titleLeft.style.flex = "1";
		titleLeft.style.minWidth = "0";

		// Editable name
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

		const isDefault = this.deps.analyticsService.getDefaultDashboard()?.id === dashboard.id;
		if (isDefault) {
			const badge = titleLeft.createSpan({ text: "Default", cls: "ft-badge ft-text-xs" });
			badge.style.background = "var(--interactive-accent)";
			badge.style.color = "var(--text-on-accent)";
			badge.style.flexShrink = "0";
		}

		// Freshness summary
		if (dashboard.tiles.length > 0) {
			const tileTimestamps = dashboard.tiles.map((t) => this.deps.tileResultCache.getTimestamp(t.queryId));
			const summaryText = computeFreshnessSummary(tileTimestamps);
			if (summaryText) {
				const worstLevel = tileTimestamps.some((t) => t !== undefined && getFreshnessLevel(t) === "stale")
					? "stale"
					: tileTimestamps.some((t) => t !== undefined && getFreshnessLevel(t) === "aging")
						? "aging"
						: "fresh";
				const summaryEl = titleLeft.createSpan({ text: summaryText, cls: "ft-text-xs" });
				summaryEl.style.cssText = `color:${getFreshnessColor(worstLevel)};font-size:0.65rem;opacity:0.8;flex-shrink:0`;
			}
		}

		const headerActions = header.createDiv();
		headerActions.style.display = "flex";
		headerActions.style.alignItems = "center";
		headerActions.style.gap = "0.5rem";
		headerActions.style.flexShrink = "0";

		if (!isDefault) {
			const setDefaultBtn = headerActions.createEl("button", { cls: "ft-text-sm" });
			setDefaultBtn.style.display = "flex";
			setDefaultBtn.style.alignItems = "center";
			setDefaultBtn.style.gap = "0.25rem";
			const defIcon = setDefaultBtn.createSpan();
			defIcon.style.display = "inline-flex";
			defIcon.style.alignItems = "center";
			setIcon(defIcon, "star");
			const defSvg = defIcon.querySelector("svg");
			if (defSvg) { defSvg.style.width = "14px"; defSvg.style.height = "14px"; }
			setDefaultBtn.createSpan({ text: "Set as Default" });
			setDefaultBtn.addEventListener("click", () => {
				void this.deps.analyticsService.setDefaultDashboard(dashboard.id);
			});
		}

		// Refresh All
		if (dashboard.tiles.length > 0) {
			const refreshAllBtn = headerActions.createEl("button", { cls: "ft-text-sm" });
			refreshAllBtn.style.display = "flex";
			refreshAllBtn.style.alignItems = "center";
			refreshAllBtn.style.gap = "0.25rem";
			const rIcon = refreshAllBtn.createSpan();
			rIcon.style.display = "inline-flex";
			rIcon.style.alignItems = "center";
			setIcon(rIcon, "refresh-cw");
			const rSvg = rIcon.querySelector("svg");
			if (rSvg) { rSvg.style.width = "14px"; rSvg.style.height = "14px"; }
			refreshAllBtn.createSpan({ text: "Refresh All" });
			refreshAllBtn.addEventListener("click", () => {
				this.deps.tileResultCache.clear();
				this.deps.scheduleRender();
			});
		}

		// Export Summary
		if (dashboard.tiles.length > 0) {
			const exportBtn = headerActions.createEl("button", { cls: "ft-text-sm" });
			exportBtn.style.display = "flex";
			exportBtn.style.alignItems = "center";
			exportBtn.style.gap = "0.25rem";
			const eIcon = exportBtn.createSpan();
			eIcon.style.display = "inline-flex";
			eIcon.style.alignItems = "center";
			setIcon(eIcon, "clipboard-copy");
			const eSvg = eIcon.querySelector("svg");
			if (eSvg) { eSvg.style.width = "14px"; eSvg.style.height = "14px"; }
			exportBtn.createSpan({ text: "Export" });
			exportBtn.addEventListener("click", () => {
				void this.exportDashboardSummary(dashboard);
			});

			// Export Template JSON to vault folder
			const templateBtn = headerActions.createEl("button", { cls: "ft-text-sm" });
			templateBtn.style.display = "flex";
			templateBtn.style.alignItems = "center";
			templateBtn.style.gap = "0.25rem";
			const tIcon = templateBtn.createSpan();
			tIcon.style.display = "inline-flex";
			tIcon.style.alignItems = "center";
			setIcon(tIcon, "file-json");
			const tSvg = tIcon.querySelector("svg");
			if (tSvg) { tSvg.style.width = "14px"; tSvg.style.height = "14px"; }
			templateBtn.createSpan({ text: "Save Template" });
			templateBtn.addEventListener("click", () => {
				void this.exportDashboardTemplate(dashboard);
			});
		}

		const addTileBtn = headerActions.createEl("button", { cls: "ft-text-sm" });
		addTileBtn.style.display = "flex";
		addTileBtn.style.alignItems = "center";
		addTileBtn.style.gap = "0.25rem";
		const btnIcon = addTileBtn.createSpan();
		btnIcon.style.display = "inline-flex";
		btnIcon.style.alignItems = "center";
		setIcon(btnIcon, "plus");
		const btnSvg = btnIcon.querySelector("svg");
		if (btnSvg) { btnSvg.style.width = "14px"; btnSvg.style.height = "14px"; }
		addTileBtn.createSpan({ text: "Add Tile" });
		addTileBtn.addEventListener("click", () => {
			this.addTileDialogVisible = !this.addTileDialogVisible;
			this.deps.scheduleRender();
		});

		// Editable description
		const descRow = this.detailEl.createDiv({ cls: "ft-mb-1" });
		const descInput = descRow.createEl("input", { type: "text" });
		descInput.value = dashboard.description ?? "";
		descInput.placeholder = "Add a description...";
		descInput.style.cssText = "width:100%;border:none;background:transparent;color:var(--text-muted);font-size:var(--font-ui-small);padding:0.25rem 0";
		descInput.addEventListener("blur", () => {
			const val = descInput.value.trim();
			if (val !== (dashboard.description ?? "")) {
				void this.deps.analyticsService.updateDashboard(dashboard.id, { description: val || undefined });
			}
		});
		descInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") { e.preventDefault(); descInput.blur(); }
		});

		// Add tile dialog (conditionally visible)
		if (this.addTileDialogVisible) {
			const dialogHost = this.detailEl.createDiv({ cls: "ft-mb-1" });
			new AddTileDialog({
				container: dialogHost,
				queries: this.deps.getState().queries,
				measurements: this.deps.getState().measurements,
				onAdd: (queryId, displayMode, title, measurementId) => {
					void this.deps.analyticsService.addTile(dashboard.id, queryId, displayMode).then(async (tile) => {
						if (tile && (title || measurementId)) {
							const updates: Record<string, unknown> = {};
							if (title) updates.title = title;
							if (measurementId) updates.measurementId = measurementId;
							await this.deps.analyticsService.updateTile(dashboard.id, tile.id, updates);
						}
						this.addTileDialogVisible = false;
						this.deps.scheduleRender();
					});
				},
				onCancel: () => {
					this.addTileDialogVisible = false;
					this.deps.scheduleRender();
				},
			}).render();
		}

		// Filter bar + breadcrumb
		if (dashboard.tiles.length > 0) {
			this.renderFilterBar(dashboard);
		}

		// Tile grid
		if (dashboard.tiles.length === 0 && !this.addTileDialogVisible) {
			const empty = this.detailEl.createDiv({ cls: "ft-text-muted ft-text-sm" });
			empty.style.textAlign = "center";
			empty.style.padding = "2rem 1rem";
			const emptyIcon = empty.createDiv();
			setIcon(emptyIcon, "grid-3x3");
			emptyIcon.style.opacity = "0.4";
			emptyIcon.style.marginBottom = "0.5rem";
			empty.createDiv({ text: "No tiles yet" });
			empty.createDiv({
				text: "Click \"Add Tile\" to pin a saved query to this dashboard",
				cls: "ft-text-xs ft-mt-05",
			});
			return;
		}

		const grid = this.detailEl.createDiv({ cls: "ft-dashboard-grid" });
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
			tileHost.style.minWidth = "0";
			const isAutoHeight = tile.autoHeight && tile.width >= 3;
			const rowSpan = Math.min(tile.height, 6);
			tileHost.style.gridRow = isAutoHeight ? "auto" : `span ${rowSpan}`;
			if (!isAutoHeight) tileHost.style.minHeight = `${rowSpan * 180}px`;

			const dashboardFilters = state.dashboardFilters;
			// Merge cross-tile filter into dimension filters for query execution
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
				onRemove: (tileId) => {
					void this.deps.analyticsService.removeTile(dashboard.id, tileId).then(() => {
						this.deps.scheduleRender();
					});
				},
				onRefresh: () => {
					this.deps.tileResultCache.clearByQueryId(effectiveQueryId);
					this.deps.scheduleRender();
				},
				onReorder: (tileId, direction) => {
					void this.deps.analyticsService.reorderTile(dashboard.id, tileId, direction).then(() => {
						this.deps.scheduleRender();
					});
				},
				onTitleChange: (tileId, newTitle) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { title: newTitle }).then(() => {
						this.deps.scheduleRender();
					});
				},
				onDisplayModeToggle: (tileId, newMode) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { displayMode: newMode }).then(() => {
						this.deps.tileResultCache.clearOne(tile.queryId);
						this.deps.scheduleRender();
					});
				},
				settingsOpen: this.openSettingsTileId === tile.id,
				onToggleSettings: (tileId) => {
					this.openSettingsTileId = this.openSettingsTileId === tileId ? null : tileId;
					this.deps.scheduleRender();
				},
				currentPage: this.tilePages.get(tile.id) ?? 1,
				onPageChange: (tileId, page) => {
					this.tilePages.set(tileId, page);
					this.deps.scheduleRender();
				},
				onRulesChange: (tileId, rules) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { conditionalRules: rules } as Partial<DashboardTile>).then(() => {
						this.deps.scheduleRender();
					});
				},
				onNumberFormatChange: (tileId, format) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { numberFormat: format } as Partial<DashboardTile>).then(() => {
						this.deps.scheduleRender();
					});
				},
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
				queries: state.queries,
				onQueryChange: (tileId, newQueryId) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { queryId: newQueryId } as Partial<DashboardTile>).then(() => {
						this.deps.tileResultCache.clearOne(newQueryId);
						this.deps.scheduleRender();
					});
				},
				measurements: state.measurements ?? [],
				onMeasurementChange: (tileId, measurementId) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { measurementId } as Partial<DashboardTile>).then(() => {
						this.deps.tileResultCache.clear();
						this.deps.scheduleRender();
					});
				},
				onWidthChange: (tileId, width) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { width } as Partial<DashboardTile>).then(() => {
						this.deps.scheduleRender();
					});
				},
				onHeightChange: (tileId, height) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { height } as Partial<DashboardTile>).then(() => {
						this.deps.scheduleRender();
					});
				},
				onSparklineToggle: (tileId, show) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { showSparkline: show } as Partial<DashboardTile>).then(() => {
						this.deps.scheduleRender();
					});
				},
				onRowLimitChange: (tileId, limit) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { rowLimit: limit } as Partial<DashboardTile>).then(() => {
						this.deps.scheduleRender();
					});
				},
				onAutoHeightToggle: (tileId, auto) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { autoHeight: auto } as Partial<DashboardTile>).then(() => {
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
				onTableKpiLabelChange: (tileId, label) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { tableKpiLabel: label || undefined } as Partial<DashboardTile>).then(() => {
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
					// Toggle: same tile+column+value clears the filter
					const isToggleOff = current && current.sourceTileId === sourceTileId && current.column === column && current.value === value;
					const newFilter = isToggleOff ? null : { sourceTileId, column, value };
					this.deps.setState({ crossTileFilter: newFilter });
					this.deps.tileResultCache.clear();
					this.updateFilteredBreadcrumb(
						mergeCrossTileFilter(dashboardFilters, newFilter),
						dashboard.id,
					);
					this.deps.scheduleRender();
				},
				activeFilters: effectiveFilters,
			} satisfies TileRenderContext);
		}

		// Query map — collapsible summary of queries behind tiles (at bottom)
		if (dashboard.tiles.length > 0) {
			const queryMap = this.deps.analyticsService.getDashboardQueryMap(dashboard.id);
			const entries = [...queryMap.values()].map((e) => ({
				...e,
				sourceBasenames: getSourceBasenames(e.query),
			}));
			new DashboardQueryMap(this.detailEl, entries, this.queryMapCollapsed, {
				onToggleCollapse: () => {
					this.queryMapCollapsed = !this.queryMapCollapsed;
					this.deps.scheduleRender();
				},
				onViewQuery: (queryId) => {
					this.deps.setState({ selectedQueryId: queryId });
					this.deps.navigation.navigateTo("queries");
					this.deps.scheduleRender();
				},
			}).render();
		}
	}

	// ── Dashboard CRUD ───────────────────────────────────────

	private createDashboard(): void {
		new DashboardNameModal(this.deps.app, {
			onConfirm: (name) => {
				void this.deps.analyticsService.createDashboard(name).then((dashboard) => {
					this.deps.setState({ selectedDashboardId: dashboard.id });
					this.deps.scheduleRender();
				});
			},
		}).open();
	}

	private async deleteDashboard(dashboard: Dashboard): Promise<void> {
		const state = this.deps.getState();
		await this.deps.analyticsService.deleteDashboard(dashboard.id);
		if (state.selectedDashboardId === dashboard.id) {
			this.deps.setState({ selectedDashboardId: null });
		}
		this.deps.scheduleRender();
	}

	private async importFromJson(): Promise<void> {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json";
		input.addEventListener("change", () => {
			const file = input.files?.[0];
			if (!file) return;

			const reader = new FileReader();
			reader.onload = async () => {
				try {
					const template = JSON.parse(reader.result as string);
					if (!template.name || !template.queries || !template.tiles) {
						new Notice("Invalid template: missing name, queries, or tiles");
						return;
					}
					const dashboard = await this.deps.analyticsService.importDashboardFromJson(template);
					this.deps.setState({ selectedDashboardId: dashboard.id });
					this.deps.scheduleRender();
					new Notice(`Dashboard "${dashboard.name}" imported`);
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					new Notice(`Import failed: ${msg}`, 5000);
				}
			};
			reader.readAsText(file);
		});
		input.click();
	}

	private async exportDashboardSummary(dashboard: Dashboard): Promise<void> {
		const state = this.deps.getState();
		const lines: string[] = [];
		lines.push(`# ${dashboard.name}`);
		if (dashboard.description) lines.push(`\n${dashboard.description}`);
		lines.push(`\n**Tiles:** ${dashboard.tiles.length}`);
		lines.push("");
		for (const tile of dashboard.tiles) {
			const query = state.queries.find((q) => q.id === tile.queryId);
			const title = tile.title || query?.name || "Untitled";
			lines.push(`- **${title}** (${tile.displayMode}) — query: ${query?.name ?? "unknown"}`);
		}
		lines.push(`\n*Exported from Analytics Hub on ${new Date().toLocaleDateString()}*`);
		await navigator.clipboard.writeText(lines.join("\n"));
		new Notice("Dashboard summary copied to clipboard");
	}

	private async exportDashboardTemplate(dashboard: Dashboard): Promise<void> {
		const template = this.deps.analyticsService.buildDashboardTemplate(
			dashboard.id,
			dashboard.name,
			dashboard.description ?? "",
			"Analytics",
		);
		if (!template) {
			new Notice("Could not build template — dashboard has no tiles with saved queries");
			return;
		}

		// Strip internal fields (id, createdAt) for a clean importable JSON
		const exportObj = {
			name: template.name,
			description: template.description,
			queries: template.queries,
			tiles: template.tiles,
		};
		const json = JSON.stringify(exportObj, null, 2);
		const sanitizedName = dashboard.name.replace(/[^a-zA-Z0-9_ -]/g, "").trim() || "Dashboard Template";

		const folders = getVaultFolders(this.deps.app);
		new FolderPickerModal(this.deps.app, folders, async (folder) => {
			const filePath = folder ? `${folder}/${sanitizedName}.json` : `${sanitizedName}.json`;
			try {
				await this.deps.app.vault.create(filePath, json);
				new Notice(`Template saved to ${filePath}`);
			} catch {
				// File might already exist — try with timestamp suffix
				const ts = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
				const fallbackPath = folder ? `${folder}/${sanitizedName} ${ts}.json` : `${sanitizedName} ${ts}.json`;
				try {
					await this.deps.app.vault.create(fallbackPath, json);
					new Notice(`Template saved to ${fallbackPath}`);
				} catch (innerErr) {
					new Notice(`Failed to save template: ${innerErr instanceof Error ? innerErr.message : String(innerErr)}`);
				}
			}
		}).open();
	}

	// ── Dashboard filter bar ────────────────────────────────

	private renderFilterBar(dashboard: Dashboard): void {
		const state = this.deps.getState();
		const dateColumns = discoverDateColumns(dashboard.tiles, state.queries);
		new DashboardFilterBar(this.detailEl, {
			tiles: dashboard.tiles,
			filters: state.dashboardFilters,
			tileResultCache: this.deps.tileResultCache,
			runQuery: (qid) => this.deps.analyticsService.runSavedQuery(qid),
			runQueryWithFilters: (qid, f) => this.deps.analyticsService.runSavedQueryWithFilters(qid, f),
			onFiltersChanged: (filters) => {
				this.updateFilteredBreadcrumb(filters, dashboard.id);
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

	// ── Breadcrumb navigation ────────────────────────────────

	/** Push a navigation entry, replacing any existing entry at the same level. */
	private pushNavigation(entry: NavigationStackEntry): void {
		// Remove any existing entry at the same or deeper level
		const levelOrder: NavigationStackEntry["level"][] = ["list", "dashboard", "filtered", "tile"];
		const targetIdx = levelOrder.indexOf(entry.level);
		this.navigationStack = this.navigationStack.filter(
			(e) => levelOrder.indexOf(e.level) < targetIdx,
		);
		this.navigationStack.push(entry);
		if (this.navigationStack.length > MAX_BREADCRUMB_DEPTH) {
			this.navigationStack = this.navigationStack.slice(-MAX_BREADCRUMB_DEPTH);
		}
	}

	/** Update "filtered" breadcrumb level based on current dashboard filters. */
	private updateFilteredBreadcrumb(
		filters: Array<{ column: string; values: string[] }>,
		dashboardId: string,
	): void {
		// Remove existing filtered entry
		this.navigationStack = this.navigationStack.filter((e) => e.level !== "filtered");
		if (filters.length > 0) {
			const filterLabel = filters.map((f) => `${f.column}`).join(", ");
			this.navigationStack.push({
				level: "filtered",
				label: `Filtered (${filterLabel})`,
				dashboardId,
			});
		}
	}

	/** Navigate to a specific breadcrumb index (pop everything after it). */
	private navigateToBreadcrumb(targetIndex: number): void {
		if (targetIndex < 0 || targetIndex >= this.navigationStack.length) return;
		const entry = this.navigationStack[targetIndex];
		this.navigationStack = this.navigationStack.slice(0, targetIndex + 1);

		// Apply state for the target level
		if (entry.level === "list" || entry.level === "dashboard") {
			// Clear filters and pagination when navigating back to list or dashboard level
			this.tilePages.clear();
			this.deps.setState({ dashboardFilters: [], dateRangeFilter: null, crossTileFilter: null });
		}
		this.deps.scheduleRender();
	}

	/** Navigate one level back in the breadcrumb stack. */
	private navigateBack(): void {
		if (this.navigationStack.length <= 1) return;
		this.navigationStack.pop();
		const current = this.navigationStack[this.navigationStack.length - 1];

		if (current.level === "list") {
			this.tilePages.clear();
			this.deps.setState({ selectedDashboardId: null, dashboardFilters: [], dateRangeFilter: null, crossTileFilter: null });
		} else if (current.level === "dashboard") {
			this.tilePages.clear();
			this.deps.setState({ dashboardFilters: [], dateRangeFilter: null, crossTileFilter: null });
		}
		this.deps.scheduleRender();
	}

	/** Clear navigation stack (called on explicit tab switch). */
	clearNavigation(): void {
		this.navigationStack = [];
	}

	// ── File watcher (PBI-ANA-133) ──────────────────────────

	private registerFileWatcher(dashboard: Dashboard): void {
		// Skip if already watching this dashboard
		if (this.watchedDashboardId === dashboard.id) return;

		this.clearFileWatcher();
		this.watchedDashboardId = dashboard.id;

		const sourcePaths = new Set(this.deps.analyticsService.getSourcePathsForDashboard(dashboard.id));
		if (sourcePaths.size === 0) return;

		this.fileWatcherRef = this.deps.app.vault.on("modify", (file) => {
			if (!sourcePaths.has(file.path)) return;

			this.modifiedSourcePaths.add(file.path);

			// Debounce: coalesce rapid saves into a single refresh cycle
			if (this.watcherDebounceTimer) clearTimeout(this.watcherDebounceTimer);
			this.watcherDebounceTimer = setTimeout(() => {
				this.watcherDebounceTimer = null;
				const modified = new Set(this.modifiedSourcePaths);
				this.modifiedSourcePaths.clear();

				const state = this.deps.getState();
				const dash = state.dashboards.find((d) => d.id === this.watchedDashboardId);
				if (!dash) return;

				let invalidated = 0;
				for (const tile of dash.tiles) {
					const measurement = tile.measurementId
						? (state.measurements ?? []).find((m) => m.id === tile.measurementId)
						: undefined;
					const queryId = measurement ? measurement.queryId : tile.queryId;
					const query = state.queries.find((q) => q.id === queryId);
					if (query?.sources.some((s) => modified.has(s.csvPath))) {
						this.deps.tileResultCache.clearByQueryId(queryId);
						invalidated++;
					}
				}

				if (invalidated > 0) {
					this.deps.scheduleRender();
					new Notice("Dashboard updated");
				}
			}, 2000);
		});
	}

	/** Unregister file watcher and clear debounce timer. */
	clearFileWatcher(): void {
		if (this.fileWatcherRef) {
			this.deps.app.vault.offref(this.fileWatcherRef);
			this.fileWatcherRef = null;
		}
		if (this.watcherDebounceTimer) {
			clearTimeout(this.watcherDebounceTimer);
			this.watcherDebounceTimer = null;
		}
		this.watchedDashboardId = null;
		this.modifiedSourcePaths.clear();
	}

	/** Public cleanup — called by orchestrator on tab switch and hub close. */
	dispose(): void {
		this.clearFileWatcher();
	}
}

// ── Filter dimension discovery (pure, testable) ─────────────

export interface FilterDimension {
	column: string;
	values: string[];
}

/**
 * Scan all tile results to discover string columns suitable for filtering.
 * Returns dimensions sorted by value count ascending (fewer values = more useful filter).
 * Maximum 4 dimensions returned.
 *
 * When `activeFilterColumns` is provided, columns that are already being filtered
 * are kept even if they have only 1 unique value in the (cascaded) filtered data.
 */
export function discoverFilterDimensions(
	tiles: Dashboard["tiles"],
	getResult: (queryId: string) => import("../../domain/analytics/types").AnalyticsResult | null,
	activeFilterColumns?: string[],
): FilterDimension[] {
	const columnValues = new Map<string, Set<string>>();

	for (const tile of tiles) {
		const result = getResult(tile.queryId);
		if (!result || result.rows.length === 0) continue;

		for (const col of result.columns) {
			const firstVal = result.rows[0][col];
			if (typeof firstVal === "number") continue; // Skip numeric columns

			if (!columnValues.has(col)) columnValues.set(col, new Set());
			const valSet = columnValues.get(col)!;
			for (const row of result.rows) {
				const val = row[col];
				if (val != null) valSet.add(String(val));
			}
		}
	}

	// Sort by value count ascending (fewer values = better filter)
	const activeSet = new Set(activeFilterColumns ?? []);
	const dimensions: FilterDimension[] = [];
	for (const [column, vals] of columnValues) {
		// Keep actively-filtered columns even with 1 value (cascading); others need ≥2
		if (vals.size >= 2 || activeSet.has(column)) {
			dimensions.push({ column, values: [...vals].sort() });
		}
	}

	dimensions.sort((a, b) => a.values.length - b.values.length);
	return dimensions.slice(0, 4);
}

/**
 * Build a cache key that incorporates active dashboard filters.
 * When filters change, old cached results are automatically bypassed.
 */
export function buildFilterCacheKey(
	queryId: string,
	filters: Array<{ column: string; values: string[] }>,
	dateRange?: QueryDateRangeFilter | null,
): string {
	let key = queryId;
	if (filters.length > 0) {
		const suffix = filters
			.map((f) => `${f.column}=${[...f.values].sort().join(",")}`)
			.sort()
			.join("&");
		key += `?${suffix}`;
	}
	if (dateRange) {
		const dSuffix = `dr=${dateRange.column}:${dateRange.start.year}-${dateRange.start.month}-${dateRange.start.day}..${dateRange.end.year}-${dateRange.end.month}-${dateRange.end.day}`;
		key += (key.includes("?") ? "&" : "?") + dSuffix;
	}
	return key;
}

/**
 * Filter an AnalyticsResult for a measurement.
 *
 * - **single** type: aggregates the measureColumn across ALL rows into one value
 *   (grand total). Returns a single-row result with only the measure column.
 * - **series** type: keeps dimensions + time bucket + measureColumn columns,
 *   preserving all rows for trend display.
 * - Returns the original result unchanged if measurement is undefined or has no
 *   measureColumn.
 */
export function filterResultForMeasurement(
	result: AnalyticsResult | null,
	measurement: Measurement | undefined,
	query: { dimensions: Array<{ column: string }>; timeBucket?: { column: string; period: string; outputColumn?: string } } | undefined,
): AnalyticsResult | null {
	if (!result || !measurement || !measurement.measureColumn) return result;

	const measureCol = measurement.measureColumn;
	if (!result.columns.includes(measureCol)) return result;

	if (measurement.type === "single") {
		// Aggregate: sum all numeric values in the measure column into one row
		let total = 0;
		for (const row of result.rows) {
			const v = row[measureCol];
			if (typeof v === "number") total += v;
		}
		return {
			...result,
			columns: [measureCol],
			rows: [{ [measureCol]: total }],
		};
	}

	// Series type: keep dimension columns + time bucket + measure column (all rows)
	const keepSet = new Set<string>();
	for (const d of query?.dimensions ?? []) keepSet.add(d.column);
	if (query?.timeBucket) {
		const tbCol = query.timeBucket.outputColumn ?? `${query.timeBucket.column}_${query.timeBucket.period}`;
		keepSet.add(tbCol);
	}
	keepSet.add(measureCol);

	const keepCols = result.columns.filter((c) => keepSet.has(c));

	return {
		...result,
		columns: keepCols,
		rows: result.rows.map((row) => {
			const filtered: ResultRow = {};
			for (const col of keepCols) filtered[col] = row[col];
			return filtered;
		}),
	};
}

/**
 * Discover date columns from dashboard tile queries.
 * Scans column type hints across all queries referenced by tiles.
 */
export function discoverDateColumns(
	tiles: DashboardTile[],
	queries: SavedAnalyticsQuery[],
): string[] {
	const dateColumns = new Set<string>();
	const queryMap = new Map(queries.map((q) => [q.id, q]));

	for (const tile of tiles) {
		const query = queryMap.get(tile.queryId);
		if (!query) continue;
		for (const hint of query.columnTypeHints) {
			if (hint.type === "date") dateColumns.add(hint.column);
		}
	}

	return [...dateColumns];
}

/**
 * Merge a cross-tile filter into the dashboard's dimension filters.
 * Returns a new array with the cross-tile filter value added to the matching column.
 */
export function mergeCrossTileFilter(
	filters: Array<{ column: string; values: string[] }>,
	crossFilter: CrossTileFilter | null,
): Array<{ column: string; values: string[] }> {
	if (!crossFilter) return filters;
	const merged = filters.map((f) => ({ column: f.column, values: [...f.values] }));
	const existing = merged.find((f) => f.column === crossFilter.column);
	if (existing) {
		if (!existing.values.includes(crossFilter.value)) {
			existing.values.push(crossFilter.value);
		}
	} else {
		merged.push({ column: crossFilter.column, values: [crossFilter.value] });
	}
	return merged;
}
