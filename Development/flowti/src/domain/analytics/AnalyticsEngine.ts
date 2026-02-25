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
	WindowFunctionName,
} from "./types";
import { parseNumber } from "./localeUtils";
import { bucketDate, parseDate } from "./dateUtils";
import { computeChange, computePctChange, computeRollingAvg } from "./trendCalculations";
import { evalRound, evalAbs, evalIf } from "./expressionFunctions";

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
			this.applyComputedColumns(resultRows, query.computedColumns, query.measures);
		}

		// 7. Apply sort (after aggregation) — multi-column sort
		let sortedRows = resultRows;
		if (query.sort && query.sort.length > 0) {
			sortedRows = this.applySort(sortedRows, query.sort);
		}

		// 8. Apply limit (after sorting)
		if (query.limit !== undefined && query.limit >= 0) {
			sortedRows = this.applyLimit(sortedRows, query.limit);
		}

		// 9. Build column list (time bucket first when present)
		const columns = [
			...(query.timeBucket
				? [query.timeBucket.outputColumn ?? `${query.timeBucket.column}_${query.timeBucket.period}`]
				: []),
			...query.dimensions.map((d) => d.column),
			...query.measures.map((m) => m.label ?? `${m.function}(${m.column})`),
			...(query.computedColumns ?? []).map((c) => c.name),
		];

		return {
			columns,
			rows: sortedRows,
			groupCount,
			sourceRowCount,
			columnTypeHints: query.columnTypeHints,
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

	private applySort(rows: ResultRow[], sorts: SortSpec[]): ResultRow[] {
		const sorted = [...rows];

		sorted.sort((a, b) => {
			for (const sort of sorts) {
				const col = sort.column;
				const dir = sort.direction === "asc" ? 1 : -1;
				const aVal = a[col];
				const bVal = b[col];

				let cmp: number;
				if (typeof aVal === "number" && typeof bVal === "number") {
					cmp = (aVal - bVal) * dir;
				} else {
					const aStr = String(aVal ?? "");
					const bStr = String(bVal ?? "");
					cmp = aStr.localeCompare(bStr) * dir;
				}

				if (cmp !== 0) return cmp;
			}
			return 0;
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
		const hasComputedColumns = (query.computedColumns ?? []).length > 0;

		for (const [, groupRows] of groups) {
			const result: ResultRow = {};

			// Carry forward raw column values from first row when computed columns
			// need them. Parsed as numbers when possible so expressions work.
			if (hasComputedColumns) {
				for (const key of Object.keys(groupRows[0])) {
					const raw = groupRows[0][key];
					const num = parseNumber(raw, this.findLocaleForColumn(key, query));
					result[key] = num !== null ? num : raw;
				}
			}

			// Dimension values from first row (override raw passthrough)
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

			// Measures (override raw passthrough with aggregated values)
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
		measures: MeasureSpec[],
	): void {
		// Inject raw-column-name aliases so {quantity} resolves to the value
		// of SUM(quantity) (or whichever aggregation targets that column).
		const measureAliases = new Map<string, string>();
		for (const m of measures) {
			const label = m.label ?? `${m.function}(${m.column})`;
			if (!measureAliases.has(m.column)) {
				measureAliases.set(m.column, label);
			}
		}
		if (measureAliases.size > 0) {
			for (const row of rows) {
				for (const [col, label] of measureAliases) {
					// Always override raw values with aggregated measure values
					if (row[label] !== undefined) {
						row[col] = row[label];
					}
				}
			}
		}

		// Pass 1: per-row evaluation (arithmetic + scalar functions)
		for (const row of rows) {
			for (const cc of computedColumns) {
				if (!hasWindowFunction(cc.expression)) {
					row[cc.name] = evaluateExpression(cc.expression, row);
				}
			}
		}

		// Pass 2: window functions (need full result set context)
		for (const cc of computedColumns) {
			if (hasWindowFunction(cc.expression)) {
				applyWindowColumn(rows, cc);
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

			const result = guessColumnType(samples, localeId);
			hints.push({ column: headers[col], type: result.type, currencySymbol: result.currencySymbol });
		}

		return hints;
	}
}

/** Known function names for detection. */
const WINDOW_FUNCTIONS: Set<string> = new Set(["CHANGE", "PCT_CHANGE", "ROLLING_AVG"]);

/** Check whether an expression contains any window function calls. */
function hasWindowFunction(expression: string): boolean {
	return WINDOW_FUNCTIONS.has(extractOuterFunctionName(expression)) ||
		/\b(CHANGE|PCT_CHANGE|ROLLING_AVG)\s*\(/.test(expression);
}

/** Extract the outer function name if the expression is a bare function call. */
function extractOuterFunctionName(expression: string): string {
	const match = expression.trim().match(/^([A-Z_]+)\s*\(/);
	return match ? match[1] : "";
}

/**
 * Extract a window function call from an expression, handling {Column(Name)} refs with parens.
 * Returns the function name, args string, and the full matched text for substitution.
 */
function extractWindowFunction(expression: string): { funcName: WindowFunctionName; argsStr: string; fullMatch: string } | null {
	// Find the start of a window function
	const startMatch = expression.match(/\b(CHANGE|PCT_CHANGE|ROLLING_AVG)\s*\(/);
	if (!startMatch || startMatch.index === undefined) return null;

	const funcName = startMatch[1] as WindowFunctionName;
	const argsStart = startMatch.index + startMatch[0].length;

	// Walk forward tracking brace and paren depth to find the matching close paren
	let depth = 1;
	let braceDepth = 0;
	let i = argsStart;
	while (i < expression.length && depth > 0) {
		const ch = expression[i];
		if (ch === "{") braceDepth++;
		else if (ch === "}") braceDepth--;
		else if (braceDepth === 0) {
			if (ch === "(") depth++;
			else if (ch === ")") depth--;
		}
		if (depth > 0) i++;
	}

	if (depth !== 0) return null;

	const argsStr = expression.substring(argsStart, i);
	const fullMatch = expression.substring(startMatch.index, i + 1);
	return { funcName, argsStr, fullMatch };
}

/**
 * Extract a scalar function call from an expression, handling {Column(Name)} refs.
 * Finds the innermost scalar function (one whose args contain no un-braced nested scalar calls).
 */
function extractScalarFunction(expression: string): { funcName: string; argsStr: string; fullMatch: string } | null {
	const startMatch = expression.match(/\b(ROUND|ABS|IF)\s*\(/);
	if (!startMatch || startMatch.index === undefined) return null;

	const funcName = startMatch[1];
	const argsStart = startMatch.index + startMatch[0].length;

	let depth = 1;
	let braceDepth = 0;
	let i = argsStart;
	while (i < expression.length && depth > 0) {
		const ch = expression[i];
		if (ch === "{") braceDepth++;
		else if (ch === "}") braceDepth--;
		else if (braceDepth === 0) {
			if (ch === "(") depth++;
			else if (ch === ")") depth--;
		}
		if (depth > 0) i++;
	}

	if (depth !== 0) return null;

	const argsStr = expression.substring(argsStart, i);
	const fullMatch = expression.substring(startMatch.index, i + 1);

	// Check if this is truly "innermost" — args should not contain un-braced ROUND/ABS/IF calls
	// If they do, we need to find that inner call instead
	const innerCheck = extractScalarFunction(argsStr);
	if (innerCheck) {
		// Recurse into the inner call — adjust positions
		return {
			funcName: innerCheck.funcName,
			argsStr: innerCheck.argsStr,
			fullMatch: innerCheck.fullMatch,
		};
	}

	return { funcName, argsStr, fullMatch };
}

/**
 * Apply a window-function computed column to the full result set.
 * Supports standalone: `CHANGE({col})` and nested: `ROUND(PCT_CHANGE({col}), 1)`.
 */
function applyWindowColumn(rows: ResultRow[], cc: ComputedColumn): void {
	// Find the window function call — must handle {SUM(Revenue)} column refs with parens
	const parsed = extractWindowFunction(cc.expression);
	if (!parsed) {
		// Fallback: treat as per-row expression
		for (const row of rows) {
			row[cc.name] = evaluateExpression(cc.expression, row);
		}
		return;
	}

	const { funcName, argsStr, fullMatch } = parsed;
	const args = splitFunctionArgs(argsStr);

	// Resolve column reference from first arg
	const colRef = args[0]?.trim().replace(/^\{|\}$/g, "") ?? "";

	// Compute window values
	let windowValues: Array<number | null>;
	switch (funcName) {
		case "CHANGE":
			windowValues = computeChange(rows, colRef);
			break;
		case "PCT_CHANGE":
			windowValues = computePctChange(rows, colRef);
			break;
		case "ROLLING_AVG": {
			const windowSize = parseInt(args[1]?.trim() ?? "3", 10);
			windowValues = computeRollingAvg(rows, colRef, isNaN(windowSize) ? 3 : windowSize);
			break;
		}
	}

	// Check if the window function is wrapped in scalar functions
	const isWrapped = cc.expression.trim() !== fullMatch;

	for (let i = 0; i < rows.length; i++) {
		const wv = windowValues[i];
		if (wv === null) {
			rows[i][cc.name] = null as unknown as string | number;
		} else if (isWrapped) {
			// Substitute the window function result back into the expression, then evaluate scalars
			const substituted = cc.expression.replace(fullMatch, String(wv));
			rows[i][cc.name] = evaluateExpression(substituted, rows[i]);
		} else {
			rows[i][cc.name] = wv;
		}
	}
}

/**
 * Evaluate an expression with {Column Label} references, arithmetic, and scalar functions.
 * Supports +, -, *, / with standard operator precedence.
 * Scalar functions: ROUND(val, n), ABS(val), IF(cond, then, else).
 * Returns string | number (IF can return string values).
 */
export function evaluateExpression(expression: string, row: ResultRow): string | number {
	if (!expression.trim()) return 0;

	// Process scalar function calls inside-out (innermost first)
	let processed = expression;
	let iterations = 0;
	const MAX_ITERATIONS = 20;

	while (iterations < MAX_ITERATIONS) {
		// Find innermost scalar function call (respects {Column(Name)} refs with parens)
		const extracted = extractScalarFunction(processed);
		if (!extracted) break;

		const { funcName, argsStr, fullMatch } = extracted;
		const args = splitFunctionArgs(argsStr);

		let result: string | number;
		switch (funcName) {
			case "ROUND": result = evalRound(args, row); break;
			case "ABS": result = evalAbs(args, row); break;
			case "IF": result = evalIf(args, row); break;
			default: result = 0;
		}

		// Substitute the function call with the result
		if (typeof result === "string") {
			processed = processed.replace(fullMatch, `"${result}"`);
		} else {
			processed = processed.replace(fullMatch, String(result));
		}
		iterations++;
	}

	// Check if the result is a quoted string (from IF)
	const trimmed = processed.trim();
	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return trimmed.slice(1, -1);
	}

	// Replace {Column Label} references with numeric values
	const substituted = processed.replace(/\{([^}]+)\}/g, (_, label: string) => {
		const key = label.trim();
		let val = row[key];

		// Fallback: if exact key not found, look for aggregated label like SUM(key), AVG(key), etc.
		if (val === undefined) {
			for (const rk of Object.keys(row)) {
				if (rk.endsWith(`(${key})`)) {
					val = row[rk];
					break;
				}
			}
		}

		if (typeof val === "number") return String(val);
		const num = parseFloat(String(val ?? ""));
		return isNaN(num) ? "0" : String(num);
	});

	// Tokenize into numbers and operators
	const tokens = tokenizeArithmetic(substituted);
	if (tokens.length === 0) return 0;

	return calculateWithPrecedence(tokens);
}

/** Split function arguments respecting nested parentheses and quoted strings. */
function splitFunctionArgs(argsStr: string): string[] {
	const args: string[] = [];
	let depth = 0;
	let current = "";
	let inQuote = false;
	let quoteChar = "";

	for (let i = 0; i < argsStr.length; i++) {
		const ch = argsStr[i];

		if (inQuote) {
			current += ch;
			if (ch === quoteChar) inQuote = false;
			continue;
		}

		if (ch === '"' || ch === "'") {
			inQuote = true;
			quoteChar = ch;
			current += ch;
			continue;
		}

		if (ch === "(") { depth++; current += ch; continue; }
		if (ch === ")") { depth--; current += ch; continue; }
		if (ch === "," && depth === 0) {
			args.push(current);
			current = "";
			continue;
		}
		current += ch;
	}

	if (current.trim()) args.push(current);
	return args;
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
): { type: "number" | "date" | "string"; currencySymbol?: string } {
	if (samples.length === 0) return { type: "string" };

	let numericCount = 0;
	let dateCount = 0;
	let detectedSymbol: string | undefined;

	for (const s of samples) {
		// Detect currency symbol prefix
		const symbolMatch = s.match(/^[€$£¥₹]/);
		if (symbolMatch) detectedSymbol = symbolMatch[0];

		// Strip currency symbols before number check (same as parseNumber)
		const stripped = s.replace(/[€$£¥₹]/g, "").trim();
		// Check if it looks like a number (digits, separators, optional sign)
		if (/^[-+]?[\d.,\s\u00A0]+$/.test(stripped) && /\d/.test(stripped)) {
			numericCount++;
		}
		// Check if it looks like a date (various patterns incl. dash-separated)
		if (
			/^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(s) ||
			/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)
		) {
			dateCount++;
		}
	}

	// Date patterns are unambiguous — use lower threshold (50%)
	const dateThreshold = samples.length * 0.5;
	if (dateCount >= dateThreshold) return { type: "date" };
	const threshold = samples.length * 0.7;
	if (numericCount >= threshold) return { type: "number", currencySymbol: detectedSymbol };
	return { type: "string" };
}
