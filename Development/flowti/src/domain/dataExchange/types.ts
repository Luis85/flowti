/**
 * Types for the Data Exchange domain.
 *
 * Defines all interfaces for CSV import, folder/base export,
 * column mapping, and `.base` file filter parsing.
 */

// ── Export format ────────────────────────────────────────

/** Supported output formats for export. */
export type ExportFormat = "csv" | "tab";

// ── Existing note conflict strategy ─────────────────────

/** How to handle notes that already exist during import. */
export type ConflictStrategy = "skip" | "update" | "overwrite";

// ── Column mapping for import ───────────────────────────

/** Maps a CSV column to a frontmatter key with an include toggle. */
export interface ColumnMapping {
	/** CSV header name */
	csvColumn: string;
	/** Frontmatter key name (may differ from csvColumn) */
	frontmatterKey: string;
	/** Whether to include this column in the import */
	included: boolean;
}

// ── Import configuration ────────────────────────────────

/** Full configuration for a CSV import operation. */
export interface ImportConfig {
	/** Path to the CSV file in the vault */
	sourcePath: string;
	/** Target folder for created notes */
	targetFolder: string;
	/** Which CSV column becomes the note filename */
	nameColumn: string;
	/** Optional prefix prepended to the filename */
	namePrefix?: string;
	/** Optional suffix appended to the filename (before .md) */
	nameSuffix?: string;
	/** Column mappings (csvColumn → frontmatterKey) */
	columnMappings: ColumnMapping[];
	/** How to handle existing notes */
	conflictStrategy: ConflictStrategy;
	/** Custom key-value pairs injected into every note's frontmatter */
	customProperties?: Record<string, string>;
}

// ── Import result ───────────────────────────────────────

/** Result summary after a completed import. */
export interface ImportResult {
	/** Total rows processed */
	totalRows: number;
	/** Notes created */
	created: number;
	/** Notes updated (conflict strategy was update/overwrite) */
	updated: number;
	/** Notes skipped (already exist + strategy=skip) */
	skipped: number;
	/** Rows that failed */
	failed: number;
	/** Error details per failed row */
	errors: ImportRowError[];
}

/** Error detail for a single failed import row. */
export interface ImportRowError {
	/** 1-based row number in the CSV */
	row: number;
	/** The attempted filename */
	filename: string;
	/** Error message */
	error: string;
}

// ── Export conflict strategy ─────────────────────────────

/** How to handle an existing output file during export. */
export type ExportConflictStrategy = "overwrite" | "skip" | "append";

// ── Export configuration ────────────────────────────────

/** Maps an internal file property key to its clean export/display label. */
export interface FilePropertyDef {
	/** Internal key as used in .base files (e.g. "file.name") */
	key: string;
	/** Clean label for export headers and UI (e.g. "name") */
	label: string;
}

/**
 * All standard Obsidian file properties available in Bases.
 * Always displayed in the export modal's File Properties section.
 */
export const STANDARD_FILE_PROPERTIES: readonly FilePropertyDef[] = [
	{ key: "file.name", label: "name" },
	{ key: "file.backlinks", label: "backlinks" },
	{ key: "file.basename", label: "basename" },
	{ key: "file.ctime", label: "ctime" },
	{ key: "file.embeds", label: "embeds" },
	{ key: "file.ext", label: "ext" },
	{ key: "file.folder", label: "folder" },
	{ key: "file.fullname", label: "fullname" },
	{ key: "file.links", label: "links" },
	{ key: "file.mtime", label: "mtime" },
	{ key: "file.path", label: "path" },
	{ key: "file.size", label: "size" },
	{ key: "file.tags", label: "tags" },
];

/** A single export column with resolution metadata for Base view exports. */
export interface ResolvedColumn {
	/** Unique key matching the view order entry (e.g. "file.name", "formula.Foo Bar", "baz.foo") */
	key: string;
	/** Display header for CSV output */
	header: string;
	/** Value resolution strategy */
	source: "file" | "frontmatter" | "formula";
	/** Key used to resolve the value (file.* key or frontmatter key) */
	resolveKey: string;
	/** For formulas: whether resolveKey targets a file property or frontmatter */
	resolveSource?: "file" | "frontmatter";
}

