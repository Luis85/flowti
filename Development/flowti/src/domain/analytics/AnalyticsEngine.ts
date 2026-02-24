/**
 * In-memory analytics engine for CSV data.
 *
 * Pure, stateless class: takes a query config + parsed CSV data → returns result.
 * Supports hash joins, GROUP BY, aggregation (SUM/COUNT/AVG/MIN/MAX),
 * locale-aware number/date parsing, time bucketing, and computed columns.
 */

import type {
	AnalyticsQuery,
	AnalyticsResult,
	AnalyticsSource,
	AggregationFunction,
	ColumnTypeHint,
	ComputedColumn,
	DimensionSpec,
	FilterSpec,
	JoinSpec,
	MeasureSpec,
	ResultRow,
	SortSpec,
	TimeBucketSpec,
} from "./types";
import { parseNumber } from "./localeUtils";
import { bucketDate, parseDate } from "./dateUtils";

/** Internal row representation during processing. */
type RawRow = Record<string, string>;

export class AnalyticsEngine {
	/**
	 * Execute an analytics query and return the result.
	 */
	run(query: AnalyticsQuery): AnalyticsResult {
		// 1. Build flat row arrays from each source
		const sourceTables = this.buildSourceTables(query.sources);

		// 2. Apply joins (or use single source)
		let rows: RawRow[];
		if (query.sources.length === 1) {
			rows = sourceTables.get(query.sources[0].alias) ?? [];
		} else {
			rows = this.applyJoins(sourceTables, query.joins);
		}

		const sourceRowCount = rows.length;

		// 3. Apply filters (before grouping)
		if (query.filters && query.filters.length > 0) {
			rows = this.applyFilters(rows, query.filters, query);
		}

		// 4. Apply time bucketing (adds a new column)
		if (query.timeBucket) {
			rows = this.applyTimeBucket(rows, query.timeBucket, query);
		}

		// 5. GROUP BY + aggregate
		const { resultRows, groupCount } = this.groupAndAggregate(
			rows,
			query.dimensions,
			query.measures,
			query,
		);

		// 6. Apply computed columns (after aggregation)
		if (query.computedColumns && query.computedColumns.length > 0) {
			this.applyComputedColumns(resultRows, query.computedColumns);
		}

		// 7. Apply sort (after aggregation)
		let sortedRows = resultRows;
		if (query.sort) {
			sortedRows = this.applySort(sortedRows, query.sort);
		}

		// 8. Apply limit (after sorting)
		if (query.limit !== undefined && query.limit >= 0) {
			sortedRows = this.applyLimit(sortedRows, query.limit);
		}

		// 9. Build column list
		const columns = [
			...query.dimensions.map((d) => d.column),
			...(query.timeBucket
				? [query.timeBucket.outputColumn ?? `${query.timeBucket.column}_${query.timeBucket.period}`]
				: []),
			...query.measures.map((m) => m.label ?? `${m.function}(${m.column})`),
			...(query.computedColumns ?? []).map((c) => c.name),
		];

		return {
			columns,
			rows: sortedRows,
			groupCount,
			sourceRowCount,
		};
	}

	// ── Source loading ──────────────────────────────────

