/**
 * Queries tab orchestrator for the Analytics Hub.
 *
 * Thin orchestrator that owns query builder state and delegates to:
 *   - SourceManager: source CRUD, resolution, type detection (C43)
 *   - QueryExecutionManager: execution pipeline, result state (C44)
 *   - QueryPersistenceManager: save/load, dirty tracking, new query (C44)
 *   - SavedQueryList: saved query master list with CRUD
 *   - SourcePanel: source config, preview
 *   - QueryBuilderPanel: type hints, joins, dims, measures, filters, sort
 *   - ComputedColumnsSection: computed column add/remove/edit
 *   - ResultsSection: error display + results panel
 *
 * Extracted from monolithic QueriesTab (1,264 LOC) per TD-ANA-001.
 * Further decomposed in Cycle 44 (PBI-ANA-140).
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
	AnalyticsSourceType,
	QuerySource,
} from "../../domain/analytics/types";
import { SourceManager } from "../../domain/analytics/SourceManager";
import type { QueriesSubDeps } from "./queries/types";
import { SavedQueryList } from "./queries/SavedQueryList";
import { SourcePanel } from "./queries/SourcePanel";
import { QueryBuilderPanel } from "./queries/QueryBuilderPanel";
import { ComputedColumnsSection } from "./queries/ComputedColumnsSection";
import { ResultsSection } from "./queries/ResultsSection";
import { ActionsBar } from "./queries/ActionsBar";
import { QueryExecutionManager } from "./queries/QueryExecutionManager";
import { QueryPersistenceManager } from "./queries/QueryPersistenceManager";
import { rowsToCsv, downloadCsvFile } from "../../utils/csvUtils";
import { generateQuickInsights } from "../../domain/analytics/quickInsights";

export class QueriesTab {
	private sourceManager: SourceManager;
	private executionManager: QueryExecutionManager;
	private persistenceManager: QueryPersistenceManager;

	// ── Query builder state (owned by orchestrator) ──
	private columnTypeHints: ColumnTypeHint[] = [];
	private joins: JoinSpec[] = [];
	private dimensions: DimensionSpec[] = [];
	private measures: MeasureSpec[] = [];
	private timeBucket: TimeBucketSpec | null = null;
	private filters: FilterSpec[] = [];
	private sort: SortSpec[] = [];
	private limit: number | null = null;
	private computedColumns: ComputedColumn[] = [];
	private excludedColumns: string[] = [];

	// ── Render batching (PBI-ANA-121) ──
	private dirtyMaster = false;
	private dirtyDetail = false;
	private renderFrameId: number | null = null;
	private previewVisible = false;
	private chartMode: "line" | "bar" = "line";
	private chartValueColumn: string | null = null;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: AnalyticsHubDeps,
	) {
		const svc = deps.analyticsService;

		this.sourceManager = new SourceManager({
			loadCsv: (path) => svc.loadCsv(path),
			loadBase: (path, viewIndex) => svc.loadBase(path, viewIndex),
			loadCsvFolder: (path) => svc.loadCsvFolder(path),
			onSourcesChanged: () => {
				this.scheduleRender(true, true);
			},
			onSourceRemoved: () => {
				this.refreshAfterSourceChange();
				this.scheduleRender(true, true);
			},
			onTypeHintsDetected: (newHints) => {
				const existingSet = new Set(this.columnTypeHints.map((h) => h.column));
				for (const hint of newHints) {
					if (!existingSet.has(hint.column)) {
						this.columnTypeHints.push(hint);
					}
				}
			},
			onAllSourcesLoaded: () => {
				if (this.measures.length > 0) {
					void this.executionManager.execute();
				} else {
					this.scheduleRender(true, true);
				}
			},
		});

		this.executionManager = new QueryExecutionManager({
			getSources: () => this.sources,
			getQueryConfig: () => this.buildQueryConfig(),
			runQuery: (q) => svc.runQuery(q),
			onStateChanged: () => this.renderDetail(),
		});

		this.persistenceManager = new QueryPersistenceManager({
			sourceManager: this.sourceManager,
			getQueryConfig: () => this.buildQueryConfig(),
			setQueryState: (state) => {
				this.columnTypeHints = state.columnTypeHints;
				this.joins = state.joins;
				this.dimensions = state.dimensions;
				this.measures = state.measures;
				this.timeBucket = state.timeBucket;
				this.filters = state.filters;
				this.sort = state.sort;
				this.limit = state.limit;
				this.computedColumns = state.computedColumns;
				this.excludedColumns = state.excludedColumns;
				this.executionManager.reset();
			},
			getSelectedQueryId: () => this.deps.getState().selectedQueryId,
			setSelectedQueryId: (id) => this.deps.setState({ selectedQueryId: id }),
			scheduleRender: (m, d) => this.scheduleRender(m, d),
			saveQuery: (name, sources, config) => svc.saveQuery(name, sources, config),
			updateQuery: (id, sources, config) => svc.updateQuery(id, sources, config),
			getQuery: (id) => svc.getQuery(id),
			syncMeasurementsFromQuery: (id) => svc.syncMeasurementsFromQuery(id),
		});
	}

	/** Convenience accessor — delegates to SourceManager. */
	private get sources(): QuerySource[] {
		return this.sourceManager.getSources();
	}

	// ─────────────────────────────────────────────────────────
	// Query config builder (shared by execution + persistence)
	// ─────────────────────────────────────────────────────────

	private buildQueryConfig(): Omit<AnalyticsQuery, "sources"> {
		return {
			joins: this.joins,
			columnTypeHints: this.columnTypeHints,
			dimensions: this.dimensions,
			measures: this.measures,
			timeBucket: this.timeBucket ?? undefined,
			filters: this.filters.length > 0 ? this.filters : undefined,
			sort: this.sort.length > 0 ? this.sort : undefined,
			limit: this.limit ?? undefined,
			computedColumns: this.computedColumns.length > 0 ? this.computedColumns : undefined,
			excludedColumns: this.excludedColumns.length > 0 ? this.excludedColumns : undefined,
		};
	}

	// ─────────────────────────────────────────────────────────
	// Render batching — max 1 render per animation frame
	// ─────────────────────────────────────────────────────────

	private scheduleRender(master: boolean, detail: boolean): void {
		if (master) this.dirtyMaster = true;
		if (detail) this.dirtyDetail = true;
		if (this.renderFrameId !== null) return;
		this.renderFrameId = requestAnimationFrame(() => {
			this.renderFrameId = null;
			const m = this.dirtyMaster;
			const d = this.dirtyDetail;
			this.dirtyMaster = false;
			this.dirtyDetail = false;
			if (m) this.renderMaster();
			if (d) this.renderDetail();
		});
	}

	// ─────────────────────────────────────────────────────────
	// Sub-component deps
	// ─────────────────────────────────────────────────────────

	private getSubDeps(): QueriesSubDeps {
		return {
			hubDeps: this.deps,
			getLoadedHeaders: () => this.sourceManager.getLoadedHeaders(),
			renderDetail: () => this.scheduleRender(false, true),
			renderMaster: () => this.scheduleRender(true, false),
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
			excludedColumns: () => this.excludedColumns,
			setExcludedColumns: (c) => { this.excludedColumns = c; },
			lastResult: () => this.executionManager.result,
			lastDurationMs: () => this.executionManager.durationMs,
			lastError: () => this.executionManager.error,
			running: () => this.executionManager.running,
			executeQuery: () => { void this.executionManager.execute(); },
			handleExportCsv: (csv) => downloadCsvFile(csv, this.getActiveQueryName()),
			applyQuickInsight: (dims, measures, timeBucket, sort, limit) => {
				this.dimensions = dims;
				this.measures = measures;
				this.timeBucket = timeBucket;
				if (sort) this.sort = sort;
				if (limit !== undefined) this.limit = limit;
				void this.executionManager.execute();
			},
			loadSavedQuery: (id) => this.persistenceManager.load(id),
			newQuery: () => {
				this.sourcesCollapsed = false;
				this.persistenceManager.newQuery();
			},
			showPreview: () => this.previewVisible,
			togglePreview: () => { this.previewVisible = !this.previewVisible; },
			chartMode: () => this.chartMode,
			setChartMode: (mode) => { this.chartMode = mode; },
			chartValueColumn: () => this.chartValueColumn,
			setChartValueColumn: (col) => { this.chartValueColumn = col; },
			getDistinctValues: (column) => this.sourceManager.getDistinctValues(column),
		};
	}

	// ─────────────────────────────────────────────────────────
	// Master: Source picker + saved queries
	// ─────────────────────────────────────────────────────────

	private sourcesCollapsed = false;
	private sourcesAutoCollapsed = false;
	private querySortKey: "name" | "sources" | "lastRun" = "name";

	renderMaster(): void {
		this.masterEl.empty();
		const state = this.deps.getState();
		const svc = this.deps.analyticsService;
		const hasSavedQueries = svc.listQueries().length > 0;

		// Consume pending entity ID from cross-tab navigation
		if (state.pendingEntityId) {
			this.deps.setState({ selectedQueryId: state.pendingEntityId, pendingEntityId: null });
		}

		// ── Saved queries first (above sources) ──
		new SavedQueryList(this.masterEl, this.getSubDeps(), {
			sortKey: this.querySortKey,
			onSortChange: (key) => { this.querySortKey = key; },
		}).render();

		// ── Related queries (when source is active) ──
		if (this.sources.length > 0) {
			this.renderRelatedQueries();
		}

		// ── Selected sources ──
		if (this.sources.length > 0) {
			const selHeader = this.masterEl.createDiv({ cls: "ft-master-category-header" });
			selHeader.createSpan({ text: "Query Sources" });
			selHeader.createSpan({ text: `${this.sources.length}`, cls: "ft-master-category-count" });

			for (const src of this.sources) {
				const item = this.masterEl.createDiv({ cls: "ft-master-event-item" });
				item.style.cssText = "align-items:flex-start;padding-left:0.5rem;border-left:2px solid var(--interactive-accent)";

				const textBlock = item.createDiv({ cls: "ft-master-event-name" });
				textBlock.style.minWidth = "0";
				textBlock.createDiv({ text: src.alias });
				const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-xs" });
				sub.addClass("ft-text-ellipsis");
				sub.textContent = src.csvPath.split("/").pop() ?? src.csvPath;

				if (src.loading) {
					item.createSpan({ text: "...", cls: "ft-text-muted ft-text-xs" });
				} else if (src.error) {
					const errBadge = item.createSpan({ text: "Error", cls: "ft-text-xs" });
					errBadge.style.color = "var(--text-error)";
				}

				const removeBtn = item.createEl("span", { cls: "ft-nav-link ft-text-sm" });
				const removeIcon = removeBtn.createSpan();
				setIcon(removeIcon, "x");
				removeBtn.setAttribute("aria-label", "Remove source");
				removeBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					this.sourceManager.removeSource(src.csvPath);
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
		const allFolders = (state.csvFolders ?? []).filter((f) =>
			!addedPaths.has(f.path) && (!state.filterText ||
				f.displayName.toLowerCase().includes(state.filterText) ||
				f.path.toLowerCase().includes(state.filterText)),
		);

		sourcesHeader.createSpan({
			text: `${availableCsv.length + availableBase.length + allFolders.length}`,
			cls: "ft-master-category-count",
		});

		sourcesHeader.addEventListener("click", () => {
			this.sourcesCollapsed = !this.sourcesCollapsed;
			this.scheduleRender(true, false);
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
						this.sourceManager.addSource(csv.path, csv.displayName.replace(/\.csv$/i, ""));
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
						this.sourceManager.addSource(base.path, base.displayName.replace(/\.base$/i, ""), "base", 0);
					});
				}
			} else if (state.filterText) {
				const empty = this.masterEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
				empty.textContent = "No matching .base files";
			}

			// CSV Folders
			let csvFolders = state.csvFolders ?? [];
			if (state.filterText) {
				csvFolders = csvFolders.filter((f) =>
					f.displayName.toLowerCase().includes(state.filterText) ||
					f.path.toLowerCase().includes(state.filterText),
				);
			}
			const availableFolders = csvFolders.filter((f) => !addedPaths.has(f.path));
			if (availableFolders.length > 0) {
				const folderSubHeader = this.masterEl.createDiv({ cls: "ft-master-category-header ft-text-xs" });
				folderSubHeader.createSpan({ text: "CSV Folders" });
				folderSubHeader.createSpan({ text: `${availableFolders.length}`, cls: "ft-master-category-count" });

				for (const folder of availableFolders) {
					this.renderSourceItem(`${folder.displayName} (${folder.fileCount} files)`, folder.path, () => {
						this.sourceManager.addSource(folder.path, folder.displayName, "csv-folder");
					});
				}
			}
		}
	}

	private renderSourceItem(displayName: string, path: string, onClick: () => void): void {
		const item = this.masterEl.createDiv({ cls: "ft-master-event-item" });
		item.style.cssText = "align-items:flex-start;padding-left:0.5rem";

		const textBlock = item.createDiv({ cls: "ft-master-event-name" });
		textBlock.style.minWidth = "0";
		textBlock.createDiv({ text: displayName });
		const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-xs" });
		sub.addClass("ft-text-ellipsis");
		sub.textContent = path;

		item.addEventListener("click", onClick);
	}

	private renderRelatedQueries(): void {
		const sourcePaths = this.sources.map((s) => s.csvPath);
		const svc = this.deps.analyticsService;
		const state = this.deps.getState();

		// Find saved queries that share at least one source with the current query
		const relatedQueries = svc.listQueries().filter((q) => {
			if (q.id === state.selectedQueryId) return false;
			return q.sources.some((s) => sourcePaths.includes(s.csvPath));
		});

		if (relatedQueries.length === 0) return;

		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Related Queries" });
		header.createSpan({ text: `${relatedQueries.length}`, cls: "ft-master-category-count" });

		for (const q of relatedQueries) {
			const item = this.masterEl.createDiv({ cls: "ft-master-event-item" });
			item.style.paddingLeft = "0.5rem";
			const nameEl = item.createDiv({ cls: "ft-master-event-name" });
			nameEl.createDiv({ text: q.name });
			const sub = nameEl.createDiv({ cls: "ft-text-muted ft-text-xs" });
			const sharedSources = q.sources.filter((s) => sourcePaths.includes(s.csvPath));
			sub.textContent = sharedSources.map((s) => s.csvPath.split("/").pop()).join(", ");

			item.addEventListener("click", () => {
				this.persistenceManager.load(q.id);
				this.deps.setState({ selectedQueryId: q.id });
			});
		}
	}

	// ─────────────────────────────────────────────────────────
	// Detail: delegates to sub-components
	// ─────────────────────────────────────────────────────────

	renderDetail(): void {
		// Consume pendingNewQuery from NewQueryModal (name + sources)
		const pendingNew = this.deps.getState().pendingNewQuery;
		if (pendingNew) {
			this.deps.setState({ pendingNewQuery: undefined });
			this.persistenceManager.newQuery();
			this.persistenceManager.queryName = pendingNew.name;
			for (const src of pendingNew.sources) {
				this.sourceManager.addSource(src.path, src.alias, src.sourceType as AnalyticsSourceType, src.viewIndex);
			}
			return; // addSource triggers re-render
		}

		// Auto-add source when navigated from CSV context (file-menu, CsvLanding)
		const pendingSource = this.deps.getState().pendingSourcePath;
		if (pendingSource) {
			this.deps.setState({ pendingSourcePath: null });
			const alreadyAdded = this.sources.some((s) => s.csvPath === pendingSource);
			if (!alreadyAdded) {
				const basename = pendingSource.split("/").pop() ?? pendingSource;
				const alias = basename.replace(/\.(csv|base)$/i, "");
				const sourceType = pendingSource.endsWith(".base") ? "base" as const : "csv" as const;
				this.sourceManager.addSource(pendingSource, alias, sourceType);
				return; // addSource triggers re-render
			}
		}

		// Auto-load saved query when selectedQueryId changed (e.g. navigated from homepage)
		const pendingId = this.deps.getState().selectedQueryId;
		if (pendingId && pendingId !== this.persistenceManager.lastLoadedQueryId) {
			this.persistenceManager.lastLoadedQueryId = pendingId;
			this.persistenceManager.load(pendingId);
			return; // load triggers re-render
		}

		// Preserve scroll position across re-renders
		const scrollParent = this.detailEl.parentElement;
		const scrollTop = scrollParent?.scrollTop ?? 0;

		this.detailEl.empty();

		// Ctrl+Enter runs query from anywhere in the detail panel
		this.detailEl.addEventListener("keydown", (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !this.executionManager.running && this.measures.length > 0) {
				e.preventDefault();
				void this.executionManager.execute();
			}
		});

		if (this.sources.length === 0) {
			this.renderEmptyDetail();
			return;
		}

		// ── Header ──────────────────────────────────────
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.style.cssText = "flex:1;min-width:0";
		const state = this.deps.getState();
		const activeQuery = state.selectedQueryId ? this.deps.analyticsService.getQuery(state.selectedQueryId) : null;
		left.createDiv({ text: activeQuery ? activeQuery.name : "Query Builder", cls: "ft-detail-event-type" });
		if (activeQuery) {
			const descInput = left.createEl("input", { type: "text" });
			descInput.value = activeQuery.description ?? "";
			descInput.placeholder = "What question does this query answer?";
			descInput.style.cssText = "width:100%;border:none;background:transparent;color:var(--text-muted);font-size:var(--font-ui-small);padding:0.15rem 0";
			descInput.addEventListener("blur", () => {
				const val = descInput.value.trim();
				if (val !== (activeQuery.description ?? "")) {
					void this.deps.analyticsService.updateQueryDescription(activeQuery.id, val || undefined);
				}
			});
			descInput.addEventListener("keydown", (e) => {
				if (e.key === "Enter") { e.preventDefault(); descInput.blur(); }
			});
		}
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
		const isEditing = !!(state.selectedQueryId && this.deps.analyticsService.getQuery(state.selectedQueryId));
		new ActionsBar({
			container: this.detailEl,
			running: this.executionManager.running,
			hasMeasures: this.measures.length > 0,
			hasLoadedSources: this.sourceManager.hasLoadedData,
			lastResult: this.executionManager.result,
			isEditing,
			hasChanges: this.persistenceManager.isDirty(this.measures.length > 0),
			selectedQueryId: state.selectedQueryId,
			queryName: this.getActiveQueryName(),
			onRunQuery: () => { void this.executionManager.execute(); },
			onReset: () => {
				this.persistenceManager.newQuery();
				this.executionManager.reset();
				this.sourcesCollapsed = false;
				this.scheduleRender(true, true);
			},
			onSave: () => {
				if (isEditing) {
					void this.persistenceManager.update();
				} else {
					void this.persistenceManager.save();
				}
			},
			onExportCsv: (result) => downloadCsvFile(rowsToCsv(result.columns, result.rows), this.getActiveQueryName()),
			onRenderDetail: () => this.scheduleRender(false, true),
		}).render();

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
		configIcon.style.cssText = "opacity:0.6;display:inline-flex;align-items:center";
		configIcon.querySelectorAll("svg").forEach((s) => { s.style.width = "14px"; s.style.height = "14px"; });
		configHeader.createSpan({ text: "Query Configuration", cls: "ft-text-sm" }).style.fontWeight = "600";

		new SourcePanel(this.detailEl, subDeps).render();

		// Quick Insights — own section when sources are loaded
		if (this.sourceManager.hasLoadedData) {
			this.renderQuickInsightsSection(subDeps);
		}

		if (this.sourceManager.getLoadedHeaders().length > 0) {
			new QueryBuilderPanel(this.detailEl, subDeps).render();
			new ComputedColumnsSection(this.detailEl, subDeps).render();
		}

		// ── Cross-references ─────────────────────────────
		if (isEditing && state.selectedQueryId) {
			this.renderCrossReferences(state.selectedQueryId);
		}

		// Restore scroll position
		if (scrollParent) {
			requestAnimationFrame(() => { scrollParent.scrollTop = scrollTop; });
		}
	}

	private renderExecutionSummary(): void {
		if (this.executionManager.running) {
			const callout = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
			callout.style.cssText = "padding:0.5rem 0.75rem;border-left:3px solid var(--interactive-accent);background:var(--background-secondary)";
			callout.createDiv({ text: "Running query...", cls: "ft-text-sm ft-text-muted" });
			return;
		}

		if (this.executionManager.error) {
			const callout = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
			callout.style.cssText = "padding:0.5rem 0.75rem;border-left:3px solid var(--text-error);background:var(--background-secondary)";
			const row = callout.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			const icon = row.createSpan();
			setIcon(icon, "alert-triangle");
			icon.style.cssText = "width:16px;height:16px;color:var(--text-error);flex-shrink:0";
			row.createSpan({ text: "Query failed", cls: "ft-text-sm" }).style.fontWeight = "600";
			return;
		}

		const result = this.executionManager.result;
		if (!result) return;

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
		if (this.executionManager.durationMs !== undefined) stats.push(`${this.executionManager.durationMs}ms`);

		row.createSpan({ text: stats.join("  ·  "), cls: "ft-text-sm" });
	}

	private renderQuickInsightsSection(subDeps: QueriesSubDeps): void {
		const insights = generateQuickInsights(this.columnTypeHints, this.sourceManager.getLoadedHeaders());
		if (insights.length === 0) return;

		const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.style.cssText = "margin:0;padding-bottom:0.35rem;margin-bottom:0.5rem";
		header.createSpan({ text: "Quick Insights", cls: "ft-text-sm" }).style.fontWeight = "600";

		const grid = section.createDiv();
		grid.style.display = "grid";
		grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(180px, 1fr))";
		grid.style.gap = "0.5rem";

		for (const insight of insights) {
			const card = grid.createDiv({ cls: "ft-stat-card" });
			card.style.cursor = "pointer";
			card.style.padding = "0.5rem 0.75rem";

			const title = card.createDiv({ cls: "ft-text-sm" });
			title.style.fontWeight = "500";
			title.textContent = insight.title;

			card.createDiv({ text: insight.description, cls: "ft-text-xs ft-text-muted" });

			card.addEventListener("click", () => {
				subDeps.applyQuickInsight(
					[...insight.dimensions],
					[...insight.measures],
					insight.timeBucket ? { ...insight.timeBucket } : null,
					insight.sort ? insight.sort.map((s) => ({ ...s })) : undefined,
					insight.limit,
				);
			});
		}
	}

	private renderCrossReferences(queryId: string): void {
		const state = this.deps.getState();

		// Measurements using this query
		const relatedMeasurements = (state.measurements ?? []).filter((m) => m.queryId === queryId);

		// Dashboards with tiles using this query
		const relatedDashboards: Array<{ id: string; name: string; tileCount: number }> = [];
		for (const dash of state.dashboards) {
			const tileCount = dash.tiles.filter((t) => t.queryId === queryId).length;
			if (tileCount > 0) {
				relatedDashboards.push({ id: dash.id, name: dash.name, tileCount });
			}
		}

		if (relatedMeasurements.length === 0 && relatedDashboards.length === 0) return;

		const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.style.cssText = "border-bottom:1px solid var(--background-modifier-border);padding-bottom:0.35rem;margin-bottom:0.5rem";
		const iconEl = header.createSpan();
		setIcon(iconEl, "link");
		iconEl.style.cssText = "width:14px;height:14px;opacity:0.6";
		header.createSpan({ text: "Cross-References", cls: "ft-text-sm" }).style.fontWeight = "600";

		// Measurements
		if (relatedMeasurements.length > 0) {
			const mHeader = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			mHeader.style.marginBottom = "0.25rem";
			const mIcon = mHeader.createSpan();
			setIcon(mIcon, "ruler");
			mIcon.style.cssText = "width:12px;height:12px;opacity:0.5";
			mHeader.createSpan({ text: "Measurements", cls: "ft-text-xs ft-text-muted" });
			mHeader.createSpan({ text: `${relatedMeasurements.length}`, cls: "ft-badge ft-badge-muted" });

			for (const m of relatedMeasurements) {
				const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
				row.style.padding = "0.15rem 0 0.15rem 1.5rem";
				const link = row.createEl("span", { text: m.name, cls: "ft-nav-link ft-text-xs" });
				row.createSpan({ text: m.type, cls: "ft-tag" }).style.fontSize = "10px";
				link.addEventListener("click", () => {
					this.deps.navigation.navigateToTab("measurements", m.id);
				});
			}
		}

		// Dashboards
		if (relatedDashboards.length > 0) {
			const dHeader = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			dHeader.style.cssText = `margin-bottom:0.25rem;${relatedMeasurements.length > 0 ? "margin-top:0.5rem" : ""}`;
			const dIcon = dHeader.createSpan();
			setIcon(dIcon, "layout-dashboard");
			dIcon.style.cssText = "width:12px;height:12px;opacity:0.5";
			dHeader.createSpan({ text: "Dashboards", cls: "ft-text-xs ft-text-muted" });
			dHeader.createSpan({ text: `${relatedDashboards.length}`, cls: "ft-badge ft-badge-muted" });

			for (const d of relatedDashboards) {
				const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
				row.style.padding = "0.15rem 0 0.15rem 1.5rem";
				const link = row.createEl("span", { text: d.name, cls: "ft-nav-link ft-text-xs" });
				row.createSpan({ text: `${d.tileCount} tile${d.tileCount > 1 ? "s" : ""}`, cls: "ft-text-xs ft-text-muted" });
				link.addEventListener("click", () => {
					this.deps.navigation.navigateToTab("dashboards", d.id);
				});
			}
		}
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
	// Source cleanup (called by SourceManager on source removal)
	// ─────────────────────────────────────────────────────────

	private refreshAfterSourceChange(): void {
		const headerSet = new Set(this.sourceManager.getLoadedHeaders());
		this.columnTypeHints = this.columnTypeHints.filter((h) => headerSet.has(h.column));
		this.dimensions = this.dimensions.filter((d) => headerSet.has(d.column));
		this.measures = this.measures.filter((m) => headerSet.has(m.column));
		this.filters = this.filters.filter((f) => headerSet.has(f.column));
		if (this.timeBucket && !headerSet.has(this.timeBucket.column)) {
			this.timeBucket = null;
		}
		this.sort = this.sort.filter((s) => headerSet.has(s.column));
		const aliases = this.sourceManager.getRemainingAliases();
		this.joins = this.joins.filter((j) => aliases.has(j.leftSource) && aliases.has(j.rightSource));
	}

	private getActiveQueryName(): string {
		const id = this.deps.getState().selectedQueryId;
		if (id) {
			const q = this.deps.analyticsService.getQuery(id);
			if (q) return q.name;
		}
		return "query";
	}
}
