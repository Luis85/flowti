/**
 * Reusable column picker utility for query builder dropdowns.
 *
 * Creates <select> elements with columns grouped by type (optgroup).
 * Used by QueryBuilderPanel for dimension, measure, filter, and sort column selection.
 */

import type { ColumnTypeHint, ColumnType } from "./types";

export interface ColumnPickerOptions {
	/** All available column headers */
	headers: string[];
	/** Column type hints for grouping */
	typeHints: ColumnTypeHint[];
	/** Currently selected column name */
	selected?: string;
	/** CSS text for the select element */
	cssText?: string;
	/** Callback when selection changes */
	onChange?: (column: string) => void;
	/** If true, show a placeholder option when nothing is selected */
	placeholder?: string;
}

const TYPE_LABELS: Record<ColumnType, string> = {
	number: "Numeric",
	date: "Date",
	string: "Text",
};

const TYPE_ORDER: ColumnType[] = ["number", "date", "string"];

/**
 * Render a column picker <select> element with columns grouped by type.
 * Falls back to a flat list when fewer than 2 types are present.
 */
export function renderColumnPicker(container: HTMLElement, options: ColumnPickerOptions): HTMLSelectElement {
	const { headers, typeHints, selected, cssText, onChange, placeholder } = options;
	const select = container.createEl("select");
	if (cssText) select.style.cssText = cssText;

	if (placeholder) {
		const opt = select.createEl("option");
		opt.value = "";
		opt.textContent = placeholder;
		opt.disabled = true;
		if (!selected) opt.selected = true;
	}

	const hintMap = new Map<string, ColumnType>();
	for (const h of typeHints) {
		hintMap.set(h.column, h.type);
	}

	// Group columns by type
	const groups = new Map<ColumnType, string[]>();
	for (const col of headers) {
		const type = hintMap.get(col) ?? "string";
		if (!groups.has(type)) groups.set(type, []);
		groups.get(type)!.push(col);
	}

	// Use optgroups when 2+ types present
	const typeCount = groups.size;

	if (typeCount >= 2) {
		for (const type of TYPE_ORDER) {
			const cols = groups.get(type);
			if (!cols || cols.length === 0) continue;

			const optgroup = select.createEl("optgroup");
			optgroup.label = TYPE_LABELS[type];

			for (const col of cols) {
				const opt = optgroup.createEl("option");
				opt.value = col;
				opt.textContent = col;
				if (col === selected) opt.selected = true;
			}
		}
	} else {
		// Flat list
		for (const col of headers) {
			const opt = select.createEl("option");
			opt.value = col;
			opt.textContent = col;
			if (col === selected) opt.selected = true;
		}
	}

	if (onChange) {
		select.addEventListener("change", () => onChange(select.value));
	}

	return select;
}

/** Group key — extends ColumnType with virtual "currency" group. */
export type SchemaGroupType = ColumnType | "currency";

/**
 * Get columns grouped by type for display in schema panels.
 * Currency columns (number + currencySymbol) get their own group.
 */
export function groupColumnsByType(
	headers: string[],
	typeHints: ColumnTypeHint[],
): Array<{ type: SchemaGroupType; label: string; columns: string[] }> {
	const hintMap = new Map<string, ColumnTypeHint>();
	for (const h of typeHints) {
		hintMap.set(h.column, h);
	}

	const groups: Array<{ type: SchemaGroupType; label: string; columns: string[] }> = [];
	const DISPLAY_ORDER: SchemaGroupType[] = ["number", "currency", "date", "string"];
	const DISPLAY_LABELS: Record<SchemaGroupType, string> = { number: "Numeric", currency: "Currency", date: "Date", string: "Text" };

	for (const groupType of DISPLAY_ORDER) {
		const cols = headers.filter((h) => {
			const hint = hintMap.get(h);
			const baseType = hint?.type ?? "string";
			if (groupType === "currency") return baseType === "number" && !!hint?.currencySymbol;
			if (groupType === "number") return baseType === "number" && !hint?.currencySymbol;
			return baseType === groupType;
		});
		if (cols.length > 0) {
			groups.push({ type: groupType, label: DISPLAY_LABELS[groupType], columns: cols });
		}
	}

	return groups;
}
