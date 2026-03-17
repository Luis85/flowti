/**
 * Conditional formatting tests.
 *
 * Tests rule evaluation, operator matching, preset resolution,
 * first-match semantics, and custom color passthrough.
 */

import { describe, it, expect } from "vitest";
import { evaluateConditionalRules, resolveColor } from "../../../src/domain/analytics/conditionalFormatting";
import type { ConditionalRule } from "../../../src/domain/analytics/types";

// ── resolveColor ────────────────────────────────────────────

describe("resolveColor", () => {
	it("resolves 'positive' preset to CSS variable", () => {
		expect(resolveColor("positive")).toBe("var(--text-success)");
	});

	it("resolves 'negative' preset to CSS variable", () => {
		expect(resolveColor("negative")).toBe("var(--text-error)");
	});

	it("resolves 'warning' preset to CSS variable", () => {
		expect(resolveColor("warning")).toBe("var(--text-warning)");
	});

	it("passes through custom CSS color strings", () => {
		expect(resolveColor("#ff0000")).toBe("#ff0000");
		expect(resolveColor("rgb(0,128,0)")).toBe("rgb(0,128,0)");
		expect(resolveColor("blue")).toBe("blue");
	});
});

// ── evaluateConditionalRules ────────────────────────────────

describe("evaluateConditionalRules", () => {
	it("returns null for empty rules array", () => {
		expect(evaluateConditionalRules(42, [])).toBeNull();
	});

	it("matches greater than operator", () => {
		const rules: ConditionalRule[] = [
			{ column: "Revenue", operator: ">", threshold: 100, color: "positive" },
		];
		expect(evaluateConditionalRules(150, rules)).toBe("var(--text-success)");
		expect(evaluateConditionalRules(50, rules)).toBeNull();
		expect(evaluateConditionalRules(100, rules)).toBeNull();
	});

	it("matches less than operator", () => {
		const rules: ConditionalRule[] = [
			{ column: "Cost", operator: "<", threshold: 50, color: "negative" },
		];
		expect(evaluateConditionalRules(30, rules)).toBe("var(--text-error)");
		expect(evaluateConditionalRules(50, rules)).toBeNull();
		expect(evaluateConditionalRules(80, rules)).toBeNull();
	});

	it("matches greater than or equal operator", () => {
		const rules: ConditionalRule[] = [
			{ column: "Score", operator: ">=", threshold: 90, color: "positive" },
		];
		expect(evaluateConditionalRules(90, rules)).toBe("var(--text-success)");
		expect(evaluateConditionalRules(91, rules)).toBe("var(--text-success)");
		expect(evaluateConditionalRules(89, rules)).toBeNull();
	});

	it("matches less than or equal operator", () => {
		const rules: ConditionalRule[] = [
			{ column: "Stock", operator: "<=", threshold: 10, color: "warning" },
		];
		expect(evaluateConditionalRules(10, rules)).toBe("var(--text-warning)");
		expect(evaluateConditionalRules(5, rules)).toBe("var(--text-warning)");
		expect(evaluateConditionalRules(11, rules)).toBeNull();
	});

	it("matches equals operator", () => {
		const rules: ConditionalRule[] = [
			{ column: "Status", operator: "=", threshold: 0, color: "negative" },
		];
		expect(evaluateConditionalRules(0, rules)).toBe("var(--text-error)");
		expect(evaluateConditionalRules(1, rules)).toBeNull();
	});

	it("matches not-equals operator", () => {
		const rules: ConditionalRule[] = [
			{ column: "Status", operator: "!=", threshold: 0, color: "positive" },
		];
		expect(evaluateConditionalRules(1, rules)).toBe("var(--text-success)");
		expect(evaluateConditionalRules(0, rules)).toBeNull();
	});

	it("first match wins when multiple rules match", () => {
		const rules: ConditionalRule[] = [
			{ column: "Revenue", operator: ">", threshold: 200, color: "positive" },
			{ column: "Revenue", operator: ">", threshold: 100, color: "warning" },
			{ column: "Revenue", operator: ">", threshold: 0, color: "negative" },
		];
		// 250 matches all three — first rule (positive) wins
		expect(evaluateConditionalRules(250, rules)).toBe("var(--text-success)");
		// 150 matches second and third — second rule (warning) wins
		expect(evaluateConditionalRules(150, rules)).toBe("var(--text-warning)");
		// 50 matches only third — third rule (negative) wins
		expect(evaluateConditionalRules(50, rules)).toBe("var(--text-error)");
	});

	it("returns null when no rules match", () => {
		const rules: ConditionalRule[] = [
			{ column: "Revenue", operator: ">", threshold: 1000, color: "positive" },
			{ column: "Revenue", operator: "<", threshold: 0, color: "negative" },
		];
		expect(evaluateConditionalRules(500, rules)).toBeNull();
	});

	it("uses custom CSS color when specified", () => {
		const rules: ConditionalRule[] = [
			{ column: "Custom", operator: ">", threshold: 0, color: "#3498db" },
		];
		expect(evaluateConditionalRules(10, rules)).toBe("#3498db");
	});
});
