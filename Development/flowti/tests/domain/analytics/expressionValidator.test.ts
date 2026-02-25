/**
 * Unit tests for the expression validator.
 */

import { describe, it, expect } from "vitest";
import { validateExpression } from "../../../src/domain/analytics/expressionValidator";

const COLUMNS = ["Revenue", "Cost", "SUM(Revenue)", "AVG(Cost)", "Category"];

describe("expressionValidator", () => {
	// ── Valid expressions ───────────────────────────────────

	describe("valid expressions", () => {
		it("accepts simple arithmetic", () => {
			const result = validateExpression("{Revenue} - {Cost}", COLUMNS);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("accepts function calls with correct args", () => {
			expect(validateExpression("ROUND({Revenue}, 2)", COLUMNS).valid).toBe(true);
			expect(validateExpression("ABS({Cost})", COLUMNS).valid).toBe(true);
			expect(validateExpression('IF({Revenue} > 100, "High", "Low")', COLUMNS).valid).toBe(true);
			expect(validateExpression("CHANGE({SUM(Revenue)})", COLUMNS).valid).toBe(true);
			expect(validateExpression("PCT_CHANGE({Revenue})", COLUMNS).valid).toBe(true);
			expect(validateExpression("ROLLING_AVG({Revenue}, 3)", COLUMNS).valid).toBe(true);
		});

		it("accepts nested functions", () => {
			const result = validateExpression("ROUND(ABS({Revenue}), 2)", COLUMNS);
			expect(result.valid).toBe(true);
		});

		it("accepts plain number literal", () => {
			const result = validateExpression("42", COLUMNS);
			expect(result.valid).toBe(true);
		});

		it("accepts mixed arithmetic and functions", () => {
			const result = validateExpression("{Revenue} * 100 / ABS({Cost})", COLUMNS);
			expect(result.valid).toBe(true);
		});
	});

	// ── Empty expression ───────────────────────────────────

	describe("empty expression", () => {
		it("rejects empty string", () => {
			const result = validateExpression("", COLUMNS);
			expect(result.valid).toBe(false);
			expect(result.errors).toContain("Expression is empty");
		});

		it("rejects whitespace-only", () => {
			const result = validateExpression("   ", COLUMNS);
			expect(result.valid).toBe(false);
			expect(result.errors).toContain("Expression is empty");
		});
	});

	// ── Brace validation ───────────────────────────────────

	describe("brace validation", () => {
		it("detects unmatched opening brace", () => {
			const result = validateExpression("{Revenue - {Cost}", COLUMNS);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("Unmatched opening brace"))).toBe(true);
		});

		it("detects unmatched closing brace", () => {
			const result = validateExpression("Revenue} - {Cost}", COLUMNS);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("Unmatched closing brace"))).toBe(true);
		});
	});

	// ── Column reference validation ────────────────────────

	describe("column references", () => {
		it("detects unknown column", () => {
			const result = validateExpression("{Profit} + {Revenue}", COLUMNS);
			expect(result.valid).toBe(false);
			expect(result.errors).toContain("Unknown column: {Profit}");
		});

		it("detects multiple unknown columns", () => {
			const result = validateExpression("{Foo} + {Bar}", COLUMNS);
			expect(result.valid).toBe(false);
			expect(result.errors).toContain("Unknown column: {Foo}");
			expect(result.errors).toContain("Unknown column: {Bar}");
		});

		it("accepts aggregated column labels", () => {
			const result = validateExpression("{SUM(Revenue)} + {AVG(Cost)}", COLUMNS);
			expect(result.valid).toBe(true);
		});
	});

	// ── Function validation ────────────────────────────────

	describe("function validation", () => {
		it("detects unknown function", () => {
			const result = validateExpression("SQRT({Revenue})", COLUMNS);
			expect(result.valid).toBe(false);
			expect(result.errors).toContain("Unknown function: SQRT");
		});

		it("detects too few arguments for IF", () => {
			const result = validateExpression("IF({Revenue} > 100, {Cost})", COLUMNS);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("IF requires at least 3"))).toBe(true);
		});

		it("detects too many arguments for ABS", () => {
			const result = validateExpression("ABS({Revenue}, 2)", COLUMNS);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("ABS accepts at most 1"))).toBe(true);
		});

		it("detects too few arguments for ROLLING_AVG", () => {
			const result = validateExpression("ROLLING_AVG({Revenue})", COLUMNS);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("ROLLING_AVG requires at least 2"))).toBe(true);
		});

		it("accepts ROUND with 1 arg (decimals defaults to 0)", () => {
			const result = validateExpression("ROUND({Revenue})", COLUMNS);
			expect(result.valid).toBe(true);
		});

		it("accepts ROUND with 2 args", () => {
			const result = validateExpression("ROUND({Revenue}, 2)", COLUMNS);
			expect(result.valid).toBe(true);
		});
	});

	// ── Parenthesis validation ─────────────────────────────

	describe("parenthesis validation", () => {
		it("detects unmatched opening parenthesis", () => {
			const result = validateExpression("ROUND({Revenue}, 2", COLUMNS);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("Unmatched opening parenthesis"))).toBe(true);
		});

		it("detects unmatched closing parenthesis", () => {
			const result = validateExpression("{Revenue}) + {Cost}", COLUMNS);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("Unmatched closing parenthesis"))).toBe(true);
		});
	});

	// ── Multiple errors ────────────────────────────────────

	describe("multiple errors", () => {
		it("reports all errors at once", () => {
			const result = validateExpression("SQRT({Unknown})", COLUMNS);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThanOrEqual(2);
			expect(result.errors).toContain("Unknown column: {Unknown}");
			expect(result.errors).toContain("Unknown function: SQRT");
		});
	});

	// ── New functions (COALESCE, UPPER, LOWER, CONCAT) ───

	describe("new function validation", () => {
		it("accepts COALESCE with valid columns", () => {
			const result = validateExpression("COALESCE({Revenue}, {Cost}, 0)", COLUMNS);
			expect(result.valid).toBe(true);
		});

		it("accepts UPPER with one arg", () => {
			const result = validateExpression("UPPER({Category})", COLUMNS);
			expect(result.valid).toBe(true);
		});

		it("accepts LOWER with one arg", () => {
			const result = validateExpression("LOWER({Category})", COLUMNS);
			expect(result.valid).toBe(true);
		});

		it("accepts CONCAT with multiple args", () => {
			const result = validateExpression('CONCAT({Category}, " - ", {Revenue})', COLUMNS);
			expect(result.valid).toBe(true);
		});

		it("rejects CONCAT with too few args", () => {
			const result = validateExpression("CONCAT({Revenue})", COLUMNS);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("CONCAT requires at least 2"))).toBe(true);
		});
	});

	// ── Edge cases ─────────────────────────────────────────

	describe("edge cases", () => {
		it("handles expression with no column references", () => {
			const result = validateExpression("100 + 200", COLUMNS);
			expect(result.valid).toBe(true);
		});

		it("handles empty available columns", () => {
			const result = validateExpression("{Revenue}", []);
			expect(result.valid).toBe(false);
			expect(result.errors).toContain("Unknown column: {Revenue}");
		});

		it("handles function with zero args", () => {
			const result = validateExpression("ABS()", COLUMNS);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("ABS requires at least 1"))).toBe(true);
		});
	});
});
