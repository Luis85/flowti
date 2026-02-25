/**
 * Shared dashboard filter bar component.
 *
 * Renders dimension dropdowns (max 4), breadcrumb chips for active filters,
 * and a clear-all button. Used by both DashboardsTab and AnalyticsDashboardPage.
 */

import { setIcon } from "obsidian";
import type { DashboardTile, AnalyticsResult, SavedFilterPreset } from "../../domain/analytics/types";
import { discoverFilterDimensions, buildFilterCacheKey } from "./DashboardsTab";
import type { TileResultCache } from "./TileResultCache";

export interface DashboardFilter {
	column: string;
	values: string[];
}

export interface FilterBarDeps {
	tiles: DashboardTile[];
	filters: DashboardFilter[];
	tileResultCache: TileResultCache;
	runQuery: (queryId: string) => Promise<AnalyticsResult>;
	runQueryWithFilters: (queryId: string, filters: DashboardFilter[]) => Promise<AnalyticsResult>;
	onFiltersChanged: (filters: DashboardFilter[]) => void;
	scheduleRender: () => void;
	/** Saved filter presets for the current dashboard */
	presets?: SavedFilterPreset[];
	onSavePreset?: (name: string, filters: DashboardFilter[]) => void;
	onDeletePreset?: (presetId: string) => void;
}

export class DashboardFilterBar {
	constructor(
		private container: HTMLElement,
		private deps: FilterBarDeps,
	) {}

	render(): void {
		const { tiles, filters, tileResultCache } = this.deps;

		const activeFilterColumns = filters.map((f) => f.column);
		const dimensions = discoverFilterDimensions(
			tiles,
			(queryId) => {
				const cacheKey = buildFilterCacheKey(queryId, filters);
				return tileResultCache.tryRun(
					cacheKey,
					() => filters.length > 0
						? this.deps.runQueryWithFilters(queryId, filters)
						: this.deps.runQuery(queryId),
					() => this.deps.scheduleRender(),
				).result;
			},
			activeFilterColumns,
		);

		const hasPresets = this.deps.presets && this.deps.presets.length > 0;
		if (dimensions.length === 0 && filters.length === 0 && !hasPresets) return;

		const bar = this.container.createDiv({ cls: "ft-filter-bar" });
		bar.style.display = "flex";
		bar.style.flexWrap = "wrap";
		bar.style.alignItems = "center";
		bar.style.gap = "0.5rem";
		bar.style.marginBottom = "0.75rem";
		bar.style.padding = "0.5rem 0.75rem";
		bar.style.background = "var(--background-secondary)";
		bar.style.borderRadius = "6px";

		bar.createSpan({ text: "Filters:", cls: "ft-text-sm" }).style.fontWeight = "600";

		// Filter presets dropdown
		if (this.deps.presets || this.deps.onSavePreset) {
			this.renderPresetControls(bar, filters);
		}

		// Dimension dropdowns (max 4) — selecting a value toggles it in the filter
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
					this.deps.onFiltersChanged(updated);
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
				this.deps.onFiltersChanged(updated);
			});
		}

		// Clear all button (only when filters active)
		if (filters.length > 0) {
			const clearBtn = bar.createEl("span", { cls: "ft-nav-link ft-text-xs" });
			clearBtn.style.cursor = "pointer";
			clearBtn.style.marginLeft = "auto";
			clearBtn.textContent = "Clear all";
			clearBtn.addEventListener("click", () => {
				this.deps.onFiltersChanged([]);
			});
		}

		// Breadcrumb chips for active filters — one chip per value
		if (filters.length > 0) {
			const breadcrumb = this.container.createDiv({ cls: "ft-filter-breadcrumb" });
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
						this.deps.onFiltersChanged(updated);
					});
				}
			}
		}
	}

	private renderPresetControls(bar: HTMLElement, filters: DashboardFilter[]): void {
		const presets = this.deps.presets ?? [];

		if (presets.length > 0) {
			for (const p of presets) {
				const chip = bar.createSpan({ cls: "ft-flex ft-items-center ft-gap-1" });
				chip.style.cssText = "display:inline-flex;align-items:center;gap:2px";

				const applyBtn = chip.createEl("span", { text: p.name, cls: "ft-nav-link ft-text-xs" });
				applyBtn.style.cursor = "pointer";
				applyBtn.addEventListener("click", () => {
					this.deps.onFiltersChanged(structuredClone(p.filters));
				});

				if (this.deps.onDeletePreset) {
					const delBtn = chip.createEl("span", { cls: "ft-text-muted" });
					delBtn.style.cssText = "cursor:pointer;display:inline-flex;align-items:center;line-height:1";
					setIcon(delBtn, "x");
					const svg = delBtn.querySelector("svg");
					if (svg) { svg.style.width = "10px"; svg.style.height = "10px"; }
					delBtn.title = `Delete preset "${p.name}"`;
					delBtn.addEventListener("click", (e) => {
						e.stopPropagation();
						this.deps.onDeletePreset!(p.id);
					});
				}
			}
		}

		// Save current button (only when filters active)
		if (filters.length > 0 && this.deps.onSavePreset) {
			const saveWrap = bar.createSpan();
			const saveBtn = saveWrap.createEl("span", { cls: "ft-nav-link ft-text-xs" });
			saveBtn.style.cursor = "pointer";
			const saveIcon = saveBtn.createSpan();
			setIcon(saveIcon, "bookmark");
			saveIcon.style.cssText = "width:10px;height:10px;display:inline-flex;align-items:center";
			saveBtn.appendText(" Save");
			saveBtn.title = "Save current filters as preset";
			saveBtn.addEventListener("click", () => {
				saveBtn.style.display = "none";
				const input = saveWrap.createEl("input", { type: "text" });
				input.placeholder = "Preset name";
				input.style.cssText = "font-size:var(--font-ui-smaller);border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:2px 6px;border-radius:4px;width:110px";
				const commit = () => {
					const val = input.value.trim();
					if (val) {
						this.deps.onSavePreset!(val, structuredClone(filters));
					} else {
						input.remove();
						saveBtn.style.display = "";
					}
				};
				input.addEventListener("blur", commit);
				input.addEventListener("keydown", (ev) => {
					if (ev.key === "Enter") { ev.preventDefault(); input.blur(); }
					if (ev.key === "Escape") { ev.preventDefault(); input.remove(); saveBtn.style.display = ""; }
				});
				setTimeout(() => input.focus(), 20);
			});
		}
	}
}
