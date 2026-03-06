import { describe, it, expect } from "vitest";
import {
	parseJourneyDefinition,
	parseJourneyResult,
	deriveJourneyStatus,
	extractTools,
} from "../../../src/domain/testManagement/journeyParser";
import type { JourneyRegistryEntry } from "../../../src/domain/testManagement/types";

// ── parseJourneyDefinition ───────────────────────────────────

describe("parseJourneyDefinition", () => {
	it("parses a valid journey definition", () => {
		const result = parseJourneyDefinition({
			journey: "Getting Started",
			chapter: 1,
			type: "functional",
			domain: "onboarding",
			actors: ["User"],
			services: ["InstallerService"],
			steps: [
				{ id: "s1", title: "Open Hub", actions: [{ tool: "command", id: "flowti:open-hub" }] },
				{ id: "s2", title: "Click Tab", actions: [{ tool: "click", selector: ".tab" }] },
			],
		});

		expect(result).not.toBeNull();
		expect(result!.name).toBe("Getting Started");
		expect(result!.chapter).toBe(1);
		expect(result!.type).toBe("functional");
		expect(result!.domain).toBe("onboarding");
		expect(result!.actors).toEqual(["User"]);
		expect(result!.services).toEqual(["InstallerService"]);
		expect(result!.stepCount).toBe(2);
		expect(result!.tools).toEqual(["click", "command"]);
	});

	it("returns null for missing journey name", () => {
		expect(parseJourneyDefinition({ steps: [] })).toBeNull();
		expect(parseJourneyDefinition({ journey: "" })).toBeNull();
	});

	it("returns null for non-object input", () => {
		expect(parseJourneyDefinition(null as unknown as Record<string, unknown>)).toBeNull();
		expect(parseJourneyDefinition(undefined as unknown as Record<string, unknown>)).toBeNull();
	});

	it("defaults type to functional for unknown types", () => {
		const result = parseJourneyDefinition({ journey: "Test", type: "invalid-type", steps: [] });
		expect(result!.type).toBe("functional");
	});

	it("handles missing optional fields gracefully", () => {
		const result = parseJourneyDefinition({ journey: "Minimal", steps: [] });
		expect(result!.chapter).toBeUndefined();
		expect(result!.category).toBeUndefined();
		expect(result!.domain).toBeUndefined();
		expect(result!.prd).toBeUndefined();
		expect(result!.feature).toBeUndefined();
		expect(result!.actors).toEqual([]);
		expect(result!.services).toEqual([]);
		expect(result!.complianceTags).toEqual([]);
	});

	it("parses feature field when provided", () => {
		const result = parseJourneyDefinition({
			journey: "Feature Test",
			feature: "MVP - Product Development Lifecycle",
			steps: [],
		});
		expect(result!.feature).toBe("MVP - Product Development Lifecycle");
	});

	it("ignores non-string feature field", () => {
		const result = parseJourneyDefinition({
			journey: "Bad Feature",
			feature: 123,
			steps: [],
		});
		expect(result!.feature).toBeUndefined();
	});

	it("includes tools from setup and teardown steps", () => {
		const result = parseJourneyDefinition({
			journey: "Full",
			setup: [{ id: "setup", actions: [{ tool: "seed" }] }],
			steps: [{ id: "s1", actions: [{ tool: "click" }] }],
			teardown: [{ id: "td", actions: [{ tool: "close-leaves" }] }],
		});
		expect(result!.tools).toEqual(["click", "close-leaves", "seed"]);
	});

	it("parses compliance tags", () => {
		const result = parseJourneyDefinition({
			journey: "Compliant",
			steps: [],
			complianceTags: ["iso-9001:customer-focus", "iso-25010:usability"],
		});
		expect(result!.complianceTags).toEqual(["iso-9001:customer-focus", "iso-25010:usability"]);
	});

	it("parses valid journey types", () => {
		for (const type of ["functional", "regression", "smoke", "exploratory", "blueprint"]) {
			const result = parseJourneyDefinition({ journey: "T", type, steps: [] });
			expect(result!.type).toBe(type);
		}
	});
});

// ── parseJourneyResult ───────────────────────────────────────

