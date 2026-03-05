import { describe, it, expect } from "vitest";
import { validateAction, validateStep, runPreview } from "../../../src/domain/journeyBuilder/previewRunner";
import type { JourneyAction } from "../../../src/domain/journeyBuilder/types";

// ── Tests ───────────────────────────────────────────────────────────

describe("validateAction", () => {
	it("returns no errors for valid action with all required fields", () => {
		const action: JourneyAction = { tool: "command", id: "flowti:open-hub" };
		expect(validateAction(action, 0, 0)).toEqual([]);
	});

	it("returns error for unknown tool name", () => {
		const action: JourneyAction = { tool: "nonexistent" as JourneyAction["tool"] };
		const errors = validateAction(action, 0, 0);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("unknown tool");
	});

	it("returns error for missing required field", () => {
		const action: JourneyAction = { tool: "command" }; // missing "id"
		const errors = validateAction(action, 0, 0);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('missing required "id"');
	});

	it("returns no error when optional field is absent", () => {
		// "set-input" has required "selector" and "value", optional "dispatchEvent"
		const action: JourneyAction = { tool: "set-input", selector: ".el", value: "hello" };
		expect(validateAction(action, 0, 0)).toEqual([]);
	});

	it("skips required check when visibleWhen condition is not met", () => {
		// "assert" has fields with visibleWhen — e.g. "selector" only required when type is visible/not-visible/text/count/attr
		// When type is "event", selector should not be required
		const action: JourneyAction = { tool: "assert", type: "event", event: "my.event" };
		const errors = validateAction(action, 0, 0);
		expect(errors.some((e) => e.includes('"selector"'))).toBe(false);
	});

	it("enforces required field when visibleWhen condition is met", () => {
		// "assert-text" has required "selector" and "contains" — no visibleWhen, always required
		const action: JourneyAction = { tool: "assert-text" }; // missing both
		const errors = validateAction(action, 0, 0);
		expect(errors.some((e) => e.includes('"selector"'))).toBe(true);
		expect(errors.some((e) => e.includes('"contains"'))).toBe(true);
	});
});

describe("validateStep", () => {
	it("returns pass for step with title and valid actions", () => {
		const result = validateStep(
			{ id: "s1", title: "My step", actions: [{ tool: "command", id: "flowti:open" }] },
			0,
		);
		expect(result.status).toBe("pass");
		expect(result.errors).toHaveLength(0);
	});

	it("returns fail for step with empty title", () => {
		const result = validateStep(
			{ id: "s1", title: "", actions: [{ tool: "command", id: "flowti:open" }] },
			0,
		);
		expect(result.status).toBe("fail");
		expect(result.errors.some((e) => e.includes("missing title"))).toBe(true);
	});

	it("returns fail for step with no actions", () => {
		const result = validateStep(
			{ id: "s1", title: "My step", actions: [] },
			0,
		);
		expect(result.status).toBe("fail");
		expect(result.errors.some((e) => e.includes("no actions"))).toBe(true);
	});

	it("collects errors from multiple invalid actions", () => {
		const result = validateStep(
			{
				id: "s1",
				title: "Step",
				actions: [
					{ tool: "command" }, // missing id
					{ tool: "click" }, // missing selector
				],
			},
			0,
		);
		expect(result.status).toBe("fail");
		expect(result.errors).toHaveLength(2);
	});
});

describe("runPreview", () => {
	it("returns correct totals for mixed pass/fail steps", () => {
		const result = runPreview([
			{ id: "s1", title: "Good", actions: [{ tool: "command", id: "foo" }] },
			{ id: "s2", title: "Bad", actions: [{ tool: "command" }] }, // missing id
			{ id: "s3", title: "Also good", actions: [{ tool: "wait", ms: "500" }] },
		]);
		expect(result.totalSteps).toBe(3);
		expect(result.passed).toBe(2);
		expect(result.failed).toBe(1);
		expect(result.steps[0].status).toBe("pass");
		expect(result.steps[1].status).toBe("fail");
		expect(result.steps[2].status).toBe("pass");
	});

	it("returns all-pass for valid journey", () => {
		const result = runPreview([
			{ id: "s1", title: "Step 1", actions: [{ tool: "command", id: "foo" }] },
			{ id: "s2", title: "Step 2", actions: [{ tool: "click", selector: ".btn" }] },
		]);
		expect(result.passed).toBe(2);
		expect(result.failed).toBe(0);
	});

	it("handles empty steps array", () => {
		const result = runPreview([]);
		expect(result.totalSteps).toBe(0);
		expect(result.passed).toBe(0);
		expect(result.failed).toBe(0);
		expect(result.steps).toEqual([]);
	});
});