/** Full configuration for an export operation. */
export interface ExportConfig {
	/** Source: folder path OR .base file path */
	sourcePath: string;
	/** Whether source is a folder or .base file */
	sourceType: "folder" | "base";
	/** Output format */
	format: ExportFormat;
	/** Target path for the output file (vault-relative or absolute for external) */
	outputPath: string;
	/** Which frontmatter columns to include */
	columns: string[];
	/** Which file properties to include (e.g. "file.name", "file.path") */
	fileProperties: string[];
	/** View index for .base files with multiple views (default: 0) */
	baseViewIndex?: number;
	/** Optional header overrides: column key → display name (from .base properties) */
	displayNames?: Record<string, string>;
	/** When true, outputPath is an absolute filesystem path outside the vault */
	isExternal?: boolean;
	/** How to handle an existing output file (default: "overwrite") */
	conflictStrategy?: ExportConflictStrategy;
	/** Unified ordered columns for Base exports. Overrides columns[]+fileProperties[] when present. */
	resolvedColumns?: ResolvedColumn[];
}

// ── Export result ───────────────────────────────────────

/** Result summary after a completed export. */
export interface ExportResult {
	/** Total rows exported */
	totalRows: number;
	/** Total columns exported */
	totalColumns: number;
	/** Output file path */
	outputPath: string;
	/** True when the export was skipped because the file already exists */
	skipped?: boolean;
}

// ── Parsed CSV data ─────────────────────────────────────

/** Structured representation of parsed CSV content. */
export interface ParsedCsv {
	/** Column headers */
	headers: string[];
	/** Row data as arrays of strings */
	rows: string[][];
	/** Total row count (excluding header) */
	rowCount: number;
	/** The delimiter detected or used during parsing */
	detectedDelimiter: string;
}

// ── Base file filter structures ─────────────────────────

/** Filter expression types recognized by the BaseQueryEngine. */
export type BaseFilterType =
	| "inFolder"
	| "folderContains"
	| "extEquals"
	| "nameContains"
	| "propertyEquals";

/** A single parsed filter expression from a .base YAML file. */
export interface BaseFilter {
	/** Type of filter expression */
	type: BaseFilterType;
	/** The field being filtered (e.g., "file.folder", or a frontmatter key) */
	field: string;
	/** The argument/value to match against */
	value: string;
	/** Whether this filter is negated (prefixed with !) */
	negated: boolean;
}

/** A logical group of filter conditions. */
export interface BaseFilterGroup {
	/** Logical operator */
	operator: "and" | "or";
	/** Child conditions (filters or nested groups) */
	conditions: Array<BaseFilter | BaseFilterGroup>;
}

/** Configuration for a single view within a .base file. */
export interface BaseViewConfig {
	/** View display name */
	name: string;
	/** View type (e.g., "table") */
	type: string;
	/** View-level filters (applied in addition to global filters) */
	filters?: BaseFilterGroup;
	/** Column order (property IDs) */
	order?: string[];
}

/** Per-property configuration from a .base file's `properties` section. */
export interface BasePropertyConfig {
	/** Custom display name for this property column */
	displayName?: string;
}

/** Parsed representation of an entire .base YAML file. */
export interface ParsedBaseFile {
	/** Global filters applied to all views */
	filters?: BaseFilterGroup;
	/** Array of view configurations */
	views: BaseViewConfig[];
	/** Per-property configuration (e.g. displayName overrides) */
	properties?: Record<string, BasePropertyConfig>;
	/** Formula definitions: name → expression (often a property reference) */
	formulas?: Record<string, string>;
}

// ── Saved configuration presets ──────────────────────────

/** A saved import configuration preset. */
export interface SavedImportConfig {
	/** Unique ID */
	id: string;
	/** User-provided name */
	name: string;
	/** Timestamp when saved */
	createdAt: number;
	/** Whether this config is marked as a favourite */
	favourite?: boolean;
	/** Path to the CSV file this config was saved from (optional for backward compat) */
	sourcePath?: string;
	/** Target folder for created notes */
	targetFolder: string;
	/** Which CSV column becomes the note filename */
	nameColumn: string;
	/** Optional prefix prepended to the filename */
	namePrefix?: string;
	/** Optional suffix appended to the filename (before .md) */
	nameSuffix?: string;
	/** Column mappings (csvColumn → frontmatterKey) */
	columnMappings: ColumnMapping[];
	/** How to handle existing notes */
	conflictStrategy: ConflictStrategy;
	/** Custom key-value pairs injected into every note's frontmatter */
	customProperties?: Record<string, string>;
	/** Whether to create/update a .base view file on import */
	createBase?: boolean;
	/** Path for the .base view file */
	basePath?: string;
	/** Type value injected into every note's frontmatter (e.g. "Event") */
	noteType?: string;
}