describe("parseJourneyResult", () => {
	it("parses a valid journey result", () => {
		const result = parseJourneyResult({
			date: "2026-03-05T10:00:00Z",
			totalSteps: 8,
			passed: 7,
			failed: 1,
			skipped: 0,
			durationMs: 5000,
		});

		expect(result).not.toBeNull();
		expect(result!.totalSteps).toBe(8);
		expect(result!.passed).toBe(7);
		expect(result!.failed).toBe(1);
		expect(result!.durationMs).toBe(5000);
	});

	it("returns null for missing totalSteps", () => {
		expect(parseJourneyResult({ date: "2026-01-01", passed: 5 })).toBeNull();
	});

	it("returns null for non-object input", () => {
		expect(parseJourneyResult(null as unknown as Record<string, unknown>)).toBeNull();
	});

	it("defaults missing numeric fields to 0", () => {
		const result = parseJourneyResult({ totalSteps: 3 });
		expect(result!.passed).toBe(0);
		expect(result!.failed).toBe(0);
		expect(result!.skipped).toBe(0);
		expect(result!.durationMs).toBe(0);
	});

	it("generates date when not provided", () => {
		const result = parseJourneyResult({ totalSteps: 1 });
		expect(result!.date).toBeTruthy();
		expect(result!.date.length).toBeGreaterThan(0);
	});
});

// ── deriveJourneyStatus ──────────────────────────────────────

describe("deriveJourneyStatus", () => {
	function makeEntry(overrides?: Partial<JourneyRegistryEntry>): JourneyRegistryEntry {
		return {
			name: "Test",
			type: "functional",
			actors: [],
			services: [],
			stepCount: 1,
			tools: [],
			jsonPath: "test.json",
			complianceTags: [],
			runHistory: [],
			...overrides,
		};
	}

	it("returns never-run when no run history", () => {
		expect(deriveJourneyStatus(makeEntry())).toBe("never-run");
	});

	it("returns passing when latest run has zero failures", () => {
		const entry = makeEntry({
			lastRunResult: { date: new Date().toISOString(), totalSteps: 5, passed: 5, failed: 0, skipped: 0, durationMs: 1000 },
		});
		expect(deriveJourneyStatus(entry)).toBe("passing");
	});

	it("returns failing when latest run has failures", () => {
		const entry = makeEntry({
			lastRunResult: { date: new Date().toISOString(), totalSteps: 5, passed: 3, failed: 2, skipped: 0, durationMs: 1000 },
		});
		expect(deriveJourneyStatus(entry)).toBe("failing");
	});

	it("returns stale when latest run is older than threshold", () => {
		const oldDate = new Date();
		oldDate.setDate(oldDate.getDate() - 31);
		const entry = makeEntry({
			lastRunResult: { date: oldDate.toISOString(), totalSteps: 5, passed: 5, failed: 0, skipped: 0, durationMs: 1000 },
		});
		expect(deriveJourneyStatus(entry)).toBe("stale");
	});

	it("uses custom stale threshold", () => {
		const date = new Date();
		date.setDate(date.getDate() - 8);
		const entry = makeEntry({
			lastRunResult: { date: date.toISOString(), totalSteps: 5, passed: 5, failed: 0, skipped: 0, durationMs: 1000 },
		});
		expect(deriveJourneyStatus(entry, 7)).toBe("stale");
		expect(deriveJourneyStatus(entry, 10)).toBe("passing");
	});

	it("falls back to last runHistory entry when lastRunResult is undefined", () => {
		const entry = makeEntry({
			runHistory: [{ date: new Date().toISOString(), totalSteps: 3, passed: 2, failed: 1, skipped: 0, durationMs: 500 }],
		});
		expect(deriveJourneyStatus(entry)).toBe("failing");
	});
});

// ── extractTools ─────────────────────────────────────────────

describe("extractTools", () => {
	it("extracts unique tool names sorted alphabetically", () => {
		const result = extractTools([
			{ actions: [{ tool: "click" }, { tool: "wait" }] },
			{ actions: [{ tool: "click" }, { tool: "assert" }] },
		]);
		expect(result).toEqual(["assert", "click", "wait"]);
	});

	it("returns empty array for steps with no actions", () => {
		expect(extractTools([{ actions: [] }, {}])).toEqual([]);
	});

	it("skips entries with non-string tool values", () => {
		const result = extractTools([
			{ actions: [{ tool: "command" }, { tool: 42 as unknown as string }, { tool: "" }] },
		]);
		expect(result).toEqual(["command"]);
	});
});
