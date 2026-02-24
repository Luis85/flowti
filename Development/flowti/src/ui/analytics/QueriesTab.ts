/**
 * Queries tab orchestrator for the Analytics Hub.
 *
 * Thin orchestrator that owns query builder state and delegates
 * rendering to focused sub-components:
 *   - SavedQueryList: saved query master list with CRUD
 *   - SourcePanel: source config, preview, Quick Insights
 *   - QueryBuilderPanel: type hints, joins, dims, measures, filters, sort
 *   - ComputedColumnsSection: computed column add/remove/edit
 *   - ResultsSection: error display + results panel
 *
 * Extracted from monolithic QueriesTab (1,264 LOC) per TD-ANA-001.
 */

import { setIcon } from "obsidian";
import type { AnalyticsHubDeps } from "./types";
import type {
	ColumnTypeHint,
	ComputedColumn,
	FilterSpec,
	SortSpec,
	JoinSpec,
	DimensionSpec,
	MeasureSpec,
	TimeBucketSpec,
	AnalyticsQuery,
	AnalyticsSource,
	AnalyticsSourceType,
	AnalyticsResult,
	SavedAnalyticsQuerySource,
} from "../../domain/analytics/types";
import { AnalyticsEngine } from "../../domain/analytics/AnalyticsEngine";
import type { QuerySource, QueriesSubDeps } from "./queries/types";
import { SavedQueryList } from "./queries/SavedQueryList";
import { SourcePanel } from "./queries/SourcePanel";
import { QueryBuilderPanel } from "./queries/QueryBuilderPanel";
import { ComputedColumnsSection } from "./queries/ComputedColumnsSection";
import { ResultsSection } from "./queries/ResultsSection";

