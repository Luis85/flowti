import { describe, it, expect } from "vitest";
import { evaluateCondition, evaluateStepCondition } from "../../../src/domain/journeyExecutor/conditionEvaluator";

describe("evaluateCondition", () => {
	describe("truthy check — {{var}}", () => {
		it("returns true when variable is non-empty", () => {
			expect(evaluateCondition("{{mode}}", { mode: "dark" })).toBe(true);
		});

		it("returns false when variable is empty string", () => {
			expect(evaluateCondition("{{mode}}", { mode: "" })).toBe(false);
		});

		it("returns false when variable is not defined", () => {
			expect(evaluateCondition("{{mode}}", {})).toBe(false);
		});
	});

	describe("negation — !{{var}}", () => {
		it("returns false when variable is non-empty", () => {
			expect(evaluateCondition("!{{mode}}", { mode: "dark" })).toBe(false);
		});

		it("returns true when variable is empty", () => {
			expect(evaluateCondition("!{{mode}}", { mode: "" })).toBe(true);
		});

		it("returns true when variable is not defined", () => {
			expect(evaluateCondition("!{{mode}}", {})).toBe(true);
		});
	});

	describe("equality — {{var}} == \"value\"", () => {
		it("returns true when variable matches", () => {
			expect(evaluateCondition('{{env}} == "prod"', { env: "prod" })).toBe(true);
		});

		it("returns false when variable does not match", () => {
			expect(evaluateCondition('{{env}} == "prod"', { env: "dev" })).toBe(false);
		});

		it("returns false when variable is not defined", () => {
			expect(evaluateCondition('{{env}} == "prod"', {})).toBe(false);
		});

		it("matches empty string explicitly", () => {
			expect(evaluateCondition('{{env}} == ""', {})).toBe(true);
		});
	});

	describe("inequality — {{var}} != \"value\"", () => {
		it("returns true when variable differs", () => {
			expect(evaluateCondition('{{env}} != "prod"', { env: "dev" })).toBe(true);
		});

		it("returns false when variable matches", () => {
			expect(evaluateCondition('{{env}} != "prod"', { env: "prod" })).toBe(false);
		});
	});

	describe("edge cases", () => {
		it("handles extra whitespace", () => {
			expect(evaluateCondition("  {{mode}}  ", { mode: "dark" })).toBe(true);
		});

		it("returns false for unrecognized expressions", () => {
			expect(evaluateCondition("something random", {})).toBe(false);
		});
	});
});

describe("evaluateStepCondition", () => {
	it("returns shouldRun: true when no conditions", () => {
		const result = evaluateStepCondition({}, {});
		expect(result.shouldRun).toBe(true);
		expect(result.reason).toBeUndefined();
	});

	describe("skipIf", () => {
		it("skips when skipIf evaluates to true", () => {
			const result = evaluateStepCondition(
				{ skipIf: "{{skip}}" },
				{ skip: "yes" },
			);
			expect(result.shouldRun).toBe(false);
			expect(result.reason).toContain("skipIf");
		});

		it("runs when skipIf evaluates to false", () => {
			const result = evaluateStepCondition(
				{ skipIf: "{{skip}}" },
				{},
			);
			expect(result.shouldRun).toBe(true);
		});
	});

	describe("runIf", () => {
		it("runs when runIf evaluates to true", () => {
			const result = evaluateStepCondition(
				{ runIf: "{{enabled}}" },
				{ enabled: "true" },
			);
			expect(result.shouldRun).toBe(true);
		});

		it("skips when runIf evaluates to false", () => {
			const result = evaluateStepCondition(
				{ runIf: "{{enabled}}" },
				{},
			);
			expect(result.shouldRun).toBe(false);
			expect(result.reason).toContain("runIf");
		});
	});

	describe("precedence", () => {
		it("skipIf takes priority over runIf", () => {
			const result = evaluateStepCondition(
				{ skipIf: "{{skip}}", runIf: "{{run}}" },
				{ skip: "yes", run: "yes" },
			);
			expect(result.shouldRun).toBe(false);
			expect(result.reason).toContain("skipIf");
		});
	});
});