/** A saved export configuration preset. */
export interface SavedExportConfig {
	/** Unique ID */
	id: string;
	/** User-provided name */
	name: string;
	/** Timestamp when saved */
	createdAt: number;
	/** Whether this config is marked as a favourite */
	favourite?: boolean;
	/** Source path this config was saved from */
	sourcePath: string;
	/** Whether source is a folder or .base file */
	sourceType: "folder" | "base";
	/** Output format */
	format: ExportFormat;
	/** Target path for the output file */
	outputPath: string;
	/** Which frontmatter columns to include */
	columns: string[];
	/** Which file properties to include */
	fileProperties: string[];
	/** View index for .base files with multiple views */
	baseViewIndex?: number;
	/** How to handle an existing output file */
	conflictStrategy?: ExportConflictStrategy;
	/** When true, outputPath is an absolute filesystem path outside the vault */
	isExternal?: boolean;
	/** Type value for TypeDoc creation (e.g. "Event") */
	noteType?: string;
}

// ── Multi-Import Pipeline ────────────────────────────────

/** A single CSV source within a multi-import pipeline. */
export interface MultiImportSource {
	/** Unique ID for this source within the pipeline */
	id: string;
	/** Vault path to the CSV file */
	csvPath: string;
	/** Which CSV column holds the merge key value (maps to pipeline.mergeKey) */
	mergeKeyColumn: string;
	/** Column mappings for non-merge-key columns */
	columnMappings: ColumnMapping[];
	/** Custom key-value pairs injected into every note from this source */
	customProperties?: Record<string, string>;
}

/** A saved multi-import pipeline configuration. */
export interface SavedMultiImportPipeline {
	/** Unique ID */
	id: string;
	/** User-provided pipeline name */
	name: string;
	/** Timestamp when created */
	createdAt: number;
	/** Whether this pipeline is marked as a favourite */
	favourite?: boolean;
	/** Target folder for all notes produced by this pipeline */
	targetFolder: string;
	/** Canonical frontmatter key name used as the merge key (e.g. "item_id") */
	mergeKey: string;
	/** Ordered list of CSV sources */
	sources: MultiImportSource[];
	/** Whether to create/update a .base view file after pipeline run */
	createBase?: boolean;
	/** Path for the .base view file */
	basePath?: string;
	/** Timestamp of the last successful execution */
	lastExecutedAt?: number;
	/** Type value injected into every note's frontmatter (e.g. "Event") */
	noteType?: string;
	/** Optional prefix prepended to filename */
	namePrefix?: string;
	/** Optional suffix appended to filename (before .md) */
	nameSuffix?: string;
	/** IDs of saved export configs to run after pipeline completes */
	exportConfigIds?: string[];
}

/** Result summary for a single source within a pipeline run. */
export interface PipelineSourceResult {
	/** ID of the source */
	sourceId: string;
	/** Vault path to the CSV file */
	csvPath: string;
	/** Result from ImportService for this source */
	result: ImportResult;
}

/** Aggregated result summary after a full pipeline run. */
export interface MultiImportResult {
	/** Total number of sources in the pipeline */
	totalSources: number;
	/** Number of sources that completed successfully */
	completedSources: number;
	/** Aggregated total rows across all sources */
	totalRows: number;
	/** Aggregated notes created (first source typically) */
	created: number;
	/** Aggregated notes updated (subsequent sources) */
	updated: number;
	/** Aggregated notes skipped */
	skipped: number;
	/** Aggregated notes failed */
	failed: number;
	/** All errors across all sources */
	errors: ImportRowError[];
	/** Per-source breakdown */
	sourceResults: PipelineSourceResult[];
}

// ── Pipeline Preview ─────────────────────────────────────

/** Preview data for a single source within a pipeline. */
export interface PipelinePreviewSource {
	/** Source ID within the pipeline */
	sourceId: string;
	/** Display name (CSV basename) */
	csvName: string;
	/** Row count in the CSV */
	rowCount: number;
	/** Included column frontmatter keys (excluding merge key) */
	columns: string[];
	/** Extracted merge key values */
	mergeKeyValues: string[];
	/** Error message if parsing/detection failed */
	error?: string;
}

