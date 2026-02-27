/**
 * Query builder panel sub-component.
 *
 * Renders configuration sections in order:
 * 1. Joins + Sort & Limit + Filters (combined pipeline section)
 * 2. Column Types & Schema (merged type hints + schema overview + dimensions)
 * 3. Time Bucket
 * 4. Measures
 */

import { setIcon } from "obsidian";
import type {
	QueriesSubDeps,
	QuerySource,
	ColumnType,
	ColumnTypeHint,
	JoinSpec,
	TimeBucketPeriod,
	AggregationFunction,
} from "./types";
import {
	AGG_FUNCTIONS,
	TIME_PERIODS,
	SELECT_CSS,
} from "./types";
import { renderColumnPicker, groupColumnsByType } from "./columnPicker";
import { FilterBuilderPanel } from "./FilterBuilderPanel";

const TYPE_ICONS: Record<string, string> = {
	number: "hash",
	currency: "coins",
	date: "calendar",
	string: "type",
};

export class QueryBuilderPanel {
	constructor(
		private container: HTMLElement,
		private deps: QueriesSubDeps,
	) {}

	render(): void {
		const headers = this.deps.getLoadedHeaders();
		if (headers.length === 0) return;

		const loadedSources = this.deps.sources().filter((s) => s.data);

		// 1. Joins + Sort & Limit + Filters (combined)
		this.renderDataPipeline(loadedSources);

		// 2. Column Types & Schema (merged)
		this.renderSchemaAndTypes(loadedSources);

		// 3. Time Bucket
		this.renderTimeBucketConfig();

		// 4. Measures
		this.renderMeasureConfig();
	}

	// ─── Combined Data Pipeline ─────────────────────────────

	private renderDataPipeline(loadedSources: QuerySource[]): void {
		const hasJoins = loadedSources.length > 1;
		const card = this.container.createDiv({ cls: "ft-card ft-mt-3" });

		// Card title
		const cardTitle = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		cardTitle.createSpan({ text: "Data Pipeline", cls: "ft-text-sm ft-font-semibold" });
		cardTitle.addClass("ft-card-title");

		// Joins sub-section (only if 2+ sources)
		if (hasJoins) {
			this.renderJoinSubSection(card, loadedSources);
		}

		// Filters sub-section
		this.addDivider(card);
		new FilterBuilderPanel(card, this.deps).renderInto(card);

		// Sort & Limit sub-section
		this.addDivider(card);
		this.renderSortLimitSubSection(card);
	}

	private addDivider(parent: HTMLElement): void {
		parent.createDiv({ cls: "ft-card-divider" });
	}

	private renderJoinSubSection(section: HTMLElement, loaded: QuerySource[]): void {
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const headerIcon = header.createSpan();
		setIcon(headerIcon, "git-merge");
		headerIcon.addClass("ft-inline-icon", "ft-icon-sm");
		header.createSpan({ text: "Joins", cls: "ft-text-sm ft-font-medium" });
		header.addClass("ft-subsection-header");
		section.createDiv({ text: "Combine rows from multiple sources by matching column values.", cls: "ft-text-muted ft-text-xs ft-helper-text" });

		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm ft-ml-auto" });
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.appendText(" Add");
		addBtn.addEventListener("click", () => {
			const joins = this.deps.joins();
			joins.push({
				leftSource: loaded[0].alias,
				leftColumn: loaded[0].data!.headers[0] ?? "",
				rightSource: loaded[1].alias,
				rightColumn: loaded[1].data!.headers[0] ?? "",
				type: "inner",
			});
			this.deps.setJoins(joins);
			this.deps.renderDetail();
		});

		const joins = this.deps.joins();
		for (let i = 0; i < joins.length; i++) {
			const join = joins[i];
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-flex-wrap ft-join-row" });

			this.renderJoinSide(row, join, "left", loaded);
			row.createSpan({ text: "=", cls: "ft-text-muted" });
			this.renderJoinSide(row, join, "right", loaded);

			const joinTypeLabels: Record<string, string> = {
				inner: "inner — only matching rows",
				left: "left — all left rows, matches from right",
			};
			const typeSelect = row.createEl("select", { cls: "ft-select-small" });
			typeSelect.title = "Inner: keeps only rows where both sides match.\nLeft: keeps all rows from the left source, filling unmatched right columns with empty values.";
			for (const jt of ["inner", "left"] as const) {
				const opt = typeSelect.createEl("option");
				opt.value = jt;
				opt.textContent = joinTypeLabels[jt];
				if (join.type === jt) opt.selected = true;
			}
			typeSelect.addEventListener("change", () => { join.type = typeSelect.value as "inner" | "left"; });

			const removeBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const removeIcon = removeBtn.createSpan();
			setIcon(removeIcon, "x");
			removeBtn.addEventListener("click", () => {
				const currentJoins = this.deps.joins();
				currentJoins.splice(i, 1);
				this.deps.setJoins(currentJoins);
				this.deps.renderDetail();
			});
		}
	}

