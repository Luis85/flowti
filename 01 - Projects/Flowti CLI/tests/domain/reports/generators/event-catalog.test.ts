import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
		basename: (p: string) => p.split("/").pop() ?? "",
	},
}));

vi.mock("../../../../src/infrastructure/config.js", () => ({
	PLUGIN_ROOT: "/plugin",
}));

vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: {
		now: () => new Date("2026-03-10T12:00:00Z"),
		iso: () => "2026-03-10T12:00:00.000Z",
		safeIso: () => "2026-03-10T12-00-00",
	},
}));

beforeEach(() => {
	vi.clearAllMocks();
});

import { extractCategories, extractCatalogEntries } from "../../../../src/domain/reports/generators/event-catalog.js";

interface CatalogEntry {
	type: string;
	category: string;
	description: string;
	direction: string;
	domain: string;
	services: string;
	stability: string;
	visibility: string;
	tags: string[];
}

function groupByCategory(categories: string[], events: CatalogEntry[]): Map<string, CatalogEntry[]> {
	const groups = new Map<string, CatalogEntry[]>();
	for (const cat of categories) groups.set(cat, []);
	for (const event of events) {
		const list = groups.get(event.category);
		if (list) list.push(event);
		else groups.set(event.category, [event]);
	}
	for (const [cat, entries] of groups) {
		if (entries.length === 0) groups.delete(cat);
	}
	return groups;
}

function getDomainSummary(events: CatalogEntry[]): [string, number][] {
	const counts = new Map<string, number>();
	for (const e of events) counts.set(e.domain, (counts.get(e.domain) ?? 0) + 1);
	return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

describe("event-catalog generator", () => {
	describe("extractCategories", () => {
		it("extracts categories from source", () => {
			const source = `export const EVENT_CATEGORIES = ["Core", "Lifecycle", "User"] as const;`;
			expect(extractCategories(source)).toEqual(["Core", "Lifecycle", "User"]);
		});

		it("returns empty for no match", () => {
			expect(extractCategories("const x = 1;")).toEqual([]);
		});

		it("handles multiline", () => {
			const source = `export const EVENT_CATEGORIES = [
				"Core",
				"Lifecycle",
			] as const;`;
			expect(extractCategories(source)).toEqual(["Core", "Lifecycle"]);
		});
	});

	describe("extractCatalogEntries", () => {
		it("extracts entries from CATALOG_DATA", () => {
			const source = `
				const CATALOG_DATA = {
					"app.started": { category: "Core", description: "App has started", direction: "outbound", domain: "lifecycle", services: "MainService", stability: "stable", visibility: "public", tags: ["system"] },
				};
			`;
			const entries = extractCatalogEntries(source);
			expect(entries).toHaveLength(1);
			expect(entries[0].type).toBe("app.started");
			expect(entries[0].category).toBe("Core");
			expect(entries[0].description).toBe("App has started");
			expect(entries[0].tags).toEqual(["system"]);
		});

		it("defaults stability to stable", () => {
			const source = `
				const CATALOG_DATA = {
					"test.event": { category: "Test", description: "A test event", direction: "inbound", domain: "test", services: "Svc" },
				};
			`;
			const entries = extractCatalogEntries(source);
			expect(entries[0].stability).toBe("stable");
		});

		it("defaults visibility to system-internal", () => {
			const source = `
				const CATALOG_DATA = {
					"test.event": { category: "Test", description: "A test event", direction: "inbound", domain: "test", services: "Svc" },
				};
			`;
			const entries = extractCatalogEntries(source);
			expect(entries[0].visibility).toBe("system-internal");
		});

		it("returns empty for missing CATALOG_DATA", () => {
			expect(extractCatalogEntries("const x = 1;")).toEqual([]);
		});

		it("handles multiple tags", () => {
			const source = `
				const CATALOG_DATA = {
					"multi.tag": { category: "Core", description: "Multi", direction: "both", domain: "core", services: "Svc", tags: ["system", "internal"] },
				};
			`;
			const entries = extractCatalogEntries(source);
			expect(entries[0].tags).toEqual(["system", "internal"]);
		});
	});

	describe("groupByCategory", () => {
		const makeEntry = (type: string, category: string): CatalogEntry => ({
			type, category, description: "", direction: "", domain: "", services: "", stability: "stable", visibility: "", tags: [],
		});

		it("groups events into categories", () => {
			const categories = ["Core", "User"];
			const events = [makeEntry("a", "Core"), makeEntry("b", "User"), makeEntry("c", "Core")];
			const groups = groupByCategory(categories, events);
			expect(groups.get("Core")).toHaveLength(2);
			expect(groups.get("User")).toHaveLength(1);
		});

		it("removes empty categories", () => {
			const categories = ["Core", "Empty"];
			const events = [makeEntry("a", "Core")];
			const groups = groupByCategory(categories, events);
			expect(groups.has("Empty")).toBe(false);
		});

		it("creates category for uncategorized events", () => {
			const categories = ["Core"];
			const events = [makeEntry("a", "Uncategorized")];
			const groups = groupByCategory(categories, events);
			expect(groups.get("Uncategorized")).toHaveLength(1);
		});
	});

	describe("getDomainSummary", () => {
		const makeEntry = (domain: string): CatalogEntry => ({
			type: "", category: "", description: "", direction: "", domain, services: "", stability: "", visibility: "", tags: [],
		});

		it("counts events per domain sorted alphabetically", () => {
			const events = [makeEntry("build"), makeEntry("analytics"), makeEntry("build")];
			const summary = getDomainSummary(events);
			expect(summary).toEqual([["analytics", 1], ["build", 2]]);
		});

		it("returns empty for no events", () => {
			expect(getDomainSummary([])).toEqual([]);
		});
	});
});
