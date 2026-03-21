/**
 * Expression evaluation for computed columns.
 *
 * Handles {Column} references, arithmetic with operator precedence,
 * scalar functions (ROUND, ABS, IF, etc.), and window functions
 * (CHANGE, PCT_CHANGE, ROLLING_AVG).
 *
 * Extracted from AnalyticsEngine to reduce its LOC.
 */

import type { ComputedColumn, ResultRow, WindowFunctionName } from "./types";
import { evalRound, evalAbs, evalIf, evalCoalesce, evalUpper, evalLower, evalConcat } from "./expressionFunctions";
import { computeChange, computePctChange, computeRollingAvg } from "./trendCalculations";

// ── Window function detection ─────────────────────────────

const WINDOW_FUNCTIONS: Set<string> = new Set(["CHANGE", "PCT_CHANGE", "ROLLING_AVG"]);

function extractOuterFunctionName(expression: string): string {
	const match = expression.trim().match(/^([A-Z_]+)\s*\(/);
	return match ? match[1] : "";
}

/** Check whether an expression contains any window function calls. */
export function hasWindowFunction(expression: string): boolean {
	return WINDOW_FUNCTIONS.has(extractOuterFunctionName(expression)) ||
		/\b(CHANGE|PCT_CHANGE|ROLLING_AVG)\s*\(/.test(expression);
}

// ── Bracket-aware function extraction ─────────────────────

/** Walk expression tracking brace/paren depth to extract function args. */
function findMatchingParen(expression: string, argsStart: number): number {
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
	return depth === 0 ? i : -1;
}

export function extractWindowFunction(expression: string): { funcName: WindowFunctionName; argsStr: string; fullMatch: string } | null {
	const startMatch = expression.match(/\b(CHANGE|PCT_CHANGE|ROLLING_AVG)\s*\(/);
	if (!startMatch || startMatch.index === undefined) return null;
	const funcName = startMatch[1] as WindowFunctionName;
	const argsStart = startMatch.index + startMatch[0].length;
	const endIdx = findMatchingParen(expression, argsStart);
	if (endIdx === -1) return null;
	return {
		funcName,
		argsStr: expression.substring(argsStart, endIdx),
		fullMatch: expression.substring(startMatch.index, endIdx + 1),
	};
}

export function extractScalarFunction(expression: string): { funcName: string; argsStr: string; fullMatch: string } | null {
	const startMatch = expression.match(/\b(ROUND|ABS|IF|COALESCE|UPPER|LOWER|CONCAT)\s*\(/);
	if (!startMatch || startMatch.index === undefined) return null;
	const funcName = startMatch[1];
	const argsStart = startMatch.index + startMatch[0].length;
	const endIdx = findMatchingParen(expression, argsStart);
	if (endIdx === -1) return null;
	const argsStr = expression.substring(argsStart, endIdx);
	const fullMatch = expression.substring(startMatch.index, endIdx + 1);
	const innerCheck = extractScalarFunction(argsStr);
	if (innerCheck) return innerCheck;
	return { funcName, argsStr, fullMatch };
}

// ── Argument splitting ────────────────────────────────────

/** Split function arguments respecting nested parentheses and quoted strings. */
export function splitFunctionArgs(argsStr: string): string[] {
	const args: string[] = [];
	let depth = 0;
	let current = "";
	let inQuote = false;
	let quoteChar = "";
	for (let i = 0; i < argsStr.length; i++) {
		const ch = argsStr[i];
		if (inQuote) { current += ch; if (ch === quoteChar) inQuote = false; continue; }
		if (ch === '"' || ch === "'") { inQuote = true; quoteChar = ch; current += ch; continue; }
		if (ch === "(") { depth++; current += ch; continue; }
		if (ch === ")") { depth--; current += ch; continue; }
		if (ch === "," && depth === 0) { args.push(current); current = ""; continue; }
		current += ch;
	}
	if (current.trim()) args.push(current);
	return args;
}

// ── Arithmetic tokenization and evaluation ────────────────

type ArithToken = { type: "num"; value: number } | { type: "op"; value: string };

function isDigitOrDot(ch: string): boolean {
	return (ch >= "0" && ch <= "9") || ch === ".";
}

function parseNumString(s: string, start: number): string {
	let i = start;
	if (s[i] === "-" || s[i] === "+") i++;
	while (i < s.length && (isDigitOrDot(s[i]) || s[i] === "e" || s[i] === "E")) i++;
	return s.substring(start, i);
}

function tokenizeArithmetic(expr: string): ArithToken[] {
	const tokens: ArithToken[] = [];
	let i = 0;
	const s = expr.trim();
	while (i < s.length) {
		if (s[i] === " " || s[i] === "\t") { i++; continue; }
		if (s[i] === "+" || s[i] === "-" || s[i] === "*" || s[i] === "/") {
			if (s[i] === "-" && (tokens.length === 0 || tokens[tokens.length - 1].type === "op")) {
				const numStr = parseNumString(s, i);
				if (numStr.length > 1) { tokens.push({ type: "num", value: parseFloat(numStr) }); i += numStr.length; continue; }
			}
			tokens.push({ type: "op", value: s[i] }); i++; continue;
		}
		if (isDigitOrDot(s[i])) {
			const numStr = parseNumString(s, i);
			tokens.push({ type: "num", value: parseFloat(numStr) }); i += numStr.length; continue;
		}
		i++;
	}
	return tokens;
}

/** Fold multiply/divide ops first, returning reduced number and operator lists. */
function foldMulDiv(nums: number[], ops: string[]): { nums: number[]; ops: string[] } {
	const nums2: number[] = [nums[0]];
	const ops2: string[] = [];
	for (let i = 0; i < ops.length; i++) {
		const right = nums[i + 1] ?? 0;
		if (ops[i] === "*") {
			nums2.push(nums2.pop()! * right);
		} else if (ops[i] === "/") {
			const left = nums2.pop()!;
			nums2.push(right === 0 ? 0 : left / right);
		} else {
			ops2.push(ops[i]);
			nums2.push(right);
		}
	}
	return { nums: nums2, ops: ops2 };
}

/** Evaluate tokens with operator precedence: * / before + - */
export function calculateWithPrecedence(tokens: ArithToken[]): number {
	if (tokens.length === 0) return 0;
	const nums: number[] = [];
	const ops: string[] = [];
	for (const t of tokens) {
		if (t.type === "num") nums.push(t.value);
		else ops.push(t.value);
	}
	if (nums.length === 0) return 0;
	if (ops.length < nums.length - 1) return nums[0];
	const folded = foldMulDiv(nums, ops);
	let result = folded.nums[0];
	for (let i = 0; i < folded.ops.length; i++) {
		if (folded.ops[i] === "+") result += folded.nums[i + 1] ?? 0;
		else if (folded.ops[i] === "-") result -= folded.nums[i + 1] ?? 0;
	}
	return isNaN(result) || !isFinite(result) ? 0 : result;
}

// ── Expression evaluation ─────────────────────────────────

const SCALAR_DISPATCH: Record<string, (args: string[], row: ResultRow) => string | number> = {
	ROUND: evalRound, ABS: evalAbs, IF: evalIf,
	COALESCE: evalCoalesce, UPPER: evalUpper, LOWER: evalLower, CONCAT: evalConcat,
};

/**
 * Evaluate an expression with {Column Label} references, arithmetic, and scalar functions.
 * Returns string | number (IF can return string values).
 */
export function evaluateExpression(expression: string, row: ResultRow): string | number {
	if (!expression.trim()) return 0;
	let processed = expression;
	let iterations = 0;
	while (iterations < 20) {
		const extracted = extractScalarFunction(processed);
		if (!extracted) break;
		const { funcName, argsStr, fullMatch } = extracted;
		const args = splitFunctionArgs(argsStr);
		const fn = SCALAR_DISPATCH[funcName];
		const result = fn ? fn(args, row) : 0;
		processed = typeof result === "string"
			? processed.replace(fullMatch, `"${result}"`)
			: processed.replace(fullMatch, String(result));
		iterations++;
	}
	const trimmed = processed.trim();
	if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
	const substituted = processed.replace(/\{([^}]+)\}/g, (_, label: string) => {
		const key = label.trim();
		let val = row[key];
		if (val === undefined) {
			for (const rk of Object.keys(row)) {
				if (rk.endsWith(`(${key})`)) { val = row[rk]; break; }
			}
		}
		if (typeof val === "number") return String(val);
		const n = parseFloat(String(val ?? ""));
		return isNaN(n) ? "0" : String(n);
	});
	const tokens = tokenizeArithmetic(substituted);
	return tokens.length === 0 ? 0 : calculateWithPrecedence(tokens);
}

// ── Window column application ─────────────────────────────

/** Apply a window-function computed column to the full result set. */
export function applyWindowColumn(rows: ResultRow[], cc: ComputedColumn): void {
	const parsed = extractWindowFunction(cc.expression);
	if (!parsed) {
		for (const row of rows) row[cc.name] = evaluateExpression(cc.expression, row);
		return;
	}
	const { funcName, argsStr, fullMatch } = parsed;
	const args = splitFunctionArgs(argsStr);
	const colRef = args[0]?.trim().replace(/^\{|\}$/g, "") ?? "";
	let windowValues: Array<number | null>;
	switch (funcName) {
		case "CHANGE": windowValues = computeChange(rows, colRef); break;
		case "PCT_CHANGE": windowValues = computePctChange(rows, colRef); break;
		case "ROLLING_AVG": {
			const ws = parseInt(args[1]?.trim() ?? "3", 10);
			windowValues = computeRollingAvg(rows, colRef, isNaN(ws) ? 3 : ws);
			break;
		}
	}
	const isWrapped = cc.expression.trim() !== fullMatch;
	for (let i = 0; i < rows.length; i++) {
		const wv = windowValues[i];
		if (wv === null) rows[i][cc.name] = null as unknown as string | number;
		else if (isWrapped) rows[i][cc.name] = evaluateExpression(cc.expression.replace(fullMatch, String(wv)), rows[i]);
		else rows[i][cc.name] = wv;
	}
}

// ── Column type guessing ──────────────────────────────────

/** Guess a column's type from sample values. */
export function guessColumnType(
	samples: string[],
	_localeId?: string,
): { type: "number" | "date" | "string"; currencySymbol?: string } {
	if (samples.length === 0) return { type: "string" };
	let numericCount = 0;
	let dateCount = 0;
	let detectedSymbol: string | undefined;
	for (const s of samples) {
		const symbolMatch = s.match(/^[€$£¥₹]/);
		if (symbolMatch) detectedSymbol = symbolMatch[0];
		const stripped = s.replace(/[€$£¥₹]/g, "").trim();
		if (/^[-+]?[\d.,\s\u00A0]+$/.test(stripped) && /\d/.test(stripped)) numericCount++;
		if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(s) || /^\d{4}-\d{1,2}-\d{1,2}$/.test(s) || /^\d{4}-\d{1,2}$/.test(s)) dateCount++;
	}
	if (dateCount >= samples.length * 0.5) return { type: "date" };
	if (numericCount >= samples.length * 0.7) return { type: "number", currencySymbol: detectedSymbol };
	return { type: "string" };
}