	private renderJoinSide(
		container: HTMLElement,
		join: JoinSpec,
		side: "left" | "right",
		loaded: QuerySource[],
	): void {
		const sourceKey = side === "left" ? "leftSource" as const : "rightSource" as const;
		const columnKey = side === "left" ? "leftColumn" as const : "rightColumn" as const;

		const srcSelect = container.createEl("select", { cls: "ft-select-small" });
		for (const src of loaded) {
			const opt = srcSelect.createEl("option");
			opt.value = src.alias;
			opt.textContent = src.alias;
			if (join[sourceKey] === src.alias) opt.selected = true;
		}
		srcSelect.addEventListener("change", () => {
			join[sourceKey] = srcSelect.value;
			const newSource = loaded.find((s) => s.alias === srcSelect.value);
			join[columnKey] = newSource?.data?.headers[0] ?? "";
			this.deps.renderDetail();
		});

		const colSelect = container.createEl("select", { cls: "ft-select-small" });
		const current = loaded.find((s) => s.alias === join[sourceKey]);
		for (const h of current?.data?.headers ?? []) {
			const opt = colSelect.createEl("option");
			opt.value = h;
			opt.textContent = h;
			if (join[columnKey] === h) opt.selected = true;
		}
		colSelect.addEventListener("change", () => { join[columnKey] = colSelect.value; });
	}

	private renderSortLimitSubSection(section: HTMLElement): void {
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const headerIcon = header.createSpan();
		setIcon(headerIcon, "arrow-up-down");
		headerIcon.addClass("ft-inline-icon", "ft-icon-sm");
		header.createSpan({ text: "Sort & Limit", cls: "ft-text-sm ft-font-medium" });
		header.addClass("ft-subsection-header");

		const sorts = this.deps.sort();
		if (sorts.length > 0) {
			header.createSpan({ text: `${sorts.length}`, cls: "ft-badge ft-badge-muted" });
		}

		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm ft-ml-auto" });
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.appendText(" Add Sort");
		addBtn.addEventListener("click", () => {
			const current = this.deps.sort();
			const usedCols = new Set(current.map((s) => s.column));
			const available = this.deps.getLoadedHeaders().find((h) => !usedCols.has(h));
			current.push({ column: available ?? this.deps.getLoadedHeaders()[0] ?? "", direction: "asc" });
			this.deps.setSort(current);
			this.deps.renderDetail();
		});

		if (sorts.length === 0) {
			section.createDiv({ text: "No sort columns", cls: "ft-text-muted ft-text-sm ft-p-2" });
		}

		for (let i = 0; i < sorts.length; i++) {
			const sortSpec = sorts[i];
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-row-padded-bordered" });

			row.createSpan({ text: i === 0 ? "Sort by" : "then by", cls: "ft-text-muted ft-text-sm" });

			renderColumnPicker(row, {
				headers: this.deps.getLoadedHeaders(),
				typeHints: this.deps.columnTypeHints(),
				selected: sortSpec.column,
				cssText: SELECT_CSS,
				onChange: (col) => {
					const current = this.deps.sort();
					current[i].column = col;
					this.deps.setSort(current);
				},
			});

			const dirSelect = row.createEl("select", { cls: "ft-select-small" });
			for (const dir of ["asc", "desc"] as const) {
				const opt = dirSelect.createEl("option");
				opt.value = dir;
				opt.textContent = dir === "asc" ? "Ascending" : "Descending";
				if (sortSpec.direction === dir) opt.selected = true;
			}
			dirSelect.addEventListener("change", () => {
				const current = this.deps.sort();
				current[i].direction = dirSelect.value as "asc" | "desc";
				this.deps.setSort(current);
			});

			const removeBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const removeIcon = removeBtn.createSpan();
			setIcon(removeIcon, "x");
			removeBtn.addEventListener("click", () => {
				const current = this.deps.sort();
				current.splice(i, 1);
				this.deps.setSort(current);
				this.deps.renderDetail();
			});
		}

		// Limit
		const limitRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-row-padded" });

		const currentLimit = this.deps.limit();
		const limitCb = limitRow.createEl("input", { type: "checkbox" });
		limitCb.checked = currentLimit !== null;
		limitCb.addEventListener("change", () => {
			this.deps.setLimit(limitCb.checked ? 10 : null);
			this.deps.renderDetail();
		});

		if (currentLimit !== null) {
			limitRow.createSpan({ text: "Max rows", cls: "ft-text-muted ft-text-sm" });
			const limitInput = limitRow.createEl("input", { type: "number", cls: "ft-select-small" });
			limitInput.value = String(currentLimit);
			limitInput.min = "0";
			limitInput.addEventListener("change", () => {
				const val = parseInt(limitInput.value, 10);
				this.deps.setLimit(isNaN(val) ? null : val);
			});
		} else {
			limitRow.createSpan({ text: "Enable row limit", cls: "ft-text-muted ft-text-sm" });
		}
	}

