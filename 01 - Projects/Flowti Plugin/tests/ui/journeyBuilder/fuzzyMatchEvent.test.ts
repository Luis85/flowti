import { describe, it, expect } from "vitest";
import { scoreEvent, filterEvents } from "../../../src/ui/journeyBuilder/fuzzyMatchEvent";
import type { EventSuggestItem } from "../../../src/ui/journeyBuilder/EventSuggestTypes";

// ── scoreEvent ──────────────────────────────────────────

describe("scoreEvent", () => {
	it("returns 1000 for exact match", () => {
		expect(scoreEvent("hub.tab.changed", "hub.tab.changed")).toBe(1000);
	});

	it("exact match is case-insensitive", () => {
		expect(scoreEvent("Hub.Tab.Changed", "hub.tab.changed")).toBe(1000);
	});

	it("returns 500+ for prefix match", () => {
		const score = scoreEvent("hub.tab", "hub.tab.changed");
		expect(score).toBeGreaterThanOrEqual(500);
		expect(score).toBeLessThan(1000);
	});

	it("returns 300+ for segment-prefix match", () => {
		const score = scoreEvent("changed", "hub.tab.changed");
		expect(score).toBeGreaterThanOrEqual(300);
		expect(score).toBeLessThan(500);
	});

	it("returns positive score for subsequence match", () => {
		const score = scoreEvent("htc", "hub.tab.changed");
		expect(score).toBeGreaterThan(0);
		expect(score).toBeLessThan(300);
	});

	it("scores segment-boundary hits higher than mid-word", () => {
		// "hc" = h(ub).c(hanged) — both at segment start
		// vs hypothetical mid-word match
		const score = scoreEvent("hc", "hub.changed");
		expect(score).toBeGreaterThan(0);
	});

	it("returns 0 for no match", () => {
		expect(scoreEvent("xyz", "hub.tab.changed")).toBe(0);
	});

	it("returns 0 when query is longer than type", () => {
		expect(scoreEvent("hub.tab.changed.extra", "hub.tab.changed")).toBe(0);
	});

	it("is case-insensitive for subsequence", () => {
		const score = scoreEvent("HTC", "hub.tab.changed");
		expect(score).toBeGreaterThan(0);
	});

	it("ranks exact above prefix", () => {
		const exact = scoreEvent("hub.opened", "hub.opened");
		const prefix = scoreEvent("hub.open", "hub.opened");
		expect(exact).toBeGreaterThan(prefix);
	});

	it("ranks prefix above segment-prefix", () => {
		const prefix = scoreEvent("hub", "hub.tab.changed");
		const segPrefix = scoreEvent("tab", "hub.tab.changed");
		expect(prefix).toBeGreaterThan(segPrefix);
	});

	it("ranks segment-prefix above subsequence", () => {
		const segPrefix = scoreEvent("changed", "hub.tab.changed");
		const subseq = scoreEvent("htc", "hub.tab.changed");
		expect(segPrefix).toBeGreaterThan(subseq);
	});

	it("handles single-character query", () => {
		const score = scoreEvent("h", "hub.tab.changed");
		expect(score).toBeGreaterThan(0);
	});

	it("handles query with dots", () => {
		const score = scoreEvent("hub.tab", "hub.tab.changed");
		expect(score).toBeGreaterThanOrEqual(500);
	});
});

// ── filterEvents ────────────────────────────────────────

const SAMPLE_ITEMS: EventSuggestItem[] = [
	{ type: "hub.tab.changed", category: "Hub", description: "Tab was switched" },
	{ type: "hub.opened", category: "Hub", description: "Hub was opened" },
	{ type: "user.created", category: "User", description: "User was created" },
	{ type: "user.updated", category: "User", description: "User was updated" },
	{ type: "session.started", category: "Session", description: "Session started" },
	{ type: "session.ended", category: "Session", description: "Session ended" },
	{ type: "settings.changed", category: "Settings", description: "Settings changed" },
];

describe("filterEvents", () => {
	it("returns items alphabetically when query is empty", () => {
		const results = filterEvents(SAMPLE_ITEMS, "", 10);
		expect(results.length).toBe(7);
		expect(results[0].item.type).toBe("hub.opened");
		expect(results[1].item.type).toBe("hub.tab.changed");
	});

	it("respects limit on empty query", () => {
		const results = filterEvents(SAMPLE_ITEMS, "", 3);
		expect(results.length).toBe(3);
	});

	it("filters by query and sorts by score descending", () => {
		const results = filterEvents(SAMPLE_ITEMS, "session", 10);
		expect(results.length).toBe(2);
		expect(results[0].item.type).toMatch(/^session\./);
		expect(results[1].item.type).toMatch(/^session\./);
	});

	it("returns empty array when no matches", () => {
		const results = filterEvents(SAMPLE_ITEMS, "zzz", 10);
		expect(results.length).toBe(0);
	});

	it("respects limit on scored results", () => {
		const results = filterEvents(SAMPLE_ITEMS, "e", 2);
		expect(results.length).toBe(2);
	});

	it("handles whitespace-only query as empty", () => {
		const results = filterEvents(SAMPLE_ITEMS, "   ", 10);
		expect(results.length).toBe(7);
	});

	it("ranks exact match first", () => {
		const results = filterEvents(SAMPLE_ITEMS, "hub.opened", 10);
		expect(results[0].item.type).toBe("hub.opened");
		expect(results[0].score).toBe(1000);
	});

	it("all results have positive scores", () => {
		const results = filterEvents(SAMPLE_ITEMS, "hub", 10);
		for (const r of results) {
			expect(r.score).toBeGreaterThan(0);
		}
	});
});
