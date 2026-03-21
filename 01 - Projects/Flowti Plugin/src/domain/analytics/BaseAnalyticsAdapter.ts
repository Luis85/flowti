/**
 * Resolves `.base` vault views into ParsedSourceData for the analytics engine.
 *
 * Delegates to ExportService's public API for column resolution and file filtering,
 * then builds the headers + rows matrix expected by AnalyticsQuery.
 */

import type { ResolvedColumn, VaultFileInfo } from "../dataExchange/types";
import type { ParsedSourceData } from "./types";

/** Callback to scan resolved columns from a .base view. */
export type ScanColumnsCallback = (
	sourcePath: string,
	viewIndex: number,
) => Promise<ResolvedColumn[] | null>;

/** Callback to resolve filtered files from a .base view. */
export type ResolveFilesCallback = (
	sourcePath: string,
	sourceType: "folder" | "base",
	viewIndex?: number,
) => Promise<VaultFileInfo[]>;

export interface BaseAnalyticsAdapterDeps {
	scanColumns: ScanColumnsCallback;
	resolveFiles: ResolveFilesCallback;
}

/**
 * Resolves a single column value from a VaultFileInfo using a ResolvedColumn descriptor.
 * Pure function — mirrors ExportService.resolveColumnValue logic.
 */
function resolveColumnValue(file: VaultFileInfo, rc: ResolvedColumn): string {
	if (rc.source === "file") {
		return resolveFileProperty(file, rc.resolveKey);
	}
	if (rc.source === "formula") {
		if (rc.resolveSource === "file") {
			return resolveFileProperty(file, rc.resolveKey);
		}
		const value = file.frontmatter?.[rc.resolveKey];
		return value !== undefined && value !== null ? String(value) : "";
	}
	// frontmatter
	const value = file.frontmatter?.[rc.resolveKey];
	return value !== undefined && value !== null ? String(value) : "";
}

/** Dispatch map for file property resolution — avoids switch/case complexity. */
const FILE_PROPERTY_RESOLVERS: Record<string, (file: VaultFileInfo) => string> = {
	"file.name": (f) => f.basename,
	"file.basename": (f) => f.basename,
	"file.fullname": (f) => `${f.basename}.${f.extension}`,
	"file.path": (f) => f.path,
	"file.folder": (f) => f.folder,
	"file.ext": (f) => f.extension,
	"file.ctime": (f) => f.stat?.ctime ? new Date(f.stat.ctime).toISOString() : "",
	"file.mtime": (f) => f.stat?.mtime ? new Date(f.stat.mtime).toISOString() : "",
	"file.size": (f) => f.stat?.size !== undefined ? String(f.stat.size) : "",
	"file.tags": (f) => f.tags?.join(", ") ?? "",
};

function resolveFileProperty(file: VaultFileInfo, property: string): string {
	const resolver = FILE_PROPERTY_RESOLVERS[property];
	return resolver ? resolver(file) : "";
}

export class BaseAnalyticsAdapter {
	constructor(private deps: BaseAnalyticsAdapterDeps) {}

	/**
	 * Resolve a `.base` file view into ParsedSourceData (headers + string[][] rows).
	 */
	async resolve(basePath: string, viewIndex: number): Promise<ParsedSourceData> {
		const columns = await this.deps.scanColumns(basePath, viewIndex);
		if (!columns || columns.length === 0) {
			throw new Error(`Base view at index ${viewIndex} has no columns defined`);
		}

		const files = await this.deps.resolveFiles(basePath, "base", viewIndex);

		const headers = columns.map((rc) => rc.header);
		const rows: string[][] = files.map((file) =>
			columns.map((rc) => resolveColumnValue(file, rc)),
		);

		return { headers, rows };
	}
}