	// ─── Column Types & Schema (merged) ─────────────────────

	private renderSchemaAndTypes(loadedSources: QuerySource[]): void {
		const headers = this.deps.getLoadedHeaders();
		const section = this.container.createDiv({ cls: "ft-card ft-mt-3" });

		const sectionHeader = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		sectionHeader.createSpan({ text: "Column Types & Schema", cls: "ft-text-sm ft-font-semibold" });
		sectionHeader.addClass("ft-card-title");
		const excluded = this.deps.excludedColumns();
		const excludeSet = new Set(excluded);
		const visibleCount = headers.length - excluded.length;
		const badge = sectionHeader.createSpan({
			text: excluded.length > 0 ? `${visibleCount}/${headers.length}` : `${headers.length}`,
			cls: "ft-badge ft-badge-muted",
		});
		badge.addClass("ft-ml-auto");
		if (excluded.length > 0) badge.title = `${excluded.length} column${excluded.length > 1 ? "s" : ""} hidden`;

		// Show effective locale inline in header
		for (const src of loadedSources) {
			const effective = src.locale === "auto" || !src.locale ? "en-US" : src.locale;
			const localeTag = sectionHeader.createSpan({ cls: "ft-badge ft-badge-muted ft-badge-locale" });
			localeTag.textContent = loadedSources.length > 1 ? `${src.alias}: ${effective}` : effective;
			// eslint-disable-next-line obsidianmd/ui/sentence-case
		if (src.locale === "auto" || !src.locale) localeTag.title = "Auto-detected (default: en-US)";
		}

		const hints = this.deps.columnTypeHints();
		const dims = this.deps.dimensions();
		const dimSet = new Set(dims.map((d) => d.column));

		// Build source map for multi-source alias badges
		const sourceMap = new Map<string, string[]>();
		if (loadedSources.length > 1) {
			for (const src of loadedSources) {
				if (!src.data) continue;
				for (const h of src.data.headers) {
					if (!sourceMap.has(h)) sourceMap.set(h, []);
					sourceMap.get(h)!.push(src.alias);
				}
			}
		}

		// Data Tools — batch quick actions
		const toolsRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-tools-row" });
		toolsRow.createSpan({ text: "Tools", cls: "ft-text-xs ft-text-muted ft-font-medium" });

		// Remove All Empty — adds != "" filters for all dimension columns
		const removeEmptyLink = toolsRow.createEl("span", { cls: "ft-nav-link ft-text-xs ft-cursor-pointer" });
		const reIcon = removeEmptyLink.createSpan();
		setIcon(reIcon, "filter-x");
		reIcon.addClass("ft-inline-icon-mr", "ft-icon-xs");
		removeEmptyLink.appendText("Remove Empty Rows");
		removeEmptyLink.addEventListener("click", () => {
			const currentFilters = this.deps.filters();
			const existingFilterCols = new Set(currentFilters.filter((f) => f.operator === "!=" && f.value === "").map((f) => f.column));
			const dimCols = dims.map((d) => d.column).filter((c) => !existingFilterCols.has(c));
			// If no dimensions yet, filter all columns
			const targetCols = dimCols.length > 0 ? dimCols : headers.filter((c) => !existingFilterCols.has(c));
			if (targetCols.length > 0) {
				const newFilters = targetCols.map((c) => ({ column: c, operator: "!=" as const, value: "" }));
				this.deps.setFilters([...currentFilters, ...newFilters]);
				this.deps.renderDetail();
			}
		});

		// Summary Stats — adds AVG, MIN, MAX, COUNT for first numeric column
		const numericCols = headers.filter((h) => {
			const hint = hints.find((ht) => ht.column === h);
			return hint?.type === "number";
		});
		if (numericCols.length > 0) {
			const statsLink = toolsRow.createEl("span", { cls: "ft-nav-link ft-text-xs ft-cursor-pointer" });
			const stIcon = statsLink.createSpan();
			setIcon(stIcon, "bar-chart-3");
			stIcon.addClass("ft-inline-icon-mr", "ft-icon-xs");
			statsLink.appendText("Summary Stats");
			statsLink.addEventListener("click", () => {
				const col = numericCols[0];
				const existing = this.deps.measures();
				const existingFns = new Set(existing.filter((m) => m.column === col).map((m) => m.function));
				const toAdd: Array<{ column: string; function: AggregationFunction; label: string }> = [];
				for (const fn of ["AVG", "MIN", "MAX", "COUNT"] as AggregationFunction[]) {
					if (!existingFns.has(fn)) toAdd.push({ column: col, function: fn, label: `${fn}(${col})` });
				}
				if (toAdd.length > 0) {
					this.deps.setMeasures([...existing, ...toAdd]);
					this.deps.renderDetail();
				}
			});
		}

		// Render columns grouped by type
		const groups = groupColumnsByType(headers, hints);

		for (const group of groups) {
			const groupDiv = section.createDiv({ cls: "ft-schema-group" });

			// Group header with type icon
			const groupHeader = groupDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-schema-group-header" });
			const icon = groupHeader.createSpan();
			setIcon(icon, TYPE_ICONS[group.type] ?? "type");
			icon.addClass("ft-inline-icon", "ft-flex-shrink-0", "ft-icon-xs");
			groupHeader.createSpan({ text: group.label, cls: "ft-text-sm ft-font-medium" });
			groupHeader.createSpan({ text: `${group.columns.length}`, cls: "ft-badge ft-badge-muted" });

			// Column rows
			for (const col of group.columns) {
				const hint = hints.find((h) => h.column === col);
				const isExcluded = excludeSet.has(col);
				const row = groupDiv.createDiv({ cls: `ft-flex ft-items-center ft-gap-2 ft-schema-col-row${isExcluded ? " ft-excluded" : ""}` });

				// Visibility toggle
				const eyeBtn = row.createEl("span", { cls: "ft-nav-link ft-icon-btn" });
				const eyeIcon = eyeBtn.createSpan();
				setIcon(eyeIcon, isExcluded ? "eye-off" : "eye");
				eyeIcon.addClass("ft-inline-icon-plain", "ft-icon-xs");
				eyeBtn.title = isExcluded ? "Include in results" : "Exclude from results";
				eyeBtn.addEventListener("click", () => {
					const current = this.deps.excludedColumns();
					if (isExcluded) {
						this.deps.setExcludedColumns(current.filter((c) => c !== col));
					} else {
						this.deps.setExcludedColumns([...current, col]);
					}
					this.deps.renderDetail();
				});

				// Remove empty filter
				const hasEmptyFilter = this.deps.filters().some((f) => f.column === col && f.operator === "!=" && f.value === "");
				const filterBtn = row.createEl("span", { cls: `ft-nav-link ft-icon-btn${hasEmptyFilter ? " ft-filter-active" : " ft-action-faint"}` });
				filterBtn.title = hasEmptyFilter ? "Empty rows filtered" : "Remove empty rows for this column";
				const filterIcon = filterBtn.createSpan();
				setIcon(filterIcon, hasEmptyFilter ? "filter" : "filter-x");
				filterIcon.addClass("ft-inline-icon-plain", "ft-icon-xs");
				if (hasEmptyFilter) {
					filterBtn.addEventListener("click", () => {
						this.deps.setFilters(this.deps.filters().filter((f) => !(f.column === col && f.operator === "!=" && f.value === "")));
						this.deps.renderDetail();
					});
				} else {
					filterBtn.addEventListener("click", () => {
						this.deps.setFilters([...this.deps.filters(), { column: col, operator: "!=", value: "" }]);
						this.deps.renderDetail();
					});
				}

				// Column name
				row.createSpan({ text: col, cls: `ft-text-sm ft-col-name${isExcluded ? " ft-col-excluded" : ""}` });

				// Alias input
				const aliasInput = row.createEl("input", { type: "text", cls: "ft-text-xs ft-input-inline" });
				aliasInput.placeholder = "Alias";
				if (hint?.alias) aliasInput.value = hint.alias;
				aliasInput.addEventListener("change", () => {
					const val = aliasInput.value.trim() || undefined;
					this.updateColumnTypeHint(col, { alias: val });
				});

				// Private toggle (lock/unlock)
				const isPrivate = hint?.isPrivate ?? false;
				const lockBtn = row.createEl("span", { cls: `ft-nav-link ft-icon-btn${isPrivate ? " ft-lock-active" : " ft-action-faint"}` });
				lockBtn.title = isPrivate ? "Remove anonymization" : "Anonymize column values";
				const lockIcon = lockBtn.createSpan();
				setIcon(lockIcon, isPrivate ? "lock" : "unlock");
				lockIcon.addClass("ft-inline-icon-plain", "ft-icon-xs");
				lockBtn.addEventListener("click", () => {
					this.updateColumnTypeHint(col, { isPrivate: !isPrivate || undefined });
					this.deps.renderDetail();
				});

				// Source alias badges (multi-source)
				const aliases = sourceMap.get(col);
				if (aliases) {
					for (const alias of aliases) {
						row.createSpan({ text: alias, cls: "ft-badge ft-badge-muted ft-badge-sm" });
					}
				}

				// Spacer
				row.createSpan({ cls: "ft-flex-spacer" });

				// Type dropdown — shows "currency" as virtual option (maps to number + symbol)
				const isCurrency = hint?.type === "number" && !!hint.currencySymbol;
				const displayType = isCurrency ? "currency" : (hint?.type ?? "string");

				const select = row.createEl("select", { cls: "ft-select-small" });
				for (const uiType of ["string", "number", "currency", "date"]) {
					const opt = select.createEl("option");
					opt.value = uiType;
					opt.textContent = uiType;
					if (uiType === displayType) opt.selected = true;
				}

				// Currency symbol input (inline, only visible for "currency" type)
				let symbolInput: HTMLInputElement | null = null;
				if (displayType === "currency") {
					symbolInput = row.createEl("input", { type: "text", cls: "ft-text-xs ft-input-symbol" });
					symbolInput.placeholder = "$";
					if (hint?.currencySymbol) symbolInput.value = hint.currencySymbol;
					symbolInput.addEventListener("change", () => {
						const val = symbolInput!.value.trim() || undefined;
						this.updateColumnTypeHint(col, { currencySymbol: val });
					});
				}

				select.addEventListener("change", () => {
					const val = select.value;
					if (val === "currency") {
						const sym = symbolInput?.value.trim() || hint?.currencySymbol || "$";
						this.updateColumnTypeHint(col, { type: "number", currencySymbol: sym });
					} else if (val === "number") {
						this.updateColumnTypeHint(col, { type: "number", currencySymbol: undefined });
					} else {
						this.updateColumnTypeHint(col, { type: val as ColumnType, currencySymbol: undefined });
					}
					this.deps.renderDetail();
				});

				// Group By checkbox (for non-numeric columns)
				if (group.type !== "number" && group.type !== "currency") {
					const dimLabel = row.createEl("label", { cls: "ft-flex ft-items-center ft-gap-1 ft-dim-label" });
					const cb = dimLabel.createEl("input", { type: "checkbox" });
					cb.checked = dimSet.has(col);
					cb.addEventListener("change", () => {
						const current = this.deps.dimensions();
						if (cb.checked) {
							current.push({ column: col });
							this.deps.setDimensions(current);
						} else {
							this.deps.setDimensions(current.filter((d) => d.column !== col));
						}
					});
					dimLabel.appendText("Group");
				}

				// Time Bucket quick-action (for date columns)
				if (group.type === "date") {
					const tb = this.deps.timeBucket();
					const isTimeBucket = tb?.column === col;
					if (isTimeBucket) {
						row.createSpan({ text: "time bucket", cls: "ft-badge ft-badge-muted ft-badge-time-bucket" });
					} else {
						const tbBtn = row.createEl("span", { cls: "ft-nav-link ft-text-xs ft-cursor-pointer" });
						tbBtn.title = `Use ${col} as time bucket`;
						const tbIcon = tbBtn.createSpan();
						setIcon(tbIcon, "clock");
						tbIcon.addClass("ft-inline-icon-plain", "ft-icon-xs");
						tbBtn.appendText(" Time Bucket");
						tbBtn.addEventListener("click", () => {
							this.deps.setTimeBucket({ column: col, period: "month" });
							this.deps.renderDetail();
						});
					}
				}

				// Quick-add measure dropdown (all column types)
				{
					const alreadyAdded = this.deps.measures().some((m) => m.column === col);
					if (alreadyAdded) {
						row.createSpan({ text: "measure", cls: "ft-badge ft-badge-muted ft-badge-time-bucket" });
					}
					const isNumeric = group.type === "number" || group.type === "currency";
					const applicableFns: AggregationFunction[] = isNumeric
						? AGG_FUNCTIONS
						: ["COUNT", "COUNT_DISTINCT"];
					const measureSelect = row.createEl("select", { cls: "ft-select-small ft-select-measure-add" });
					const placeholder = measureSelect.createEl("option");
					placeholder.value = "";
					placeholder.textContent = "+ measure";
					placeholder.disabled = true;
					placeholder.selected = true;
					for (const fn of applicableFns) {
						const opt = measureSelect.createEl("option");
						opt.value = fn;
						opt.textContent = fn;
					}
					measureSelect.addEventListener("change", () => {
						const fn = measureSelect.value as AggregationFunction;
						if (!fn) return;
						this.deps.setMeasures([...this.deps.measures(), { column: col, function: fn, label: `${fn}(${col})` }]);
						this.deps.renderDetail();
					});
				}
			}
		}
	}

