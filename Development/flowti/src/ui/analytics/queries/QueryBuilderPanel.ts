/**
 * Query builder panel sub-component.
 *
 * Renders type hints, joins, dimensions, measures,
 * time bucketing, filters, and sort/limit configuration.
 */

import { setIcon } from "obsidian";
import type {
	QueriesSubDeps,
	QuerySource,
	ColumnType,
	JoinSpec,
	TimeBucketPeriod,
	AggregationFunction,
	FilterOperator,
} from "./types";
import {
	AGG_FUNCTIONS,
	TIME_PERIODS,
	FILTER_OPERATORS,
	SELECT_CSS,
	INPUT_CSS,
} from "./types";

export class QueryBuilderPanel {
	constructor(
		private container: HTMLElement,
		private deps: QueriesSubDeps,
	) {}

	render(): void {
		const headers = this.deps.getLoadedHeaders();
		if (headers.length === 0) return;

		this.renderTypeHints();
		const loadedSources = this.deps.sources().filter((s) => s.data);
		if (loadedSources.length > 1) {
			this.renderJoinConfig(loadedSources);
		}
		this.renderDimensionConfig();
		this.renderMeasureConfig();
		this.renderTimeBucketConfig();
		this.renderFilterConfig();
		this.renderSortLimitConfig();
	}

	private renderTypeHints(): void {
		const section = this.container.createDiv({ cls: "ft-card ft-mt-3" });
		section.createDiv({ text: "Column Types", cls: "ft-detail-section-header" });

		const table = section.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("tr");
		thead.createEl("th", { text: "Column" });
		thead.createEl("th", { text: "Type" });

		const hints = this.deps.columnTypeHints();
		for (const col of this.deps.getLoadedHeaders()) {
			const hint = hints.find((h) => h.column === col);
			const tr = table.createEl("tr");
			tr.createEl("td", { text: col, cls: "ft-text-sm" });

			const typeTd = tr.createEl("td");
			const select = typeTd.createEl("select");
			select.style.cssText = SELECT_CSS;
			for (const type of ["string", "number", "date"] as ColumnType[]) {
				const opt = select.createEl("option");
				opt.value = type;
				opt.textContent = type;
				if (hint?.type === type) opt.selected = true;
				else if (!hint && type === "string") opt.selected = true;
			}
			select.addEventListener("change", () => {
				const currentHints = this.deps.columnTypeHints();
				const existing = currentHints.find((h) => h.column === col);
				if (existing) {
					existing.type = select.value as ColumnType;
				} else {
					currentHints.push({ column: col, type: select.value as ColumnType });
					this.deps.setColumnTypeHints(currentHints);
				}
			});
		}
	}