	private buildSourceTables(
		sources: AnalyticsSource[],
	): Map<string, RawRow[]> {
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

	// ── Joins ──────────────────────────────────────────

	private applyJoins(
		tables: Map<string, RawRow[]>,
		joins: JoinSpec[],
	): RawRow[] {
		if (joins.length === 0) {
			// No joins — return first table
			const first = tables.values().next();
			return first.done ? [] : first.value;
		}

		let result: RawRow[] | null = null;

		for (const join of joins) {
			const leftRows = result ?? tables.get(join.leftSource) ?? [];
			const rightRows = tables.get(join.rightSource) ?? [];

			// Build hash index on right side
			const rightIndex = new Map<string, RawRow[]>();
			for (const row of rightRows) {
				const key = row[join.rightColumn] ?? "";
				if (!rightIndex.has(key)) rightIndex.set(key, []);
				rightIndex.get(key)!.push(row);
			}

			const joined: RawRow[] = [];
			for (const leftRow of leftRows) {
				const key = leftRow[join.leftColumn] ?? "";
				const matches = rightIndex.get(key);

				if (matches && matches.length > 0) {
					for (const rightRow of matches) {
						joined.push({ ...leftRow, ...rightRow });
					}
				} else if (join.type === "left") {
					// Left join: keep left row, fill right columns with "Unknown"
					const rightHeaders = rightRows.length > 0
						? Object.keys(rightRows[0])
						: [];
					const filler: RawRow = {};
					for (const h of rightHeaders) {
						filler[h] = "Unknown";
					}
					joined.push({ ...leftRow, ...filler });
				}
				// inner join: skip unmatched rows
			}

			result = joined;
		}

		return result ?? [];
	}

	// ── Filtering ─────────────────────────────────────

	private applyFilters(
		rows: RawRow[],
		filters: FilterSpec[],
		query: AnalyticsQuery,
	): RawRow[] {
		return rows.filter((row) =>
			filters.every((f) => this.matchFilter(row, f, query)),
		);
	}

	private matchFilter(row: RawRow, filter: FilterSpec, query: AnalyticsQuery): boolean {
		const raw = row[filter.column] ?? "";
		const filterVal = filter.value;

		// String operators
		if (filter.operator === "contains") {
			return raw.toLowerCase().includes(filterVal.toLowerCase());
		}
		if (filter.operator === "startsWith") {
			return raw.toLowerCase().startsWith(filterVal.toLowerCase());
		}

		// Try numeric comparison
		const localeId = this.findLocaleForColumn(filter.column, query);
		const numRow = parseNumber(raw, localeId);
		const numFilter = parseFloat(filterVal);

		if (numRow !== null && !isNaN(numFilter)) {
			switch (filter.operator) {
				case "=": return numRow === numFilter;
				case "!=": return numRow !== numFilter;
				case ">": return numRow > numFilter;
				case "<": return numRow < numFilter;
				case ">=": return numRow >= numFilter;
				case "<=": return numRow <= numFilter;
			}
		}

		// Fallback to string comparison
		switch (filter.operator) {
			case "=": return raw === filterVal;
			case "!=": return raw !== filterVal;
			case ">": return raw > filterVal;
			case "<": return raw < filterVal;
			case ">=": return raw >= filterVal;
			case "<=": return raw <= filterVal;
		}
	}

	// ── Sorting and limiting ──────────────────────────

	private applySort(rows: ResultRow[], sort: SortSpec): ResultRow[] {
		const sorted = [...rows];
		const col = sort.column;
		const dir = sort.direction === "asc" ? 1 : -1;

		sorted.sort((a, b) => {
			const aVal = a[col];
			const bVal = b[col];

			// Numeric comparison when both are numbers
			if (typeof aVal === "number" && typeof bVal === "number") {
				return (aVal - bVal) * dir;
			}

			// String comparison
			const aStr = String(aVal ?? "");
			const bStr = String(bVal ?? "");
			return aStr.localeCompare(bStr) * dir;
		});

		return sorted;
	}

	private applyLimit(rows: ResultRow[], limit: number): ResultRow[] {
		return rows.slice(0, limit);
	}

	// ── Time bucketing ─────────────────────────────────

	private applyTimeBucket(
		rows: RawRow[],
		spec: TimeBucketSpec,
		query: AnalyticsQuery,
	): RawRow[] {
		const outputCol = spec.outputColumn ?? `${spec.column}_${spec.period}`;
		const localeId = this.findLocaleForColumn(spec.column, query);

		return rows.map((row) => {
			const raw = row[spec.column] ?? "";
			const parsed = parseDate(raw, localeId);
			const bucket = parsed ? bucketDate(parsed, spec.period) : "Unknown";
			return { ...row, [outputCol]: bucket };
		});
	}

	// ── Grouping and aggregation ───────────────────────

	private groupAndAggregate(
		rows: RawRow[],
		dimensions: DimensionSpec[],
		measures: MeasureSpec[],
		query: AnalyticsQuery,
	): { resultRows: ResultRow[]; groupCount: number } {
		// Build groups — include time bucket column in group key if present
		const groups = new Map<string, RawRow[]>();
		const timeBucketCol = query.timeBucket
			? (query.timeBucket.outputColumn ?? `${query.timeBucket.column}_${query.timeBucket.period}`)
			: null;

		for (const row of rows) {
			const keyParts = dimensions.map((d) => row[d.column] ?? "");
			if (timeBucketCol) keyParts.push(row[timeBucketCol] ?? "");
			const groupKey = keyParts.join("|||");
			if (!groups.has(groupKey)) groups.set(groupKey, []);
			groups.get(groupKey)!.push(row);
		}

		// Aggregate each group
		const resultRows: ResultRow[] = [];

		for (const [, groupRows] of groups) {
			const result: ResultRow = {};

			// Dimension values from first row
			for (const dim of dimensions) {
				result[dim.column] = groupRows[0][dim.column] ?? "";
			}

			// Time bucket column (if present and in dimensions via output column)
			if (query.timeBucket) {
				const outputCol =
					query.timeBucket.outputColumn ??
					`${query.timeBucket.column}_${query.timeBucket.period}`;
				result[outputCol] = groupRows[0][outputCol] ?? "";
			}

			// Measures
			for (const measure of measures) {
				const label = measure.label ?? `${measure.function}(${measure.column})`;
				result[label] = this.aggregate(
					groupRows,
					measure.column,
					measure.function,
					query,
				);
			}

			resultRows.push(result);
		}

		return { resultRows, groupCount: groups.size };
	}

	private aggregate(
		rows: RawRow[],
		column: string,
		fn: AggregationFunction,
		query: AnalyticsQuery,
	): number {
		if (fn === "COUNT") return rows.length;

		const localeId = this.findLocaleForColumn(column, query);
		const values: number[] = [];

		for (const row of rows) {
			const raw = row[column] ?? "";
			const num = parseNumber(raw, localeId);
			if (num !== null) values.push(num);
		}

		if (values.length === 0) return 0;

		switch (fn) {
			case "SUM":
				return values.reduce((a, b) => a + b, 0);
			case "AVG":
				return values.reduce((a, b) => a + b, 0) / values.length;
			case "MIN":
				return Math.min(...values);
			case "MAX":
				return Math.max(...values);
		}
	}

	// ── Computed columns ─────────────────────────────

	private applyComputedColumns(
		rows: ResultRow[],
		computedColumns: ComputedColumn[],
	): void {
		for (const row of rows) {
			for (const cc of computedColumns) {
				row[cc.name] = evaluateExpression(cc.expression, row);
			}
		}
	}

	// ── Helpers ────────────────────────────────────────

	/**
	 * Find the locale for a given column by checking which source contains it.
	 */
	private findLocaleForColumn(
		column: string,
		query: AnalyticsQuery,
	): AnalyticsQuery["sources"][0]["locale"] {
		for (const source of query.sources) {
			if (source.data.headers.includes(column)) {
				return source.locale;
			}
		}
		return undefined;
	}

	/**
	 * Auto-detect column types from sample data.
	 * Scans first 10 non-empty values per column and guesses the type.
	 */
	static detectColumnTypes(
		headers: string[],
		rows: string[][],
		localeId?: string,
	): ColumnTypeHint[] {
		const hints: ColumnTypeHint[] = [];
		const sampleSize = Math.min(rows.length, 10);

		for (let col = 0; col < headers.length; col++) {
			const samples: string[] = [];
			for (let row = 0; row < sampleSize; row++) {
				const val = rows[row]?.[col]?.trim();
				if (val) samples.push(val);
			}

			const type = guessColumnType(samples, localeId);
			hints.push({ column: headers[col], type });
		}

		return hints;
	}
}

/**
 * Evaluate an arithmetic expression with {Column Label} references.
 * Supports +, -, *, / with standard operator precedence.
 * Returns 0 for invalid expressions or division by zero.
 */
export function evaluateExpression(expression: string, row: ResultRow): number {
	if (!expression.trim()) return 0;

	// Replace {Column Label} references with numeric values
	const substituted = expression.replace(/\{([^}]+)\}/g, (_, label: string) => {
		const val = row[label.trim()];
		if (typeof val === "number") return String(val);
		const num = parseFloat(String(val ?? ""));
		return isNaN(num) ? "0" : String(num);
	});