export class QueriesTab {
	private sources: QuerySource[] = [];
	private columnTypeHints: ColumnTypeHint[] = [];
	private joins: JoinSpec[] = [];
	private dimensions: DimensionSpec[] = [];
	private measures: MeasureSpec[] = [];
	private timeBucket: TimeBucketSpec | null = null;
	private filters: FilterSpec[] = [];
	private sort: SortSpec | null = null;
	private limit: number | null = null;
	private computedColumns: ComputedColumn[] = [];
	private lastResult: AnalyticsResult | null = null;
	private lastDurationMs: number | undefined;
	private lastError: string | null = null;
	private running = false;
	private previewVisible = false;
	private chartMode: "line" | "bar" = "line";
	private chartValueColumn: string | null = null;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: AnalyticsHubDeps,
	) {}

	// ─────────────────────────────────────────────────────────
	// Sub-component deps
	// ─────────────────────────────────────────────────────────

	private getSubDeps(): QueriesSubDeps {
		return {
			hubDeps: this.deps,
			getLoadedHeaders: () => this.getLoadedHeaders(),
			renderDetail: () => this.renderDetail(),
			renderMaster: () => this.renderMaster(),
			sources: () => this.sources,
			columnTypeHints: () => this.columnTypeHints,
			setColumnTypeHints: (h) => { this.columnTypeHints = h; },
			joins: () => this.joins,
			setJoins: (j) => { this.joins = j; },
			dimensions: () => this.dimensions,
			setDimensions: (d) => { this.dimensions = d; },
			measures: () => this.measures,
			setMeasures: (m) => { this.measures = m; },
			timeBucket: () => this.timeBucket,
			setTimeBucket: (tb) => { this.timeBucket = tb; },
			filters: () => this.filters,
			setFilters: (f) => { this.filters = f; },
			sort: () => this.sort,
			setSort: (s) => { this.sort = s; },
			limit: () => this.limit,
			setLimit: (l) => { this.limit = l; },
			computedColumns: () => this.computedColumns,
			setComputedColumns: (c) => { this.computedColumns = c; },
			lastResult: () => this.lastResult,
			lastDurationMs: () => this.lastDurationMs,
			lastError: () => this.lastError,
			running: () => this.running,
			executeQuery: () => { void this.executeQuery(); },
			handleExportCsv: (csv) => this.handleExportCsv(csv),
			applyQuickInsight: (dims, measures, timeBucket) => {
				this.dimensions = dims;
				this.measures = measures;
				this.timeBucket = timeBucket;
				this.renderDetail();
				void this.executeQuery();
			},
			loadSavedQuery: (id) => this.loadSavedQuery(id),
			newQuery: () => this.newQuery(),
			showPreview: () => this.previewVisible,
		chartMode: () => this.chartMode,
		setChartMode: (mode) => { this.chartMode = mode; },
		chartValueColumn: () => this.chartValueColumn,
		setChartValueColumn: (col) => { this.chartValueColumn = col; },
		};
	}

	// ─────────────────────────────────────────────────────────
	// Master: Source picker + saved queries
	// ─────────────────────────────────────────────────────────

	private sourcesCollapsed = false;
	private sourcesAutoCollapsed = false;

	renderMaster(): void {
		this.masterEl.empty();
		const state = this.deps.getState();
		const svc = this.deps.analyticsService;
		const hasSavedQueries = svc.listQueries().length > 0;

		// ── Saved queries first (above sources) ──
		new SavedQueryList(this.masterEl, this.getSubDeps()).render();

		// ── Selected sources ──
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

		// ── Available sources (collapsible when saved queries exist) ──
		const addedPaths = new Set(this.sources.map((s) => s.csvPath));

		// Auto-collapse once when saved queries exist and no sources loaded
		if (!this.sourcesAutoCollapsed && hasSavedQueries && this.sources.length === 0) {
			this.sourcesCollapsed = true;
			this.sourcesAutoCollapsed = true;
		}

		const sourcesHeader = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		sourcesHeader.style.cursor = "pointer";

		const toggleIcon = sourcesHeader.createSpan();
		setIcon(toggleIcon, this.sourcesCollapsed ? "chevron-right" : "chevron-down");
		toggleIcon.style.width = "14px";
		toggleIcon.style.height = "14px";
		toggleIcon.style.flexShrink = "0";

		sourcesHeader.createSpan({ text: "Sources" });

		let csvFiles = state.csvFiles;
		let baseFiles = state.baseFiles;
		if (state.filterText) {
			csvFiles = csvFiles.filter((f) =>
				f.displayName.toLowerCase().includes(state.filterText) ||
				f.path.toLowerCase().includes(state.filterText),
			);
			baseFiles = baseFiles.filter((f) =>
				f.displayName.toLowerCase().includes(state.filterText) ||
				f.path.toLowerCase().includes(state.filterText),
			);
		}
		const availableCsv = csvFiles.filter((f) => !addedPaths.has(f.path));
		const availableBase = baseFiles.filter((f) => !addedPaths.has(f.path));

		sourcesHeader.createSpan({
			text: `${availableCsv.length + availableBase.length}`,
			cls: "ft-master-category-count",
		});

		sourcesHeader.addEventListener("click", () => {
			this.sourcesCollapsed = !this.sourcesCollapsed;
			this.renderMaster();
		});

		if (!this.sourcesCollapsed) {
			// CSV Sources
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

			// Base Views
			if (availableBase.length > 0) {
				const baseSubHeader = this.masterEl.createDiv({ cls: "ft-master-category-header ft-text-xs" });
				baseSubHeader.createSpan({ text: "Base Views" });
				baseSubHeader.createSpan({ text: `${availableBase.length}`, cls: "ft-master-category-count" });

				for (const base of availableBase) {
					this.renderSourceItem(base.displayName, base.path, () => {
						this.addSource(base.path, base.displayName.replace(/\.base$/i, ""), "base", 0);
					});
				}
			} else if (state.filterText) {
				const empty = this.masterEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
				empty.textContent = "No matching .base files";
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
	// Detail: delegates to sub-components
	// ─────────────────────────────────────────────────────────

	renderDetail(): void {
		// Preserve scroll position across re-renders
		const scrollParent = this.detailEl.parentElement;
		const scrollTop = scrollParent?.scrollTop ?? 0;

		this.detailEl.empty();

		if (this.sources.length === 0) {
			this.renderEmptyDetail();
			return;
		}

		// ── Header ──────────────────────────────────────
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		const state = this.deps.getState();
		const activeQuery = state.selectedQueryId ? this.deps.analyticsService.getQuery(state.selectedQueryId) : null;
		left.createDiv({ text: activeQuery ? activeQuery.name : "Query Builder", cls: "ft-detail-event-type" });
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

		// ── Actions (always visible at top) ─────────────
		this.renderActions();

		// ── Execution summary + results (above config) ──
		this.renderExecutionSummary();

		const subDeps = this.getSubDeps();
		new ResultsSection(this.detailEl, subDeps).render();

		// ── Configuration (below results) ───────────────
		const configHeader = this.detailEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mt-3" });
		configHeader.style.borderTop = "2px solid var(--background-modifier-border)";
		configHeader.style.paddingTop = "0.75rem";
		const configIcon = configHeader.createSpan();
		setIcon(configIcon, "settings-2");
		configIcon.style.width = "16px";
		configIcon.style.height = "16px";
		configIcon.style.opacity = "0.6";
		configHeader.createSpan({ text: "Query Configuration", cls: "ft-detail-section-header" });

		new SourcePanel(this.detailEl, subDeps).render();

		if (this.getLoadedHeaders().length > 0) {
			new QueryBuilderPanel(this.detailEl, subDeps).render();
			new ComputedColumnsSection(this.detailEl, subDeps).render();
		}

		// Restore scroll position
		if (scrollParent) {
			requestAnimationFrame(() => { scrollParent.scrollTop = scrollTop; });
		}
	}

	private renderExecutionSummary(): void {
		if (this.running) {
			const callout = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
			callout.style.cssText = "padding:0.5rem 0.75rem;border-left:3px solid var(--interactive-accent);background:var(--background-secondary)";
			callout.createDiv({ text: "Running query...", cls: "ft-text-sm ft-text-muted" });
			return;
		}

		if (this.lastError) {
			const callout = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
			callout.style.cssText = "padding:0.5rem 0.75rem;border-left:3px solid var(--text-error);background:var(--background-secondary)";
			const row = callout.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			const icon = row.createSpan();
			setIcon(icon, "alert-triangle");
			icon.style.cssText = "width:16px;height:16px;color:var(--text-error);flex-shrink:0";
			row.createSpan({ text: "Query failed", cls: "ft-text-sm" }).style.fontWeight = "600";
			return;
		}

		if (!this.lastResult) return;

		const result = this.lastResult;
		const callout = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
		callout.style.cssText = "padding:0.5rem 0.75rem;border-left:3px solid var(--text-success);background:var(--background-secondary)";

		const row = callout.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = row.createSpan();
		setIcon(icon, "check-circle");
		icon.style.cssText = "width:16px;height:16px;color:var(--text-success);flex-shrink:0";

		const stats: string[] = [
			`${result.rows.length} rows`,
			`${result.groupCount} groups`,
			`${result.sourceRowCount} source rows`,
		];
		if (this.lastDurationMs !== undefined) stats.push(`${this.lastDurationMs}ms`);

		row.createSpan({ text: stats.join("  ·  "), cls: "ft-text-sm" });
	}

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
	// Actions (Run / Reset / Save / Update)
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

		// Preview toggle — peek at source data
		const hasLoadedSources = this.sources.some((s) => s.data);
		if (hasLoadedSources) {
			const previewLink = actions.createEl("span", { cls: "ft-nav-link" });
			const previewIcon = previewLink.createSpan();
			setIcon(previewIcon, "eye");
			previewLink.appendText(this.previewVisible ? " Hide Preview" : " Preview Data");
			if (this.previewVisible) previewLink.style.color = "var(--text-accent)";
			previewLink.addEventListener("click", () => {
				this.previewVisible = !this.previewVisible;
				this.renderDetail();
			});
		}

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
			this.filters = [];
			this.sort = null;
			this.limit = null;
			this.computedColumns = [];
			this.lastResult = null;
			this.lastDurationMs = undefined;
			this.lastError = null;
			this.renderMaster();
			this.renderDetail();
		});

		// Save / Update Query
		if (this.measures.length > 0) {
			const state = this.deps.getState();
			const isEditing = state.selectedQueryId && this.deps.analyticsService.getQuery(state.selectedQueryId);

			if (isEditing) {
				const updateLink = actions.createEl("span", { cls: "ft-nav-link" });
				const updateIcon = updateLink.createSpan();
				setIcon(updateIcon, "save");
				updateLink.appendText(" Update Query");
				updateLink.addEventListener("click", () => {
					void this.updateCurrentQuery();
				});
			}

			const saveLink = actions.createEl("span", { cls: "ft-nav-link" });
			const saveIcon = saveLink.createSpan();
			setIcon(saveIcon, "plus");
			saveLink.appendText(isEditing ? " Save As New" : " Save Query");
			saveLink.addEventListener("click", () => {
				void this.saveCurrentQuery();
			});
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
			let data = null;
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
		const existingSet = new Set(this.columnTypeHints.map((h) => h.column));
		for (const hint of detected) {
			if (!existingSet.has(hint.column)) {
				this.columnTypeHints.push(hint);
			}
		}
	}

	private refreshAfterSourceChange(): void {
		const headerSet = new Set(this.getLoadedHeaders());
		this.columnTypeHints = this.columnTypeHints.filter((h) => headerSet.has(h.column));
		this.dimensions = this.dimensions.filter((d) => headerSet.has(d.column));
		this.measures = this.measures.filter((m) => headerSet.has(m.column));
		this.filters = this.filters.filter((f) => headerSet.has(f.column));
		if (this.timeBucket && !headerSet.has(this.timeBucket.column)) {
			this.timeBucket = null;
		}
		if (this.sort && !headerSet.has(this.sort.column)) {
			this.sort = null;
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
				filters: this.filters.length > 0 ? this.filters : undefined,
				sort: this.sort ?? undefined,
				limit: this.limit ?? undefined,
				computedColumns: this.computedColumns.length > 0 ? this.computedColumns : undefined,
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

	private buildQueryConfig(): Omit<AnalyticsQuery, "sources"> {
		return {
			joins: this.joins,
			columnTypeHints: this.columnTypeHints,
			dimensions: this.dimensions,
			measures: this.measures,
			timeBucket: this.timeBucket ?? undefined,
			filters: this.filters.length > 0 ? this.filters : undefined,
			sort: this.sort ?? undefined,
			limit: this.limit ?? undefined,
			computedColumns: this.computedColumns.length > 0 ? this.computedColumns : undefined,
		};
	}

	private buildSavedSources(): SavedAnalyticsQuerySource[] {
		return this.sources.map((s) => ({
			alias: s.alias,
			csvPath: s.csvPath,
			sourceType: s.sourceType !== "csv" ? s.sourceType : undefined,
			viewIndex: s.viewIndex,
			locale: s.locale !== "auto" ? s.locale : undefined,
		}));
	}

	private async saveCurrentQuery(): Promise<void> {
		const svc = this.deps.analyticsService;
		const name = `Query ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;

		const saved = await svc.saveQuery(name, this.buildSavedSources(), this.buildQueryConfig());
		this.deps.setState({ selectedQueryId: saved.id });
		this.renderMaster();
	}

	private async updateCurrentQuery(): Promise<void> {
		const state = this.deps.getState();
		if (!state.selectedQueryId) return;

		await this.deps.analyticsService.updateQuery(
			state.selectedQueryId,
			this.buildSavedSources(),
			this.buildQueryConfig(),
		);

		this.renderMaster();
	}

	private newQuery(): void {
		this.sources = [];
		this.columnTypeHints = [];
		this.joins = [];
		this.dimensions = [];
		this.measures = [];
		this.timeBucket = null;
		this.filters = [];
		this.sort = null;
		this.limit = null;
		this.computedColumns = [];
		this.lastResult = null;
		this.lastDurationMs = undefined;
		this.lastError = null;
		this.deps.setState({ selectedQueryId: null });
		this.sourcesCollapsed = false;
		this.renderMaster();
		this.renderDetail();
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
		this.filters = saved.filters ? saved.filters.map((f) => ({ ...f })) : [];
		this.sort = saved.sort ? { ...saved.sort } : null;
		this.limit = saved.limit ?? null;
		this.computedColumns = saved.computedColumns ? saved.computedColumns.map((c) => ({ ...c })) : [];
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
}
