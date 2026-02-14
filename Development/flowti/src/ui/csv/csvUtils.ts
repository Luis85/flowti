/**
 * Pure helper functions for CsvActionView.
 */

import type { ColumnMapping } from "../../domain/dataExchange/types";
import { basename, stripExtension } from "../../utils/pathUtils";

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
