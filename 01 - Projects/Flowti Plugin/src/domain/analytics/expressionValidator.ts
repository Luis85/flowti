/**
 * Pure expression validator for computed column expressions.
 *
 * Validates syntax before the expression reaches the engine:
 * - Balanced braces
 * - Valid column references (all {Column} exist in available columns)
 * - Valid function names (ROUND, ABS, IF, CHANGE, PCT_CHANGE, ROLLING_AVG)
 * - Argument count checks for known functions
 * - No empty expressions
 */

const VALID_FUNCTIONS = new Set([
	"ROUND", "ABS", "IF",
	"CHANGE", "PCT_CHANGE", "ROLLING_AVG",
	"COALESCE", "UPPER", "LOWER", "CONCAT",
]);

const FUNCTION_ARG_COUNTS: Record<string, { min: number; max: number }> = {
	ROUND: { min: 1, max: 2 },
	ABS: { min: 1, max: 1 },
	IF: { min: 3, max: 3 },
	CHANGE: { min: 1, max: 1 },
	PCT_CHANGE: { min: 1, max: 1 },
	ROLLING_AVG: { min: 2, max: 2 },
	COALESCE: { min: 1, max: 10 },
	UPPER: { min: 1, max: 1 },
	LOWER: { min: 1, max: 1 },
	CONCAT: { min: 2, max: 10 },
};

export interface ExpressionValidationResult {
	valid: boolean;
	errors: string[];
}

/**
 * Validate a computed column expression against available columns.
 *
 * @param expression - The expression string (e.g., "{Revenue} - {Cost}")
 * @param availableColumns - Column names available for reference
 * @returns Validation result with error messages
 */
export function validateExpression(
	expression: string,
	availableColumns: string[],
): ExpressionValidationResult {
	const errors: string[] = [];

	if (!expression.trim()) {
		return { valid: false, errors: ["Expression is empty"] };
	}

	// Check balanced curly braces
	let braceDepth = 0;
	for (const ch of expression) {
		if (ch === "{") braceDepth++;
		if (ch === "}") braceDepth--;
		if (braceDepth < 0) {
			errors.push("Unmatched closing brace '}'");
			break;
		}
	}
	if (braceDepth > 0) {
		errors.push("Unmatched opening brace '{'");
	}

	// Check column references
	const colRefPattern = /\{([^}]+)\}/g;
	const colSet = new Set(availableColumns);
	let match;
	while ((match = colRefPattern.exec(expression)) !== null) {
		const colName = match[1].trim();
		if (!colSet.has(colName)) {
			errors.push(`Unknown column: {${colName}}`);
		}
	}

	// Check function calls (strip column refs first so {SUM(x)} doesn't look like a SUM call)
	const stripped = expression.replace(/\{[^}]*\}/g, "__COL__");
	const funcPattern = /([A-Z_]+)\s*\(/g;
	while ((match = funcPattern.exec(stripped)) !== null) {
		const funcName = match[1];
		if (!VALID_FUNCTIONS.has(funcName)) {
			errors.push(`Unknown function: ${funcName}`);
			continue;
		}

		// Count arguments by finding matching parenthesis
		const startIdx = match.index + match[0].length;
		const argCount = countFunctionArgs(stripped, startIdx);
		if (argCount !== null) {
			const expected = FUNCTION_ARG_COUNTS[funcName];
			if (expected) {
				if (argCount < expected.min) {
					errors.push(`${funcName} requires at least ${expected.min} argument${expected.min > 1 ? "s" : ""}, got ${argCount}`);
				} else if (argCount > expected.max) {
					errors.push(`${funcName} accepts at most ${expected.max} argument${expected.max > 1 ? "s" : ""}, got ${argCount}`);
				}
			}
		}
	}

	// Check balanced parentheses
	let parenDepth = 0;
	for (const ch of expression) {
		if (ch === "(") parenDepth++;
		if (ch === ")") parenDepth--;
		if (parenDepth < 0) {
			errors.push("Unmatched closing parenthesis ')'");
			break;
		}
	}
	if (parenDepth > 0) {
		errors.push("Unmatched opening parenthesis '('");
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Count the number of comma-separated arguments starting after an opening paren.
 * Returns null if closing paren not found.
 */
function countFunctionArgs(expression: string, startIdx: number): number | null {
	let depth = 1;
	let argCount = 1;
	let hasContent = false;

	for (let i = startIdx; i < expression.length; i++) {
		const ch = expression[i];
		if (ch === "(") depth++;
		else if (ch === ")") {
			depth--;
			if (depth === 0) return hasContent ? argCount : 0;
		} else if (ch === "," && depth === 1) {
			argCount++;
		}
		if (ch.trim()) hasContent = true;
	}

	return null; // unmatched
}
