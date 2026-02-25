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
	INPUT_CSS,
} from "./types";
import { renderColumnPicker, groupColumnsByType } from "./columnPicker";
import { FilterBuilderPanel } from "./FilterBuilderPanel";

const TYPE_ICONS: Record<string, string> = {
	number: "hash",
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
		cardTitle.createDiv({ text: "Data Pipeline", cls: "ft-detail-section-header" });
		cardTitle.style.margin = "0";

		// Joins sub-section (only if 2+ sources)
		if (hasJoins) {
			this.addDivider(card);
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
		const divider = parent.createDiv();
		divider.style.cssText = "border-top:1px solid var(--background-modifier-border);margin:0.5rem 0";
	}

	private renderJoinSubSection(section: HTMLElement, loaded: QuerySource[]): void {
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const headerIcon = header.createSpan();
		setIcon(headerIcon, "git-merge");
		headerIcon.style.cssText = "width:14px;height:14px;opacity:0.6";
		header.createSpan({ text: "Joins", cls: "ft-text-sm" }).style.fontWeight = "500";
		header.style.margin = "0";

		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		addBtn.style.marginLeft = "auto";
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
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1 ft-flex-wrap" });
			row.style.padding = "0.25rem 0.5rem";

			this.renderJoinSide(row, join, "left", loaded);
			row.createSpan({ text: "=", cls: "ft-text-muted" });
			this.renderJoinSide(row, join, "right", loaded);

			const typeSelect = row.createEl("select");
			typeSelect.style.cssText = SELECT_CSS;
			for (const jt of ["inner", "left"] as const) {
				const opt = typeSelect.createEl("option");
				opt.value = jt;
				opt.textContent = jt;
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

		const srcSelect = container.createEl("select");
		srcSelect.style.cssText = SELECT_CSS;
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

		const colSelect = container.createEl("select");
		colSelect.style.cssText = SELECT_CSS;
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
		headerIcon.style.cssText = "width:14px;height:14px;opacity:0.6";
		header.createSpan({ text: "Sort & Limit", cls: "ft-text-sm" }).style.fontWeight = "500";
		header.style.margin = "0";

		const sorts = this.deps.sort();
		if (sorts.length > 0) {
			header.createSpan({ text: `${sorts.length}`, cls: "ft-badge ft-badge-muted" });
		}

		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		addBtn.style.marginLeft = "auto";
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
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			row.style.padding = "0.35rem 0.5rem";
			row.style.borderBottom = "1px solid var(--background-modifier-border)";

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

			const dirSelect = row.createEl("select");
			dirSelect.style.cssText = SELECT_CSS;
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
		const limitRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
		limitRow.style.padding = "0.35rem 0.5rem";

		const currentLimit = this.deps.limit();
		const limitCb = limitRow.createEl("input", { type: "checkbox" });
		limitCb.checked = currentLimit !== null;
		limitCb.addEventListener("change", () => {
			this.deps.setLimit(limitCb.checked ? 10 : null);
			this.deps.renderDetail();
		});

		if (currentLimit !== null) {
			limitRow.createSpan({ text: "Max rows", cls: "ft-text-muted ft-text-sm" });
			const limitInput = limitRow.createEl("input", { type: "number" });
			limitInput.value = String(currentLimit);
			limitInput.min = "0";
			limitInput.style.cssText = INPUT_CSS;
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
		sectionHeader.createDiv({ text: "Column Types & Schema", cls: "ft-detail-section-header" });
		sectionHeader.style.margin = "0";
		const excluded = this.deps.excludedColumns();
		const excludeSet = new Set(excluded);
		const visibleCount = headers.length - excluded.length;
		const badge = sectionHeader.createSpan({
			text: excluded.length > 0 ? `${visibleCount}/${headers.length}` : `${headers.length}`,
			cls: "ft-badge ft-badge-muted",
		});
		badge.style.marginLeft = "auto";
		if (excluded.length > 0) badge.title = `${excluded.length} column${excluded.length > 1 ? "s" : ""} hidden`;

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

		// Render columns grouped by type
		const groups = groupColumnsByType(headers, hints);

		for (const group of groups) {
			const groupDiv = section.createDiv();
			groupDiv.style.padding = "0.25rem 0.5rem";

			// Group header with type icon
			const groupHeader = groupDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
			groupHeader.style.borderBottom = "1px solid var(--background-modifier-border)";
			groupHeader.style.paddingBottom = "0.25rem";
			groupHeader.style.marginBottom = "0.25rem";
			const icon = groupHeader.createSpan();
			setIcon(icon, TYPE_ICONS[group.type] ?? "type");
			icon.style.width = "14px";
			icon.style.height = "14px";
			icon.style.opacity = "0.6";
			groupHeader.createSpan({ text: group.label, cls: "ft-text-sm" }).style.fontWeight = "500";
			groupHeader.createSpan({ text: `${group.columns.length}`, cls: "ft-badge ft-badge-muted" });

			// Column rows
			for (const col of group.columns) {
				const hint = hints.find((h) => h.column === col);
				const isExcluded = excludeSet.has(col);
				const row = groupDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
				row.style.padding = "0.2rem 0 0.2rem 1.25rem";
				if (isExcluded) row.style.opacity = "0.45";

				// Visibility toggle
				const eyeBtn = row.createEl("span", { cls: "ft-nav-link" });
				eyeBtn.style.cssText = "cursor:pointer;flex-shrink:0;padding:0";
				const eyeIcon = eyeBtn.createSpan();
				setIcon(eyeIcon, isExcluded ? "eye-off" : "eye");
				eyeIcon.style.cssText = "width:12px;height:12px";
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

				// Column name
				const nameEl = row.createSpan({ text: col, cls: "ft-text-sm" });
				nameEl.style.minWidth = "80px";
				if (isExcluded) nameEl.style.textDecoration = "line-through";

				// Alias input
				const aliasInput = row.createEl("input", { type: "text", cls: "ft-text-xs" });
				aliasInput.style.cssText = "padding:2px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary);width:80px;color:var(--text-muted)";
				aliasInput.placeholder = "alias";
				if (hint?.alias) aliasInput.value = hint.alias;
				aliasInput.addEventListener("change", () => {
					const val = aliasInput.value.trim() || undefined;
					this.updateColumnTypeHint(col, { alias: val });
				});

				// Source alias badges (multi-source)
				const aliases = sourceMap.get(col);
				if (aliases) {
					for (const alias of aliases) {
						const badge = row.createSpan({ text: alias, cls: "ft-badge ft-badge-muted" });
						badge.style.fontSize = "0.65rem";
						badge.style.padding = "0 0.25rem";
					}
				}

				// Spacer
				const spacer = row.createSpan();
				spacer.style.flex = "1";

				// Type dropdown — shows "currency" as virtual option (maps to number + symbol)
				const isCurrency = hint?.type === "number" && !!hint.currencySymbol;
				const displayType = isCurrency ? "currency" : (hint?.type ?? "string");

				const select = row.createEl("select");
				select.style.cssText = SELECT_CSS;
				for (const uiType of ["string", "number", "currency", "date"]) {
					const opt = select.createEl("option");
					opt.value = uiType;
					opt.textContent = uiType;
					if (uiType === displayType) opt.selected = true;
				}

				// Currency symbol input (visible for number or currency)
				const symbolInput = row.createEl("input", { type: "text", cls: "ft-text-xs" });
				symbolInput.style.cssText = "padding:2px 4px;border-radius:4px;border:1px solid var(--background-modifier-border);background:var(--background-primary);width:36px";
				symbolInput.placeholder = "$";
				if (hint?.currencySymbol) symbolInput.value = hint.currencySymbol;
				symbolInput.style.display = (displayType === "number" || displayType === "currency") ? "" : "none";

				select.addEventListener("change", () => {
					const val = select.value;
					if (val === "currency") {
						// Set type=number + auto-populate symbol if empty
						const sym = symbolInput.value.trim() || "$";
						symbolInput.value = sym;
						symbolInput.style.display = "";
						this.updateColumnTypeHint(col, { type: "number", currencySymbol: sym });
					} else if (val === "number") {
						// Clear currency symbol
						symbolInput.value = "";
						symbolInput.style.display = "";
						this.updateColumnTypeHint(col, { type: "number", currencySymbol: undefined });
					} else {
						symbolInput.style.display = "none";
						this.updateColumnTypeHint(col, { type: val as ColumnType, currencySymbol: undefined });
					}
					this.deps.renderDetail();
				});

				symbolInput.addEventListener("change", () => {
					const val = symbolInput.value.trim() || undefined;
					this.updateColumnTypeHint(col, { currencySymbol: val });
				});

				// Group By checkbox (for non-numeric columns)
				if (group.type !== "number") {
					const dimLabel = row.createEl("label", { cls: "ft-flex ft-items-center ft-gap-1" });
					dimLabel.style.cssText = "cursor:pointer;font-size:var(--font-ui-small);color:var(--text-muted)";
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

				// Quick-add measure button (for numeric columns)
				if (group.type === "number") {
					const alreadyAdded = this.deps.measures().some((m) => m.column === col);
					if (alreadyAdded) {
						const addedBadge = row.createSpan({ text: "measure", cls: "ft-badge ft-badge-muted" });
						addedBadge.style.fontSize = "0.65rem";
					} else {
						const addMeasureBtn = row.createEl("span", { cls: "ft-nav-link ft-text-xs" });
						addMeasureBtn.style.cursor = "pointer";
						addMeasureBtn.title = `Add SUM(${col}) as measure`;
						const btnIcon = addMeasureBtn.createSpan();
						setIcon(btnIcon, "plus");
						btnIcon.style.width = "12px";
						btnIcon.style.height = "12px";
						addMeasureBtn.appendText(" SUM");
						addMeasureBtn.addEventListener("click", () => {
							this.deps.setMeasures([...this.deps.measures(), { column: col, function: "SUM" }]);
							this.deps.renderDetail();
						});
					}
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
		section.createDiv({ text: "Time Bucket", cls: "ft-detail-section-header" });

		const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
		row.style.padding = "0.35rem 0.5rem";

		const tb = this.deps.timeBucket();
		const cb = row.createEl("input", { type: "checkbox" });
		cb.checked = tb !== null;
		cb.addEventListener("change", () => {
			this.deps.setTimeBucket(cb.checked ? { column: dateCols[0], period: "month" } : null);
			this.deps.renderDetail();
		});

		if (tb) {
			const colSelect = row.createEl("select");
			colSelect.style.cssText = SELECT_CSS;
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

			const periodSelect = row.createEl("select");
			periodSelect.style.cssText = SELECT_CSS;
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
		header.createDiv({ text: "Measures", cls: "ft-detail-section-header" });
		header.style.margin = "0";

		const hints = this.deps.columnTypeHints();
		const numericCols = hints.filter((h) => h.type === "number").map((h) => h.column);
		const allHeaders = numericCols.length > 0 ? numericCols : this.deps.getLoadedHeaders();

		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		addBtn.style.marginLeft = "auto";
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.appendText(" Add");
		addBtn.addEventListener("click", () => {
			const numCol = hints.find((h) => h.type === "number");
			const measures = this.deps.measures();
			measures.push({
				column: numCol?.column ?? allHeaders[0] ?? "",
				function: "SUM",
			});
			this.deps.setMeasures(measures);
			this.deps.renderDetail();
		});

		const measures = this.deps.measures();
		for (let i = 0; i < measures.length; i++) {
			const measure = measures[i];
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			row.style.padding = "0.35rem 0.5rem";
			row.style.borderBottom = "1px solid var(--background-modifier-border)";

			const funcSelect = row.createEl("select");
			funcSelect.style.cssText = SELECT_CSS;
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
