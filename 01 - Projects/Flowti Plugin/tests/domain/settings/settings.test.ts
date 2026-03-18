import { describe, it, expect } from "vitest";
import {
	FlowtiSettingsSchema,
	safeParseSettings,
	DEFAULT_CATALOG_CATEGORIES,
	DEFAULT_ENTITY_PATHS,
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

		it("should have entries that are valid EVENT_CATEGORIES items", () => {
			for (const entry of DEFAULT_CATALOG_CATEGORIES) {
				expect(EVENT_CATEGORIES).toContain(entry.name);
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

	describe("entityPaths", () => {
		it("should default entityPaths when not provided", () => {
			const result = FlowtiSettingsSchema.parse({});
			expect(result.entityPaths).toEqual(DEFAULT_ENTITY_PATHS);
		});

		it("should default all 8 entity types", () => {
			const result = FlowtiSettingsSchema.parse({});
			expect(Object.keys(result.entityPaths)).toHaveLength(8);
			expect(result.entityPaths.events.subfolder).toBe("Events");
			expect(result.entityPaths.domains.subfolder).toBe("Domains");
			expect(result.entityPaths.actors.subfolder).toBe("Actors");
			expect(result.entityPaths.products.subfolder).toBe("Products");
		});

		it("should default overridePath to empty string", () => {
			const result = FlowtiSettingsSchema.parse({});
			for (const cfg of Object.values(result.entityPaths)) {
				expect(cfg.overridePath).toBe("");
			}
		});

		it("should preserve custom entity paths", () => {
			const custom = {
				...DEFAULT_ENTITY_PATHS,
				events: { subfolder: "MyEvents", overridePath: "custom/events" },
			};
			const result = FlowtiSettingsSchema.parse({ entityPaths: custom });
			expect(result.entityPaths.events.subfolder).toBe("MyEvents");
			expect(result.entityPaths.events.overridePath).toBe("custom/events");
			expect(result.entityPaths.domains.subfolder).toBe("Domains");
		});

		it("should parse old settings without entityPaths (backwards compat)", () => {
			const result = FlowtiSettingsSchema.parse({
				debugMode: true,
				docsRootPath: "my/docs",
			});
			expect(result.entityPaths).toEqual(DEFAULT_ENTITY_PATHS);
		});
	});

	describe("userHubConfig", () => {
		it("should default kpiMeasures to empty array", () => {
			const result = FlowtiSettingsSchema.parse({});
			expect(result.userHubConfig.kpiMeasures).toEqual([]);
		});

		it("should default visibleHubs to standard 4 hubs", () => {
			const result = FlowtiSettingsSchema.parse({});
			expect(result.userHubConfig.visibleHubs).toEqual(["event-catalog", "data-exchange", "analytics", "train"]);
		});

		it("should default showQuickActions to true", () => {
			const result = FlowtiSettingsSchema.parse({});
			expect(result.userHubConfig.showQuickActions).toBe(true);
		});

		it("should parse custom kpiMeasures", () => {
			const result = FlowtiSettingsSchema.parse({
				userHubConfig: { kpiMeasures: ["event-catalog:Events", "analytics:Queries"] },
			});
			expect(result.userHubConfig.kpiMeasures).toEqual(["event-catalog:Events", "analytics:Queries"]);
		});

		it("should enforce max 3 kpiMeasures", () => {
			expect(() => FlowtiSettingsSchema.parse({
				userHubConfig: { kpiMeasures: ["a", "b", "c", "d"] },
			})).toThrow();
		});
	});

	describe("processesFolder", () => {
		it("should default to docs/processes", () => {
			const result = FlowtiSettingsSchema.parse({});
			expect(result.processesFolder).toBe("docs/processes");
		});

		it("should accept custom processesFolder", () => {
			const result = FlowtiSettingsSchema.parse({ processesFolder: "custom/processes" });
			expect(result.processesFolder).toBe("custom/processes");
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
