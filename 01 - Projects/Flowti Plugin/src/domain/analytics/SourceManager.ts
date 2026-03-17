/**
 * Source Manager — owns source CRUD, resolution, and type detection
 * for the Analytics Hub query builder.
 *
 * Extracted from QueriesTab (PBI-ANA-120, Cycle 43) to separate
 * source management concerns from query orchestration.
 */

import type {
	ColumnTypeHint,
	AnalyticsSourceType,
	ParsedSourceData,
	SavedAnalyticsQuerySource,
	QuerySource,
} from "./types";
import { AnalyticsEngine } from "./AnalyticsEngine";
import { detectNumberLocale } from "./localeUtils";

export interface SourceManagerDeps {
	loadCsv(path: string): Promise<{ headers: string[]; rows: string[][] } | null>;
	loadBase(path: string, viewIndex: number): Promise<ParsedSourceData | null>;
	loadCsvFolder(path: string): Promise<ParsedSourceData | null>;
	/** Called when sources array or any source's data/loading state changes. */
	onSourcesChanged(): void;
	/** Called when a source is removed (orchestrator should clean orphaned specs). */
	onSourceRemoved(): void;
	/** Called with newly detected column type hints after a source loads. */
	onTypeHintsDetected(newHints: ColumnTypeHint[]): void;
	/** Called when all sources finish loading and pending-execute was requested. */
	onAllSourcesLoaded(): void;
}

export class SourceManager {
	private sources: QuerySource[] = [];
	private pendingExecute = false;

	constructor(private deps: SourceManagerDeps) {}

	// ── Accessors ────────────────────────────────────────────

	getSources(): QuerySource[] {
		return this.sources;
	}

	get hasSources(): boolean {
		return this.sources.length > 0;
	}

	get hasLoadedData(): boolean {
		return this.sources.some((s) => s.data);
	}

	get allLoaded(): boolean {
		return this.sources.every((s) => !s.loading);
	}

	// ── Source CRUD ───────────────────────────────────────────

	addSource(
		csvPath: string,
		defaultAlias: string,
		sourceType: AnalyticsSourceType = "csv",
		viewIndex?: number,
	): void {
		let alias = defaultAlias;
		const existing = new Set(this.sources.map((s) => s.alias));
		let counter = 2;
		while (existing.has(alias)) {
			alias = `${defaultAlias}_${counter++}`;
		}

		const source: QuerySource = {
			csvPath,
			alias,
			locale: "auto",
			sourceType,
			viewIndex,
			data: null,
			loading: true,
		};
		this.sources.push(source);
		this.deps.onSourcesChanged();
		void this.loadSourceData(source);
	}

	removeSource(csvPath: string): void {
		this.sources = this.sources.filter((s) => s.csvPath !== csvPath);
		this.deps.onSourceRemoved();
	}

	// ── Data loading ─────────────────────────────────────────

	private async loadSourceData(source: QuerySource): Promise<void> {
		try {
			let data: ParsedSourceData | null = null;
			if (source.sourceType === "base") {
				data = await this.deps.loadBase(source.csvPath, source.viewIndex ?? 0);
			} else if (source.sourceType === "csv-folder") {
				data = await this.deps.loadCsvFolder(source.csvPath);
			} else {
				const parsed = await this.deps.loadCsv(source.csvPath);
				if (parsed) data = { headers: parsed.headers, rows: parsed.rows };
			}

			source.loading = false;
			if (data) {
				source.data = data;
				this.detectTypeHints(source);
			}
		} catch (err) {
			source.loading = false;
			source.error = err instanceof Error ? err.message : String(err);
		}

		if (this.pendingExecute && this.allLoaded) {
			this.pendingExecute = false;
			this.deps.onAllSourcesLoaded();
			return;
		}

		this.deps.onSourcesChanged();
	}

	private detectTypeHints(source: QuerySource): void {
		if (!source.data) return;

		const detected = AnalyticsEngine.detectColumnTypes(
			source.data.headers,
			source.data.rows,
			source.locale !== "auto" ? source.locale : undefined,
		);

		// Detect source-level locale from numeric column samples
		const numericSamples: string[] = [];
		const numericCols = detected.filter((h) => h.type === "number");
		for (const hint of numericCols) {
			const colIdx = source.data.headers.indexOf(hint.column);
			if (colIdx < 0) continue;
			for (let r = 0; r < Math.min(source.data.rows.length, 10); r++) {
				const val = source.data.rows[r][colIdx]?.trim();
				if (val) numericSamples.push(val);
			}
		}
		if (numericSamples.length > 0) {
			source.detectedLocale = detectNumberLocale(numericSamples);
		}

		this.deps.onTypeHintsDetected(detected);
	}

	// ── Query helpers ────────────────────────────────────────

	getLoadedHeaders(): string[] {
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

	getDistinctValues(column: string, maxScan = 1000, maxValues = 20): string[] {
		const values = new Set<string>();
		for (const src of this.sources) {
			if (!src.data) continue;
			const idx = src.data.headers.indexOf(column);
			if (idx < 0) continue;
			const rows = src.data.rows;
			const limit = Math.min(rows.length, maxScan);
			for (let i = 0; i < limit; i++) {
				const val = rows[i][idx];
				if (val !== undefined && val !== null && val !== "") {
					values.add(String(val));
					if (values.size >= maxValues) return [...values];
				}
			}
		}
		return [...values];
	}

	getRemainingAliases(): Set<string> {
		return new Set(this.sources.map((s) => s.alias));
	}

	// ── Persistence ──────────────────────────────────────────

	buildSavedSources(): SavedAnalyticsQuerySource[] {
		return this.sources.map((s) => ({
			alias: s.alias,
			csvPath: s.csvPath,
			sourceType: s.sourceType !== "csv" ? s.sourceType : undefined,
			viewIndex: s.viewIndex,
			locale: s.locale !== "auto" ? s.locale : undefined,
		}));
	}

	loadFromSaved(sources: SavedAnalyticsQuerySource[], pendingExecute = false): void {
		this.sources = [];
		this.pendingExecute = pendingExecute;

		for (const src of sources) {
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
	}

	reset(): void {
		this.sources = [];
		this.pendingExecute = false;
	}
}
