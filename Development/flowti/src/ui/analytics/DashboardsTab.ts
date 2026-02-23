/**
 * Dashboards tab — master/detail split for dashboard management.
 *
 * Master panel: dashboard list with name, tile count, create/delete.
 * Detail panel: CSS Grid tile layout for the selected dashboard.
 */

import { setIcon } from "obsidian";
import type { AnalyticsResult, Dashboard } from "../../domain/analytics/types";
import type { AnalyticsHubDeps } from "./types";
import { DashboardTileRenderer, type TileRenderContext } from "./DashboardTileRenderer";
import { AddTileDialog } from "./AddTileDialog";

export class DashboardsTab {
	private addTileDialogVisible = false;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: AnalyticsHubDeps,
	) {}

	// ── Master panel ─────────────────────────────────────────

	renderMaster(): void {
		this.masterEl.empty();

		const state = this.deps.getState();
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
		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.setAttribute("aria-label", "New Dashboard");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.createDashboard();
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
			this.deps.setState({ selectedDashboardId: dashboard.id });
			this.deps.scheduleRender();
		});
	}

	// ── Detail panel ─────────────────────────────────────────

	renderDetail(): void {
		this.detailEl.empty();

		const state = this.deps.getState();
		const dashboard = state.dashboards.find((d) => d.id === state.selectedDashboardId);

		if (!dashboard) {
			this.renderEmptyDetail();
			return;
		}

		this.renderDashboardDetail(dashboard);
	}

	private renderEmptyDetail(): void {
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
		// Header row
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		header.style.display = "flex";
		header.style.alignItems = "center";
		header.style.justifyContent = "space-between";
		header.style.marginBottom = "0.75rem";

		const titleEl = header.createSpan({ text: dashboard.name, cls: "ft-text-lg" });
		titleEl.style.fontWeight = "600";

		const addTileBtn = header.createEl("button", { cls: "ft-text-sm" });
		addTileBtn.style.display = "flex";
		addTileBtn.style.alignItems = "center";
		addTileBtn.style.gap = "0.25rem";
		const btnIcon = addTileBtn.createSpan();
		setIcon(btnIcon, "plus");
		btnIcon.style.width = "14px";
		btnIcon.style.height = "14px";
		addTileBtn.createSpan({ text: "Add Tile" });
		addTileBtn.addEventListener("click", () => {
			this.addTileDialogVisible = !this.addTileDialogVisible;
			this.deps.scheduleRender();
		});

		// Add tile dialog (conditionally visible)
		if (this.addTileDialogVisible) {
			const dialogHost = this.detailEl.createDiv({ cls: "ft-mb-1" });
			new AddTileDialog({
				container: dialogHost,
				queries: this.deps.getState().queries,
				onAdd: (queryId, displayMode) => {
					void this.deps.analyticsService.addTile(dashboard.id, queryId, displayMode).then(() => {
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
		grid.style.gridTemplateColumns = "repeat(2, 1fr)";
		grid.style.gap = "0.75rem";

		const state = this.deps.getState();

		for (const tile of dashboard.tiles) {
			const query = state.queries.find((q) => q.id === tile.queryId);
			const tileHost = grid.createDiv();
			tileHost.style.gridColumn = `span ${Math.min(tile.width, 2)}`;

			const tileResult = this.tryRunQuery(tile.queryId);

			const renderer = new DashboardTileRenderer(tileHost);
			renderer.render({
				tile,
				query,
				result: tileResult.result,
				error: tileResult.error,
				onRemove: (tileId) => {
					void this.deps.analyticsService.removeTile(dashboard.id, tileId).then(() => {
						this.deps.scheduleRender();
					});
				},
			} satisfies TileRenderContext);
		}
	}

	// ── Dashboard CRUD ───────────────────────────────────────

	private async createDashboard(): Promise<void> {
		const name = `Dashboard ${this.deps.getState().dashboards.length + 1}`;
		const dashboard = await this.deps.analyticsService.createDashboard(name);
		this.deps.setState({ selectedDashboardId: dashboard.id });
		this.deps.scheduleRender();
	}

	private async deleteDashboard(dashboard: Dashboard): Promise<void> {
		const state = this.deps.getState();
		await this.deps.analyticsService.deleteDashboard(dashboard.id);
		if (state.selectedDashboardId === dashboard.id) {
			this.deps.setState({ selectedDashboardId: null });
		}
		this.deps.scheduleRender();
	}

	// ── Query execution ──────────────────────────────────────

	/**
	 * Attempt to run a saved query synchronously from cached results.
	 * For Inc 3 we kick off async execution and show loading until results arrive.
	 */
	private tileResults = new Map<string, { result: AnalyticsResult | null; error: string | null }>();

	private tryRunQuery(queryId: string): { result: AnalyticsResult | null; error: string | null } {
		const cached = this.tileResults.get(queryId);
		if (cached) return cached;

		// Start async load
		this.tileResults.set(queryId, { result: null, error: null });
		void this.deps.analyticsService.runSavedQuery(queryId).then(
			(result) => {
				this.tileResults.set(queryId, { result, error: null });
				this.deps.scheduleRender();
			},
			(err) => {
				const message = err instanceof Error ? err.message : String(err);
				this.tileResults.set(queryId, { result: null, error: message });
				this.deps.scheduleRender();
			},
		);

		return { result: null, error: null };
	}

	/** Clear cached tile results (called on dashboard switch or refresh). */
	clearResultCache(): void {
		this.tileResults.clear();
	}
}
