/**
 * Scalar function implementations for computed column expressions.
 *
 * These are evaluated per-row in the first pass of the expression pipeline:
 * - ROUND(value, decimals) — round to N decimal places
 * - ABS(value) — absolute value
 * - IF(condition, thenValue, elseValue) — conditional logic
 *
 * IF can return string values (e.g., "Low", "High"), broadening the computed
 * column contract from number-only to string | number.
 */

import type { ResultRow } from "./types";

/** Evaluate ROUND(value, decimals). Returns a number rounded to the specified decimal places. */
export function evalRound(args: string[], row: ResultRow): number {
	const val = resolveNumericArg(args[0], row);
	const decimals = parseInt(args[1]?.trim() ?? "0", 10);
	return isNaN(val) ? 0 : Number(val.toFixed(isNaN(decimals) ? 0 : decimals));
}

/** Evaluate ABS(value). Returns the absolute value. */
export function evalAbs(args: string[], row: ResultRow): number {
	const val = resolveNumericArg(args[0], row);
	return isNaN(val) ? 0 : Math.abs(val);
}

/**
 * Evaluate IF(condition, thenValue, elseValue).
 * Condition: {column} op threshold (supports >, <, >=, <=, =, !=).
 * Then/else: string literal ("High"), number, or {column} reference.
 */
export function evalIf(args: string[], row: ResultRow): string | number {
	if (args.length < 3) return 0;

	const condition = args[0].trim();
	const thenVal = args[1].trim();
	const elseVal = args[2].trim();

	const condMatch = condition.match(/^(.+?)\s*(>=|<=|!=|>|<|=)\s*(.+)$/);
	if (!condMatch) return resolveValue(elseVal, row);

	const leftNum = resolveNumericArg(condMatch[1].trim(), row);
	const rightNum = resolveNumericArg(condMatch[3].trim(), row);

	if (isNaN(leftNum) || isNaN(rightNum)) return resolveValue(elseVal, row);

	let condResult = false;
	switch (condMatch[2]) {
		case ">": condResult = leftNum > rightNum; break;
		case "<": condResult = leftNum < rightNum; break;
		case ">=": condResult = leftNum >= rightNum; break;
		case "<=": condResult = leftNum <= rightNum; break;
		case "=": condResult = leftNum === rightNum; break;
		case "!=": condResult = leftNum !== rightNum; break;
	}

	return resolveValue(condResult ? thenVal : elseVal, row);
}

/** Resolve a then/else value — string literal, column ref, or number. */
function resolveValue(val: string, row: ResultRow): string | number {
	const trimmed = val.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		return trimmed.slice(1, -1);
	}
	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		const col = trimmed.slice(1, -1).trim();
		const v = row[col];
		if (typeof v === "number") return v;
		const n = parseFloat(String(v ?? ""));
		return isNaN(n) ? String(v ?? "") : n;
	}
	const n = parseFloat(trimmed);
	if (!isNaN(n)) return n;
	return trimmed;
}

/** Evaluate COALESCE(val1, val2, ...). Returns the first non-null/non-empty value. */
export function evalCoalesce(args: string[], row: ResultRow): string | number {
	for (const arg of args) {
		const val = resolveValue(arg, row);
		if (val !== null && val !== undefined && val !== "" && !(typeof val === "number" && isNaN(val))) {
			return val;
		}
	}
	return "";
}

/** Evaluate UPPER(value). Returns the string uppercased. */
export function evalUpper(args: string[], row: ResultRow): string {
	const val = resolveValue(args[0] ?? "", row);
	return String(val).toUpperCase();
}

/** Evaluate LOWER(value). Returns the string lowercased. */
export function evalLower(args: string[], row: ResultRow): string {
	const val = resolveValue(args[0] ?? "", row);
	return String(val).toLowerCase();
}

/** Evaluate CONCAT(val1, val2, ...). Concatenates all resolved values. */
export function evalConcat(args: string[], row: ResultRow): string {
	return args.map((a) => String(resolveValue(a, row))).join("");
}

/** Resolve an argument to a number (from column ref or literal). */
function resolveNumericArg(arg: string | undefined, row: ResultRow): number {
	if (!arg) return NaN;
	const trimmed = arg.trim();
	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		const col = trimmed.slice(1, -1).trim();
		let val = row[col];
		// Fallback: look for aggregated label like SUM(col), AVG(col), etc.
		if (val === undefined) {
			for (const rk of Object.keys(row)) {
				if (rk.endsWith(`(${col})`)) { val = row[rk]; break; }
			}
		}
		if (typeof val === "number") return val;
		return parseFloat(String(val ?? ""));
	}
	return parseFloat(trimmed);
}