	private renderJoinConfig(loaded: QuerySource[]): void {
		const section = this.container.createDiv({ cls: "ft-card ft-mt-3" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.createDiv({ text: "Joins", cls: "ft-detail-section-header" });
		header.style.margin = "0";

		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		addBtn.style.marginLeft = "auto";
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.appendText(" Add Join");
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
			row.style.padding = "0.35rem 0.5rem";
			row.style.borderBottom = "1px solid var(--background-modifier-border)";

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

	private renderDimensionConfig(): void {
		const section = this.container.createDiv({ cls: "ft-card ft-mt-3" });
		section.createDiv({ text: "Group By (Dimensions)", cls: "ft-detail-section-header" });

		const dims = this.deps.dimensions();
		const dimSet = new Set(dims.map((d) => d.column));
		const hints = this.deps.columnTypeHints();
		const numericCols = new Set(hints.filter((h) => h.type === "number").map((h) => h.column));
		const grid = section.createDiv({ cls: "ft-property-grid" });
		for (const col of this.deps.getLoadedHeaders().filter((c) => !numericCols.has(c))) {
			const item = grid.createDiv({ cls: "ft-property-item" });
			const cb = item.createEl("input", { type: "checkbox" });
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
			item.createSpan({ text: col, cls: "ft-text-sm" });
		}
	}

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

			const colSelect = row.createEl("select");
			colSelect.style.cssText = SELECT_CSS;
			for (const h of allHeaders) {
				const opt = colSelect.createEl("option");
				opt.value = h;
				opt.textContent = h;
				if (measure.column === h) opt.selected = true;
			}
			colSelect.addEventListener("change", () => { measure.column = colSelect.value; });

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

	private renderFilterConfig(): void {
		const section = this.container.createDiv({ cls: "ft-card ft-mt-3" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.createDiv({ text: "Filters", cls: "ft-detail-section-header" });
		header.style.margin = "0";

		const allHeaders = this.deps.getLoadedHeaders();

		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		addBtn.style.marginLeft = "auto";
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.appendText(" Add");
		addBtn.addEventListener("click", () => {
			const filters = this.deps.filters();
			filters.push({
				column: allHeaders[0] ?? "",
				operator: "=",
				value: "",
			});
			this.deps.setFilters(filters);
			this.deps.renderDetail();
		});

		const filters = this.deps.filters();
		for (let i = 0; i < filters.length; i++) {
			const filter = filters[i];
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			row.style.padding = "0.35rem 0.5rem";
			row.style.borderBottom = "1px solid var(--background-modifier-border)";

			const colSelect = row.createEl("select");
			colSelect.style.cssText = SELECT_CSS;
			for (const h of allHeaders) {
				const opt = colSelect.createEl("option");
				opt.value = h;
				opt.textContent = h;
				if (filter.column === h) opt.selected = true;
			}
			colSelect.addEventListener("change", () => { filter.column = colSelect.value; });

			const opSelect = row.createEl("select");
			opSelect.style.cssText = SELECT_CSS;
			for (const op of FILTER_OPERATORS) {
				const opt = opSelect.createEl("option");
				opt.value = op.id;
				opt.textContent = op.label;
				if (filter.operator === op.id) opt.selected = true;
			}
			opSelect.addEventListener("change", () => { filter.operator = opSelect.value as FilterOperator; });

			const valInput = row.createEl("input", { type: "text" });
			valInput.value = filter.value;
			valInput.placeholder = "Value";
			valInput.style.cssText = INPUT_CSS + ";width:120px";
			valInput.addEventListener("change", () => { filter.value = valInput.value; });

			const removeBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			const removeIcon = removeBtn.createSpan();
			setIcon(removeIcon, "x");
			removeBtn.addEventListener("click", () => {
				const current = this.deps.filters();
				current.splice(i, 1);
				this.deps.setFilters(current);
				this.deps.renderDetail();
			});
		}

		if (filters.length === 0) {
			section.createDiv({ text: "No filters — all rows included", cls: "ft-text-muted ft-text-sm ft-p-2" });
		}
	}

	private renderSortLimitConfig(): void {
		const section = this.container.createDiv({ cls: "ft-card ft-mt-3" });
		section.createDiv({ text: "Sort & Limit", cls: "ft-detail-section-header" });

		const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
		row.style.padding = "0.35rem 0.5rem";

		const currentSort = this.deps.sort();
		const sortCb = row.createEl("input", { type: "checkbox" });
		sortCb.checked = currentSort !== null;
		sortCb.addEventListener("change", () => {
			this.deps.setSort(sortCb.checked
				? { column: this.deps.getLoadedHeaders()[0] ?? "", direction: "asc" }
				: null);
			this.deps.renderDetail();
		});

		if (currentSort) {
			row.createSpan({ text: "Sort by", cls: "ft-text-muted ft-text-sm" });

			const colSelect = row.createEl("select");
			colSelect.style.cssText = SELECT_CSS;
			for (const h of this.deps.getLoadedHeaders()) {
				const opt = colSelect.createEl("option");
				opt.value = h;
				opt.textContent = h;
				if (currentSort.column === h) opt.selected = true;
			}
			colSelect.addEventListener("change", () => {
				const s = this.deps.sort();
				if (s) s.column = colSelect.value;
			});

			const dirSelect = row.createEl("select");
			dirSelect.style.cssText = SELECT_CSS;
			for (const dir of ["asc", "desc"] as const) {
				const opt = dirSelect.createEl("option");
				opt.value = dir;
				opt.textContent = dir === "asc" ? "Ascending" : "Descending";
				if (currentSort.direction === dir) opt.selected = true;
			}
			dirSelect.addEventListener("change", () => {
				const s = this.deps.sort();
				if (s) s.direction = dirSelect.value as "asc" | "desc";
			});
		} else {
			row.createSpan({ text: "Enable sorting", cls: "ft-text-muted ft-text-sm" });
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
}
