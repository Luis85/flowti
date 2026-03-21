/**
 * Data pipeline section rendering for QueryBuilderPanel.
 *
 * Renders joins, sort/limit configuration.
 * Extracted to reduce QueryBuilderPanel module size.
 */
import { setIcon } from "obsidian";
import type {
	QueriesSubDeps,
	QuerySource,
	JoinSpec,
	TimeBucketPeriod,
} from "./types";
import { SELECT_CSS } from "./types";
import { renderColumnPicker } from "./columnPicker";

/** Renders the join sub-section within the data pipeline card. */
export function renderJoinSubSection(section: HTMLElement, loaded: QuerySource[], deps: QueriesSubDeps): void {
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
		const joins = deps.joins();
		joins.push({
			leftSource: loaded[0].alias,
			leftColumn: loaded[0].data!.headers[0] ?? "",
			rightSource: loaded[1].alias,
			rightColumn: loaded[1].data!.headers[0] ?? "",
			type: "inner",
		});
		deps.setJoins(joins);
		deps.renderDetail();
	});

	const joins = deps.joins();
	for (let i = 0; i < joins.length; i++) {
		renderJoinRow(section, joins[i], i, loaded, deps);
	}
}

function renderJoinRow(section: HTMLElement, join: JoinSpec, index: number, loaded: QuerySource[], deps: QueriesSubDeps): void {
	const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-flex-wrap ft-join-row" });
	renderJoinSide(row, join, "left", loaded, deps);
	row.createSpan({ text: "=", cls: "ft-text-muted" });
	renderJoinSide(row, join, "right", loaded, deps);

	const joinTypeLabels: Record<string, string> = {
		inner: "inner \u2014 only matching rows",
		left: "left \u2014 all left rows, matches from right",
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
		const currentJoins = deps.joins();
		currentJoins.splice(index, 1);
		deps.setJoins(currentJoins);
		deps.renderDetail();
	});
}

