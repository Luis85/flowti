import { describe, it, expect } from "vitest";
import {
	compileCheck,
	buildBatchEval,
	parseResults,
	formatFailures,
	validateParallelGroup,
} from "./parallelGroup";
import type { ParallelCheckResult } from "./parallelGroup";
import type {
	AssertAction,
	AssertTextAction,
	AssertNumberAction,
	AssertValueAction,
	EvalAction,
} from "./journeyTypes";

// ── compileCheck ─────────────────────────────────────────────────

describe("compileCheck", () => {
	it("compiles assert visible", () => {
		const action: AssertAction = {
			tool: "assert",
			type: "visible",
			selector: "[data-test-id='foo']",
			description: "Foo visible",
		};
		const code = compileCheck(action, 0);
		expect(code).toContain("querySelectorAll");
		expect(code).toContain("els.length > 0");
		expect(code).toContain("R.push");
		expect(code).toContain("i:0");
	});

	it("compiles assert not-visible", () => {
		const action: AssertAction = {
			tool: "assert",
			type: "not-visible",
			selector: ".gone",
		};
		const code = compileCheck(action, 1);
		expect(code).toContain("els.length === 0");
		expect(code).toContain("i:1");
	});

	it("compiles assert text", () => {
		const action: AssertAction = {
			tool: "assert",
			type: "text",
			selector: ".heading",
			contains: "Hello",
		};
		const code = compileCheck(action, 2);
		expect(code).toContain("includes('Hello')");
	});

	it("compiles assert count", () => {
		const action: AssertAction = {
			tool: "assert",
			type: "count",
			selector: ".item",
			count: 3,
		};
		const code = compileCheck(action, 0);
		expect(code).toContain("els.length === 3");
	});

	it("compiles assert leaf", () => {
		const action: AssertAction = {
			tool: "assert",
			type: "leaf",
			viewType: "flowti-user-hub",
		};
		const code = compileCheck(action, 0);
		expect(code).toContain("workspace-leaf-content");
		expect(code).toContain("flowti-user-hub");
	});

	it("compiles assert attr", () => {
		const action: AssertAction = {
			tool: "assert",
			type: "attr",
			selector: ".btn",
			attr: "disabled",
			value: "true",
		};
		const code = compileCheck(action, 0);
		expect(code).toContain("getAttribute('disabled')");
		expect(code).toContain("=== 'true'");
	});

	it("compiles assert eval", () => {
		const action: AssertAction = {
			tool: "assert",
			type: "eval",
			code: "1 + 1",
			expected: "2",
		};
		const code = compileCheck(action, 0);
		expect(code).toContain("String(1 + 1)");
		expect(code).toContain("=== '2'");
	});

	it("compiles assert-text tool", () => {
		const action: AssertTextAction = {
			tool: "assert-text",
			selector: ".badge",
			contains: "3 items",
		};
		const code = compileCheck(action, 0);
		expect(code).toContain("includes('3 items')");
	});

	it("compiles assert-number tool (gte)", () => {
		const action: AssertNumberAction = {
			tool: "assert-number",
			selector: ".count",
			operator: "gte",
			value: 5,
		};
		const code = compileCheck(action, 0);
		expect(code).toContain(">= 5");
	});

	it("compiles assert-number tool (eq)", () => {
		const action: AssertNumberAction = {
			tool: "assert-number",
			selector: ".count",
			operator: "eq",
			value: 10,
		};
		const code = compileCheck(action, 0);
		expect(code).toContain("=== 10");
	});

	it("compiles assert-value tool (equals)", () => {
		const action: AssertValueAction = {
			tool: "assert-value",
			selector: "input.name",
			equals: "hello",
		};
		const code = compileCheck(action, 0);
		expect(code).toContain("val === 'hello'");
	});

	it("compiles assert-value tool (contains)", () => {
		const action: AssertValueAction = {
			tool: "assert-value",
			selector: "input.name",
			contains: "ell",
		};
		const code = compileCheck(action, 0);
		expect(code).toContain("val.includes('ell')");
	});

	it("compiles eval tool with equals expectation", () => {
		const action: EvalAction = {
			tool: "eval",
			code: "window.x",
			expect: { type: "equals", value: "42" },
		};
		const code = compileCheck(action, 0);
		expect(code).toContain("=== '42'");
	});

	it("compiles eval tool with truthy expectation", () => {
		const action: EvalAction = {
			tool: "eval",
			code: "window.flag",
			expect: { type: "truthy" },
		};
		const code = compileCheck(action, 0);
		expect(code).toContain("result !== 'false'");
		expect(code).toContain("result !== 'null'");
	});

	it("compiles eval tool without expectation (always passes)", () => {
		const action: EvalAction = {
			tool: "eval",
			code: "console.log('hi')",
		};
		const code = compileCheck(action, 0);
		expect(code).toContain("const ok = true");
	});

	it("escapes single quotes in selectors", () => {
		const action: AssertAction = {
			tool: "assert",
			type: "visible",
			selector: "[data-test-id='foo']",
		};
		const code = compileCheck(action, 0);
		expect(code).toContain("\\'foo\\'");
	});

	it("throws on unsupported assert type (event)", () => {
		const action = {
			tool: "assert" as const,
			type: "event" as const,
			event: "hub.opened",
		};
		expect(() => compileCheck(action as unknown as AssertAction, 0)).toThrow("unsupported");
	});

	it("includes highlight fragment for visible checks", () => {
		const action: AssertAction = {
			tool: "assert",
			type: "visible",
			selector: ".x",
		};
		const code = compileCheck(action, 0);
		expect(code).toContain("ft-e2e-highlight-assert-pass");
		expect(code).toContain("ft-e2e-highlight-assert-fail");
		expect(code).toContain("scrollIntoView");
	});

	it("includes Notice fragment", () => {
		const action: AssertAction = {
			tool: "assert",
			type: "visible",
			selector: ".x",
			description: "X visible",
		};
		const code = compileCheck(action, 0);
		expect(code).toContain("new Notice");
		expect(code).toContain("X visible");
	});
});

