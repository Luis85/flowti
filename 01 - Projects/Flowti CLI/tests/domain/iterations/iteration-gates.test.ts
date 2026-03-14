import { describe, it, expect } from "vitest";
import { evaluateGate, makeGateEvaluator } from "../../../src/domain/iterations/iteration-gates.js";
import type { IterationSummary } from "../../../src/domain/iterations/iteration-types.js";

function makeSummary(overrides: Partial<IterationSummary> = {}): IterationSummary {
	return {
		name: "Test", number: 1, startDate: "2026-03-14", endDate: "2026-03-28",
		goal: "Build something", capacity: "", description: "", status: "planned",
		file: "iteration-001-plan.md", agents: [], resources: [], capacities: [], scopeItems: [],
		...overrides,
	};
}

describe("has-goal gate", () => {
	it("passes when goal is set", () => {
		expect(evaluateGate("has-goal", makeSummary({ goal: "Ship it" })).passed).toBe(true);
	});

	it("fails when goal is empty", () => {
		expect(evaluateGate("has-goal", makeSummary({ goal: "" })).passed).toBe(false);
	});

	it("fails when goal is whitespace", () => {
		expect(evaluateGate("has-goal", makeSummary({ goal: "   " })).passed).toBe(false);
	});
});

describe("has-scope gate", () => {
	it("passes when scope items exist", () => {
		const result = evaluateGate("has-scope", makeSummary({ scopeItems: [{ text: "Do thing", done: false }] }));
		expect(result.passed).toBe(true);
	});

	it("fails when no scope items", () => {
		expect(evaluateGate("has-scope", makeSummary({ scopeItems: [] })).passed).toBe(false);
	});
});

describe("has-dates gate", () => {
	it("passes when both dates set", () => {
		expect(evaluateGate("has-dates", makeSummary({ startDate: "2026-03-14", endDate: "2026-03-28" })).passed).toBe(true);
	});

	it("fails when startDate empty", () => {
		expect(evaluateGate("has-dates", makeSummary({ startDate: "" })).passed).toBe(false);
	});

	it("fails when endDate empty", () => {
		expect(evaluateGate("has-dates", makeSummary({ endDate: "" })).passed).toBe(false);
	});
});

describe("has-resources gate", () => {
	it("passes when resources exist", () => {
		const result = evaluateGate("has-resources", makeSummary({ resources: [{ name: "Alice" }] }));
		expect(result.passed).toBe(true);
	});

	it("passes when capacities exist", () => {
		const result = evaluateGate("has-resources", makeSummary({ capacities: [{ label: "Points", value: "10" }] }));
		expect(result.passed).toBe(true);
	});

	it("fails when neither resources nor capacities", () => {
		expect(evaluateGate("has-resources", makeSummary({ resources: [], capacities: [] })).passed).toBe(false);
	});
});

describe("scope-progress gate", () => {
	it("passes when at least one item done", () => {
		const items = [{ text: "A", done: true }, { text: "B", done: false }];
		expect(evaluateGate("scope-progress", makeSummary({ scopeItems: items })).passed).toBe(true);
	});

	it("fails when no items done", () => {
		const items = [{ text: "A", done: false }, { text: "B", done: false }];
		expect(evaluateGate("scope-progress", makeSummary({ scopeItems: items })).passed).toBe(false);
	});

	it("fails when no scope items at all", () => {
		expect(evaluateGate("scope-progress", makeSummary({ scopeItems: [] })).passed).toBe(false);
	});
});

describe("all-scope-done gate", () => {
	it("passes when all items done", () => {
		const items = [{ text: "A", done: true }, { text: "B", done: true }];
		expect(evaluateGate("all-scope-done", makeSummary({ scopeItems: items })).passed).toBe(true);
	});

	it("fails when some items not done", () => {
		const items = [{ text: "A", done: true }, { text: "B", done: false }];
		expect(evaluateGate("all-scope-done", makeSummary({ scopeItems: items })).passed).toBe(false);
	});

	it("fails when no scope items", () => {
		expect(evaluateGate("all-scope-done", makeSummary({ scopeItems: [] })).passed).toBe(false);
	});
});

describe("unknown gate", () => {
	it("passes with a message for unknown gates", () => {
		const result = evaluateGate("nonexistent", makeSummary());
		expect(result.passed).toBe(true);
		expect(result.message).toContain("Unknown gate");
	});
});

describe("makeGateEvaluator", () => {
	it("returns a bound evaluator function", () => {
		const summary = makeSummary({ goal: "Ship it" });
		const evaluator = makeGateEvaluator(summary);
		expect(evaluator("has-goal").passed).toBe(true);
	});
});
