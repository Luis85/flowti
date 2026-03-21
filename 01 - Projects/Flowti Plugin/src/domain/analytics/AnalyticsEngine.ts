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
	ColumnType,
	ColumnTypeHint,
	ComputedColumn,
	DimensionSpec,
	FilterSpec,
	JoinSpec,
	MeasureSpec,
	QueryDateRangeFilter,
	ResultRow,
	SortSpec,
	TimeBucketSpec,
} from "./types";
import { parseNumber } from "./localeUtils";
import { bucketDate, isDateInRange, parseDate } from "./dateUtils";
import { JoinExecutor, type RawRow } from "./JoinExecutor";
import { hasWindowFunction, evaluateExpression, applyWindowColumn, guessColumnType } from "./expressionEvaluator";

// Re-export for backward compatibility — tests and other modules import from this file
export { evaluateExpression } from "./expressionEvaluator";

/** Compare two values (number or string) using an operator. */
function compareValues<T extends string | number>(left: T, op: string, right: T): boolean {
	switch (op) {
		case "=": return left === right;
		case "!=": return left !== right;
		case ">": return left > right;
		case "<": return left < right;
		case ">=": return left >= right;
		case "<=": return left <= right;
		default: return left === right;
	}
}

export class AnalyticsEngine {
	private readonly joinExecutor = new JoinExecutor();
	/**
	 * Execute an analytics query and return the result.
	 */
	run(query: AnalyticsQuery): AnalyticsResult {
		const rows = this.loadAndFilterRows(query);
		const sourceRowCount = rows.sourceRowCount;

		// GROUP BY + aggregate
		const { resultRows, groupCount } = this.groupAndAggregate(
			rows.filtered,
			query.dimensions,
			query.measures,
			query,
		);

		// Apply computed columns (after aggregation)
		if (query.computedColumns && query.computedColumns.length > 0) {
			this.applyComputedColumns(resultRows, query.computedColumns, query.measures);
		}

		// Sort + limit
		let sortedRows = resultRows;
		if (query.sort && query.sort.length > 0) sortedRows = this.applySort(sortedRows, query.sort);
		if (query.limit !== undefined && query.limit >= 0) sortedRows = this.applyLimit(sortedRows, query.limit);

		return this.buildResult(query, sortedRows, groupCount, sourceRowCount);
	}

	/** Load sources, apply joins, date range filter, row filters, and time bucketing. */
	private loadAndFilterRows(query: AnalyticsQuery): { filtered: RawRow[]; sourceRowCount: number } {
		const sourceTables = this.buildSourceTables(query.sources);
		let rows: RawRow[] = query.sources.length === 1
			? (sourceTables.get(query.sources[0].alias) ?? [])
			: this.applyJoins(sourceTables, query.joins);
		const sourceRowCount = rows.length;
		if (query.dateRangeFilter) rows = this.applyDateRangeFilter(rows, query.dateRangeFilter, query);
		if (query.filters && query.filters.length > 0) rows = this.applyFilters(rows, query.filters, query);
		if (query.timeBucket) rows = this.applyTimeBucket(rows, query.timeBucket, query);
		return { filtered: rows, sourceRowCount };
	}

	/** Build final result: columns, aliases, currency hints, anonymization. */
	private buildResult(
		query: AnalyticsQuery, sortedRows: ResultRow[],
		groupCount: number, sourceRowCount: number,
	): AnalyticsResult {
		const allColumns = this.buildColumnList(query);
		const excludeSet = query.excludedColumns?.length ? new Set(query.excludedColumns) : null;
		const columns = excludeSet ? allColumns.filter((c) => !excludeSet.has(c)) : allColumns;
		const augmentedHints = this.augmentCurrencyHints(query);
		const aliasMap = this.buildAliasMap(query);
		let finalColumns = columns;
		let finalRows = sortedRows;
		if (aliasMap.size > 0) {
			finalColumns = columns.map((c) => aliasMap.get(c) ?? c);
			finalRows = this.applyAliases(sortedRows, columns, aliasMap);
		}
		finalRows = this.anonymizePrivateColumns(finalRows, finalColumns, query.columnTypeHints ?? []);
		return { columns: finalColumns, rows: finalRows, groupCount, sourceRowCount, columnTypeHints: augmentedHints };
	}

	private buildColumnList(query: AnalyticsQuery): string[] {
		return [
			...(query.timeBucket ? [query.timeBucket.outputColumn ?? `${query.timeBucket.column}_${query.timeBucket.period}`] : []),
			...query.dimensions.map((d) => d.column),
			...query.measures.map((m) => m.label ?? `${m.function}(${m.column})`),
			...(query.computedColumns ?? []).map((c) => c.name),
		];
	}

	private augmentCurrencyHints(query: AnalyticsQuery): ColumnTypeHint[] {
		const hintMap = new Map<string, ColumnTypeHint>();
		for (const h of query.columnTypeHints ?? []) hintMap.set(h.column, h);
		const augmented = [...(query.columnTypeHints ?? [])];
		for (const m of query.measures) {
			const label = m.label ?? `${m.function}(${m.column})`;
			const src = hintMap.get(m.column);
			if (src?.currencySymbol && !hintMap.has(label)) {
				augmented.push({ column: label, type: "number", currencySymbol: src.currencySymbol });
			}
		}
		return augmented;
	}

	private buildAliasMap(query: AnalyticsQuery): Map<string, string> {
		const aliasMap = new Map<string, string>();
		for (const hint of query.columnTypeHints ?? []) {
			if (hint.alias && hint.alias.trim()) aliasMap.set(hint.column, hint.alias.trim());
		}
		return aliasMap;
	}

