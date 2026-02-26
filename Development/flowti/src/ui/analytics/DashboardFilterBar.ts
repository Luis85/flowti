/**
 * Shared dashboard filter bar component.
 *
 * Renders dimension dropdowns (max 4), breadcrumb chips for active filters,
 * and a clear-all button. Used by both DashboardsTab and AnalyticsDashboardPage.
 */

import { setIcon } from "obsidian";
import type { CrossTileFilter, DashboardTile, AnalyticsResult, DateRangeFilter, DateRangePreset, SavedFilterPreset } from "../../domain/analytics/types";
import { DATE_RANGE_PRESET_LABELS } from "../../domain/analytics/dateUtils";
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
	/** Active date range filter (null = no date range). */
	dateRangeFilter?: DateRangeFilter | null;
	/** Available date columns detected from tile queries. */
	dateColumns?: string[];
	/** Callback when date range filter changes. */
	onDateRangeChanged?: (filter: DateRangeFilter | null) => void;
	/** Active cross-tile filter (null = none). */
	crossTileFilter?: CrossTileFilter | null;
	/** Callback when cross-tile filter is cleared. */
	onCrossTileFilterClear?: () => void;
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
		const hasDateColumns = this.deps.dateColumns && this.deps.dateColumns.length > 0;
		const hasDateRange = this.deps.dateRangeFilter != null;
		const hasCrossTile = this.deps.crossTileFilter != null;
		if (dimensions.length === 0 && filters.length === 0 && !hasPresets && !hasDateColumns && !hasDateRange && !hasCrossTile) return;

		const bar = this.container.createDiv({ cls: "ft-filter-bar" });

		bar.createSpan({ text: "Filters:", cls: "ft-text-sm ft-font-semibold" });

		// Filter presets dropdown
		if (this.deps.presets || this.deps.onSavePreset) {
			this.renderPresetControls(bar, filters);
		}

		// Date range picker
		if (hasDateColumns && this.deps.onDateRangeChanged) {
			this.renderDateRangePicker(bar);
		}

		// Dimension dropdowns (max 4) — selecting a value toggles it in the filter
		const shownDimensions = dimensions.slice(0, 4);
		for (const dim of shownDimensions) {
			const activeFilter = filters.find((f) => f.column === dim.column);
			const selectedCount = activeFilter ? activeFilter.values.length : 0;

			const select = bar.createEl("select", { cls: "ft-select-small ft-text-xs" });

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

		// Clear all button (only when any filter active)
		if (filters.length > 0 || hasDateRange || hasCrossTile) {
			const clearBtn = bar.createEl("span", { cls: "ft-nav-link ft-text-xs" });
			clearBtn.style.cursor = "pointer";
			clearBtn.style.marginLeft = "auto";
			clearBtn.textContent = "Clear all";
			clearBtn.addEventListener("click", () => {
				this.deps.onFiltersChanged([]);
				this.deps.onDateRangeChanged?.(null);
				this.deps.onCrossTileFilterClear?.();
			});
		}

		// Breadcrumb chips for active filters — one chip per value
		if (filters.length > 0 || hasDateRange || hasCrossTile) {
			const breadcrumb = this.container.createDiv({ cls: "ft-filter-breadcrumb" });
			breadcrumb.style.display = "flex";
			breadcrumb.style.flexWrap = "wrap";
			breadcrumb.style.gap = "0.35rem";
			breadcrumb.style.marginBottom = "0.75rem";

			breadcrumb.createSpan({ text: "Showing:", cls: "ft-text-xs ft-text-muted" });

			// Row-count preview badge (FR-96)
			const rowCount = this.estimateFilteredRowCount(tiles, filters);
			if (rowCount !== null) {
				const badge = breadcrumb.createSpan({ cls: "ft-badge ft-badge-muted ft-text-xs" });
				badge.textContent = `~${rowCount} rows`;
			}

			// Date range chip
			if (this.deps.dateRangeFilter && this.deps.onDateRangeChanged) {
				const dr = this.deps.dateRangeFilter;
				const chip = breadcrumb.createSpan({ cls: "ft-filter-chip ft-text-xs" });
				const label = dr.preset === "custom"
					? `${dr.column || "Date"}: ${dr.startDate ?? "?"} to ${dr.endDate ?? "?"}`
					: `${dr.column || "Date"}: ${DATE_RANGE_PRESET_LABELS[dr.preset]}`;
				chip.textContent = label;

				const closeBtn = chip.createSpan({ text: " \u00d7" });
				closeBtn.style.cursor = "pointer";
				closeBtn.style.fontWeight = "bold";
				closeBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					this.deps.onDateRangeChanged!(null);
				});
			}

			// Cross-tile filter chip
			if (this.deps.crossTileFilter && this.deps.onCrossTileFilterClear) {
				const cf = this.deps.crossTileFilter;
				const chip = breadcrumb.createSpan({ cls: "ft-filter-chip ft-text-xs" });
				chip.style.background = "var(--interactive-accent)";
				chip.style.color = "var(--text-on-accent)";
				chip.textContent = `${cf.column} = ${cf.value}`;

				const closeBtn = chip.createSpan({ text: " \u00d7" });
				closeBtn.style.cursor = "pointer";
				closeBtn.style.fontWeight = "bold";
				closeBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					this.deps.onCrossTileFilterClear!();
				});
			}

			for (const f of filters) {
				for (const val of f.values) {
					const chip = breadcrumb.createSpan({ cls: "ft-filter-chip ft-text-xs" });
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

	/**
	 * Estimate the total filtered row count from cached tile results.
	 * Returns null if no cached results are available yet.
	 */
	private estimateFilteredRowCount(tiles: DashboardTile[], filters: DashboardFilter[]): number | null {
		if (filters.length === 0) return null;
		let totalRows = 0;
		let hasAnyResult = false;

		const seen = new Set<string>();
		for (const tile of tiles) {
			const cacheKey = buildFilterCacheKey(tile.queryId, filters);
			if (seen.has(cacheKey)) continue;
			seen.add(cacheKey);

			const entry = this.deps.tileResultCache.get(cacheKey);
			if (entry?.result) {
				totalRows += entry.result.rows.length;
				hasAnyResult = true;
			}
		}

		return hasAnyResult ? totalRows : null;
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

	private renderDateRangePicker(bar: HTMLElement): void {
		const dateColumns = this.deps.dateColumns ?? [];
		const current = this.deps.dateRangeFilter;
		const onChanged = this.deps.onDateRangeChanged!;

		const wrap = bar.createSpan({ cls: "ft-date-range-picker" });
		wrap.style.cssText = "display:inline-flex;align-items:center;gap:4px";

		// Date column selector (when multiple date columns)
		let selectedColumn = current?.column || dateColumns[0] || "";
		if (dateColumns.length > 1) {
			const colSelect = wrap.createEl("select", { cls: "ft-select-small ft-text-xs" });
			for (const col of dateColumns) {
				const opt = colSelect.createEl("option");
				opt.value = col;
				opt.textContent = col;
				if (col === selectedColumn) opt.selected = true;
			}
			colSelect.addEventListener("change", () => {
				selectedColumn = colSelect.value;
				if (current) {
					onChanged({ ...current, column: selectedColumn });
				}
			});
		}

		// Preset selector
		const select = wrap.createEl("select", { cls: "ft-select-small ft-text-xs" });
		const noneOpt = select.createEl("option");
		noneOpt.value = "";
		noneOpt.textContent = "Date range: All";
		if (!current) noneOpt.selected = true;

		const presetKeys: DateRangePreset[] = [
			"last-7-days", "last-30-days", "last-90-days",
			"this-week", "last-week",
			"this-month", "last-month",
			"this-quarter", "last-quarter",
			"this-year", "last-year",
			"custom",
		];
		for (const key of presetKeys) {
			const opt = select.createEl("option");
			opt.value = key;
			opt.textContent = DATE_RANGE_PRESET_LABELS[key];
			if (current?.preset === key) opt.selected = true;
		}

		select.addEventListener("change", () => {
			if (!select.value) {
				onChanged(null);
				return;
			}
			const preset = select.value as DateRangePreset;
			if (preset === "custom") {
				const today = new Date().toISOString().slice(0, 10);
				onChanged({ column: selectedColumn, preset: "custom", startDate: today, endDate: today });
			} else {
				onChanged({ column: selectedColumn, preset });
			}
		});

		// Custom date inputs (only when preset = "custom")
		if (current?.preset === "custom") {
			const startInput = wrap.createEl("input", { type: "date", cls: "ft-text-xs" });
			startInput.style.cssText = "font-size:var(--font-ui-smaller);border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:2px 4px;border-radius:4px";
			startInput.value = current.startDate ?? "";
			startInput.addEventListener("change", () => {
				onChanged({ ...current, startDate: startInput.value });
			});

			wrap.createSpan({ text: "to", cls: "ft-text-xs ft-text-muted" });

			const endInput = wrap.createEl("input", { type: "date", cls: "ft-text-xs" });
			endInput.style.cssText = "font-size:var(--font-ui-smaller);border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:2px 4px;border-radius:4px";
			endInput.value = current.endDate ?? "";
			endInput.addEventListener("change", () => {
				onChanged({ ...current, endDate: endInput.value });
			});
		}
	}
}
