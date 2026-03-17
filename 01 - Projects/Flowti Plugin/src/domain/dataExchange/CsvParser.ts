/**
 * CsvParser — thin, type-safe wrapper around papaparse.
 *
 * Provides CSV/Tab parsing and generation without exposing
 * the underlying library to the rest of the domain.
 */

import * as Papa from "papaparse";
import type { ExportFormat, ParsedCsv } from "./types";

/** Options for parsing CSV content. */
export interface CsvParseOptions {
	/** Override the auto-detected delimiter */
	delimiter?: string;
	/** Whether the first row is a header row (default: true) */
	hasHeader?: boolean;
}

export class CsvParser {
	/**
	 * Parses a CSV or tab-delimited string into structured data.
	 *
	 * @param content - Raw CSV/Tab content
	 * @param options - Parsing options
	 * @returns Parsed headers, rows, and row count
	 */
	parse(content: string, options?: CsvParseOptions): ParsedCsv {
		const result = Papa.parse(content, {
			delimiter: options?.delimiter,
			header: false,
			skipEmptyLines: true,
			dynamicTyping: false,
		});

		const data = result.data as string[][];
		const hasHeader = options?.hasHeader !== false;

		if (data.length === 0) {
			return { headers: [], rows: [], rowCount: 0, detectedDelimiter: options?.delimiter ?? "," };
		}

		const headers = hasHeader
			? data[0]
			: data[0].map((_, i) => `column_${i + 1}`);
		const rows = hasHeader ? data.slice(1) : data;

		return {
			headers,
			rows,
			rowCount: rows.length,
			detectedDelimiter: result.meta.delimiter,
		};
	}

	/**
	 * Generates CSV or tab-delimited content from row data.
	 *
	 * @param headers - Column headers
	 * @param rows - Array of row objects keyed by header name
	 * @param format - Output format ("csv" or "tab")
	 * @returns Formatted output string
	 */
	generate(
		headers: string[],
		rows: Array<Record<string, string>>,
		format: ExportFormat,
	): string {
		const delimiter = format === "tab" ? "\t" : ",";
		return Papa.unparse(
			{
				fields: headers,
				data: rows.map((row) => headers.map((h) => row[h] ?? "")),
			},
			{ delimiter, quotes: format === "csv" },
		);
	}
}
