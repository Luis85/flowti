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
}

/** A saved export configuration preset. */
export interface SavedExportConfig {
	/** Unique ID */
	id: string;
	/** User-provided name */
	name: string;
	/** Timestamp when saved */
	createdAt: number;
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
}

/** Persisted state for the Data Exchange domain. */
export interface DataExchangeState {
	savedImportConfigs: SavedImportConfig[];
	savedExportConfigs: SavedExportConfig[];
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
