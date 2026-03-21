/**
 * Source resolution helpers for AnalyticsService.
 *
 * Extracted from AnalyticsService.ts to stay under max-lines.
 * Handles CSV, .base, and csv-folder source resolution.
 */

import type { ParsedCsv } from "../dataExchange/types";
import type { ParsedSourceData, SavedAnalyticsQuerySource } from "./types";
import type { BaseAnalyticsAdapter } from "./BaseAnalyticsAdapter";

export type ReadCsvCallback = (csvPath: string) => Promise<ParsedCsv | null>;

/** Merge multiple CSV files from a folder into a single ParsedSourceData. */
export async function resolveCsvFolder(
	folderPath: string,
	listFolder: (folderPath: string) => Promise<string[]>,
	readCsv: ReadCsvCallback,
): Promise<ParsedSourceData> {
	const files = await listFolder(folderPath);
	const csvFiles = files.filter((f) => f.endsWith(".csv")).sort();
	if (csvFiles.length === 0) throw new Error(`No CSV files in folder: ${folderPath}`);

	const headerSet = new Set<string>();
	const headerOrder: string[] = [];
	const fileResults: Array<{ headers: string[]; rows: string[][] }> = [];
	for (const file of csvFiles) {
		const parsed = await readCsv(file);
		if (!parsed) continue;
		for (const h of parsed.headers) {
			if (!headerSet.has(h)) { headerSet.add(h); headerOrder.push(h); }
		}
		fileResults.push(parsed);
	}

	const mergedRows: string[][] = [];
	for (const fr of fileResults) {
		const colIndex = headerOrder.map((h) => fr.headers.indexOf(h));
		for (const row of fr.rows) mergedRows.push(colIndex.map((idx) => (idx >= 0 ? row[idx] : "")));
	}
	return { headers: headerOrder, rows: mergedRows };
}

/** Resolve a saved query source to ParsedSourceData, regardless of type. */
export async function resolveSource(
	src: SavedAnalyticsQuerySource,
	baseAdapter: BaseAnalyticsAdapter | undefined,
	readCsv: ReadCsvCallback | undefined,
	listFolder: ((folderPath: string) => Promise<string[]>) | undefined,
): Promise<ParsedSourceData> {
	if (src.sourceType === "base") {
		if (!baseAdapter) throw new Error("Base adapter not configured");
		return baseAdapter.resolve(src.csvPath, src.viewIndex ?? 0);
	}

	if (src.sourceType === "csv-folder") {
		if (!listFolder) throw new Error("Folder listing not configured");
		if (!readCsv) throw new Error("CSV reader not configured");
		return resolveCsvFolder(src.csvPath, listFolder, readCsv);
	}

	if (!readCsv) throw new Error("CSV reader not configured");
	const parsed = await readCsv(src.csvPath);
	if (!parsed) throw new Error(`CSV not found: ${src.csvPath}`);
	return { headers: parsed.headers, rows: parsed.rows };
}
