/**
 * Visual filter builder sub-component.
 *
 * Replaces the text-only filter section in QueryBuilderPanel with
 * type-aware operator selection and value suggestions from source data.
 *
 * String columns: =, !=, contains, startsWith + datalist with distinct values
 * Number columns: =, !=, >, <, >=, <=
 * Date columns: =, !=, >, <, >=, <=
 */

import { setIcon } from "obsidian";
import type { QueriesSubDeps, FilterOperator } from "./types";
import { SELECT_CSS } from "./types";
import { renderColumnPicker } from "./columnPicker";

/** Operators appropriate for string columns. */
const STRING_OPERATORS: Array<{ id: FilterOperator; label: string }> = [
	{ id: "=", label: "=" },
	{ id: "!=", label: "!=" },
	{ id: "contains", label: "contains" },
	{ id: "startsWith", label: "starts with" },
];

/** Operators appropriate for number and date columns. */
const NUMERIC_OPERATORS: Array<{ id: FilterOperator; label: string }> = [
	{ id: "=", label: "=" },
	{ id: "!=", label: "!=" },
	{ id: ">", label: ">" },
	{ id: "<", label: "<" },
	{ id: ">=", label: ">=" },
	{ id: "<=", label: "<=" },
];

export class FilterBuilderPanel {
	constructor(
		private container: HTMLElement,
		private deps: QueriesSubDeps,
	) {}

	render(): void {
		this.renderInto(this.container.createDiv({ cls: "ft-card ft-mt-3" }));
	}

	/** Render filter controls into an existing parent element (no card wrapper). */
	renderInto(section: HTMLElement): void {
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const headerIcon = header.createSpan({ cls: "ft-filter-header-icon ft-icon-sm" });
		setIcon(headerIcon, "filter");
		header.createSpan({ text: "Filters", cls: "ft-text-sm ft-font-medium" });

		const filterCount = this.deps.filters().length;
		if (filterCount > 0) {
			header.createSpan({ text: `${filterCount}`, cls: "ft-badge ft-badge-muted" });
		}

		const allHeaders = this.deps.getLoadedHeaders();

		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm ft-ml-auto" });
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
			this.renderFilterRow(section, filters, i, allHeaders);
		}

		if (filters.length === 0) {
			section.createDiv({ text: "No filters — all rows included", cls: "ft-text-muted ft-text-sm ft-p-2" });
		}
	}

	private renderFilterRow(section: HTMLElement, filters: Array<{ column: string; operator: FilterOperator; value: string }>, index: number, allHeaders: string[]): void {
		const filter = filters[index];
		const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-filter-row" });

		// Column picker with type grouping
		renderColumnPicker(row, {
			headers: allHeaders,
			typeHints: this.deps.columnTypeHints(),
			selected: filter.column,
			cssText: SELECT_CSS,
			onChange: (col) => {
				filter.column = col;
				// Reset operator to "=" when column changes (type-safe default)
				filter.operator = "=";
				this.deps.renderDetail();
			},
		});

		// Type-aware operator select
		const colType = this.getColumnType(filter.column);
		const operators = colType === "string" ? STRING_OPERATORS : NUMERIC_OPERATORS;

		const opSelect = row.createEl("select", { cls: "ft-select-input" });
		for (const op of operators) {
			const opt = opSelect.createEl("option");
			opt.value = op.id;
			opt.textContent = op.label;
			if (filter.operator === op.id) opt.selected = true;
		}
		opSelect.addEventListener("change", () => { filter.operator = opSelect.value as FilterOperator; });

		// Value input with datalist suggestions for string columns
		const valInput = row.createEl("input", { type: "text", cls: "ft-filter-value-input" });
		valInput.value = filter.value;
		valInput.placeholder = "Value";
		valInput.addEventListener("change", () => { filter.value = valInput.value; });

		if (colType === "string" && this.deps.getDistinctValues) {
			const listId = `ft-filter-suggest-${index}`;
			const datalist = row.createEl("datalist");
			datalist.id = listId;
			valInput.setAttribute("list", listId);

			const values = this.deps.getDistinctValues(filter.column);
			for (const v of values) {
				const opt = datalist.createEl("option");
				opt.value = v;
			}
		}

		// Remove button
		const removeBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const removeIcon = removeBtn.createSpan();
		setIcon(removeIcon, "x");
		removeBtn.addEventListener("click", () => {
			const current = this.deps.filters();
			current.splice(index, 1);
			this.deps.setFilters(current);
			this.deps.renderDetail();
		});
	}

	private getColumnType(column: string): string {
		const hint = this.deps.columnTypeHints().find((h) => h.column === column);
		return hint?.type ?? "string";
	}
}
