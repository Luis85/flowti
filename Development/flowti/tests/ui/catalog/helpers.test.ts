import { describe, it, expect } from "vitest";
import type { EventCatalogEntry } from "../../../src/infrastructure/events/catalog";
import type { DiscoveredEvent } from "../../../src/domain/discovery/types";
import type { CatalogCategoryConfig } from "../../../src/domain/settings/settings";
import type { Subscription } from "../../../src/domain/subscription/types";
import type { EventDefinition } from "../../../src/domain/eventDefinition/types";
import type {
	FlowEntry,
	SystemEntry,
	ActorEntry,
	ProductEntry,
} from "../../../src/ui/catalog/types";
import {
	fmString,
	fmStringArray,
	isDiscoveredEvent,
	isSystemOnly,
	isConfigured,
	getOrderedCategories,
	getSourcePath,
	findRelatedFlows,
	findRelatedSystems,
	findRelatedActors,
	findRelatedProducts,
} from "../../../src/ui/catalog/helpers";

// ── Fixtures ─────────────────────────────────────────────────

function makeEntry(overrides: Partial<EventCatalogEntry> = {}): EventCatalogEntry {
	return {
		type: "test.event",
		category: "Test",
		description: "A test event",
		direction: "Service → Listeners",
		domain: "test",
		services: "TestService",
		tags: [],
		...overrides,
	} as EventCatalogEntry;
}

function makeDiscovered(overrides: Partial<DiscoveredEvent> = {}): DiscoveredEvent {
	return {
		eventName: "custom.event",
		sourcePath: "Events/custom event.md",
		triggerCount: 1,
		lastTriggered: "2026-01-01",
		...overrides,
	} as DiscoveredEvent;
}

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
	return {
		id: "sub-1",
		eventType: "file.created",
		label: "My Watcher",
		enabled: true,
		filters: {},
		createdAt: "2026-01-01",
		...overrides,
	};
}

function makeDef(overrides: Partial<EventDefinition> = {}): EventDefinition {
	return {
		id: "def-1",
		sourceEventType: "file.created",
		filePattern: "**/*.csv",
		domainEventName: "report.received",
		emissionPolicy: "always",
		payloadMappings: [],
		enabled: true,
		createdAt: "2026-01-01",
		...overrides,
	};
}

function makeFlow(overrides: Partial<FlowEntry> = {}): FlowEntry {
	return {
		name: "Daily Report",
		description: "Processes daily reports",
		events: ["file.created", "ingestion.job.completed"],
		domains: ["reporting"],
		services: ["IngestionService"],
		filePath: "docs/Flows/Daily Report.md",
		resolvedEvents: [],
		...overrides,
	};
}

function makeSystem(overrides: Partial<SystemEntry> = {}): SystemEntry {
	return {
		name: "CRM System",
		description: "External CRM",
		domains: ["sales"],
		services: ["ImportService"],
		filePath: "docs/Systems/CRM System.md",
		events: [makeEntry({ type: "file.created" })],
		...overrides,
	};
}

function makeActor(overrides: Partial<ActorEntry> = {}): ActorEntry {
	return {
		name: "Data Analyst",
		description: "Analyses reports",
		events: ["export.completed"],
		domains: ["reporting"],
		services: ["ExportService"],
		filePath: "docs/Actors/Data Analyst.md",
		resolvedEvents: [],
		...overrides,
	};
}

function makeProduct(overrides: Partial<ProductEntry> = {}): ProductEntry {
	return {
		name: "Dashboard",
		description: "Analytics dashboard",
		events: ["export.completed"],
		domains: ["reporting"],
		services: ["ExportService"],
		filePath: "docs/Products/Dashboard.md",
		resolvedEvents: [],
		...overrides,
	};
}

// ── Tests ────────────────────────────────────────────────────