/** Preview data for a single note entry the pipeline would create/update. */
export interface PipelinePreviewEntry {
	/** Original merge key value */
	key: string;
	/** Constructed filename (with prefix/suffix, without .md) */
	filename: string;
	/** Whether a note already exists at the target path */
	exists: boolean;
}

/** Complete preview result for a pipeline. */
export interface PipelinePreviewResult {
	/** Per-source breakdown */
	sources: PipelinePreviewSource[];
	/** Deduplicated note entries */
	entries: PipelinePreviewEntry[];
	/** Count of entries where exists === false */
	toCreate: number;
	/** Count of entries where exists === true */
	toUpdate: number;
}

/** Callback to check whether a vault file exists at a given path. */
export type FileExistsCallback = (path: string) => boolean;

/** Persisted state for the Data Exchange domain. */
export interface DataExchangeState {
	savedImportConfigs: SavedImportConfig[];
	savedExportConfigs: SavedExportConfig[];
	/** Saved multi-import pipeline configurations */
	savedPipelines?: SavedMultiImportPipeline[];
	/** Per-CSV file display settings, keyed by vault path */
	csvDisplaySettings?: Record<string, CsvDisplaySettings>;
	/** Vault paths of CSV files hidden from the "Available Files" dashboard section */
	hiddenCsvPaths?: string[];
}

// ── CSV display settings ────────────────────────────────

/** Per-CSV display settings persisted for the landing page. */
export interface CsvDisplaySettings {
	/** Sort column header name, or null for no sort */
	sortColumn: string | null;
	/** Sort direction */
	sortDirection: "asc" | "desc";
	/** Columns hidden from the preview table */
	hiddenColumns: string[];
	/** Column selected for filtering, or null for all columns */
	filterColumn: string | null;
	/** Filter text applied to filterColumn (or all columns) */
	filterText: string;
	/** Maximum preview rows (default 100) */
	maxPreviewRows: number;
	/** Timestamp (ms) of the last successful import */
	lastImportedAt?: number;
}

// ── Data Dictionary ─────────────────────────────────────

/** Reference to a config that uses a property. */
export interface DataDictionaryConfigRef {
	configId: string;
	configName: string;
	configType: "import" | "export";
}

/** Aggregated property metadata for the Data Dictionary. */
export interface DataDictionaryEntry {
	/** Frontmatter property name */
	propertyName: string;
	/** Config IDs that use this property */
	usedInConfigs: DataDictionaryConfigRef[];
	/** CSV column names that map to this property */
	csvColumnNames: string[];
	/** Sample values seen (first N unique values) */
	sampleValues: string[];
	/** Note types that expect this property (derived from pipeline noteType) */
	typeNames?: string[];
}

/** A type definition scanned from the Types folder. */
export interface TypeDocEntry {
	/** Type name (e.g. "Event", "Asset") */
	name: string;
	/** Description from frontmatter */
	description: string;
	/** Expected frontmatter property keys */
	properties: string[];
	/** Vault path to the TypeDoc file */
	filePath: string;
	/** Number of pipelines that reference this type */
	pipelineCount: number;
}

// ── Vault file info (for BaseQueryEngine) ───────────────

/** Lightweight representation of a vault file with its metadata. */
export interface VaultFileInfo {
	/** Full vault-relative path */
	path: string;
	/** Filename without extension */
	basename: string;
	/** File extension (without dot) */
	extension: string;
	/** Parent folder path */
	folder: string;
	/** Parsed frontmatter, or undefined if none */
	frontmatter: Record<string, unknown> | undefined;
	/** File stats (creation time, modification time, size) */
	stat?: { ctime: number; mtime: number; size: number };
	/** All tags (frontmatter + inline, without # prefix) */
	tags?: string[];
}

// ── Config state accessor (for sub-modules) ─────────────

/** Read-only access to config state, used by extracted sub-services. */
export interface ConfigStateAccessor {
	getState(): Readonly<DataExchangeState>;
	getImportConfig(id: string): SavedImportConfig | undefined;
	getExportConfig(id: string): SavedExportConfig | undefined;
	getPipeline(id: string): SavedMultiImportPipeline | undefined;
}
