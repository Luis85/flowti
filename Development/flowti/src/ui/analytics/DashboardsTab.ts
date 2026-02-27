/**
 * Dashboards tab — master/detail split for dashboard management.
 *
 * Master panel: dashboard list with name, tile count, create/delete.
 * Detail panel: CSS Grid tile layout for the selected dashboard.
 */

import { Notice, setIcon, type EventRef } from "obsidian";
import type { Dashboard } from "../../domain/analytics/types";
import { computeFreshnessSummary, getFreshnessLevel, getFreshnessColor } from "../../domain/analytics/freshnessUtils";
import { discoverDateColumns, filterResultForMeasurement } from "./dashboardUtils";
import type { AnalyticsHubDeps, NavigationStackEntry } from "./types";
import { MAX_BREADCRUMB_DEPTH } from "./types";
import { DashboardBreadcrumbs } from "./DashboardBreadcrumbs";
import { DashboardTileRenderer, type TileRenderContext } from "./DashboardTileRenderer";
import { AddTileDialog } from "./AddTileDialog";
import { DashboardNameModal } from "./DashboardNameModal";
import { DashboardQueryMap, getSourceBasenames } from "./DashboardQueryMap";
import { DashboardFilterBar } from "./DashboardFilterBar";
import { FolderPickerModal, getVaultFolders } from "../FolderPickerModal";
import { DashboardCallbackFactory } from "./DashboardCallbackFactory";
import { buildTileRenderContext } from "./buildTileRenderContext";

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
		const sortSelect = header.createEl("select", { cls: "ft-text-xs ft-sort-select" });
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
		addBtn.setAttribute("aria-label", "New dashboard");
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
			const empty = this.masterEl.createDiv({ cls: "ft-text-muted ft-text-sm ft-empty-state-pad" });
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

		const row = this.masterEl.createDiv({ cls: "ft-master-item ft-dash-master-row" });
		if (isSelected) row.addClass("ft-active");

		const left = row.createDiv({ cls: "ft-dash-master-left" });

		// Star toggle
		const starBtn = left.createSpan({ cls: "ft-nav-link ft-flex-shrink-0 ft-cursor-pointer" });
		const starIcon = starBtn.createSpan();
		setIcon(starIcon, "star");
		starIcon.addClass("ft-icon-14");
		if (!dashboard.isFavorite) {
			starBtn.addClass("ft-icon-ghost");
		}
		starBtn.setAttribute("aria-label", dashboard.isFavorite ? "Unfavorite" : "Favorite");
		starBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.deps.analyticsService.toggleDashboardFavorite(dashboard.id);
		});

		const iconEl = left.createSpan();
		setIcon(iconEl, "layout-grid");
		iconEl.addClass("ft-icon-14");
		iconEl.addClass("ft-flex-shrink-0");

		left.createSpan({ text: dashboard.name, cls: "ft-text-sm ft-truncate" });

		left.createSpan({
			text: `${dashboard.tiles.length}`,
			cls: "ft-badge ft-text-xs ft-flex-shrink-0",
		});

		// Default badge
		const defaultDashboard = this.deps.analyticsService.getDefaultDashboard();
		if (defaultDashboard?.id === dashboard.id) {
			left.createSpan({ text: "Default", cls: "ft-badge ft-text-xs ft-badge-default" });
		}

		// Delete button
		const deleteBtn = row.createSpan({ cls: "ft-nav-link ft-text-muted ft-flex-shrink-0 ft-cursor-pointer" });
		const deleteIcon = deleteBtn.createSpan();
		setIcon(deleteIcon, "trash-2");
		deleteIcon.addClass("ft-icon-14");
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
		const empty = this.detailEl.createDiv({ cls: "ft-empty-detail ft-empty-detail-pad" });
		const iconEl = empty.createDiv();
		setIcon(iconEl, "layout-grid");
		iconEl.addClass("ft-empty-icon-lg");
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
		const header = this.detailEl.createDiv({ cls: "ft-detail-header ft-detail-header-flex" });

		const titleLeft = header.createDiv({ cls: "ft-detail-title-left" });

		// Editable name
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

		const isDefault = this.deps.analyticsService.getDefaultDashboard()?.id === dashboard.id;
		if (isDefault) {
			titleLeft.createSpan({ text: "Default", cls: "ft-badge ft-text-xs ft-badge-default" });
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
				const summaryEl = titleLeft.createSpan({ text: summaryText, cls: "ft-text-xs ft-freshness-summary" });
				summaryEl.style.color = getFreshnessColor(worstLevel);
			}
		}

		const headerActions = header.createDiv({ cls: "ft-header-actions" });

		if (!isDefault) {
			const setDefaultBtn = headerActions.createEl("button", { cls: "ft-text-sm ft-action-btn" });
			const defIcon = setDefaultBtn.createSpan({ cls: "ft-action-btn-icon" });
			setIcon(defIcon, "star");
			setDefaultBtn.createSpan({ text: "Set as Default" });
			setDefaultBtn.addEventListener("click", () => {
				void this.deps.analyticsService.setDefaultDashboard(dashboard.id);
			});
		}

		// Refresh All
		if (dashboard.tiles.length > 0) {
			const refreshAllBtn = headerActions.createEl("button", { cls: "ft-text-sm ft-action-btn" });
			const rIcon = refreshAllBtn.createSpan({ cls: "ft-action-btn-icon" });
			setIcon(rIcon, "refresh-cw");
			refreshAllBtn.createSpan({ text: "Refresh All" });
			refreshAllBtn.addEventListener("click", () => {
				this.deps.tileResultCache.clear();
				this.deps.scheduleRender();
			});
		}

		// Export Summary
		if (dashboard.tiles.length > 0) {
			const exportBtn = headerActions.createEl("button", { cls: "ft-text-sm ft-action-btn" });
			const eIcon = exportBtn.createSpan({ cls: "ft-action-btn-icon" });
			setIcon(eIcon, "clipboard-copy");
			exportBtn.createSpan({ text: "Export" });
			exportBtn.addEventListener("click", () => {
				void this.exportDashboardSummary(dashboard);
			});

			// Export Template JSON to vault folder
			const templateBtn = headerActions.createEl("button", { cls: "ft-text-sm ft-action-btn" });
			const tIcon = templateBtn.createSpan({ cls: "ft-action-btn-icon" });
			setIcon(tIcon, "file-json");
			templateBtn.createSpan({ text: "Save Template" });
			templateBtn.addEventListener("click", () => {
				void this.exportDashboardTemplate(dashboard);
			});
		}

		const addTileBtn = headerActions.createEl("button", { cls: "ft-text-sm ft-action-btn" });
		const btnIcon = addTileBtn.createSpan({ cls: "ft-action-btn-icon" });
		setIcon(btnIcon, "plus");
		addTileBtn.createSpan({ text: "Add Tile" });
		addTileBtn.addEventListener("click", () => {
			this.addTileDialogVisible = !this.addTileDialogVisible;
			this.deps.scheduleRender();
		});

		// Editable description
		const descRow = this.detailEl.createDiv({ cls: "ft-mb-1" });
		const descInput = descRow.createEl("input", { type: "text", cls: "ft-desc-input" });
		descInput.value = dashboard.description ?? "";
		descInput.placeholder = "Add a description...";
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
			const empty = this.detailEl.createDiv({ cls: "ft-text-muted ft-text-sm ft-empty-tile-pad" });
			const emptyIcon = empty.createDiv();
			setIcon(emptyIcon, "grid-3x3");
			emptyIcon.addClass("ft-icon-dim");
			emptyIcon.addClass("ft-mb-2");
			empty.createDiv({ text: "No tiles yet" });
			empty.createDiv({
				text: "Click \"Add Tile\" to pin a saved query to this dashboard",
				cls: "ft-text-xs ft-mt-05",
			});
			return;
		}

		const grid = this.detailEl.createDiv({ cls: "ft-dashboard-grid ft-tile-grid" });

		const state = this.deps.getState();
		const callbackFactory = new DashboardCallbackFactory({
			analyticsService: this.deps.analyticsService,
			tileResultCache: this.deps.tileResultCache,
			getState: this.deps.getState,
			setState: this.deps.setState,
			navigation: this.deps.navigation,
			scheduleRender: this.deps.scheduleRender,
		});

		for (const tile of dashboard.tiles) {
			const ctx = buildTileRenderContext({
				tile,
				measurements: state.measurements ?? [],
				queries: state.queries,
				dashboardFilters: state.dashboardFilters,
				crossTileFilter: state.crossTileFilter,
				dateRangeFilter: state.dateRangeFilter,
			});

			const tileHost = grid.createDiv();
			tileHost.style.gridColumn = `span ${Math.min(tile.width, 6)}`;
			tileHost.addClass("ft-min-w-0");
			const isAutoHeight = tile.autoHeight && tile.width >= 3;
			const rowSpan = Math.min(tile.height, 6);
			tileHost.style.gridRow = isAutoHeight ? "auto" : `span ${rowSpan}`;
			if (!isAutoHeight) tileHost.style.minHeight = `${rowSpan * 180}px`;

			const tileResult = this.deps.tileResultCache.tryRun(
				ctx.cacheKey,
				() => ctx.hasFilters
					? this.deps.analyticsService.runSavedQueryWithFilters(ctx.effectiveQueryId, ctx.effectiveFilters, ctx.resolvedDateRange ?? undefined)
					: this.deps.analyticsService.runSavedQuery(ctx.effectiveQueryId),
				() => this.deps.scheduleRender(),
			);

			const filteredResult = filterResultForMeasurement(tileResult.result, ctx.measurement, ctx.query);

			// Cross-tile filter source indicator
			if (state.crossTileFilter && state.crossTileFilter.sourceTileId === tile.id) {
				tileHost.classList.add("ft-tile-filter-source");
			}

			const callbacks = callbackFactory.createTileCallbacks(
				dashboard.id,
				tile,
				ctx.effectiveQueryId,
				state.dashboardFilters,
				(filters, dashId) => this.updateFilteredBreadcrumb(filters, dashId),
			);

			const renderer = new DashboardTileRenderer(tileHost);
			renderer.render({
				tile,
				query: ctx.query,
				result: filteredResult,
				error: tileResult.error,
				refreshedAt: this.deps.tileResultCache.getTimestamp(ctx.cacheKey),
				...callbacks,
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
				queries: state.queries,
				measurements: state.measurements ?? [],
				activeFilters: ctx.effectiveFilters,
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

// ── Re-exported pure utilities (moved to dashboardUtils.ts, TD-128) ──
export { discoverFilterDimensions, buildFilterCacheKey, filterResultForMeasurement, discoverDateColumns, mergeCrossTileFilter } from "./dashboardUtils";
export type { FilterDimension } from "./dashboardUtils";
