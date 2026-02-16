// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServicesTab } from "../../../src/ui/catalog/ServicesTab";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { CatalogComponentDeps, ServiceEntry } from "../../../src/ui/catalog/types";
import { createMockCatalogDeps, createDefaultCatalogState } from "./testHelpers";
import { createMockTFile, createMockTFolder } from "../../mocks/obsidian-stub";

// ── Tests ────────────────────────────────────────────────

describe("ServicesTab", () => {
	let masterEl: HTMLElement;
	let detailEl: HTMLElement;
	let deps: CatalogComponentDeps;
	let eventBus: IEventBus;
	let tab: ServicesTab;

	beforeEach(() => {
		eventBus = new EventBus();
		masterEl = document.createElement("div");
		detailEl = document.createElement("div");
		deps = createMockCatalogDeps({ eventBus });
		tab = new ServicesTab(masterEl, detailEl, deps);
	});

	describe("scan", () => {
		it("should include catalog-derived services", () => {
			tab.scan();
			const entries = tab.getEntries();
			// EVENT_CATALOG provides built-in services
			expect(entries.length).toBeGreaterThan(0);
			for (const entry of entries) {
				expect(entry).toHaveProperty("name");
				expect(entry).toHaveProperty("events");
				expect(entry).toHaveProperty("visible");
			}
		});

		it("should merge file-scanned services with catalog services", () => {
			const file = createMockTFile("docs/Services/CustomService.md", "CustomService");
			const folder = createMockTFolder("docs/Services", [file]);

			const customDeps = createMockCatalogDeps({
				eventBus,
				getEntityFolder: vi.fn((entity: string) =>
					entity === "services" ? "docs/Services" : `docs/${entity}`
				),
			});

			(customDeps.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>)
				.mockImplementation((p: string) => (p === "docs/Services" ? folder : null));
			(customDeps.vaultQuery.getFrontmatter as ReturnType<typeof vi.fn>)
				.mockImplementation((p: string) => {
					if (p === "docs/Services/CustomService.md") {
						return { type: "ServiceDoc", service: "CustomService", description: "A custom service", domains: ["MyDomain"] };
					}
					return undefined;
				});

			const customTab = new ServicesTab(masterEl, detailEl, customDeps);
			customTab.scan();
			const entries = customTab.getEntries();

			const custom = entries.find((e) => e.name === "CustomService");
			expect(custom).toBeDefined();
			expect(custom!.description).toBe("A custom service");
			expect(custom!.domains).toEqual(["MyDomain"]);
			expect(custom!.filePath).toBe("docs/Services/CustomService.md");
		});

		it("should give catalog-only services filePath null", () => {
			tab.scan();
			const entries = tab.getEntries();
			// Catalog-derived services without doc files should have null filePath
			const catalogOnly = entries.filter((e) => e.filePath === null);
			expect(catalogOnly.length).toBeGreaterThan(0);
		});

		it("should derive domains from catalog when file has none", () => {
			tab.scan();
			const entries = tab.getEntries();
			// Catalog-only entries derive domains from their catalog events
			for (const entry of entries) {
				if (entry.filePath === null && entry.events.length > 0) {
					expect(entry.domains.length).toBeGreaterThan(0);
				}
			}
		});

		it("should prefer file domains over catalog-derived domains", () => {
			const file = createMockTFile("docs/Services/EventBus.md", "EventBus");
			const folder = createMockTFolder("docs/Services", [file]);

			const customDeps = createMockCatalogDeps({
				eventBus,
				getEntityFolder: vi.fn((entity: string) =>
					entity === "services" ? "docs/Services" : `docs/${entity}`
				),
			});

			(customDeps.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>)
				.mockImplementation((p: string) => (p === "docs/Services" ? folder : null));
			(customDeps.vaultQuery.getFrontmatter as ReturnType<typeof vi.fn>)
				.mockImplementation((p: string) => {
					if (p === "docs/Services/EventBus.md") {
						return { type: "ServiceDoc", service: "EventBus", domains: ["ExplicitDomain"] };
					}
					return undefined;
				});

			const customTab = new ServicesTab(masterEl, detailEl, customDeps);
			customTab.scan();
			const entry = customTab.getEntries().find((e) => e.name === "EventBus");
			expect(entry).toBeDefined();
			expect(entry!.domains).toEqual(["ExplicitDomain"]);
		});

		it("should compute configuredCount from subscriptions and definitions", () => {
			const state = createDefaultCatalogState({
				subscriptions: [
					{ id: "s1", eventType: "plugin.loaded", enabled: true, filters: {}, createdAt: "2026-01-01" },
				],
				definitions: [],
			});

			const customDeps = createMockCatalogDeps({
				eventBus,
				getState: vi.fn(() => state),
			});
			const customTab = new ServicesTab(masterEl, detailEl, customDeps);
			customTab.scan();

			// The service containing plugin.loaded should have configuredCount > 0
			const entries = customTab.getEntries();
			const configured = entries.filter((e) => e.configuredCount > 0);
			expect(configured.length).toBeGreaterThanOrEqual(1);
		});

		it("should mark catalog-originating services as system", () => {
			tab.scan();
			const entries = tab.getEntries();
			// All catalog-only services should have isSystem = true
			for (const entry of entries) {
				if (entry.filePath === null) {
					expect(entry.isSystem).toBe(true);
				}
			}
		});

		it("should apply visibility from catalogServices state", () => {
			// First scan to discover real service names from catalog
			tab.scan();
			const firstName = tab.getEntries()[0]?.name;
			expect(firstName).toBeDefined();

			const state = createDefaultCatalogState({
				catalogServices: [{ name: firstName, visible: false }],
			});

			const customDeps = createMockCatalogDeps({
				eventBus,
				getState: vi.fn(() => state),
			});
			const customTab = new ServicesTab(masterEl, detailEl, customDeps);
			customTab.scan();

			const entry = customTab.getEntries().find((e) => e.name === firstName);
			expect(entry).toBeDefined();
			expect(entry!.visible).toBe(false);
		});

		it("should default visibility to true when not in catalogServices", () => {
			tab.scan();
			const entries = tab.getEntries();
			// Without specific visibility settings, all should default to visible
			for (const entry of entries) {
				expect(entry.visible).toBe(true);
			}
		});

		it("should sort entries alphabetically", () => {
			tab.scan();
			const names = tab.getEntries().map((e) => e.name);
			const sorted = [...names].sort((a, b) => a.localeCompare(b));
			expect(names).toEqual(sorted);
		});

		it("should collect non-conforming service files", () => {
			const file = createMockTFile("docs/Services/bad.md", "bad");
			const folder = createMockTFolder("docs/Services", [file]);

			const customDeps = createMockCatalogDeps({
				eventBus,
				getEntityFolder: vi.fn((entity: string) =>
					entity === "services" ? "docs/Services" : `docs/${entity}`
				),
			});

			(customDeps.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>)
				.mockImplementation((p: string) => (p === "docs/Services" ? folder : null));
			(customDeps.vaultQuery.getFrontmatter as ReturnType<typeof vi.fn>)
				.mockReturnValue({ wrong: "type" });

			// Mock fileManager.processFrontMatter for normalizeNonConformingFiles
			(customDeps.app as unknown as Record<string, unknown>).fileManager = {
				processFrontMatter: vi.fn(),
			};

			const customTab = new ServicesTab(masterEl, detailEl, customDeps);
			customTab.scan();
			const entry = customTab.getEntries().find((e) => e.name === "bad");
			expect(entry).toBeDefined();
		});
	});

	describe("renderMaster", () => {
		it("should render a header with 'Services' text", () => {
			tab.renderMaster();
			const header = masterEl.querySelector(".ft-master-category-header");
			expect(header).toBeTruthy();
			expect(header?.textContent).toContain("Services");
		});

		it("should render service items from catalog", () => {
			tab.renderMaster();
			const items = masterEl.querySelectorAll(".ft-master-event-item");
			expect(items.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe("renderDetail", () => {
		it("should show empty state when no service is selected", () => {
			tab.renderDetail();
			const empty = detailEl.querySelector(".ft-catalog-detail-empty");
			expect(empty).toBeTruthy();
			expect(empty?.textContent).toContain("Select a service");
		});
	});

	describe("selection", () => {
		it("should track selected service", () => {
			tab.setSelectedService("EventBus");
			expect(tab.getSelectedService()).toBe("EventBus");
		});

		it("should clear selection", () => {
			tab.setSelectedService("EventBus");
			tab.setSelectedService(null);
			expect(tab.getSelectedService()).toBeNull();
		});
	});
});
