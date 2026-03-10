import { describe, it, expect, vi } from "vitest";
import {
	parseJourneyDefinition,
	validateRaw,
	validateJourney,
	loadJourneyFile,
} from "../../../../src/domain/e2e/journey/journey-loader.js";
import type { JourneyDefinition } from "../../../../src/domain/e2e/journey/journey-types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function validDefinition(): Record<string, unknown> {
	return {
		journey: "test",
		description: "A test journey",
		steps: [
			{
				id: "s1",
				title: "Step 1",
				description: "Do something",
				actions: [{ tool: "log", message: "hi" }],
			},
		],
	};
}

// ── validateRaw ──────────────────────────────────────────────────────

describe("validateRaw", () => {
	it("returns no errors for valid definition", () => {
		expect(validateRaw(validDefinition())).toEqual([]);
	});

	it("requires journey to be a non-empty string", () => {
		const errors = validateRaw({ ...validDefinition(), journey: "" });
		expect(errors).toHaveLength(1);
		expect(errors[0].path).toBe("journey");
	});

	it("requires journey field to exist", () => {
		const def = validDefinition();
		delete def.journey;
		const errors = validateRaw(def);
		expect(errors.some((e) => e.path === "journey")).toBe(true);
	});

	it("requires steps to be an array", () => {
		const errors = validateRaw({ ...validDefinition(), steps: "not-array" });
		expect(errors).toHaveLength(1);
		expect(errors[0].path).toBe("steps");
	});

	it("validates step id is non-empty", () => {
		const def = validDefinition();
		(def.steps as Record<string, unknown>[])[0].id = "";
		const errors = validateRaw(def);
		expect(errors.some((e) => e.path.includes("id"))).toBe(true);
	});

	it("validates step title is non-empty", () => {
		const def = validDefinition();
		(def.steps as Record<string, unknown>[])[0].title = "";
		const errors = validateRaw(def);
		expect(errors.some((e) => e.path.includes("title"))).toBe(true);
	});

	it("validates step actions is an array", () => {
		const def = validDefinition();
		(def.steps as Record<string, unknown>[])[0].actions = "bad";
		const errors = validateRaw(def);
		expect(errors.some((e) => e.path.includes("actions"))).toBe(true);
	});

	it("validates action tool is non-empty", () => {
		const def = validDefinition();
		(def.steps as Record<string, unknown>[])[0].actions = [{ tool: "" }];
		const errors = validateRaw(def);
		expect(errors.some((e) => e.path.includes("tool"))).toBe(true);
	});

	it("returns early when steps is not an array", () => {
		const errors = validateRaw({ journey: "test", steps: null });
		expect(errors).toHaveLength(1);
		expect(errors[0].path).toBe("steps");
	});
});

// ── parseJourneyDefinition ───────────────────────────────────────────

describe("parseJourneyDefinition", () => {
	it("parses valid JSON into JourneyDefinition", () => {
		const json = JSON.stringify(validDefinition());
		const def = parseJourneyDefinition(json);
		expect(def.journey).toBe("test");
		expect(def.steps).toHaveLength(1);
	});

	it("includes source path in error messages", () => {
		const json = JSON.stringify({ steps: "bad" });
		expect(() => parseJourneyDefinition(json, "my-file.journey"))
			.toThrow("my-file.journey");
	});

	it("throws on invalid JSON", () => {
		expect(() => parseJourneyDefinition("not json")).toThrow();
	});

	it("throws when required fields are missing", () => {
		const json = JSON.stringify({ journey: "", steps: [] });
		expect(() => parseJourneyDefinition(json)).toThrow("Invalid journey");
	});
});

// ── validateJourney ──────────────────────────────────────────────────

describe("validateJourney", () => {
	it("returns valid: true for correct definition", () => {
		const def = validDefinition() as unknown as JourneyDefinition;
		const result = validateJourney(def);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("returns valid: false with errors for bad definition", () => {
		const def = { steps: "bad" } as unknown as JourneyDefinition;
		const result = validateJourney(def);
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});
});

// ── loadJourneyFile ──────────────────────────────────────────────────

describe("loadJourneyFile", () => {
	it("reads and parses a journey file", () => {
		const readFile = vi.fn(() => JSON.stringify(validDefinition()));
		const def = loadJourneyFile(readFile, "/path/to/journey.journey");
		expect(readFile).toHaveBeenCalledWith("/path/to/journey.journey");
		expect(def.journey).toBe("test");
	});

	it("throws when file content is invalid", () => {
		const readFile = vi.fn(() => "{}");
		expect(() => loadJourneyFile(readFile, "/bad.journey")).toThrow();
	});

	it("propagates read errors", () => {
		const readFile = vi.fn(() => { throw new Error("ENOENT"); });
		expect(() => loadJourneyFile(readFile, "/missing.journey")).toThrow("ENOENT");
	});
});
