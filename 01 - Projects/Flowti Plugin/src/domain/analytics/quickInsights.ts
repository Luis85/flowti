/**
 * Quick Insights — auto-suggested queries based on detected column types.
 *
 * Pure function: takes column type hints + headers → returns up to 6 suggestions.
 * Rules:
 *   1. First text column as dimension + first numeric column SUM → "Total [numeric] by [text]"
 *   2. First text column as dimension + COUNT → "Count by [text]"
 *   3. If date column detected → first numeric SUM + time bucket month → "[numeric] over time"
 *   4. First text + first numeric AVG → "Average [numeric] by [text]"
 *   5. First text + first numeric SUM + limit 5 + desc sort → "Top 5 [text] by [numeric]"
 *   6. If 2+ text columns → COUNT grouped by both → "Distribution of [text1] × [text2]"
 */

import type { ColumnTypeHint, DimensionSpec, MeasureSpec, SortSpec, TimeBucketSpec } from "./types";

/** A quick insight suggestion that can populate the query builder. */
export interface QuickInsightSuggestion {
	/** Display title for the suggestion card */
	title: string;
	/** Short description of what this query shows */
	description: string;
	/** Dimensions to set in the query builder */
	dimensions: DimensionSpec[];
	/** Measures to set in the query builder */
	measures: MeasureSpec[];
	/** Optional time bucket to set */
	timeBucket?: TimeBucketSpec;
	/** Optional sort to set */
	sort?: SortSpec[];
	/** Optional limit to set */
	limit?: number;
}

/**
 * Generate up to 3 quick insight suggestions based on detected column types.
 * Returns empty array if fewer than 2 columns or no useful combinations found.
 */
interface ColumnContext {
	firstText: ColumnTypeHint | undefined;
	firstNum: ColumnTypeHint | undefined;
	firstDate: ColumnTypeHint | undefined;
	textCols: ColumnTypeHint[];
}

/** Each rule is a function that may push a suggestion. */
type InsightRule = (ctx: ColumnContext) => QuickInsightSuggestion | null;

const insightRules: InsightRule[] = [
	// Rule 1: "Total [numeric] by [text]" — SUM
	({ firstText, firstNum }) => firstText && firstNum ? {
		title: `Total ${firstNum.column} by ${firstText.column}`,
		description: `SUM of ${firstNum.column}, grouped by ${firstText.column}`,
		dimensions: [{ column: firstText.column }],
		measures: [{ column: firstNum.column, function: "SUM" }],
	} : null,
	// Rule 2: "Count by [text]" — COUNT
	({ firstText, firstNum, firstDate }) => firstText && (firstNum || firstDate) ? {
		title: `Count by ${firstText.column}`,
		description: `Number of records per ${firstText.column}`,
		dimensions: [{ column: firstText.column }],
		measures: [{ column: (firstNum?.column ?? firstText.column), function: "COUNT" }],
	} : null,
	// Rule 3: "[numeric] over time" — SUM + time bucket
	({ firstNum, firstDate }) => firstDate && firstNum ? {
		title: `${firstNum.column} over time`,
		description: `Monthly ${firstNum.column} trend`,
		dimensions: [],
		measures: [{ column: firstNum.column, function: "SUM" }],
		timeBucket: { column: firstDate.column, period: "month" },
	} : null,
	// Rule 4: "Average [numeric] by [text]" — AVG
	({ firstText, firstNum }) => firstText && firstNum ? {
		title: `Average ${firstNum.column} by ${firstText.column}`,
		description: `AVG of ${firstNum.column}, grouped by ${firstText.column}`,
		dimensions: [{ column: firstText.column }],
		measures: [{ column: firstNum.column, function: "AVG" }],
	} : null,
	// Rule 5: "Top 5 [text] by [numeric]" — SUM + limit + sort desc
	({ firstText, firstNum }) => firstText && firstNum ? {
		title: `Top 5 ${firstText.column} by ${firstNum.column}`,
		description: `Highest ${firstNum.column} entries`,
		dimensions: [{ column: firstText.column }],
		measures: [{ column: firstNum.column, function: "SUM" }],
		sort: [{ column: `SUM(${firstNum.column})`, direction: "desc" }],
		limit: 5,
	} : null,
	// Rule 6: "Distribution of [text1] × [text2]" — COUNT grouped by two text columns
	({ textCols, firstNum }) => textCols.length >= 2 ? {
		title: `Distribution of ${textCols[0].column} × ${textCols[1].column}`,
		description: `Count per ${textCols[0].column} and ${textCols[1].column} combination`,
		dimensions: [{ column: textCols[0].column }, { column: textCols[1].column }],
		measures: [{ column: (firstNum?.column ?? textCols[0].column), function: "COUNT" }],
	} : null,
];

export function generateQuickInsights(
	columnTypeHints: ColumnTypeHint[],
	_headers: string[],
): QuickInsightSuggestion[] {
	if (columnTypeHints.length < 2) return [];

	const textCols = columnTypeHints.filter((h) => h.type === "string");
	const numCols = columnTypeHints.filter((h) => h.type === "number");
	const dateCols = columnTypeHints.filter((h) => h.type === "date");

	const ctx: ColumnContext = {
		firstText: textCols[0],
		firstNum: numCols[0],
		firstDate: dateCols[0],
		textCols,
	};

	const suggestions: QuickInsightSuggestion[] = [];
	for (const rule of insightRules) {
		const suggestion = rule(ctx);
		if (suggestion) suggestions.push(suggestion);
	}

	return suggestions.slice(0, 6);
}
