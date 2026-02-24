/**
 * Pure CSV utility functions.
 *
 * Extracted from ui/csv/csvUtils.ts and ui/PipelineSourceModal.ts
 * per ADR-023 (Modal Business Logic Extraction).
 */

import type { ColumnMapping } from "../domain/dataExchange/types";
import { basename, stripExtension } from "./pathUtils";

/** Split a CSV line using the given delimiter, handling quoted fields. */
export function splitCsvLine(line: string, delimiter: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			inQuotes = !inQuotes;
		} else if (!inQuotes && line.startsWith(delimiter, i)) {
			result.push(current.trim());
			current = "";
			i += delimiter.length - 1;
		} else {
			current += ch;
		}
	}
	result.push(current.trim());
	return result;
}

/** Auto-detect the delimiter from raw CSV content. */
export function detectDelimiter(content: string): string {
	const firstLine = content.split("\n")[0] ?? "";
	const candidates = [",", ";", "\t", "|"];
	let bestDelim = ",";
	let bestCount = 0;
	for (const delim of candidates) {
		let count = 0;
		let inQuotes = false;
		for (const ch of firstLine) {
			if (ch === '"') inQuotes = !inQuotes;
			else if (ch === delim && !inQuotes) count++;
		}
		if (count > bestCount) {
			bestCount = count;
			bestDelim = delim;
		}
	}
	return bestDelim;
}

/** Generate .base YAML content for a set of imported columns. */
export function generateBaseYaml(targetFolder: string, columnMappings: ColumnMapping[]): string {
	const includedMappings = columnMappings.filter((m) => m.included);
	const lines: string[] = [];
	lines.push("filters:");
	lines.push("  and:");
	lines.push(`    - 'file.inFolder("${targetFolder}")'`);
	lines.push(`    - 'file.ext == "md"'`);
	lines.push("");
	lines.push("views:");
	lines.push("  - name: \"Imported Data\"");
	lines.push("    type: \"table\"");
	if (includedMappings.length > 0) {
		lines.push("    order:");
		lines.push("      - \"file.name\"");
		for (const m of includedMappings) {
			lines.push(`      - "${m.frontmatterKey}"`);
		}
	}
	return lines.join("\n") + "\n";
}

/** Extract the base filename from a file path (replace .csv with .base). */
export function getBaseFilename(filePath: string): string {
	const csvFile = basename(filePath) || "imported.csv";
	return stripExtension(csvFile, ".csv") + ".base";
}

/** Format a timestamp as a human-readable relative time string. */
export function formatRelativeTime(ts: number): string {
	const diff = Date.now() - ts;
	const secs = Math.floor(diff / 1000);
	if (secs < 60) return "just now";
	const mins = Math.floor(secs / 60);
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return new Date(ts).toLocaleDateString();
}

/**
 * Fuzzy-match a merge key name against CSV column headers.
 *
 * Normalizes both sides by lowercasing and stripping underscores, spaces,
 * and dashes. Returns the original header name if matched, or undefined.
 */
export function matchMergeKeyColumn(mergeKey: string, headers: string[]): string | undefined {
	const normalized = mergeKey.toLowerCase().replace(/[_\s-]/g, "");
	return headers.find((h) => {
		const hNorm = h.toLowerCase().replace(/[_\s-]/g, "");
		return hNorm === normalized;
	});
}

// ─────────────────────────────────────────────────────────
// CSV Generation & Export
// ─────────────────────────────────────────────────────────

/** Escape a single CSV field value, quoting if it contains commas, quotes, or newlines. */
export function escapeCsvField(value: unknown): string {
	const str = value == null ? "" : typeof value === "number" ? String(value) : String(value);
	if (str.includes(",") || str.includes('"') || str.includes("\n")) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

/** Generate a CSV string from column headers and row data. */
export function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
	const lines = [columns.map((c) => escapeCsvField(c)).join(",")];
	for (const row of rows) {
		lines.push(columns.map((col) => escapeCsvField(row[col])).join(","));
	}
	return lines.join("\n");
}

/** Trigger a file download of CSV content with the given filename. */
export function downloadCsvFile(csv: string, filename: string): void {
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${filename.replace(/[<>:"/\\|?*]/g, "_")}.csv`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Synchronize column mappings with a new set of CSV headers.
 *
 * - If `existing` is empty, creates a fresh mapping for each header.
 * - Otherwise, adds new headers not yet in the mapping and removes
 *   stale mappings whose CSV column no longer exists.
 *
 * Returns a new array (does not mutate the input).
 */
export function syncColumnMappings(headers: string[], existing: ColumnMapping[]): ColumnMapping[] {
	if (existing.length === 0) {
		return headers.map((h) => ({
			csvColumn: h,
			frontmatterKey: h,
			included: true,
		}));
	}

	const headerSet = new Set(headers);
	const existingCols = new Set(existing.map((m) => m.csvColumn));
	const result = [...existing];

	for (const h of headers) {
		if (!existingCols.has(h)) {
			result.push({
				csvColumn: h,
				frontmatterKey: h,
				included: true,
			});
		}
	}

	return result.filter((m) => headerSet.has(m.csvColumn));
}
