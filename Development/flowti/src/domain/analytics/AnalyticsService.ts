/**
 * Analytics domain service — orchestrates query execution and saved query management.
 *
 * Thin facade: loads CSV data, delegates to AnalyticsEngine, emits events,
 * and persists saved query configurations via DataExchangeState.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { DataExchangeState, ParsedCsv } from "../dataExchange/types";
import type { ITypedStorage } from "../../utils/TypedStorage";
import type {
	AnalyticsQuery,
	AnalyticsResult,
	AnalyticsSource,
	SavedAnalyticsQuery,
	SavedAnalyticsQuerySource,
} from "./types";
import { AnalyticsEngine } from "./AnalyticsEngine";

/** Callback to read a CSV file's content from the vault. */
export type ReadCsvCallback = (csvPath: string) => Promise<ParsedCsv | null>;

export interface AnalyticsServiceOptions {
	storage: ITypedStorage<DataExchangeState>;
	eventBus?: IEventBus;
	readCsv?: ReadCsvCallback;
	fileSystem?: IFileSystemClient;
}

function generateId(): string {
	return `aq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultState(): DataExchangeState {
	return { savedImportConfigs: [], savedExportConfigs: [] };
}

export class AnalyticsService {
	private engine = new AnalyticsEngine();
	private storage: ITypedStorage<DataExchangeState>;
	private state: DataExchangeState = createDefaultState();
	private eventBus?: IEventBus;
	private readCsv?: ReadCsvCallback;
	private fileSystem?: IFileSystemClient;
	private queryFolder?: string;

	constructor(options: AnalyticsServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
		this.readCsv = options.readCsv;
		this.fileSystem = options.fileSystem;
	}

	/** Load persisted state from storage. */
	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved) this.state = saved;
	}

	/** Set the CSV reading callback (wired during setup). */
	setReadCsv(cb: ReadCsvCallback): void {
		this.readCsv = cb;
	}

	/** Set the vault folder where saved queries are written as JSON files. */
	setQueryFolder(folder: string): void {
		this.queryFolder = folder;
	}

	/** Read and parse a CSV file from vault. Returns null if reader not configured or file not found. */
	async loadCsv(csvPath: string): Promise<ParsedCsv | null> {
		if (!this.readCsv) return null;
		return this.readCsv(csvPath);
	}

	// ── Query execution ──────────────────────────────────

	/**
	 * Execute an analytics query with pre-loaded source data.
	 * Use this when the caller already has parsed CSV data.
	 */
	async runQuery(query: AnalyticsQuery, queryName?: string): Promise<AnalyticsResult> {
		await this.eventBus?.emit("analytics.query.started", {
			queryName,
			sourceCount: query.sources.length,
			dimensionCount: query.dimensions.length,
			measureCount: query.measures.length,
		});

		const start = Date.now();

		try {
			const result = this.engine.run(query);
			const durationMs = Date.now() - start;

			await this.eventBus?.emit("analytics.query.completed", {
				queryName,
				rowCount: result.rows.length,
				groupCount: result.groupCount,
				durationMs,
				result,
			});

			return result;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			await this.eventBus?.emit("analytics.query.failed", {
				queryName,
				error: message,
			});
			throw err;
		}
	}

	/**
	 * Execute a saved query by ID.
	 * Loads CSVs from vault, builds AnalyticsQuery, and runs the engine.
	 */
	async runSavedQuery(queryId: string): Promise<AnalyticsResult> {
		const saved = this.getQuery(queryId);
		if (!saved) throw new Error(`Saved query not found: ${queryId}`);
		if (!this.readCsv) throw new Error("CSV reader not configured");

		// Load CSV sources
		const sources: AnalyticsSource[] = [];
		for (const src of saved.sources) {
			const parsed = await this.readCsv(src.csvPath);
			if (!parsed) throw new Error(`CSV not found: ${src.csvPath}`);
			sources.push({
				alias: src.alias,
				data: { headers: parsed.headers, rows: parsed.rows },
				locale: src.locale,
			});
		}

		const query: AnalyticsQuery = {
			sources,
			joins: saved.joins,
			columnTypeHints: saved.columnTypeHints,
			dimensions: saved.dimensions,
			measures: saved.measures,
			timeBucket: saved.timeBucket,
		};

		const result = await this.runQuery(query, saved.name);

		// Update last run metadata
		saved.lastRun = Date.now();
		saved.lastRowCount = result.rows.length;
		await this.storage.save(this.state);

		return result;
	}

	// ── Saved query CRUD ─────────────────────────────────

	/** Save a new analytics query configuration. */
	async saveQuery(
		name: string,
		sources: SavedAnalyticsQuerySource[],
		query: Omit<AnalyticsQuery, "sources">,
	): Promise<SavedAnalyticsQuery> {
		const saved: SavedAnalyticsQuery = {
			id: generateId(),
			name,
			createdAt: Date.now(),
			sources,
			joins: query.joins,
			columnTypeHints: query.columnTypeHints,
			dimensions: query.dimensions,
			measures: query.measures,
			timeBucket: query.timeBucket,
		};

		const queries = this.state.savedAnalyticsQueries ?? [];
		queries.push(saved);
		this.state.savedAnalyticsQueries = queries;
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.query.saved", {
			queryId: saved.id,
			queryName: saved.name,
		});

		await this.writeQueryFile(saved);

		return saved;
	}

	/** List all saved analytics queries. */
	listQueries(): SavedAnalyticsQuery[] {
		return this.state.savedAnalyticsQueries ?? [];
	}

	/** Get a saved query by ID. */
	getQuery(id: string): SavedAnalyticsQuery | undefined {
		return this.listQueries().find((q) => q.id === id);
	}

	/** Delete a saved query by ID. */
	async deleteQuery(id: string): Promise<boolean> {
		const queries = this.state.savedAnalyticsQueries ?? [];
		const idx = queries.findIndex((q) => q.id === id);
		if (idx === -1) return false;

		const removed = queries[idx];
		queries.splice(idx, 1);
		this.state.savedAnalyticsQueries = queries;
		await this.storage.save(this.state);

		await this.eventBus?.emit("analytics.query.deleted", {
			queryId: removed.id,
			queryName: removed.name,
		});

		await this.deleteQueryFile(removed.name);

		return true;
	}

	// ── File persistence ────────────────────────────────

	/** Write a saved query as a JSON file in the query folder. */
	private async writeQueryFile(query: SavedAnalyticsQuery): Promise<void> {
		if (!this.fileSystem || !this.queryFolder) return;
		const path = `${this.queryFolder}/${this.sanitizeFileName(query.name)}.json`;
		await this.fileSystem.createFile(path, JSON.stringify(query, null, 2), { createFolders: true });
	}

	/** Delete the JSON file for a query by name. */
	private async deleteQueryFile(queryName: string): Promise<void> {
		if (!this.fileSystem || !this.queryFolder) return;
		const path = `${this.queryFolder}/${this.sanitizeFileName(queryName)}.json`;
		try { await this.fileSystem.deleteFile(path); } catch { /* file may not exist */ }
	}

	/** Sanitize a query name for use as a filename. */
	private sanitizeFileName(name: string): string {
		return name.replace(/[\\/:*?"<>|]/g, "-").trim();
	}
}