	// Tokenize into numbers and operators
	const tokens = tokenizeArithmetic(substituted);
	if (tokens.length === 0) return 0;

	return calculateWithPrecedence(tokens);
}

/** Token: either a number or an operator */
type ArithToken = { type: "num"; value: number } | { type: "op"; value: string };

/** Tokenize a string like "100 - 50 * 2" into numbers and operators. */
function tokenizeArithmetic(expr: string): ArithToken[] {
	const tokens: ArithToken[] = [];
	let i = 0;
	const s = expr.trim();

	while (i < s.length) {
		// Skip whitespace
		if (s[i] === " " || s[i] === "\t") { i++; continue; }

		// Operator
		if (s[i] === "+" || s[i] === "-" || s[i] === "*" || s[i] === "/") {
			// Handle leading negative: treat as part of number if no preceding number
			if (s[i] === "-" && (tokens.length === 0 || tokens[tokens.length - 1].type === "op")) {
				const numStr = parseNumString(s, i);
				if (numStr.length > 1) {
					tokens.push({ type: "num", value: parseFloat(numStr) });
					i += numStr.length;
					continue;
				}
			}
			tokens.push({ type: "op", value: s[i] });
			i++;
			continue;
		}

		// Number
		if (isDigitOrDot(s[i])) {
			const numStr = parseNumString(s, i);
			tokens.push({ type: "num", value: parseFloat(numStr) });
			i += numStr.length;
			continue;
		}

		// Skip unknown characters
		i++;
	}

	return tokens;
}

