import { describe, it, expect } from "vitest";
import {
	groupByCategory,
	buildDomainSummary,
	detectPhantomEvents,
	generateEventCatalog,
} from "../../../src/domain/docs/eventCatalogGenerator";
import type { EventEntryInput } from "../../../src/domain/docs/eventCatalogGenerator";

const DATE = "2026-02-27T12:00:00.000Z";

const CATEGORIES = ["Plugin Lifecycle", "User", "Settings", "Analytics"] as const;

function entry(overrides: Partial<EventEntryInput> & { type: string }): EventEntryInput {
	return {
		category: "User",
		description: "Test event",
		direction: "Service → Listeners",
		domain: "user",
		services: "TestService",
		stability: "stable",
		visibility: "system-internal",
		tags: [],
		...overrides,
	};
}

describe("groupByCategory", () => {
	it("groups events by category in display order", () => {
		const events = [
			entry({ type: "user.created", category: "User" }),
			entry({ type: "plugin.loaded", category: "Plugin Lifecycle" }),
			entry({ type: "user.updated", category: "User" }),
		];

		const groups = groupByCategory(events, CATEGORIES);
		const keys = Array.from(groups.keys());

		expect(keys[0]).toBe("Plugin Lifecycle");
		expect(keys[1]).toBe("User");
		expect(groups.get("Plugin Lifecycle")).toHaveLength(1);
		expect(groups.get("User")).toHaveLength(2);
	});

	it("removes empty categories", () => {
		const events = [entry({ type: "user.created", category: "User" })];
		const groups = groupByCategory(events, CATEGORIES);

		expect(groups.has("Plugin Lifecycle")).toBe(false);
		expect(groups.has("Settings")).toBe(false);
		expect(groups.has("User")).toBe(true);
	});

	it("handles unknown categories", () => {
		const events = [entry({ type: "custom.event", category: "Custom" })];
		const groups = groupByCategory(events, CATEGORIES);

		expect(groups.has("Custom")).toBe(true);
		expect(groups.get("Custom")).toHaveLength(1);
	});

	it("returns empty map for empty input", () => {
		const groups = groupByCategory([], CATEGORIES);
		expect(groups.size).toBe(0);
	});
});

describe("buildDomainSummary", () => {
	it("counts events per domain", () => {
		const events = [
			entry({ type: "a", domain: "user" }),
			entry({ type: "b", domain: "user" }),
			entry({ type: "c", domain: "analytics" }),
		];

		const summary = buildDomainSummary(events);

		expect(summary.get("analytics")).toBe(1);
		expect(summary.get("user")).toBe(2);
	});

	it("sorts domains alphabetically", () => {
		const events = [
			entry({ type: "a", domain: "user" }),
			entry({ type: "b", domain: "analytics" }),
			entry({ type: "c", domain: "infrastructure" }),
		];

		const keys = Array.from(buildDomainSummary(events).keys());
		expect(keys).toEqual(["analytics", "infrastructure", "user"]);
	});

	it("returns empty map for empty input", () => {
		expect(buildDomainSummary([]).size).toBe(0);
	});
});

describe("detectPhantomEvents", () => {
	it("detects added events", () => {
		const result = detectPhantomEvents(["a", "b", "c"], ["a", "b"]);
		expect(result.added).toEqual(["c"]);
		expect(result.removed).toEqual([]);
	});

	it("detects removed events", () => {
		const result = detectPhantomEvents(["a", "b"], ["a", "b", "c"]);
		expect(result.added).toEqual([]);
		expect(result.removed).toEqual(["c"]);
	});

	it("detects both added and removed", () => {
		const result = detectPhantomEvents(["a", "c"], ["a", "b"]);
		expect(result.added).toEqual(["c"]);
		expect(result.removed).toEqual(["b"]);
	});

	it("returns empty when lists match", () => {
		const result = detectPhantomEvents(["a", "b"], ["a", "b"]);
		expect(result.added).toEqual([]);
		expect(result.removed).toEqual([]);
	});
});

describe("generateEventCatalog", () => {
	const sampleEvents: EventEntryInput[] = [
		entry({ type: "plugin.loaded", category: "Plugin Lifecycle", domain: "infrastructure", services: "Plugin", tags: ["system"] }),
		entry({ type: "user.created", category: "User", domain: "user", services: "UserService" }),
		entry({ type: "user.updated", category: "User", domain: "user", services: "UserService" }),
		entry({ type: "analytics.query.started", category: "Analytics", domain: "analytics", services: "AnalyticsService" }),
	];

	it("includes frontmatter with correct counts", () => {
		const md = generateEventCatalog(sampleEvents, CATEGORIES, DATE);

		expect(md).toContain("type: EventCatalog");
		expect(md).toContain("total_events: 4");
		expect(md).toContain("categories: 3");
		expect(md).toContain("domains: 3");
	});

	it("includes domain summary table", () => {
		const md = generateEventCatalog(sampleEvents, CATEGORIES, DATE);

		expect(md).toContain("## Domain Summary");
		expect(md).toContain("| analytics | 1 |");
		expect(md).toContain("| infrastructure | 1 |");
		expect(md).toContain("| user | 2 |");
	});

	it("includes category sections in display order", () => {
		const md = generateEventCatalog(sampleEvents, CATEGORIES, DATE);

		const lifecycleIdx = md.indexOf("## Plugin Lifecycle");
		const userIdx = md.indexOf("## User");
		const analyticsIdx = md.indexOf("## Analytics");

		expect(lifecycleIdx).toBeGreaterThan(-1);
		expect(userIdx).toBeGreaterThan(lifecycleIdx);
		expect(analyticsIdx).toBeGreaterThan(userIdx);
	});

	it("renders event table with all columns", () => {
		const md = generateEventCatalog(sampleEvents, CATEGORIES, DATE);

		expect(md).toContain("| Event | Description | Direction | Domain | Services | Stability | Visibility |");
		expect(md).toContain("| `plugin.loaded` |");
		expect(md).toContain("| `user.created` |");
	});

	it("handles empty event list", () => {
		const md = generateEventCatalog([], CATEGORIES, DATE);

		expect(md).toContain("total_events: 0");
		expect(md).toContain("categories: 0");
		expect(md).toContain("domains: 0");
	});

	it("includes stability and visibility in event rows", () => {
		const events = [
			entry({ type: "test.event", stability: "experimental", visibility: "user-facing" }),
		];
		const md = generateEventCatalog(events, CATEGORIES, DATE);

		expect(md).toContain("experimental");
		expect(md).toContain("user-facing");
	});
});