describe("catalog helpers", () => {
	// ── Frontmatter Parsing ──────────────────────────────────

	describe("fmString", () => {
		it("should return trimmed string value", () => {
			expect(fmString({ title: "  Hello  " }, "title")).toBe("Hello");
		});

		it("should return undefined for missing key", () => {
			expect(fmString({ title: "Hello" }, "missing")).toBeUndefined();
		});

		it("should return undefined for empty string", () => {
			expect(fmString({ title: "" }, "title")).toBeUndefined();
		});

		it("should return undefined for whitespace-only string", () => {
			expect(fmString({ title: "   " }, "title")).toBeUndefined();
		});

		it("should return undefined for non-string value", () => {
			expect(fmString({ count: 42 }, "count")).toBeUndefined();
		});

		it("should return undefined when fm is undefined", () => {
			expect(fmString(undefined, "title")).toBeUndefined();
		});
	});

	describe("fmStringArray", () => {
		it("should return array of strings", () => {
			expect(fmStringArray({ tags: ["a", "b"] }, "tags")).toEqual(["a", "b"]);
		});

		it("should filter out non-string elements", () => {
			expect(fmStringArray({ tags: ["a", 42, "b", null] }, "tags")).toEqual(["a", "b"]);
		});

		it("should return empty array for missing key", () => {
			expect(fmStringArray({ tags: ["a"] }, "missing")).toEqual([]);
		});

		it("should return empty array for non-array value", () => {
			expect(fmStringArray({ tags: "not-an-array" }, "tags")).toEqual([]);
		});

		it("should return empty array when fm is undefined", () => {
			expect(fmStringArray(undefined, "tags")).toEqual([]);
		});
	});

	// ── Event Classification ─────────────────────────────────

	describe("isDiscoveredEvent", () => {
		it("should return true for discovered event types", () => {
			const discovered = [makeDiscovered({ eventName: "custom.report" })];
			expect(isDiscoveredEvent("custom.report", discovered)).toBe(true);
		});

		it("should return false for unknown event types", () => {
			const discovered = [makeDiscovered({ eventName: "custom.report" })];
			expect(isDiscoveredEvent("file.created", discovered)).toBe(false);
		});

		it("should return false for empty discovered list", () => {
			expect(isDiscoveredEvent("custom.report", [])).toBe(false);
		});
	});

	describe("isSystemOnly", () => {
		it("should return true when all events have system tag", () => {
			const events = [
				makeEntry({ tags: ["system"] }),
				makeEntry({ type: "other", tags: ["system"] }),
			];
			expect(isSystemOnly(events)).toBe(true);
		});

		it("should return false when any event lacks system tag", () => {
			const events = [
				makeEntry({ tags: ["system"] }),
				makeEntry({ type: "other", tags: [] }),
			];
			expect(isSystemOnly(events)).toBe(false);
		});

		it("should return false for empty events list", () => {
			expect(isSystemOnly([])).toBe(false);
		});
	});

	describe("isConfigured", () => {
		it("should return true when subscription matches", () => {
			const subs = [makeSub({ eventType: "file.created" })];
			expect(isConfigured("file.created", subs, [])).toBe(true);
		});

		it("should return true when definition matches", () => {
			const defs = [makeDef({ sourceEventType: "file.created" })];
			expect(isConfigured("file.created", [], defs)).toBe(true);
		});

		it("should return false when neither matches", () => {
			const subs = [makeSub({ eventType: "file.modified" })];
			const defs = [makeDef({ sourceEventType: "file.deleted" })];
			expect(isConfigured("file.created", subs, defs)).toBe(false);
		});

		it("should return false for empty lists", () => {
			expect(isConfigured("file.created", [], [])).toBe(false);
		});
	});

	// ── Category Ordering ────────────────────────────────────

	describe("getOrderedCategories", () => {
		it("should preserve existing categories", () => {
			const cats: CatalogCategoryConfig[] = [
				{ name: "User", visible: false },
				{ name: "Settings", visible: true },
			];
			const result = getOrderedCategories(cats);
			// User and Settings should be in the result with their visibility preserved
			const user = result.find((c) => c.name === "User");
			const settings = result.find((c) => c.name === "Settings");
			expect(user).toEqual({ name: "User", visible: false });
			expect(settings).toEqual({ name: "Settings", visible: true });
		});

		it("should add missing known categories as visible", () => {
			const cats: CatalogCategoryConfig[] = [
				{ name: "User", visible: true },
			];
			const result = getOrderedCategories(cats);
			// Should include all EVENT_CATEGORIES, including ones not in input
			expect(result.length).toBeGreaterThan(1);
			// Added categories should default to visible
			const added = result.filter((c) => c.name !== "User");
			for (const c of added) {
				expect(c.visible).toBe(true);
			}
		});

		it("should filter out unknown categories from settings", () => {
			const cats: CatalogCategoryConfig[] = [
				{ name: "NonExistent", visible: true },
				{ name: "User", visible: true },
			];
			const result = getOrderedCategories(cats);
			expect(result.find((c) => c.name === "NonExistent")).toBeUndefined();
			expect(result.find((c) => c.name === "User")).toBeDefined();
		});
	});

	// ── Source Path Lookup ────────────────────────────────────

	describe("getSourcePath", () => {
		it("should return source path for matching event", () => {
			const discovered = [
				makeDiscovered({ eventName: "custom.report", sourcePath: "Events/report.md" }),
			];
			expect(getSourcePath(discovered, "custom.report")).toBe("Events/report.md");
		});

		it("should return undefined for unknown event", () => {
			const discovered = [
				makeDiscovered({ eventName: "custom.report", sourcePath: "Events/report.md" }),
			];
			expect(getSourcePath(discovered, "unknown.event")).toBeUndefined();
		});

		it("should return undefined for empty list", () => {
			expect(getSourcePath([], "custom.report")).toBeUndefined();
		});
	});

	// ── Cross-Reference Helpers ──────────────────────────────

	describe("findRelatedFlows", () => {
		const flows = [
			makeFlow({ name: "Daily Report", events: ["file.created"], domains: ["reporting"] }),
			makeFlow({ name: "User Onboard", events: ["user.created"], domains: ["auth"], services: ["UserService"] }),
			makeFlow({ name: "Export Flow", events: ["export.started"], domains: ["data"], services: ["ExportService"] }),
		];

		it("should match by overlapping events", () => {
			const result = findRelatedFlows(flows, { events: ["file.created"] });
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Daily Report");
		});

		it("should match by overlapping domains", () => {
			const result = findRelatedFlows(flows, { domains: ["auth"] });
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("User Onboard");
		});

		it("should match by overlapping services", () => {
			const result = findRelatedFlows(flows, { services: ["ExportService"] });
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Export Flow");
		});

		it("should return multiple matches", () => {
			const result = findRelatedFlows(flows, { domains: ["reporting", "auth"] });
			expect(result).toHaveLength(2);
		});

		it("should return empty for no overlap", () => {
			const result = findRelatedFlows(flows, { events: ["nonexistent"] });
			expect(result).toHaveLength(0);
		});

		it("should return empty for empty criteria", () => {
			const result = findRelatedFlows(flows, {});
			expect(result).toHaveLength(0);
		});
	});

	describe("findRelatedSystems", () => {
		const systems = [
			makeSystem({ name: "CRM", domains: ["sales"], services: ["CrmConnector"], events: [makeEntry({ type: "crm.synced" })] }),
			makeSystem({ name: "ERP", domains: ["finance"], services: ["ErpConnector"], events: [makeEntry({ type: "erp.updated" })] }),
		];

		it("should match by overlapping events (checks entry.type)", () => {
			const result = findRelatedSystems(systems, { events: ["crm.synced"] });
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("CRM");
		});

		it("should match by overlapping domains", () => {
			const result = findRelatedSystems(systems, { domains: ["finance"] });
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("ERP");
		});

		it("should match by overlapping services", () => {
			const result = findRelatedSystems(systems, { services: ["ErpConnector"] });
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("ERP");
		});

		it("should return empty for no overlap", () => {
			expect(findRelatedSystems(systems, { events: ["unknown"] })).toHaveLength(0);
		});
	});

	describe("findRelatedActors", () => {
		const actors = [
			makeActor({ name: "Analyst", events: ["export.completed"], domains: ["reporting"] }),
			makeActor({ name: "Admin", events: ["user.created"], domains: ["auth"] }),
		];

		it("should match by overlapping events", () => {
			const result = findRelatedActors(actors, { events: ["export.completed"] });
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Analyst");
		});

		it("should match by overlapping domains", () => {
			const result = findRelatedActors(actors, { domains: ["auth"] });
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Admin");
		});

		it("should return empty for no overlap", () => {
			expect(findRelatedActors(actors, { services: ["NonService"] })).toHaveLength(0);
		});
	});

	describe("findRelatedProducts", () => {
		const products = [
			makeProduct({ name: "Dashboard", domains: ["reporting"], services: ["ChartService"], events: ["chart.rendered"] }),
			makeProduct({ name: "Inbox", domains: ["messaging"], services: ["MailService"], events: ["message.received"] }),
		];

		it("should match by overlapping domains", () => {
			const result = findRelatedProducts(products, { domains: ["reporting"] });
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Dashboard");
		});

		it("should match by overlapping services", () => {
			const result = findRelatedProducts(products, { services: ["ChartService"] });
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Dashboard");
		});

		it("should match by overlapping events", () => {
			const result = findRelatedProducts(products, { events: ["message.received"] });
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Inbox");
		});

		it("should return empty for no overlap", () => {
			expect(findRelatedProducts(products, { domains: ["unknown"] })).toHaveLength(0);
		});
	});
});
