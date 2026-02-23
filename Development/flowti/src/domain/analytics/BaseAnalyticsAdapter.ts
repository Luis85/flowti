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

function resolveFileProperty(file: VaultFileInfo, property: string): string {
	switch (property) {
		case "file.name": return file.basename;
		case "file.basename": return file.basename;
		case "file.fullname": return `${file.basename}.${file.extension}`;
		case "file.path": return file.path;
		case "file.folder": return file.folder;
		case "file.ext": return file.extension;
		case "file.ctime":
			return file.stat?.ctime ? new Date(file.stat.ctime).toISOString() : "";
		case "file.mtime":
			return file.stat?.mtime ? new Date(file.stat.mtime).toISOString() : "";
		case "file.size":
			return file.stat?.size !== undefined ? String(file.stat.size) : "";
		case "file.tags": return file.tags?.join(", ") ?? "";
		default: return "";
	}
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
