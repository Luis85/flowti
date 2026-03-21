/**
 * Column row rendering for the schema/types section of QueryBuilderPanel.
 *
 * Extracted to reduce complexity of renderSchemaAndTypes (c:55 → sub-15).
 */
import { setIcon } from "obsidian";
import type {
	QueriesSubDeps,
	ColumnType,
	ColumnTypeHint,
	AggregationFunction,
} from "./types";
import { AGG_FUNCTIONS } from "./types";

export interface ColumnRowContext {
	deps: QueriesSubDeps;
	col: string;
	hint: ColumnTypeHint | undefined;
	isExcluded: boolean;
	dimSet: Set<string>;
	sourceMap: Map<string, string[]>;
	groupType: string;
	updateColumnTypeHint: (col: string, update: Partial<ColumnTypeHint>) => void;
}

/** Renders a single column row with all controls. */
export function renderSchemaColumnRow(parent: HTMLElement, ctx: ColumnRowContext): void {
	const { deps, col, hint, isExcluded, groupType } = ctx;
	const row = parent.createDiv({ cls: `ft-flex ft-items-center ft-gap-2 ft-schema-col-row${isExcluded ? " ft-excluded" : ""}` });

	renderVisibilityToggle(row, col, isExcluded, deps);
	renderEmptyFilter(row, col, deps);
	row.createSpan({ text: col, cls: `ft-text-sm ft-col-name${isExcluded ? " ft-col-excluded" : ""}` });
	renderAliasInput(row, col, hint, ctx.updateColumnTypeHint);
	renderPrivateToggle(row, col, hint, ctx.updateColumnTypeHint, deps);
	renderSourceBadges(row, col, ctx.sourceMap);
	row.createSpan({ cls: "ft-flex-spacer" });
	renderTypeDropdown(row, col, hint, ctx.updateColumnTypeHint, deps);
	renderGroupByCheckbox(row, col, groupType, ctx.dimSet, deps);
	renderTimeBucketAction(row, col, groupType, deps);
	renderMeasureDropdown(row, col, groupType, deps);
}

function renderVisibilityToggle(row: HTMLElement, col: string, isExcluded: boolean, deps: QueriesSubDeps): void {
	const eyeBtn = row.createEl("span", { cls: "ft-nav-link ft-icon-btn" });
	const eyeIcon = eyeBtn.createSpan();
	setIcon(eyeIcon, isExcluded ? "eye-off" : "eye");
	eyeIcon.addClass("ft-inline-icon-plain", "ft-icon-xs");
	eyeBtn.title = isExcluded ? "Include in results" : "Exclude from results";
	eyeBtn.addEventListener("click", () => {
		const current = deps.excludedColumns();
		if (isExcluded) {
			deps.setExcludedColumns(current.filter((c) => c !== col));
		} else {
			deps.setExcludedColumns([...current, col]);
		}
		deps.renderDetail();
	});
}

function renderEmptyFilter(row: HTMLElement, col: string, deps: QueriesSubDeps): void {
	const hasEmptyFilter = deps.filters().some((f) => f.column === col && f.operator === "!=" && f.value === "");
	const filterBtn = row.createEl("span", { cls: `ft-nav-link ft-icon-btn${hasEmptyFilter ? " ft-filter-active" : " ft-action-faint"}` });
	filterBtn.title = hasEmptyFilter ? "Empty rows filtered" : "Remove empty rows for this column";
	const filterIcon = filterBtn.createSpan();
	setIcon(filterIcon, hasEmptyFilter ? "filter" : "filter-x");
	filterIcon.addClass("ft-inline-icon-plain", "ft-icon-xs");
	filterBtn.addEventListener("click", () => {
		if (hasEmptyFilter) {
			deps.setFilters(deps.filters().filter((f) => !(f.column === col && f.operator === "!=" && f.value === "")));
		} else {
			deps.setFilters([...deps.filters(), { column: col, operator: "!=", value: "" }]);
		}
		deps.renderDetail();
	});
}

function renderAliasInput(row: HTMLElement, col: string, hint: ColumnTypeHint | undefined, updateHint: (col: string, u: Partial<ColumnTypeHint>) => void): void {
	const aliasInput = row.createEl("input", { type: "text", cls: "ft-text-xs ft-input-inline" });
	aliasInput.placeholder = "Alias";
	if (hint?.alias) aliasInput.value = hint.alias;
	aliasInput.addEventListener("change", () => {
		updateHint(col, { alias: aliasInput.value.trim() || undefined });
	});
}