	private updateColumnTypeHint(column: string, update: Partial<ColumnTypeHint>): void {
		const currentHints = [...this.deps.columnTypeHints()];
		const idx = currentHints.findIndex((h) => h.column === column);
		if (idx >= 0) {
			currentHints[idx] = { ...currentHints[idx], ...update };
		} else {
			currentHints.push({ column, type: update.type ?? "string", ...update });
		}
		this.deps.setColumnTypeHints(currentHints);
	}

	// ─── Time Bucket ────────────────────────────────────────

	private renderTimeBucketConfig(): void {
		const hints = this.deps.columnTypeHints();
		const dateCols = hints.filter((h) => h.type === "date").map((h) => h.column);
		if (dateCols.length === 0) return;

		const section = this.container.createDiv({ cls: "ft-card ft-mt-3" });
		const tbHeader = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		tbHeader.createSpan({ text: "Time Bucket", cls: "ft-text-sm ft-font-semibold" });
		tbHeader.addClass("ft-card-title");
		section.createDiv({ text: "Group rows by a date column into time periods for trend analysis.", cls: "ft-text-muted ft-text-xs ft-helper-text-snug" });

		const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-row-padded" });

		const tb = this.deps.timeBucket();
		const cb = row.createEl("input", { type: "checkbox" });
		cb.checked = tb !== null;
		cb.addEventListener("change", () => {
			this.deps.setTimeBucket(cb.checked ? { column: dateCols[0], period: "month" } : null);
			this.deps.renderDetail();
		});

		if (tb) {
			const colSelect = row.createEl("select", { cls: "ft-select-small" });
			for (const col of dateCols) {
				const opt = colSelect.createEl("option");
				opt.value = col;
				opt.textContent = col;
				if (tb.column === col) opt.selected = true;
			}
			colSelect.addEventListener("change", () => {
				const current = this.deps.timeBucket();
				if (current) current.column = colSelect.value;
			});

			row.createSpan({ text: "by", cls: "ft-text-muted ft-text-sm" });

			const periodSelect = row.createEl("select", { cls: "ft-select-small" });
			for (const p of TIME_PERIODS) {
				const opt = periodSelect.createEl("option");
				opt.value = p;
				opt.textContent = p;
				if (tb.period === p) opt.selected = true;
			}
			periodSelect.addEventListener("change", () => {
				const current = this.deps.timeBucket();
				if (current) current.period = periodSelect.value as TimeBucketPeriod;
			});
		} else {
			row.createSpan({ text: "Enable time bucketing", cls: "ft-text-muted ft-text-sm" });
		}
	}

