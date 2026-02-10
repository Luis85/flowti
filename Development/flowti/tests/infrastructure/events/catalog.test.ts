import { describe, it, expect } from "vitest";
import {
	EVENT_CATALOG,
	EVENT_CATEGORIES,
	getEventsByCategory,
	getEventCategory,
	getEventEntry,
} from "../../../src/infrastructure/events/catalog";

/**
 * Catalog completeness against FlowtiEventMap is enforced at compile
 * time via `satisfies Record<keyof FlowtiEventMap, EventCatalogMeta>`.
 * These tests cover structural integrity and runtime helper functions.
 */
describe("Event Catalog", () => {
	describe("EVENT_CATALOG", () => {
		it("should have unique event types", () => {
			const types = EVENT_CATALOG.map((e) => e.type);
			const unique = new Set(types);
			expect(unique.size).toBe(types.length);
		});

		it("should have non-empty descriptions for all entries", () => {
			for (const entry of EVENT_CATALOG) {
				expect(entry.description.length).toBeGreaterThan(0);
			}
		});

		it("should have non-empty directions for all entries", () => {
			for (const entry of EVENT_CATALOG) {
				expect(entry.direction.length).toBeGreaterThan(0);
			}
		});

		it("should have non-empty domain for all entries", () => {
			for (const entry of EVENT_CATALOG) {
				expect(entry.domain.length).toBeGreaterThan(0);
			}
		});

		it("should have non-empty services for all entries", () => {
			for (const entry of EVENT_CATALOG) {
				expect(entry.services.length).toBeGreaterThan(0);
			}
		});

		it("should assign every entry to a known category", () => {
			const categories = new Set<string>(EVENT_CATEGORIES);
			for (const entry of EVENT_CATALOG) {
				expect(categories.has(entry.category)).toBe(true);
			}
		});
	});

	describe("EVENT_CATEGORIES", () => {
		it("should list all categories used in the catalog", () => {
			const usedCategories = new Set(EVENT_CATALOG.map((e) => e.category));
			for (const cat of usedCategories) {
				expect(EVENT_CATEGORIES).toContain(cat);
			}
		});

		it("should have no empty categories (all categories have entries)", () => {
			for (const cat of EVENT_CATEGORIES) {
				const entries = EVENT_CATALOG.filter((e) => e.category === cat);
				expect(entries.length).toBeGreaterThan(0);
			}
		});
	});

	describe("getEventsByCategory", () => {
		it("should return entries for a valid category", () => {
			const entries = getEventsByCategory("Plugin Lifecycle");
			expect(entries.length).toBe(5);
			expect(entries.every((e) => e.category === "Plugin Lifecycle")).toBe(true);
		});

		it("should return discovery entries", () => {
			const entries = getEventsByCategory("Discovery");
			expect(entries.length).toBe(5);
			expect(entries.every((e) => e.category === "Discovery")).toBe(true);
		});

		it("should return event filter entries", () => {
			const entries = getEventsByCategory("Event Filter");
			expect(entries.length).toBe(4);
			expect(entries.every((e) => e.category === "Event Filter")).toBe(true);
		});

		it("should return event notify entries", () => {
			const entries = getEventsByCategory("Event Notify");
			expect(entries.length).toBe(4);
			expect(entries.every((e) => e.category === "Event Notify")).toBe(true);
		});

		it("should return an empty array for unknown category", () => {
			const entries = getEventsByCategory("nonexistent");
			expect(entries).toEqual([]);
		});
	});

	describe("getEventCategory", () => {
		it("should return the category for a known event type", () => {
			expect(getEventCategory("user.created")).toBe("User");
			expect(getEventCategory("file.created")).toBe("File Notifications");
			expect(getEventCategory("plugin.ready")).toBe("Plugin Lifecycle");
		});

		it("should return undefined for an unknown event type", () => {
			expect(getEventCategory("nonexistent.event")).toBeUndefined();
		});
	});

	describe("getEventEntry", () => {
		it("should return the full entry for a known event type", () => {
			const entry = getEventEntry("settings.changed");
			expect(entry).toBeDefined();
			expect(entry?.type).toBe("settings.changed");
			expect(entry?.category).toBe("Settings");
			expect(entry?.description).toBeTruthy();
			expect(entry?.direction).toBeTruthy();
			expect(entry?.domain).toBe("settings");
			expect(entry?.services).toBe("SettingsService");
		});

		it("should return undefined for an unknown event type", () => {
			expect(getEventEntry("does.not.exist")).toBeUndefined();
		});
	});
});
