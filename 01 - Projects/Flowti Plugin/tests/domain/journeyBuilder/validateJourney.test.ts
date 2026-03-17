import { describe, it, expect } from "vitest";
import { validateJourneyJSON } from "../../../src/domain/journeyBuilder/validateJourney";

describe("validateJourneyJSON", () => {
	const validJourney = JSON.stringify({
		journey: "Test Journey",
		description: "A test",
		startEvent: "app.opened",
		endEvent: "app.closed",
		steps: [
			{ id: "step-1", title: "Open hub", actions: [{ tool: "command", id: "test" }] },
			{ id: "step-2", title: "Verify", actions: [] },
		],
	});

	// ── JSON parsing ────────────────────────────────────────────

	it("accepts valid journey JSON", () => {
		const result = validateJourneyJSON(validJourney);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.data).toBeDefined();
	});

	it("rejects invalid JSON syntax", () => {
		const result = validateJourneyJSON("{bad json");
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toMatch(/Invalid JSON/);
	});

	it("rejects JSON that is an array", () => {
		const result = validateJourneyJSON("[1, 2, 3]");
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("JSON object");
	});

	it("rejects JSON that is a primitive", () => {
		const result = validateJourneyJSON('"hello"');
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("JSON object");
	});

	it("rejects null JSON", () => {
		const result = validateJourneyJSON("null");
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("JSON object");
	});

	// ── Required fields ─────────────────────────────────────────

	it("requires journey field", () => {
		const result = validateJourneyJSON(JSON.stringify({ steps: [] }));
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining('"journey"'));
	});

	it("rejects empty journey name", () => {
		const result = validateJourneyJSON(JSON.stringify({ journey: "", steps: [] }));
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining('"journey"'));
	});

	it("requires steps field", () => {
		const result = validateJourneyJSON(JSON.stringify({ journey: "Test" }));
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining('"steps"'));
	});

	it("rejects non-array steps", () => {
		const result = validateJourneyJSON(JSON.stringify({ journey: "Test", steps: "not an array" }));
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining('"steps"'));
	});

	// ── Step validation ─────────────────────────────────────────

	it("requires step id", () => {
		const result = validateJourneyJSON(JSON.stringify({
			journey: "Test",
			steps: [{ title: "Step without id" }],
		}));
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("Step 1"));
		expect(result.errors).toContainEqual(expect.stringContaining('"id"'));
	});

	it("requires step title", () => {
		const result = validateJourneyJSON(JSON.stringify({
			journey: "Test",
			steps: [{ id: "step-1" }],
		}));
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("Step 1"));
		expect(result.errors).toContainEqual(expect.stringContaining('"title"'));
	});

	it("rejects non-object step", () => {
		const result = validateJourneyJSON(JSON.stringify({
			journey: "Test",
			steps: ["not an object"],
		}));
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("Step 1"));
		expect(result.errors).toContainEqual(expect.stringContaining("must be an object"));
	});

	it("rejects null step", () => {
		const result = validateJourneyJSON(JSON.stringify({
			journey: "Test",
			steps: [null],
		}));
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("Step 1"));
	});

	// ── Action validation ───────────────────────────────────────

	it("rejects non-array actions", () => {
		const result = validateJourneyJSON(JSON.stringify({
			journey: "Test",
			steps: [{ id: "step-1", title: "Test", actions: "not an array" }],
		}));
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining('"actions" must be an array'));
	});

	it("rejects action without tool", () => {
		const result = validateJourneyJSON(JSON.stringify({
			journey: "Test",
			steps: [{ id: "step-1", title: "Test", actions: [{ selector: ".btn" }] }],
		}));
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining('"tool"'));
	});

	it("rejects non-object action", () => {
		const result = validateJourneyJSON(JSON.stringify({
			journey: "Test",
			steps: [{ id: "step-1", title: "Test", actions: ["click"] }],
		}));
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("action 1"));
	});

	// ── Edge cases ──────────────────────────────────────────────

	it("accepts steps without actions field", () => {
		const result = validateJourneyJSON(JSON.stringify({
			journey: "Test",
			steps: [{ id: "step-1", title: "Manual step" }],
		}));
		expect(result.valid).toBe(true);
	});

	it("accepts empty steps array", () => {
		const result = validateJourneyJSON(JSON.stringify({
			journey: "Test",
			steps: [],
		}));
		expect(result.valid).toBe(true);
	});

	it("accepts minimal valid journey", () => {
		const result = validateJourneyJSON(JSON.stringify({
			journey: "Minimal",
			steps: [{ id: "s1", title: "Only step" }],
		}));
		expect(result.valid).toBe(true);
	});

	it("collects multiple errors", () => {
		const result = validateJourneyJSON(JSON.stringify({
			steps: [{ actions: "bad" }],
		}));
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(1);
	});

	it("returns parsed data even with errors", () => {
		const result = validateJourneyJSON(JSON.stringify({ steps: [] }));
		expect(result.valid).toBe(false);
		expect(result.data).toBeDefined();
		expect(result.data!.steps).toEqual([]);
	});
});
