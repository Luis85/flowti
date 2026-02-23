/**
 * Queries tab component for the Analytics Hub.
 *
 * Query builder UI: source selection, column type hints, joins,
 * dimensions, measures, time bucketing, and query execution.
 *
 * Migrated from AnalyticsTab (DX Hub) — same rendering logic,
 * adapted to AnalyticsHubDeps with non-optional analyticsService.
 */

import { setIcon } from "obsidian";
import type { AnalyticsHubDeps } from "./types";
import type {
	LocaleId,
	ColumnTypeHint,
	ColumnType,
	JoinSpec,
	DimensionSpec,
	MeasureSpec,
	TimeBucketSpec,
	TimeBucketPeriod,
	AggregationFunction,
	AnalyticsQuery,
	AnalyticsSource,
	AnalyticsSourceType,
	AnalyticsResult,
	ParsedSourceData,
	SavedAnalyticsQuerySource,
} from "../../domain/analytics/types";
import { AnalyticsEngine } from "../../domain/analytics/AnalyticsEngine";
import { AnalyticsResultsPanel } from "../hub/AnalyticsResultsPanel";

interface QuerySource {
	csvPath: string;
	alias: string;
	locale: LocaleId;
	sourceType: AnalyticsSourceType;
	viewIndex?: number;
	data: ParsedSourceData | null;
	loading: boolean;
}

const LOCALE_OPTIONS: Array<{ id: LocaleId; label: string }> = [
	{ id: "auto", label: "Auto" },
	{ id: "en-US", label: "en-US" },
	{ id: "en-GB", label: "en-GB" },
	{ id: "de-DE", label: "de-DE" },
	{ id: "nl-NL", label: "nl-NL" },
	{ id: "fr-FR", label: "fr-FR" },
];

const AGG_FUNCTIONS: AggregationFunction[] = ["SUM", "COUNT", "AVG", "MIN", "MAX"];
const TIME_PERIODS: TimeBucketPeriod[] = ["month", "quarter", "year"];
const SELECT_CSS = "padding:2px 6px;font-size:var(--font-ui-small);background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:var(--radius-s,4px);color:var(--text-normal)";
const INPUT_CSS = SELECT_CSS + ";width:80px";