function renderJoinSide(container: HTMLElement, join: JoinSpec, side: "left" | "right", loaded: QuerySource[], deps: QueriesSubDeps): void {
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
		deps.renderDetail();
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

/** Renders the sort & limit sub-section within the data pipeline card. */
export function renderSortLimitSubSection(section: HTMLElement, deps: QueriesSubDeps): void {
	const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
	const headerIcon = header.createSpan();
	setIcon(headerIcon, "arrow-up-down");
	headerIcon.addClass("ft-inline-icon", "ft-icon-sm");
	header.createSpan({ text: "Sort & Limit", cls: "ft-text-sm ft-font-medium" });
	header.addClass("ft-subsection-header");

	const sorts = deps.sort();
	if (sorts.length > 0) {
		header.createSpan({ text: `${sorts.length}`, cls: "ft-badge ft-badge-muted" });
	}

	const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm ft-ml-auto" });
	const addSortIcon = addBtn.createSpan();
	setIcon(addSortIcon, "plus");
	addBtn.appendText(" Add Sort");
	addBtn.addEventListener("click", () => {
		const current = deps.sort();
		const usedCols = new Set(current.map((s) => s.column));
		const available = deps.getLoadedHeaders().find((h) => !usedCols.has(h));
		current.push({ column: available ?? deps.getLoadedHeaders()[0] ?? "", direction: "asc" });
		deps.setSort(current);
		deps.renderDetail();
	});

	if (sorts.length === 0) {
		section.createDiv({ text: "No sort columns", cls: "ft-text-muted ft-text-sm ft-p-2" });
	}

	for (let i = 0; i < sorts.length; i++) {
		renderSortRow(section, sorts[i], i, deps);
	}

	renderLimitRow(section, deps);
}

function renderSortRow(section: HTMLElement, sortSpec: { column: string; direction: string }, index: number, deps: QueriesSubDeps): void {
	const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-row-padded-bordered" });
	row.createSpan({ text: index === 0 ? "Sort by" : "then by", cls: "ft-text-muted ft-text-sm" });

	renderColumnPicker(row, {
		headers: deps.getLoadedHeaders(),
		typeHints: deps.columnTypeHints(),
		selected: sortSpec.column,
		cssText: SELECT_CSS,
		onChange: (col) => { const current = deps.sort(); current[index].column = col; deps.setSort(current); },
	});

	const dirSelect = row.createEl("select", { cls: "ft-select-small" });
	for (const dir of ["asc", "desc"] as const) {
		const opt = dirSelect.createEl("option");
		opt.value = dir;
		opt.textContent = dir === "asc" ? "Ascending" : "Descending";
		if (sortSpec.direction === dir) opt.selected = true;
	}
	dirSelect.addEventListener("change", () => {
		const current = deps.sort();
		current[index].direction = dirSelect.value as "asc" | "desc";
		deps.setSort(current);
	});

	const removeBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
	const removeIcon = removeBtn.createSpan();
	setIcon(removeIcon, "x");
	removeBtn.addEventListener("click", () => {
		const current = deps.sort();
		current.splice(index, 1);
		deps.setSort(current);
		deps.renderDetail();
	});
}

function renderLimitRow(section: HTMLElement, deps: QueriesSubDeps): void {
	const limitRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-row-padded" });
	const currentLimit = deps.limit();
	const limitCb = limitRow.createEl("input", { type: "checkbox" });
	limitCb.checked = currentLimit !== null;
	limitCb.addEventListener("change", () => { deps.setLimit(limitCb.checked ? 10 : null); deps.renderDetail(); });

	if (currentLimit !== null) {
		limitRow.createSpan({ text: "Max rows", cls: "ft-text-muted ft-text-sm" });
		const limitInput = limitRow.createEl("input", { type: "number", cls: "ft-select-small" });
		limitInput.value = String(currentLimit);
		limitInput.min = "0";
		limitInput.addEventListener("change", () => {
			const val = parseInt(limitInput.value, 10);
			deps.setLimit(isNaN(val) ? null : val);
		});
	} else {
		limitRow.createSpan({ text: "Enable row limit", cls: "ft-text-muted ft-text-sm" });
	}
}

/** Renders the time bucket configuration section. */
export function renderTimeBucketConfig(container: HTMLElement, deps: QueriesSubDeps): void {
	const hints = deps.columnTypeHints();
	const dateCols = hints.filter((h) => h.type === "date").map((h) => h.column);
	if (dateCols.length === 0) return;

	const section = container.createDiv({ cls: "ft-card ft-mt-3" });
	const tbHeader = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
	tbHeader.createSpan({ text: "Time Bucket", cls: "ft-text-sm ft-font-semibold" });
	tbHeader.addClass("ft-card-title");
	section.createDiv({ text: "Group rows by a date column into time periods for trend analysis.", cls: "ft-text-muted ft-text-xs ft-helper-text-snug" });

	const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-row-padded" });
	const tb = deps.timeBucket();
	const cb = row.createEl("input", { type: "checkbox" });
	cb.checked = tb !== null;
	cb.addEventListener("change", () => { deps.setTimeBucket(cb.checked ? { column: dateCols[0], period: "month" } : null); deps.renderDetail(); });

	if (tb) {
		const colSelect = row.createEl("select", { cls: "ft-select-small" });
		for (const col of dateCols) {
			const opt = colSelect.createEl("option");
			opt.value = col; opt.textContent = col;
			if (tb.column === col) opt.selected = true;
		}
		colSelect.addEventListener("change", () => { const current = deps.timeBucket(); if (current) current.column = colSelect.value; });
		row.createSpan({ text: "by", cls: "ft-text-muted ft-text-sm" });
		const periodSelect = row.createEl("select", { cls: "ft-select-small" });
		const TIME_PERIODS_LOCAL: TimeBucketPeriod[] = ["day", "week", "month", "quarter", "year"];
		for (const p of TIME_PERIODS_LOCAL) {
			const opt = periodSelect.createEl("option");
			opt.value = p; opt.textContent = p;
			if (tb.period === p) opt.selected = true;
		}
		periodSelect.addEventListener("change", () => { const current = deps.timeBucket(); if (current) current.period = periodSelect.value as TimeBucketPeriod; });
	} else {
		row.createSpan({ text: "Enable time bucketing", cls: "ft-text-muted ft-text-sm" });
	}
}