// ── buildBatchEval ───────────────────────────────────────────────

describe("buildBatchEval", () => {
	it("wraps fragments in IIFE returning JSON", () => {
		const actions: AssertAction[] = [
			{ tool: "assert", type: "visible", selector: ".a" },
			{ tool: "assert", type: "visible", selector: ".b" },
		];
		const code = buildBatchEval(actions);
		expect(code).toContain("(() => {");
		expect(code).toContain("const R = [];");
		expect(code).toContain("return JSON.stringify(R);");
		expect(code).toContain("})()");
	});

	it("assigns sequential indices", () => {
		const actions: AssertAction[] = [
			{ tool: "assert", type: "visible", selector: ".a" },
			{ tool: "assert", type: "visible", selector: ".b" },
			{ tool: "assert", type: "visible", selector: ".c" },
		];
		const code = buildBatchEval(actions);
		expect(code).toContain("i:0");
		expect(code).toContain("i:1");
		expect(code).toContain("i:2");
	});
});

// ── parseResults ─────────────────────────────────────────────────

describe("parseResults", () => {
	it("parses valid JSON results", () => {
		const json = JSON.stringify([
			{ i: 0, ok: true, v: "1" },
			{ i: 1, ok: false, v: "0", err: "not found" },
		]);
		const results = parseResults(json);
		expect(results).toHaveLength(2);
		expect(results[0].ok).toBe(true);
		expect(results[1].ok).toBe(false);
		expect(results[1].err).toBe("not found");
	});
});

// ── formatFailures ───────────────────────────────────────────────

describe("formatFailures", () => {
	it("returns null when all pass", () => {
		const results: ParallelCheckResult[] = [
			{ i: 0, ok: true, v: "1" },
			{ i: 1, ok: true, v: "hello" },
		];
		const msg = formatFailures(results, [
			{ tool: "assert", type: "visible", selector: ".a" },
			{ tool: "assert", type: "visible", selector: ".b" },
		] as AssertAction[]);
		expect(msg).toBeNull();
	});

	it("formats single failure with description", () => {
		const results: ParallelCheckResult[] = [
			{ i: 0, ok: true, v: "1" },
			{ i: 1, ok: false, v: "0" },
		];
		const msg = formatFailures(results, [
			{ tool: "assert", type: "visible", selector: ".a" },
			{ tool: "assert", type: "visible", selector: ".b", description: "B visible" },
		] as AssertAction[]);
		expect(msg).toContain("1 of 2 checks failed");
		expect(msg).toContain("[1] B visible");
	});

	it("formats multiple failures", () => {
		const results: ParallelCheckResult[] = [
			{ i: 0, ok: false, v: "0" },
			{ i: 1, ok: true, v: "1" },
			{ i: 2, ok: false, v: "", err: "TypeError" },
		];
		const msg = formatFailures(results, [
			{ tool: "assert", type: "visible", selector: ".a" },
			{ tool: "assert", type: "visible", selector: ".b" },
			{ tool: "assert", type: "visible", selector: ".c" },
		] as AssertAction[]);
		expect(msg).toContain("2 of 3 checks failed");
		expect(msg).toContain("[0]");
		expect(msg).toContain("[2]");
		expect(msg).toContain("TypeError");
	});

	it("uses fallback description when none provided", () => {
		const results: ParallelCheckResult[] = [
			{ i: 0, ok: false, v: "0" },
		];
		const msg = formatFailures(results, [
			{ tool: "assert", type: "visible", selector: ".x" },
		] as AssertAction[]);
		expect(msg).toContain("Expected '.x' to be visible");
	});
});

// ── validateParallelGroup ────────────────────────────────────────

describe("validateParallelGroup", () => {
	it("accepts valid assertion tools", () => {
		expect(() =>
			validateParallelGroup([
				{ tool: "assert", type: "visible", selector: ".a" },
				{ tool: "assert-text", selector: ".b", contains: "hi" },
				{ tool: "eval", code: "1+1", expect: { type: "truthy" } },
			] as any[]),
		).not.toThrow();
	});

	it("rejects assert type event", () => {
		expect(() =>
			validateParallelGroup([
				{ tool: "assert", type: "event", event: "hub.opened" },
			] as any[]),
		).toThrow("event");
	});

	it("rejects eval with store", () => {
		expect(() =>
			validateParallelGroup([
				{ tool: "eval", code: "1+1", store: "x" },
			] as any[]),
		).toThrow("store");
	});

	it("rejects nested parallel-group", () => {
		expect(() =>
			validateParallelGroup([
				{ tool: "parallel-group", actions: [] },
			] as any[]),
		).toThrow("nesting");
	});
});