	private applyAliases(rows: ResultRow[], columns: string[], aliasMap: Map<string, string>): ResultRow[] {
		return rows.map((row) => {
			const newRow: ResultRow = {};
			for (const col of columns) newRow[aliasMap.get(col) ?? col] = row[col];
			for (const key of Object.keys(row)) {
				if (!columns.includes(key) && !(aliasMap.get(key))) newRow[key] = row[key];
			}
			return newRow;
		});
	}

	// ── Private column anonymization ───────────────────

	private anonymizePrivateColumns(
		rows: ResultRow[],
		columns: string[],
		hints: ColumnTypeHint[],
	): ResultRow[] {
		// Build map of private column display names → type hint
		const privateColTypes = new Map<string, ColumnType>();
		for (const h of hints) {
			if (!h.isPrivate) continue;
			const displayName = h.alias?.trim() || h.column;
			if (columns.includes(displayName)) privateColTypes.set(displayName, h.type);
		}
		if (privateColTypes.size === 0) return rows;

		// Per-column value → pseudonym mapping (consistent within this execution)
		const pseudonymMaps = new Map<string, Map<string | number, string | number>>();
		for (const col of privateColTypes.keys()) pseudonymMaps.set(col, new Map());

		return rows.map((row) => {
			const newRow: ResultRow = { ...row };
			for (const [col, hintType] of privateColTypes) {
				if (!(col in newRow)) continue;
				const val = newRow[col];
				// Numbers (by type hint or actual type) are zeroed out
				if (hintType === "number" || typeof val === "number") {
					newRow[col] = 0;
				} else {
					const map = pseudonymMaps.get(col)!;
					if (!map.has(val)) map.set(val, `Entity-${map.size + 1}`);
					newRow[col] = map.get(val)!;
				}
			}
			return newRow;
		});
	}

	// ── Source loading ──────────────────────────────────

	private buildSourceTables(sources: AnalyticsSource[]): Map<string, RawRow[]> {
		return this.joinExecutor.buildSourceTables(sources);
	}

	private applyJoins(tables: Map<string, RawRow[]>, joins: JoinSpec[]): RawRow[] {
		return this.joinExecutor.applyJoins(tables, joins);
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
		if (filter.operator === "contains") return raw.toLowerCase().includes(filterVal.toLowerCase());
		if (filter.operator === "startsWith") return raw.toLowerCase().startsWith(filterVal.toLowerCase());
		const localeId = this.findLocaleForColumn(filter.column, query);
		const numRow = parseNumber(raw, localeId);
		const numFilter = parseFloat(filterVal);
		if (numRow !== null && !isNaN(numFilter)) return compareValues(numRow, filter.operator, numFilter);
		return compareValues(raw, filter.operator, filterVal);
	}

	// ── Date range filtering ─────────────────────────

	private applyDateRangeFilter(
		rows: RawRow[],
		filter: QueryDateRangeFilter,
		query: AnalyticsQuery,
	): RawRow[] {
		// Skip filtering if the column doesn't exist in any source's data.
		// This handles multi-query dashboards where the selected date column
		// exists in some queries but not others.
		const columnInData = query.sources.some((s) => s.data.headers.includes(filter.column));
		if (!columnInData) return rows;

		const localeId = this.findLocaleForColumn(filter.column, query);
		return rows.filter((row) => {
			const raw = row[filter.column] ?? "";
			const parsed = parseDate(raw, localeId);
			if (!parsed) return false;
			return isDateInRange(parsed, filter.start, filter.end);
		});
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
		const groups = this.buildGroups(rows, dimensions, query);
		const hasComputedColumns = (query.computedColumns ?? []).length > 0;
		const resultRows: ResultRow[] = [];
		for (const [, groupRows] of groups) {
			resultRows.push(this.aggregateGroup(groupRows, dimensions, measures, query, hasComputedColumns));
		}
		return { resultRows, groupCount: groups.size };
	}

	private buildGroups(rows: RawRow[], dimensions: DimensionSpec[], query: AnalyticsQuery): Map<string, RawRow[]> {
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
		return groups;
	}

	private aggregateGroup(
		groupRows: RawRow[], dimensions: DimensionSpec[],
		measures: MeasureSpec[], query: AnalyticsQuery, hasComputedColumns: boolean,
	): ResultRow {
		const result: ResultRow = {};
		if (hasComputedColumns) {
			for (const key of Object.keys(groupRows[0])) {
				const raw = groupRows[0][key];
				const num = parseNumber(raw, this.findLocaleForColumn(key, query));
				result[key] = num !== null ? num : raw;
			}
		}
		for (const dim of dimensions) result[dim.column] = groupRows[0][dim.column] ?? "";
		if (query.timeBucket) {
			const outputCol = query.timeBucket.outputColumn ?? `${query.timeBucket.column}_${query.timeBucket.period}`;
			result[outputCol] = groupRows[0][outputCol] ?? "";
		}
		for (const measure of measures) {
			const label = measure.label ?? `${measure.function}(${measure.column})`;
			result[label] = this.aggregate(groupRows, measure.column, measure.function, query);
		}
		return result;
	}

	private aggregate(
		rows: RawRow[],
		column: string,
		fn: AggregationFunction,
		query: AnalyticsQuery,
	): number {
		if (fn === "COUNT") return rows.length;

		if (fn === "COUNT_DISTINCT") {
			const seen = new Set<string>();
			for (const row of rows) seen.add(String(row[column] ?? ""));
			return seen.size;
		}

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

// Expression evaluation, window functions, and guessColumnType are in ./expressionEvaluator
