/**
 * Quick Insights — auto-suggested queries based on detected column types.
 *
 * Pure function: takes column type hints + headers → returns up to 3 suggestions.
 * Rules:
 *   1. First text column as dimension + first numeric column SUM → "Total [numeric] by [text]"
 *   2. First text column as dimension + COUNT → "Count by [text]"
 *   3. If date column detected → first numeric SUM + time bucket month → "[numeric] over time"
 */

import type { ColumnTypeHint, DimensionSpec, MeasureSpec, TimeBucketSpec } from "./types";

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
}

/**
 * Generate up to 3 quick insight suggestions based on detected column types.
 * Returns empty array if fewer than 2 columns or no useful combinations found.
 */
export function generateQuickInsights(
	columnTypeHints: ColumnTypeHint[],
	_headers: string[],
): QuickInsightSuggestion[] {
	if (columnTypeHints.length < 2) return [];

	const textCols = columnTypeHints.filter((h) => h.type === "string");
	const numCols = columnTypeHints.filter((h) => h.type === "number");
	const dateCols = columnTypeHints.filter((h) => h.type === "date");

	const suggestions: QuickInsightSuggestion[] = [];

	const firstText = textCols[0];
	const firstNum = numCols[0];
	const firstDate = dateCols[0];

	// Rule 1: "Total [numeric] by [text]" — SUM
	if (firstText && firstNum) {
		suggestions.push({
			title: `Total ${firstNum.column} by ${firstText.column}`,
			description: `SUM of ${firstNum.column}, grouped by ${firstText.column}`,
			dimensions: [{ column: firstText.column }],
			measures: [{ column: firstNum.column, function: "SUM" }],
		});
	}

	// Rule 2: "Count by [text]" — COUNT
	if (firstText && (firstNum || dateCols.length > 0)) {
		const countCol = firstNum?.column ?? firstText.column;
		suggestions.push({
			title: `Count by ${firstText.column}`,
			description: `Number of records per ${firstText.column}`,
			dimensions: [{ column: firstText.column }],
			measures: [{ column: countCol, function: "COUNT" }],
		});
	}

	// Rule 3: "[numeric] over time" — SUM + time bucket
	if (firstDate && firstNum) {
		suggestions.push({
			title: `${firstNum.column} over time`,
			description: `Monthly ${firstNum.column} trend`,
			dimensions: [],
			measures: [{ column: firstNum.column, function: "SUM" }],
			timeBucket: { column: firstDate.column, period: "month" },
		});
	}

	return suggestions.slice(0, 3);
}
