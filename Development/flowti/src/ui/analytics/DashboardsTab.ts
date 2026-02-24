/**
 * Dashboards tab — master/detail split for dashboard management.
 *
 * Master panel: dashboard list with name, tile count, create/delete.
 * Detail panel: CSS Grid tile layout for the selected dashboard.
 */

import { Notice, setIcon } from "obsidian";
import type { Dashboard, DashboardTile } from "../../domain/analytics/types";
import { computeFreshnessSummary, getFreshnessLevel, getFreshnessColor } from "../../domain/analytics/freshnessUtils";
import type { AnalyticsHubDeps } from "./types";
import { DashboardTileRenderer, type TileRenderContext } from "./DashboardTileRenderer";
import { AddTileDialog } from "./AddTileDialog";
import { DashboardNameModal } from "./DashboardNameModal";

export class DashboardsTab {
	private addTileDialogVisible = false;
	private openSettingsTileId: string | null = null;

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
		const importBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const importIcon = importBtn.createSpan();
		setIcon(importIcon, "download");
		importBtn.setAttribute("aria-label", "Import JSON");
		importBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.importFromJson();
		});

		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.setAttribute("aria-label", "New Dashboard");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.createDashboard();
		});

		// Sort favorites first
		dashboards = [...dashboards].sort((a, b) => {
			if (a.isFavorite && !b.isFavorite) return -1;
			if (!a.isFavorite && b.isFavorite) return 1;
			return 0;
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
				summaryEl.style.color = getFreshnessColor(worstLevel);
				summaryEl.style.flexShrink = "0";
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
			setIcon(defIcon, "star");
			defIcon.style.width = "14px";
			defIcon.style.height = "14px";
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
			setIcon(rIcon, "refresh-cw");
			rIcon.style.width = "14px";
			rIcon.style.height = "14px";
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
			setIcon(eIcon, "clipboard-copy");
			eIcon.style.width = "14px";
			eIcon.style.height = "14px";
			exportBtn.createSpan({ text: "Export" });
			exportBtn.addEventListener("click", () => {
				void this.exportDashboardSummary(dashboard);
			});
		}

		const addTileBtn = headerActions.createEl("button", { cls: "ft-text-sm" });
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
		grid.style.gridTemplateColumns = "repeat(5, 1fr)";
		grid.style.gridAutoRows = "auto";
		grid.style.gap = "1rem";

		const state = this.deps.getState();

		for (const tile of dashboard.tiles) {
			const query = state.queries.find((q) => q.id === tile.queryId);
			const tileHost = grid.createDiv();
			tileHost.style.gridColumn = `span ${Math.min(tile.width, 5)}`;
			tileHost.style.minWidth = "0";
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
				onRemove: (tileId) => {
					void this.deps.analyticsService.removeTile(dashboard.id, tileId).then(() => {
						this.deps.scheduleRender();
					});
				},
				onRefresh: () => {
					this.deps.tileResultCache.clearOne(tile.queryId);
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
				onRulesChange: (tileId, rules) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { conditionalRules: rules } as Partial<DashboardTile>).then(() => {
						this.deps.scheduleRender();
					});
				},
			onChartValueColumnChange: (tileId, column) => {
					void this.deps.analyticsService.updateTile(dashboard.id, tileId, { chartValueColumn: column } as Partial<DashboardTile>).then(() => {
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
				onViewQuery: (queryId) => {
					this.deps.setState({ selectedQueryId: queryId });
					this.deps.navigation.navigateTo("queries");
					this.deps.scheduleRender();
				},
			} satisfies TileRenderContext);
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
	}

}
