/**
 * Tests for scalar expression functions: ROUND, ABS, IF.
 *
 * Tests cover the extracted expressionFunctions module and
 * integration via evaluateExpression in AnalyticsEngine.
 */

import { describe, it, expect } from "vitest";
import { evalRound, evalAbs, evalIf, evalCoalesce, evalUpper, evalLower, evalConcat } from "../../../src/domain/analytics/expressionFunctions";
import { evaluateExpression } from "../../../src/domain/analytics/AnalyticsEngine";
import type { ResultRow } from "../../../src/domain/analytics/types";

describe("expressionFunctions", () => {
	// ── ROUND ──────────────────────────────────────────

	describe("evalRound", () => {
		it("should round to specified decimal places", () => {
			const row: ResultRow = { Value: 23.4567 };
			expect(evalRound(["{Value}", "2"], row)).toBe(23.46);
		});

		it("should round to 0 decimals by default", () => {
			const row: ResultRow = { Value: 23.7 };
			expect(evalRound(["{Value}"], row)).toBe(24);
		});

		it("should handle integer values", () => {
			const row: ResultRow = { Value: 100 };
			expect(evalRound(["{Value}", "2"], row)).toBe(100);
		});

		it("should handle negative values", () => {
			const row: ResultRow = { Value: -3.14159 };
			expect(evalRound(["{Value}", "3"], row)).toBe(-3.142);
		});

		it("should return 0 for non-numeric input", () => {
			const row: ResultRow = { Value: "n/a" };
			expect(evalRound(["{Value}", "2"], row)).toBe(0);
		});
	});

	// ── ABS ────────────────────────────────────────────

	describe("evalAbs", () => {
		it("should return absolute value of negative number", () => {
			const row: ResultRow = { Change: -42.5 };
			expect(evalAbs(["{Change}"], row)).toBe(42.5);
		});

		it("should preserve positive values", () => {
			const row: ResultRow = { Change: 100 };
			expect(evalAbs(["{Change}"], row)).toBe(100);
		});

		it("should handle zero", () => {
			const row: ResultRow = { Value: 0 };
			expect(evalAbs(["{Value}"], row)).toBe(0);
		});

		it("should return 0 for non-numeric input", () => {
			const row: ResultRow = { Value: "text" };
			expect(evalAbs(["{Value}"], row)).toBe(0);
		});
	});

	// ── IF ──────────────────────────────────────────────

	describe("evalIf", () => {
		it("should return then value when condition is true", () => {
			const row: ResultRow = { Margin: 5 };
			expect(evalIf(['{Margin} < 10', '"Low"', '"OK"'], row)).toBe("Low");
		});

		it("should return else value when condition is false", () => {
			const row: ResultRow = { Margin: 15 };
			expect(evalIf(['{Margin} < 10', '"Low"', '"OK"'], row)).toBe("OK");
		});

		it("should support >= operator", () => {
			const row: ResultRow = { Score: 80 };
			expect(evalIf(['{Score} >= 80', '"Pass"', '"Fail"'], row)).toBe("Pass");
		});

		it("should support column reference in then/else", () => {
			const row: ResultRow = { Margin: 15, Backup: 99 };
			expect(evalIf(["{Margin} >= 10", "{Margin}", "0"], row)).toBe(15);
		});

		it("should support numeric then/else values", () => {
			const row: ResultRow = { Status: 1 };
			expect(evalIf(["{Status} = 1", "100", "0"], row)).toBe(100);
		});

		it("should support != operator", () => {
			const row: ResultRow = { Code: 0 };
			expect(evalIf(['{Code} != 0', '"Active"', '"Inactive"'], row)).toBe("Inactive");
		});
	});

	// ── IF edge cases (AI-1 fix) ──────────────────────

	describe("evalIf malformed conditions", () => {
		it("should return else value when condition regex does not match", () => {
			const row: ResultRow = { X: 10 };
			// "just some text" has no operator — regex won't match
			expect(evalIf(["just some text", '"Yes"', '"No"'], row)).toBe("No");
		});

		it("should return else value for empty condition string", () => {
			const row: ResultRow = { X: 10 };
			expect(evalIf(["", '"Yes"', '"No"'], row)).toBe("No");
		});

		it("should return numeric else value for malformed condition", () => {
			const row: ResultRow = { X: 10 };
			expect(evalIf(["no_operator_here", "100", "42"], row)).toBe(42);
		});
	});

	describe("evalIf column ref on right side (AI-1b)", () => {
		it("should resolve column reference as threshold", () => {
			const row: ResultRow = { Stock: 180, Reorder: 200 };
			expect(evalIf(["{Stock} < {Reorder}", "1", "0"], row)).toBe(1);
		});

		it("should resolve column reference when condition is false", () => {
			const row: ResultRow = { Stock: 300, Reorder: 200 };
			expect(evalIf(["{Stock} < {Reorder}", "1", "0"], row)).toBe(0);
		});
	});

	// ── Nesting ────────────────────────────────────────

	describe("nested expressions via evaluateExpression", () => {
		it("should handle ROUND(ABS(...))", () => {
			const row: ResultRow = { Delta: -3.14159 };
			expect(evaluateExpression("ROUND(ABS({Delta}), 2)", row)).toBe(3.14);
		});

		it("should handle IF with arithmetic in condition", () => {
			const row: ResultRow = { Revenue: 1000, Cost: 900 };
			// Margin = (Revenue - Cost) / Revenue * 100 = 10
			expect(evaluateExpression('IF({Revenue} > 500, "Big", "Small")', row)).toBe("Big");
		});

		it("should handle string result from IF in full expression", () => {
			const row: ResultRow = { Value: 3 };
			const result = evaluateExpression('IF({Value} < 5, "Low", "High")', row);
			expect(result).toBe("Low");
		});
	});

	// ── COALESCE ──────────────────────────────────────────

	describe("evalCoalesce", () => {
		it("should return first non-missing value", () => {
			// A is missing from row, so COALESCE skips it
			const row: ResultRow = { B: 42 };
			expect(evalCoalesce(["{A}", "{B}", "0"], row)).toBe(42);
		});

		it("should return first non-empty string value", () => {
			const row: ResultRow = { A: "", B: "hello" };
			expect(evalCoalesce(["{A}", "{B}"], row)).toBe("hello");
		});

		it("should return literal fallback when all columns are missing", () => {
			const row: ResultRow = {};
			expect(evalCoalesce(["{A}", "{B}", "0"], row)).toBe(0);
		});

		it("should return first value if not empty", () => {
			const row: ResultRow = { A: "first", B: "second" };
			expect(evalCoalesce(["{A}", "{B}"], row)).toBe("first");
		});
	});

	// ── UPPER ──────────────────────────────────────────

	describe("evalUpper", () => {
		it("should uppercase a column value", () => {
			const row: ResultRow = { Name: "john" };
			expect(evalUpper(["{Name}"], row)).toBe("JOHN");
		});

		it("should uppercase a string literal", () => {
			const row: ResultRow = {};
			expect(evalUpper(['"hello"'], row)).toBe("HELLO");
		});

		it("should handle mixed case", () => {
			const row: ResultRow = { Name: "John Doe" };
			expect(evalUpper(["{Name}"], row)).toBe("JOHN DOE");
		});
	});

	// ── LOWER ──────────────────────────────────────────

	describe("evalLower", () => {
		it("should lowercase a column value", () => {
			const row: ResultRow = { Name: "JOHN" };
			expect(evalLower(["{Name}"], row)).toBe("john");
		});

		it("should lowercase a string literal", () => {
			const row: ResultRow = {};
			expect(evalLower(['"HELLO"'], row)).toBe("hello");
		});
	});

	// ── CONCAT ─────────────────────────────────────────

	describe("evalConcat", () => {
		it("should concatenate two column values", () => {
			const row: ResultRow = { First: "John", Last: "Doe" };
			expect(evalConcat(["{First}", "{Last}"], row)).toBe("JohnDoe");
		});

		it("should concatenate with string literal separator", () => {
			const row: ResultRow = { First: "John", Last: "Doe" };
			expect(evalConcat(["{First}", '" "', "{Last}"], row)).toBe("John Doe");
		});

		it("should handle multiple args", () => {
			const row: ResultRow = { A: "a", B: "b", C: "c" };
			expect(evalConcat(["{A}", "{B}", "{C}"], row)).toBe("abc");
		});

		it("should handle mixed types (numbers and strings)", () => {
			const row: ResultRow = { Name: "Item", Count: 5 };
			expect(evalConcat(["{Name}", '": "', "{Count}"], row)).toBe("Item: 5");
		});
	});

	// ── Nesting: new functions via evaluateExpression ──

	describe("new functions via evaluateExpression", () => {
		it("COALESCE in expression", () => {
			const row: ResultRow = { B: 10 };
			expect(evaluateExpression("COALESCE({A}, {B}, 0)", row)).toBe(10);
		});

		it("UPPER in expression", () => {
			const row: ResultRow = { Name: "john" };
			expect(evaluateExpression("UPPER({Name})", row)).toBe("JOHN");
		});

		it("LOWER in expression", () => {
			const row: ResultRow = { Name: "JOHN" };
			expect(evaluateExpression("LOWER({Name})", row)).toBe("john");
		});

		it("CONCAT in expression", () => {
			const row: ResultRow = { First: "John", Last: "Doe" };
			expect(evaluateExpression('CONCAT({First}, " ", {Last})', row)).toBe("John Doe");
		});
	});

	// ── Contract: evaluateExpression returns string | number ──

	describe("string | number contract", () => {
		it("should return string from IF with string literals", () => {
			const row: ResultRow = { X: 1 };
			const result = evaluateExpression('IF({X} = 1, "Yes", "No")', row);
			expect(typeof result).toBe("string");
			expect(result).toBe("Yes");
		});

		it("should return number from arithmetic", () => {
			const row: ResultRow = { A: 10, B: 20 };
			const result = evaluateExpression("{A} + {B}", row);
			expect(typeof result).toBe("number");
			expect(result).toBe(30);
		});

		it("should return number from ROUND", () => {
			const row: ResultRow = { X: 3.14159 };
			const result = evaluateExpression("ROUND({X}, 2)", row);
			expect(typeof result).toBe("number");
			expect(result).toBe(3.14);
		});
	});
});
