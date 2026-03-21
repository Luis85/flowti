/**
 * JoinExecutor — extracted from AnalyticsEngine.
 *
 * Pure, stateless class: builds source tables from parsed CSV data
 * and executes hash joins (inner + left) across multiple sources.
 */

import type { AnalyticsSource, JoinSpec } from "./types";

/** Internal row representation during processing. */
export type RawRow = Record<string, string>;

export class JoinExecutor {
	/**
	 * Convert parsed source data (headers + string[][]) into a map of
	 * alias → flat row objects for downstream processing.
	 */
	buildSourceTables(sources: AnalyticsSource[]): Map<string, RawRow[]> {
		const tables = new Map<string, RawRow[]>();
		for (const source of sources) {
			const rows: RawRow[] = [];
			for (const row of source.data.rows) {
				const obj: RawRow = {};
				for (let i = 0; i < source.data.headers.length; i++) {
					obj[source.data.headers[i]] = row[i] ?? "";
				}
				rows.push(obj);
			}
			tables.set(source.alias, rows);
		}
		return tables;
	}

	/**
	 * Apply a sequence of joins to the source tables.
	 *
	 * Supports:
	 * - `inner` join: only matching rows
	 * - `left` join: all left rows, "Unknown" for unmatched right columns
	 *
	 * Uses hash-based join (O(n+m) per join step).
	 */
	/** Build a hash index from rows keyed by a column value. */
	private buildHashIndex(rows: RawRow[], column: string): Map<string, RawRow[]> {
		const index = new Map<string, RawRow[]>();
		for (const row of rows) {
			const key = row[column] ?? "";
			if (!index.has(key)) index.set(key, []);
			index.get(key)!.push(row);
		}
		return index;
	}

	/** Execute a single join step between left and right rows. */
	private executeJoinStep(leftRows: RawRow[], rightRows: RawRow[], join: JoinSpec): RawRow[] {
		const rightIndex = this.buildHashIndex(rightRows, join.rightColumn);
		const joined: RawRow[] = [];

		for (const leftRow of leftRows) {
			const key = leftRow[join.leftColumn] ?? "";
			const matches = rightIndex.get(key);

			if (matches && matches.length > 0) {
				for (const rightRow of matches) {
					joined.push({ ...leftRow, ...rightRow });
				}
			} else if (join.type === "left") {
				const rightHeaders = rightRows.length > 0 ? Object.keys(rightRows[0]) : [];
				const filler: RawRow = {};
				for (const h of rightHeaders) filler[h] = "Unknown";
				joined.push({ ...leftRow, ...filler });
			}
		}

		return joined;
	}

	applyJoins(
		tables: Map<string, RawRow[]>,
		joins: JoinSpec[],
	): RawRow[] {
		if (joins.length === 0) {
			const first = tables.values().next();
			return first.done ? [] : first.value;
		}

		let result: RawRow[] | null = null;

		for (const join of joins) {
			const leftRows = result ?? tables.get(join.leftSource) ?? [];
			const rightRows = tables.get(join.rightSource) ?? [];
			result = this.executeJoinStep(leftRows, rightRows, join);
		}

		return result ?? [];
	}
}