	// ─── Measures ───────────────────────────────────────────

	private renderMeasureConfig(): void {
		const section = this.container.createDiv({ cls: "ft-card ft-mt-3" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.createSpan({ text: "Measures", cls: "ft-text-sm ft-font-semibold" });
		header.addClass("ft-card-title");
		section.createDiv({ text: "Aggregate columns using functions like SUM, COUNT, or AVG.", cls: "ft-text-muted ft-text-xs ft-helper-text-snug" });

		const hints = this.deps.columnTypeHints();
		const allHeaders = this.deps.getLoadedHeaders();

		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm ft-ml-auto" });
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.appendText(" Add");
		addBtn.addEventListener("click", () => {
			const numCol = hints.find((h) => h.type === "number");
			const measures = this.deps.measures();
			measures.push({
				column: numCol?.column ?? allHeaders[0] ?? "",
				function: numCol ? "SUM" : "COUNT",
			});
			this.deps.setMeasures(measures);
			this.deps.renderDetail();
		});

		const measures = this.deps.measures();
		for (let i = 0; i < measures.length; i++) {
			const measure = measures[i];
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-row-padded-bordered" });

			const funcSelect = row.createEl("select", { cls: "ft-select-small" });
			for (const fn of AGG_FUNCTIONS) {
				const opt = funcSelect.createEl("option");
				opt.value = fn;
				opt.textContent = fn;
				if (measure.function === fn) opt.selected = true;
			}
			funcSelect.addEventListener("change", () => { measure.function = funcSelect.value as AggregationFunction; });

			row.createSpan({ text: "(", cls: "ft-text-muted" });

			renderColumnPicker(row, {
				headers: allHeaders,
				typeHints: hints,
				selected: measure.column,
				cssText: SELECT_CSS,
				onChange: (col) => { measure.column = col; },
			});

			row.createSpan({ text: ")", cls: "ft-text-muted" });

			row.createSpan({ text: "as", cls: "ft-text-muted ft-text-xs ft-ml-1" });
			const aliasInput = row.createEl("input", { type: "text", cls: "ft-text-xs ft-input-alias" });
			aliasInput.placeholder = `${measure.function}(${measure.column})`;
			if (measure.label) aliasInput.value = measure.label;
			aliasInput.addEventListener("change", () => {
				measure.label = aliasInput.value.trim() || undefined;
			});

			// Type hint for measure output (number format)
			const measureLabel = measure.label ?? `${measure.function}(${measure.column})`;
			const measureHint = hints.find((h) => h.column === measureLabel);
			const isMeasureCurrency = measureHint?.type === "number" && !!measureHint.currencySymbol;
			const measureType = isMeasureCurrency ? "currency" : (measureHint?.type ?? "number");

			const typeSelect = row.createEl("select", { cls: "ft-select-small ft-select-measure-type" });
			for (const t of ["number", "currency"]) {
				const opt = typeSelect.createEl("option");
				opt.value = t;
				opt.textContent = t;
				if (t === measureType) opt.selected = true;
			}

			let symInput: HTMLInputElement | null = null;
			if (measureType === "currency") {
				symInput = row.createEl("input", { type: "text", cls: "ft-text-xs ft-input-measure-symbol" });
				symInput.placeholder = "$";
				if (measureHint?.currencySymbol) symInput.value = measureHint.currencySymbol;
				symInput.addEventListener("change", () => {
					this.updateColumnTypeHint(measureLabel, { type: "number", currencySymbol: symInput!.value.trim() || "$" });
				});
			}

			typeSelect.addEventListener("change", () => {
				if (typeSelect.value === "currency") {
					this.updateColumnTypeHint(measureLabel, { type: "number", currencySymbol: "$" });
				} else {
					this.updateColumnTypeHint(measureLabel, { type: "number", currencySymbol: undefined });
				}
				this.deps.renderDetail();
			});

			const removeBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const removeIcon = removeBtn.createSpan();
			setIcon(removeIcon, "x");
			removeBtn.addEventListener("click", () => {
				const current = this.deps.measures();
				current.splice(i, 1);
				this.deps.setMeasures(current);
				this.deps.renderDetail();
			});
		}

		if (measures.length === 0) {
			section.createDiv({ text: "Add at least one measure to run a query", cls: "ft-text-muted ft-text-sm ft-p-2" });
		}
	}
}
