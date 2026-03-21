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
	ColumnTypeHint,
	AggregationFunction,
} from "./types";
import {
	AGG_FUNCTIONS,
	SELECT_CSS,
} from "./types";
import { renderColumnPicker, groupColumnsByType } from "./columnPicker";
import { FilterBuilderPanel } from "./FilterBuilderPanel";
import { renderSchemaColumnRow } from "./schemaColumnRow";
import { renderJoinSubSection, renderSortLimitSubSection, renderTimeBucketConfig } from "./pipelineSection";

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
		renderTimeBucketConfig(this.container, this.deps);

		// 4. Measures
		this.renderMeasureConfig();
	}

	// ─── Combined Data Pipeline ─────────────────────────────

	private renderDataPipeline(loadedSources: QuerySource[]): void {
		const card = this.container.createDiv({ cls: "ft-card ft-mt-3" });
		const cardTitle = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		cardTitle.createSpan({ text: "Data Pipeline", cls: "ft-text-sm ft-font-semibold" });
		cardTitle.addClass("ft-card-title");
		if (loadedSources.length > 1) renderJoinSubSection(card, loadedSources, this.deps);
		card.createDiv({ cls: "ft-card-divider" });
		new FilterBuilderPanel(card, this.deps).renderInto(card);
		card.createDiv({ cls: "ft-card-divider" });
		renderSortLimitSubSection(card, this.deps);
	}

	// ─── Column Types & Schema (merged) ─────────────────────

	private renderSchemaAndTypes(loadedSources: QuerySource[]): void {
		const headers = this.deps.getLoadedHeaders();
		const section = this.container.createDiv({ cls: "ft-card ft-mt-3" });

		this.renderSchemaHeader(section, headers, loadedSources);

		const hints = this.deps.columnTypeHints();
		const dims = this.deps.dimensions();
		const dimSet = new Set(dims.map((d) => d.column));
		const sourceMap = this.buildSourceMap(loadedSources);

		this.renderSchemaTools(section, headers, hints, dims);

		const excludeSet = new Set(this.deps.excludedColumns());
		const groups = groupColumnsByType(headers, hints);

		for (const group of groups) {
			const groupDiv = section.createDiv({ cls: "ft-schema-group" });
			const groupHeader = groupDiv.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-schema-group-header" });
			const icon = groupHeader.createSpan();
			setIcon(icon, TYPE_ICONS[group.type] ?? "type");
			icon.addClass("ft-inline-icon", "ft-flex-shrink-0", "ft-icon-xs");
			groupHeader.createSpan({ text: group.label, cls: "ft-text-sm ft-font-medium" });
			groupHeader.createSpan({ text: `${group.columns.length}`, cls: "ft-badge ft-badge-muted" });

			for (const col of group.columns) {
				renderSchemaColumnRow(groupDiv, {
					deps: this.deps, col,
					hint: hints.find((h) => h.column === col),
					isExcluded: excludeSet.has(col),
					dimSet, sourceMap, groupType: group.type,
					updateColumnTypeHint: (c, u) => this.updateColumnTypeHint(c, u),
				});
			}
		}
	}

	private renderSchemaHeader(section: HTMLElement, headers: string[], loadedSources: QuerySource[]): void {
		const sectionHeader = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		sectionHeader.createSpan({ text: "Column Types & Schema", cls: "ft-text-sm ft-font-semibold" });
		sectionHeader.addClass("ft-card-title");
		const excluded = this.deps.excludedColumns();
		const visibleCount = headers.length - excluded.length;
		const badge = sectionHeader.createSpan({
			text: excluded.length > 0 ? `${visibleCount}/${headers.length}` : `${headers.length}`,
			cls: "ft-badge ft-badge-muted",
		});
		badge.addClass("ft-ml-auto");
		if (excluded.length > 0) badge.title = `${excluded.length} column${excluded.length > 1 ? "s" : ""} hidden`;
		for (const src of loadedSources) {
			const effective = src.locale === "auto" || !src.locale ? "en-US" : src.locale;
			const localeTag = sectionHeader.createSpan({ cls: "ft-badge ft-badge-muted ft-badge-locale" });
			localeTag.textContent = loadedSources.length > 1 ? `${src.alias}: ${effective}` : effective;
			// eslint-disable-next-line obsidianmd/ui/sentence-case
		if (src.locale === "auto" || !src.locale) localeTag.title = "Auto-detected (default: en-US)";
		}
	}

	private buildSourceMap(loadedSources: QuerySource[]): Map<string, string[]> {
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
		return sourceMap;
	}

	private renderSchemaTools(section: HTMLElement, headers: string[], hints: ColumnTypeHint[], dims: { column: string }[]): void {
		const toolsRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-tools-row" });
		toolsRow.createSpan({ text: "Tools", cls: "ft-text-xs ft-text-muted ft-font-medium" });
		this.renderRemoveEmptyTool(toolsRow, headers, dims);
		this.renderSummaryStatsTool(toolsRow, headers, hints);
	}

	private renderRemoveEmptyTool(toolsRow: HTMLElement, headers: string[], dims: { column: string }[]): void {
		const removeEmptyLink = toolsRow.createEl("span", { cls: "ft-nav-link ft-text-xs ft-cursor-pointer" });
		const reIcon = removeEmptyLink.createSpan();
		setIcon(reIcon, "filter-x");
		reIcon.addClass("ft-inline-icon-mr", "ft-icon-xs");
		removeEmptyLink.appendText("Remove Empty Rows");
		removeEmptyLink.addEventListener("click", () => {
			const currentFilters = this.deps.filters();
			const existingFilterCols = new Set(currentFilters.filter((f) => f.operator === "!=" && f.value === "").map((f) => f.column));
			const dimCols = dims.map((d) => d.column).filter((c) => !existingFilterCols.has(c));
			const targetCols = dimCols.length > 0 ? dimCols : headers.filter((c) => !existingFilterCols.has(c));
			if (targetCols.length > 0) {
				const newFilters = targetCols.map((c) => ({ column: c, operator: "!=" as const, value: "" }));
				this.deps.setFilters([...currentFilters, ...newFilters]);
				this.deps.renderDetail();
			}
		});
	}

	private renderSummaryStatsTool(toolsRow: HTMLElement, headers: string[], hints: ColumnTypeHint[]): void {
		const numericCols = headers.filter((h) => hints.find((ht) => ht.column === h)?.type === "number");
		if (numericCols.length === 0) return;
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
			measures.push({ column: numCol?.column ?? allHeaders[0] ?? "", function: numCol ? "SUM" : "COUNT" });
			this.deps.setMeasures(measures);
			this.deps.renderDetail();
		});

		const measures = this.deps.measures();
		for (let i = 0; i < measures.length; i++) {
			this.renderMeasureRow(section, measures[i], i, hints, allHeaders);
		}

		if (measures.length === 0) {
			section.createDiv({ text: "Add at least one measure to run a query", cls: "ft-text-muted ft-text-sm ft-p-2" });
		}
	}

	private renderMeasureRow(
		section: HTMLElement,
		measure: { column: string; function: AggregationFunction; label?: string },
		index: number,
		hints: ColumnTypeHint[],
		allHeaders: string[],
	): void {
		const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-row-padded-bordered" });

		const funcSelect = row.createEl("select", { cls: "ft-select-small" });
		for (const fn of AGG_FUNCTIONS) {
			const opt = funcSelect.createEl("option");
			opt.value = fn; opt.textContent = fn;
			if (measure.function === fn) opt.selected = true;
		}
		funcSelect.addEventListener("change", () => { measure.function = funcSelect.value as AggregationFunction; });

		row.createSpan({ text: "(", cls: "ft-text-muted" });
		renderColumnPicker(row, {
			headers: allHeaders, typeHints: hints, selected: measure.column,
			cssText: SELECT_CSS, onChange: (col) => { measure.column = col; },
		});
		row.createSpan({ text: ")", cls: "ft-text-muted" });

		row.createSpan({ text: "as", cls: "ft-text-muted ft-text-xs ft-ml-1" });
		const aliasInput = row.createEl("input", { type: "text", cls: "ft-text-xs ft-input-alias" });
		aliasInput.placeholder = `${measure.function}(${measure.column})`;
		if (measure.label) aliasInput.value = measure.label;
		aliasInput.addEventListener("change", () => { measure.label = aliasInput.value.trim() || undefined; });

		this.renderMeasureTypeControl(row, measure, hints);

		const removeBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const removeIcon = removeBtn.createSpan();
		setIcon(removeIcon, "x");
		removeBtn.addEventListener("click", () => {
			const current = this.deps.measures();
			current.splice(index, 1);
			this.deps.setMeasures(current);
			this.deps.renderDetail();
		});
	}

	private renderMeasureTypeControl(
		row: HTMLElement,
		measure: { column: string; function: AggregationFunction; label?: string },
		hints: ColumnTypeHint[],
	): void {
		const measureLabel = measure.label ?? `${measure.function}(${measure.column})`;
		const measureHint = hints.find((h) => h.column === measureLabel);
		const isMeasureCurrency = measureHint?.type === "number" && !!measureHint.currencySymbol;
		const measureType = isMeasureCurrency ? "currency" : (measureHint?.type ?? "number");

		const typeSelect = row.createEl("select", { cls: "ft-select-small ft-select-measure-type" });
		for (const t of ["number", "currency"]) {
			const opt = typeSelect.createEl("option");
			opt.value = t; opt.textContent = t;
			if (t === measureType) opt.selected = true;
		}

		if (measureType === "currency") {
			const symInput = row.createEl("input", { type: "text", cls: "ft-text-xs ft-input-measure-symbol" });
			symInput.placeholder = "$";
			if (measureHint?.currencySymbol) symInput.value = measureHint.currencySymbol;
			symInput.addEventListener("change", () => {
				this.updateColumnTypeHint(measureLabel, { type: "number", currencySymbol: symInput.value.trim() || "$" });
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
	}
}