export class QueriesTab {
	private sources: QuerySource[] = [];
	private columnTypeHints: ColumnTypeHint[] = [];
	private joins: JoinSpec[] = [];
	private dimensions: DimensionSpec[] = [];
	private measures: MeasureSpec[] = [];
	private timeBucket: TimeBucketSpec | null = null;
	private lastResult: AnalyticsResult | null = null;
	private lastDurationMs: number | undefined;
	private lastError: string | null = null;
	private running = false;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: AnalyticsHubDeps,
	) {}

	// ─────────────────────────────────────────────────────────
	// Master: Source picker
	// ─────────────────────────────────────────────────────────

	renderMaster(): void {
		this.masterEl.empty();
		const state = this.deps.getState();

		// Selected sources
		if (this.sources.length > 0) {
			const selHeader = this.masterEl.createDiv({ cls: "ft-master-category-header" });
			selHeader.createSpan({ text: "Query Sources" });
			selHeader.createSpan({ text: `${this.sources.length}`, cls: "ft-master-category-count" });

			for (const src of this.sources) {
				const item = this.masterEl.createDiv({ cls: "ft-master-event-item ft-master-event-selected" });
				item.style.alignItems = "flex-start";

				const textBlock = item.createDiv({ cls: "ft-master-event-name" });
				textBlock.style.minWidth = "0";
				textBlock.createDiv({ text: src.alias });
				const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm" });
				sub.style.whiteSpace = "nowrap";
				sub.style.overflow = "hidden";
				sub.style.textOverflow = "ellipsis";
				sub.textContent = src.csvPath;

				if (src.loading) {
					item.createSpan({ text: "...", cls: "ft-badge ft-badge-muted" });
				} else if (src.data) {
					item.createSpan({ text: `${src.data.headers.length} cols`, cls: "ft-badge ft-badge-muted" });
				}

				const removeBtn = item.createEl("span", { cls: "ft-nav-link ft-text-sm" });
				const removeIcon = removeBtn.createSpan();
				setIcon(removeIcon, "x");
				removeBtn.setAttribute("aria-label", "Remove source");
				removeBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					this.removeSource(src.csvPath);
				});
			}
		}

		// Saved queries (favorites first)
		const savedQueries = [...this.deps.analyticsService.listQueries()].sort((a, b) => {
			if (a.isFavorite && !b.isFavorite) return -1;
			if (!a.isFavorite && b.isFavorite) return 1;
			return 0;
		});
		if (savedQueries.length > 0) {
			const sqHeader = this.masterEl.createDiv({ cls: "ft-master-category-header" });
			sqHeader.createSpan({ text: "Saved Queries" });
			sqHeader.createSpan({ text: `${savedQueries.length}`, cls: "ft-master-category-count" });

			for (const sq of savedQueries) {
				const isSelected = state.selectedQueryId === sq.id;
				const item = this.masterEl.createDiv({
					cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
				});
				item.style.alignItems = "flex-start";

				// Star toggle
				const starBtn = item.createEl("span", { cls: "ft-nav-link" });
				starBtn.style.flexShrink = "0";
				starBtn.style.cursor = "pointer";
				const starIcon = starBtn.createSpan();
				setIcon(starIcon, "star");
				starIcon.style.width = "14px";
				starIcon.style.height = "14px";
				if (!sq.isFavorite) {
					starBtn.style.opacity = "0.3";
				}
				starBtn.setAttribute("aria-label", sq.isFavorite ? "Unfavorite" : "Favorite");
				starBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					void this.deps.analyticsService.toggleQueryFavorite(sq.id);
				});

				const textBlock = item.createDiv({ cls: "ft-master-event-name" });
				textBlock.style.minWidth = "0";
				textBlock.createDiv({ text: sq.name });
				const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm" });
				sub.textContent = `${sq.sources.length} source${sq.sources.length > 1 ? "s" : ""}, ${sq.measures.length} measure${sq.measures.length > 1 ? "s" : ""}`;

				if (sq.lastRowCount !== undefined) {
					item.createSpan({ text: `${sq.lastRowCount} rows`, cls: "ft-badge ft-badge-muted" });
				}

				// Delete button
				const delBtn = item.createEl("span", { cls: "ft-nav-link ft-text-sm" });
				const delIcon = delBtn.createSpan();
				setIcon(delIcon, "trash-2");
				delBtn.setAttribute("aria-label", "Delete query");
				delBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					void this.deleteSavedQuery(sq.id);
				});

				item.addEventListener("click", () => {
					this.deps.setState({ selectedQueryId: sq.id });
					this.loadSavedQuery(sq.id);
				});
			}
		}

		// Available CSVs
		const addedPaths = new Set(this.sources.map((s) => s.csvPath));

		let csvFiles = state.csvFiles;
		if (state.filterText) {
			csvFiles = csvFiles.filter((f) =>
				f.displayName.toLowerCase().includes(state.filterText) ||
				f.path.toLowerCase().includes(state.filterText),
			);
		}
		const availableCsv = csvFiles.filter((f) => !addedPaths.has(f.path));

		const csvHeader = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		csvHeader.createSpan({ text: "CSV Sources" });
		csvHeader.createSpan({ text: `${availableCsv.length}`, cls: "ft-master-category-count" });

		if (availableCsv.length === 0) {
			const empty = this.masterEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			empty.textContent = state.filterText
				? "No matching CSVs"
				: this.sources.length > 0 ? "All CSVs added" : "No CSV files in vault";
		} else {
			for (const csv of availableCsv) {
				this.renderSourceItem(csv.displayName, csv.path, () => {
					this.addSource(csv.path, csv.displayName.replace(/\.csv$/i, ""));
				});
			}
		}

		// Available .base files
		let baseFiles = state.baseFiles;
		if (state.filterText) {
			baseFiles = baseFiles.filter((f) =>
				f.displayName.toLowerCase().includes(state.filterText) ||
				f.path.toLowerCase().includes(state.filterText),
			);
		}
		const availableBase = baseFiles.filter((f) => !addedPaths.has(f.path));

		const baseHeader = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		baseHeader.createSpan({ text: "Base Views" });
		baseHeader.createSpan({ text: `${availableBase.length}`, cls: "ft-master-category-count" });

		if (availableBase.length === 0) {
			const empty = this.masterEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			empty.textContent = state.filterText
				? "No matching .base files"
				: "No .base files in vault";
		} else {
			for (const base of availableBase) {
				this.renderSourceItem(base.displayName, base.path, () => {
					this.addSource(base.path, base.displayName.replace(/\.base$/i, ""), "base", 0);
				});
			}
		}
	}

	private renderSourceItem(displayName: string, path: string, onClick: () => void): void {
		const item = this.masterEl.createDiv({ cls: "ft-master-event-item" });
		item.style.alignItems = "flex-start";

		const textBlock = item.createDiv({ cls: "ft-master-event-name" });
		textBlock.style.minWidth = "0";
		textBlock.createDiv({ text: displayName });
		const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm" });
		sub.style.whiteSpace = "nowrap";
		sub.style.overflow = "hidden";
		sub.style.textOverflow = "ellipsis";
		sub.textContent = path;

		item.addEventListener("click", onClick);
	}

	// ─────────────────────────────────────────────────────────
	// Detail: Query builder form
	// ─────────────────────────────────────────────────────────

	renderDetail(): void {
		this.detailEl.empty();

		if (this.sources.length === 0) {
			this.renderEmptyDetail();
			return;
		}

		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: "Query Builder", cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({
			text: `${this.sources.length} source${this.sources.length > 1 ? "s" : ""}`,
			cls: "ft-badge ft-badge-muted",
		});
		if (this.dimensions.length > 0) {
			badges.createSpan({ text: `${this.dimensions.length} dim`, cls: "ft-badge ft-badge-muted" });
		}
		if (this.measures.length > 0) {
			badges.createSpan({
				text: `${this.measures.length} measure${this.measures.length > 1 ? "s" : ""}`,
				cls: "ft-badge ft-badge-muted",
			});
		}

		this.renderActions();
		this.renderSourceConfig();

		if (this.getLoadedHeaders().length > 0) {
			this.renderTypeHints();
			if (this.sources.filter((s) => s.data).length > 1) {
				this.renderJoinConfig();
			}
			this.renderDimensionConfig();
			this.renderMeasureConfig();
			this.renderTimeBucketConfig();
		}

		if (this.lastError) {
			const errCard = this.detailEl.createDiv({ cls: "ft-alert ft-alert-warning ft-mt-3" });
			errCard.createDiv({ text: this.lastError, cls: "ft-text-sm" });
		}

		if (this.lastResult) {
			const resultsContainer = this.detailEl.createDiv({ cls: "ft-mt-3" });
			const panel = new AnalyticsResultsPanel(resultsContainer, {
				result: this.lastResult,
				durationMs: this.lastDurationMs,
				onExportCsv: (csv) => this.handleExportCsv(csv),
			});
			panel.render();
		}
	}

	// ─────────────────────────────────────────────────────────
	// Empty state
	// ─────────────────────────────────────────────────────────

	private renderEmptyDetail(): void {
		const state = this.deps.getState();
		const queryCount = state.queries.length;
		const wrap = this.detailEl.createDiv({ cls: "ft-empty-detail" });
		wrap.style.textAlign = "center";
		wrap.style.padding = "3rem 1.5rem";
		const iconEl = wrap.createDiv();
		setIcon(iconEl, "bar-chart-2");
		iconEl.style.fontSize = "2rem";
		iconEl.style.opacity = "0.5";
		iconEl.style.marginBottom = "0.5rem";
		wrap.createDiv({ text: "Add a CSV source to build a query", cls: "ft-text-muted" });
		if (queryCount > 0) {
			wrap.createDiv({ text: `${queryCount} saved queries available`, cls: "ft-text-muted ft-text-sm ft-mt-1" });
		}
	}

	// ─────────────────────────────────────────────────────────
	// Source management
	// ─────────────────────────────────────────────────────────

	private addSource(csvPath: string, defaultAlias: string, sourceType: AnalyticsSourceType = "csv", viewIndex?: number): void {
		let alias = defaultAlias;
		const existing = new Set(this.sources.map((s) => s.alias));
		let counter = 2;
		while (existing.has(alias)) {
			alias = `${defaultAlias}_${counter++}`;
		}

		const source: QuerySource = { csvPath, alias, locale: "auto", sourceType, viewIndex, data: null, loading: true };
		this.sources.push(source);
		this.renderMaster();
		this.renderDetail();
		void this.loadSourceData(source);
	}

	private removeSource(csvPath: string): void {
		this.sources = this.sources.filter((s) => s.csvPath !== csvPath);
		this.refreshAfterSourceChange();
		this.renderMaster();
		this.renderDetail();
	}

	private async loadSourceData(source: QuerySource): Promise<void> {
		const svc = this.deps.analyticsService;

		try {
			let data: ParsedSourceData | null = null;
			if (source.sourceType === "base") {
				data = await svc.loadBase(source.csvPath, source.viewIndex ?? 0);
			} else {
				const parsed = await svc.loadCsv(source.csvPath);
				if (parsed) data = { headers: parsed.headers, rows: parsed.rows };
			}

			source.loading = false;
			if (data) {
				source.data = data;
				this.autoDetectTypeHints(source);
			}
		} catch {
			source.loading = false;
		}
		this.renderMaster();
		this.renderDetail();
	}

	private autoDetectTypeHints(source: QuerySource): void {
		if (!source.data) return;
		const detected = AnalyticsEngine.detectColumnTypes(
			source.data.headers,
			source.data.rows,
			source.locale !== "auto" ? source.locale : undefined,
		);
		const existing = new Set(this.columnTypeHints.map((h) => h.column));
		for (const hint of detected) {
			if (!existing.has(hint.column)) {
				this.columnTypeHints.push(hint);
			}
		}
	}

	private refreshAfterSourceChange(): void {
		const headerSet = new Set(this.getLoadedHeaders());
		this.columnTypeHints = this.columnTypeHints.filter((h) => headerSet.has(h.column));
		this.dimensions = this.dimensions.filter((d) => headerSet.has(d.column));
		this.measures = this.measures.filter((m) => headerSet.has(m.column));
		if (this.timeBucket && !headerSet.has(this.timeBucket.column)) {
			this.timeBucket = null;
		}
		const aliases = new Set(this.sources.map((s) => s.alias));
		this.joins = this.joins.filter((j) => aliases.has(j.leftSource) && aliases.has(j.rightSource));
	}

	private getLoadedHeaders(): string[] {
		const headers: string[] = [];
		const seen = new Set<string>();
		for (const src of this.sources) {
			if (!src.data) continue;
			for (const h of src.data.headers) {
				if (!seen.has(h)) {
					headers.push(h);
					seen.add(h);
				}
			}
		}
		return headers;
	}

	// ─────────────────────────────────────────────────────────
	// Render sections
	// ─────────────────────────────────────────────────────────

	private renderActions(): void {
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		const runLink = actions.createEl("span", { cls: "ft-nav-link" });
		const runIcon = runLink.createSpan();
		setIcon(runIcon, "play");
		runLink.appendText(" Run Query");
		if (this.running || this.measures.length === 0) {
			runLink.style.pointerEvents = "none";
			runLink.style.opacity = "0.5";
		}
		runLink.addEventListener("click", () => {
			if (!this.running && this.measures.length > 0) {
				void this.executeQuery();
			}
		});

		const clearLink = actions.createEl("span", { cls: "ft-nav-link" });
		const clearIcon = clearLink.createSpan();
		setIcon(clearIcon, "rotate-ccw");
		clearLink.appendText(" Reset");
		clearLink.addEventListener("click", () => {
			this.sources = [];
			this.columnTypeHints = [];
			this.joins = [];
			this.dimensions = [];
			this.measures = [];
			this.timeBucket = null;
			this.lastResult = null;
			this.lastDurationMs = undefined;
			this.lastError = null;
			this.renderMaster();
			this.renderDetail();
		});

		// Save Query (always available since analyticsService is required)
		if (this.measures.length > 0) {
			const saveLink = actions.createEl("span", { cls: "ft-nav-link" });
			const saveIcon = saveLink.createSpan();
			setIcon(saveIcon, "save");
			saveLink.appendText(" Save Query");
			saveLink.addEventListener("click", () => {
				void this.saveCurrentQuery();
			});
		}
	}

	private renderSourceConfig(): void {
		const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		section.createDiv({ text: "Sources", cls: "ft-detail-section-header" });

		for (const src of this.sources) {
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			row.style.padding = "0.35rem 0.5rem";
			row.style.borderBottom = "1px solid var(--background-modifier-border)";

			const aliasInput = row.createEl("input", { type: "text" });
			aliasInput.value = src.alias;
			aliasInput.style.cssText = INPUT_CSS;
			aliasInput.addEventListener("change", () => {
				src.alias = aliasInput.value.trim() || src.alias;
			});

			row.createSpan({ text: src.csvPath.split("/").pop() ?? src.csvPath, cls: "ft-text-sm ft-flex-1" });

			const localeSelect = row.createEl("select");
			localeSelect.style.cssText = SELECT_CSS;
			for (const opt of LOCALE_OPTIONS) {
				const option = localeSelect.createEl("option");
				option.value = opt.id;
				option.textContent = opt.label;
				if (src.locale === opt.id) option.selected = true;
			}
			localeSelect.addEventListener("change", () => {
				src.locale = localeSelect.value as LocaleId;
			});

			if (src.loading) {
				row.createSpan({ text: "Loading...", cls: "ft-text-muted ft-text-sm" });
			} else if (src.data) {
				row.createSpan({ text: `${src.data.rows.length} rows`, cls: "ft-text-muted ft-text-sm" });
			}
		}
	}

	private renderTypeHints(): void {
		const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		section.createDiv({ text: "Column Types", cls: "ft-detail-section-header" });

		const table = section.createEl("table", { cls: "ft-preview-table" });
		const thead = table.createEl("tr");
		thead.createEl("th", { text: "Column" });
		thead.createEl("th", { text: "Type" });

		for (const col of this.getLoadedHeaders()) {
			const hint = this.columnTypeHints.find((h) => h.column === col);
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
				const existing = this.columnTypeHints.find((h) => h.column === col);
				if (existing) {
					existing.type = select.value as ColumnType;
				} else {
					this.columnTypeHints.push({ column: col, type: select.value as ColumnType });
				}
			});
		}
	}

	private renderJoinConfig(): void {
		const loaded = this.sources.filter((s) => s.data);
		if (loaded.length < 2) return;

		const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.createDiv({ text: "Joins", cls: "ft-detail-section-header" });
		header.style.margin = "0";

		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		addBtn.style.marginLeft = "auto";
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.appendText(" Add Join");
		addBtn.addEventListener("click", () => {
			this.joins.push({
				leftSource: loaded[0].alias,
				leftColumn: loaded[0].data!.headers[0] ?? "",
				rightSource: loaded[1].alias,
				rightColumn: loaded[1].data!.headers[0] ?? "",
				type: "inner",
			});
			this.renderDetail();
		});

		for (let i = 0; i < this.joins.length; i++) {
			const join = this.joins[i];
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
				this.joins.splice(i, 1);
				this.renderDetail();
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
			this.renderDetail();
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
		const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		section.createDiv({ text: "Group By (Dimensions)", cls: "ft-detail-section-header" });

		const dimSet = new Set(this.dimensions.map((d) => d.column));
		const grid = section.createDiv({ cls: "ft-property-grid" });
		for (const col of this.getLoadedHeaders()) {
			const item = grid.createDiv({ cls: "ft-property-item" });
			const cb = item.createEl("input", { type: "checkbox" });
			cb.checked = dimSet.has(col);
			cb.addEventListener("change", () => {
				if (cb.checked) {
					this.dimensions.push({ column: col });
				} else {
					this.dimensions = this.dimensions.filter((d) => d.column !== col);
				}
			});
			item.createSpan({ text: col, cls: "ft-text-sm" });
		}
	}

	private renderMeasureConfig(): void {
		const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.createDiv({ text: "Measures", cls: "ft-detail-section-header" });
		header.style.margin = "0";

		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		addBtn.style.marginLeft = "auto";
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.appendText(" Add");
		addBtn.addEventListener("click", () => {
			const numCol = this.columnTypeHints.find((h) => h.type === "number");
			this.measures.push({
				column: numCol?.column ?? this.getLoadedHeaders()[0] ?? "",
				function: "SUM",
			});
			this.renderDetail();
		});

		const allHeaders = this.getLoadedHeaders();
		for (let i = 0; i < this.measures.length; i++) {
			const measure = this.measures[i];
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
				this.measures.splice(i, 1);
				this.renderDetail();
			});
		}

		if (this.measures.length === 0) {
			section.createDiv({ text: "Add at least one measure to run a query", cls: "ft-text-muted ft-text-sm ft-p-2" });
		}
	}

	private renderTimeBucketConfig(): void {
		const dateCols = this.columnTypeHints.filter((h) => h.type === "date").map((h) => h.column);
		if (dateCols.length === 0) return;

		const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		section.createDiv({ text: "Time Bucket", cls: "ft-detail-section-header" });

		const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
		row.style.padding = "0.35rem 0.5rem";

		const cb = row.createEl("input", { type: "checkbox" });
		cb.checked = this.timeBucket !== null;
		cb.addEventListener("change", () => {
			this.timeBucket = cb.checked ? { column: dateCols[0], period: "month" } : null;
			this.renderDetail();
		});

		if (this.timeBucket) {
			const colSelect = row.createEl("select");
			colSelect.style.cssText = SELECT_CSS;
			for (const col of dateCols) {
				const opt = colSelect.createEl("option");
				opt.value = col;
				opt.textContent = col;
				if (this.timeBucket.column === col) opt.selected = true;
			}
			colSelect.addEventListener("change", () => {
				if (this.timeBucket) this.timeBucket.column = colSelect.value;
			});

			row.createSpan({ text: "by", cls: "ft-text-muted ft-text-sm" });

			const periodSelect = row.createEl("select");
			periodSelect.style.cssText = SELECT_CSS;
			for (const p of TIME_PERIODS) {
				const opt = periodSelect.createEl("option");
				opt.value = p;
				opt.textContent = p;
				if (this.timeBucket.period === p) opt.selected = true;
			}
			periodSelect.addEventListener("change", () => {
				if (this.timeBucket) this.timeBucket.period = periodSelect.value as TimeBucketPeriod;
			});
		} else {
			row.createSpan({ text: "Enable time bucketing", cls: "ft-text-muted ft-text-sm" });
		}
	}

	// ─────────────────────────────────────────────────────────
	// Query execution
	// ─────────────────────────────────────────────────────────

	private async executeQuery(): Promise<void> {
		this.running = true;
		this.lastError = null;
		this.lastResult = null;
		this.lastDurationMs = undefined;
		this.renderDetail();

		const start = Date.now();
		try {
			const sources: AnalyticsSource[] = this.sources
				.filter((s) => s.data)
				.map((s) => ({
					alias: s.alias,
					data: s.data!,
					locale: s.locale !== "auto" ? s.locale : undefined,
				}));

			const query: AnalyticsQuery = {
				sources,
				joins: this.joins,
				columnTypeHints: this.columnTypeHints,
				dimensions: this.dimensions,
				measures: this.measures,
				timeBucket: this.timeBucket ?? undefined,
			};

			this.lastResult = await this.deps.analyticsService.runQuery(query);
			this.lastDurationMs = Date.now() - start;
		} catch (err) {
			this.lastError = err instanceof Error ? err.message : String(err);
		} finally {
			this.running = false;
			this.renderDetail();
		}
	}

	private handleExportCsv(csv: string): void {
		void navigator.clipboard.writeText(csv);
	}

	// ─────────────────────────────────────────────────────────
	// Saved queries
	// ─────────────────────────────────────────────────────────

	private async saveCurrentQuery(): Promise<void> {
		const svc = this.deps.analyticsService;
		const name = `Query ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
		const sources: SavedAnalyticsQuerySource[] = this.sources.map((s) => ({
			alias: s.alias,
			csvPath: s.csvPath,
			sourceType: s.sourceType !== "csv" ? s.sourceType : undefined,
			viewIndex: s.viewIndex,
			locale: s.locale !== "auto" ? s.locale : undefined,
		}));

		await svc.saveQuery(name, sources, {
			joins: this.joins,
			columnTypeHints: this.columnTypeHints,
			dimensions: this.dimensions,
			measures: this.measures,
			timeBucket: this.timeBucket ?? undefined,
		});

		this.renderMaster();
	}

	private loadSavedQuery(queryId: string): void {
		const svc = this.deps.analyticsService;
		const saved = svc.getQuery(queryId);
		if (!saved) return;

		// Reset current state and populate from saved query
		this.sources = [];
		this.columnTypeHints = [...saved.columnTypeHints];
		this.joins = [...saved.joins];
		this.dimensions = [...saved.dimensions];
		this.measures = [...saved.measures];
		this.timeBucket = saved.timeBucket ? { ...saved.timeBucket } : null;
		this.lastResult = null;
		this.lastDurationMs = undefined;
		this.lastError = null;

		// Add sources and load their data
		for (const src of saved.sources) {
			const source: QuerySource = {
				csvPath: src.csvPath,
				alias: src.alias,
				locale: src.locale ?? "auto",
				sourceType: src.sourceType ?? "csv",
				viewIndex: src.viewIndex,
				data: null,
				loading: true,
			};
			this.sources.push(source);
			void this.loadSourceData(source);
		}

		this.renderMaster();
		this.renderDetail();
	}

	/** Delete a saved query by ID. */
	private async deleteSavedQuery(queryId: string): Promise<void> {
		const svc = this.deps.analyticsService;
		await svc.deleteQuery(queryId);
		if (this.deps.getState().selectedQueryId === queryId) {
			this.deps.setState({ selectedQueryId: null });
		}
		this.renderMaster();
	}
}
