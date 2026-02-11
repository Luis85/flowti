import { describe, it, expect } from "vitest";
import {
	FlowtiSettingsSchema,
	safeParseSettings,
	DEFAULT_CATALOG_CATEGORIES,
} from "../../../src/domain/settings/settings";
import { EVENT_CATEGORIES } from "../../../src/infrastructure/events/catalog";

describe("FlowtiSettings", () => {
	describe("FlowtiSettingsSchema", () => {
		it("should parse valid settings", () => {
			const result = FlowtiSettingsSchema.parse({ debugMode: true });
			expect(result.debugMode).toBe(true);
		});

		it("should reject invalid debugMode type", () => {
			expect(() => FlowtiSettingsSchema.parse({ debugMode: "yes" })).toThrow();
		});

		it("should default eventSystemEnabled to true", () => {
			const result = FlowtiSettingsSchema.parse({});
			expect(result.eventSystemEnabled).toBe(true);
		});

		it("should default showSystemEvents to false", () => {
			const result = FlowtiSettingsSchema.parse({});
			expect(result.showSystemEvents).toBe(false);
		});

		it("should parse eventSystemEnabled when provided", () => {
			const result = FlowtiSettingsSchema.parse({ eventSystemEnabled: false });
			expect(result.eventSystemEnabled).toBe(false);
		});

		it("should default docsRootPath when not provided", () => {
			const result = FlowtiSettingsSchema.parse({ debugMode: false });
			expect(result.docsRootPath).toBe("03 - Resources/Documentation/Reference");
		});

		it("should parse custom docsRootPath", () => {
			const result = FlowtiSettingsSchema.parse({
				debugMode: false,
				docsRootPath: "custom/path",
			});
			expect(result.docsRootPath).toBe("custom/path");
		});
	});

	describe("catalogCategories", () => {
		it("should default catalogCategories when not provided", () => {
			const result = FlowtiSettingsSchema.parse({});
			expect(result.catalogCategories).toEqual(DEFAULT_CATALOG_CATEGORIES);
		});

		it("should have an entry for every EVENT_CATEGORIES item", () => {
			const names = DEFAULT_CATALOG_CATEGORIES.map((c) => c.name);
			for (const cat of EVENT_CATEGORIES) {
				expect(names).toContain(cat);
			}
		});

		it("should have end-user categories visible by default", () => {
			const visibleNames = DEFAULT_CATALOG_CATEGORIES
				.filter((c) => c.visible)
				.map((c) => c.name);
			expect(visibleNames).toContain("User");
			expect(visibleNames).toContain("Settings");
			expect(visibleNames).toContain("Installer");
			expect(visibleNames).toContain("Discovery");
		});

		it("should have infrastructure categories hidden by default", () => {
			const hiddenNames = DEFAULT_CATALOG_CATEGORIES
				.filter((c) => !c.visible)
				.map((c) => c.name);
			expect(hiddenNames).toContain("Plugin Lifecycle");
			expect(hiddenNames).toContain("Service Lifecycle");
			expect(hiddenNames).toContain("Commands");
			expect(hiddenNames).toContain("Logging");
		});

		it("should preserve saved category order", () => {
			const customOrder = [
				{ name: "Logging", visible: true },
				{ name: "User", visible: false },
			];
			const result = FlowtiSettingsSchema.parse({ catalogCategories: customOrder });
			expect(result.catalogCategories).toEqual(customOrder);
		});
	});

	describe("safeParseSettings", () => {
		it("should return parsed settings for valid data", () => {
			const result = safeParseSettings({ debugMode: true });
			expect(result).not.toBeNull();
			expect(result?.debugMode).toBe(true);
		});

		it("should return null for invalid data", () => {
			const result = safeParseSettings({ debugMode: "invalid" });
			expect(result).toBeNull();
		});
	});
});