function renderPrivateToggle(row: HTMLElement, col: string, hint: ColumnTypeHint | undefined, updateHint: (col: string, u: Partial<ColumnTypeHint>) => void, deps: QueriesSubDeps): void {
	const isPrivate = hint?.isPrivate ?? false;
	const lockBtn = row.createEl("span", { cls: `ft-nav-link ft-icon-btn${isPrivate ? " ft-lock-active" : " ft-action-faint"}` });
	lockBtn.title = isPrivate ? "Remove anonymization" : "Anonymize column values";
	const lockIcon = lockBtn.createSpan();
	setIcon(lockIcon, isPrivate ? "lock" : "unlock");
	lockIcon.addClass("ft-inline-icon-plain", "ft-icon-xs");
	lockBtn.addEventListener("click", () => {
		updateHint(col, { isPrivate: !isPrivate || undefined });
		deps.renderDetail();
	});
}

function renderSourceBadges(row: HTMLElement, col: string, sourceMap: Map<string, string[]>): void {
	const aliases = sourceMap.get(col);
	if (aliases) {
		for (const alias of aliases) {
			row.createSpan({ text: alias, cls: "ft-badge ft-badge-muted ft-badge-sm" });
		}
	}
}

function renderTypeDropdown(row: HTMLElement, col: string, hint: ColumnTypeHint | undefined, updateHint: (col: string, u: Partial<ColumnTypeHint>) => void, deps: QueriesSubDeps): void {
	const isCurrency = hint?.type === "number" && !!hint.currencySymbol;
	const displayType = isCurrency ? "currency" : (hint?.type ?? "string");
	const select = row.createEl("select", { cls: "ft-select-small" });
	for (const uiType of ["string", "number", "currency", "date"]) {
		const opt = select.createEl("option");
		opt.value = uiType;
		opt.textContent = uiType;
		if (uiType === displayType) opt.selected = true;
	}
	let symbolInput: HTMLInputElement | null = null;
	if (displayType === "currency") {
		symbolInput = row.createEl("input", { type: "text", cls: "ft-text-xs ft-input-symbol" });
		symbolInput.placeholder = "$";
		if (hint?.currencySymbol) symbolInput.value = hint.currencySymbol;
		symbolInput.addEventListener("change", () => {
			updateHint(col, { currencySymbol: symbolInput!.value.trim() || undefined });
		});
	}
	select.addEventListener("change", () => {
		const val = select.value;
		if (val === "currency") {
			const sym = symbolInput?.value.trim() || hint?.currencySymbol || "$";
			updateHint(col, { type: "number", currencySymbol: sym });
		} else if (val === "number") {
			updateHint(col, { type: "number", currencySymbol: undefined });
		} else {
			updateHint(col, { type: val as ColumnType, currencySymbol: undefined });
		}
		deps.renderDetail();
	});
}

function renderGroupByCheckbox(row: HTMLElement, col: string, groupType: string, dimSet: Set<string>, deps: QueriesSubDeps): void {
	if (groupType === "number" || groupType === "currency") return;
	const dimLabel = row.createEl("label", { cls: "ft-flex ft-items-center ft-gap-1 ft-dim-label" });
	const cb = dimLabel.createEl("input", { type: "checkbox" });
	cb.checked = dimSet.has(col);
	cb.addEventListener("change", () => {
		const current = deps.dimensions();
		if (cb.checked) {
			current.push({ column: col });
			deps.setDimensions(current);
		} else {
			deps.setDimensions(current.filter((d) => d.column !== col));
		}
	});
	dimLabel.appendText("Group");
}

function renderTimeBucketAction(row: HTMLElement, col: string, groupType: string, deps: QueriesSubDeps): void {
	if (groupType !== "date") return;
	const tb = deps.timeBucket();
	if (tb?.column === col) {
		row.createSpan({ text: "time bucket", cls: "ft-badge ft-badge-muted ft-badge-time-bucket" });
	} else {
		const tbBtn = row.createEl("span", { cls: "ft-nav-link ft-text-xs ft-cursor-pointer" });
		tbBtn.title = `Use ${col} as time bucket`;
		const tbIcon = tbBtn.createSpan();
		setIcon(tbIcon, "clock");
		tbIcon.addClass("ft-inline-icon-plain", "ft-icon-xs");
		tbBtn.appendText(" Time Bucket");
		tbBtn.addEventListener("click", () => { deps.setTimeBucket({ column: col, period: "month" }); deps.renderDetail(); });
	}
}

function renderMeasureDropdown(row: HTMLElement, col: string, groupType: string, deps: QueriesSubDeps): void {
	const alreadyAdded = deps.measures().some((m) => m.column === col);
	if (alreadyAdded) {
		row.createSpan({ text: "measure", cls: "ft-badge ft-badge-muted ft-badge-time-bucket" });
	}
	const isNumeric = groupType === "number" || groupType === "currency";
	const applicableFns: AggregationFunction[] = isNumeric ? AGG_FUNCTIONS : ["COUNT", "COUNT_DISTINCT"];
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
		deps.setMeasures([...deps.measures(), { column: col, function: fn, label: `${fn}(${col})` }]);
		deps.renderDetail();
	});
}