function isDigitOrDot(ch: string): boolean {
	return (ch >= "0" && ch <= "9") || ch === ".";
}

function parseNumString(s: string, start: number): string {
	let i = start;
	if (s[i] === "-" || s[i] === "+") i++;
	while (i < s.length && (isDigitOrDot(s[i]) || s[i] === "e" || s[i] === "E")) i++;
	return s.substring(start, i);
}

/** Evaluate tokens with operator precedence: * / before + - */
function calculateWithPrecedence(tokens: ArithToken[]): number {
	if (tokens.length === 0) return 0;

	// Collect numbers and operators
	const nums: number[] = [];
	const ops: string[] = [];

	for (const t of tokens) {
		if (t.type === "num") nums.push(t.value);
		else ops.push(t.value);
	}

	// If mismatched, return first number or 0
	if (nums.length === 0) return 0;
	if (ops.length < nums.length - 1) return nums[0];

	// Pass 1: handle * and /
	const nums2: number[] = [nums[0]];
	const ops2: string[] = [];

	for (let i = 0; i < ops.length; i++) {
		if (ops[i] === "*" || ops[i] === "/") {
			const left = nums2.pop()!;
			const right = nums[i + 1] ?? 0;
			if (ops[i] === "*") {
				nums2.push(left * right);
			} else {
				nums2.push(right === 0 ? 0 : left / right);
			}
		} else {
			ops2.push(ops[i]);
			nums2.push(nums[i + 1] ?? 0);
		}
	}

	// Pass 2: handle + and -
	let result = nums2[0];
	for (let i = 0; i < ops2.length; i++) {
		if (ops2[i] === "+") result += nums2[i + 1] ?? 0;
		else if (ops2[i] === "-") result -= nums2[i + 1] ?? 0;
	}

	return isNaN(result) || !isFinite(result) ? 0 : result;
}

/**
 * Guess a column's type from sample values.
 */
function guessColumnType(
	samples: string[],
	_localeId?: string,
): "number" | "date" | "string" {
	if (samples.length === 0) return "string";

	let numericCount = 0;
	let dateCount = 0;

	for (const s of samples) {
		// Check if it looks like a number (digits, separators, optional sign)
		if (/^[-+]?[\d.,\s\u00A0]+$/.test(s) && /\d/.test(s)) {
			numericCount++;
		}
		// Check if it looks like a date (various patterns)
		if (
			/^\d{1,2}[/.]\d{1,2}[/.]\d{4}$/.test(s) ||
			/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)
		) {
			dateCount++;
		}
	}

	const threshold = samples.length * 0.7;
	if (dateCount >= threshold) return "date";
	if (numericCount >= threshold) return "number";
	return "string";
}
