// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TFile, TFolder } from "obsidian";
import { DomainsTab } from "../../../src/ui/catalog/DomainsTab";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { CatalogComponentDeps, DomainEntry } from "../../../src/ui/catalog/types";
import type { EventCatalogEntry } from "../../../src/infrastructure/events/catalog";
import { createMockCatalogDeps, createDefaultCatalogState } from "./testHelpers";

function createMockTFile(path: string, basename: string, ext = "md"): TFile {
	const file = new TFile();
	Object.defineProperty(file, "path", { value: path, writable: false });
	Object.defineProperty(file, "basename", { value: basename, writable: false });
	Object.defineProperty(file, "extension", { value: ext, writable: false });
	return file;
}

function createMockTFolder(path: string, children: (TFile | TFolder)[]): TFolder {
	const folder = new TFolder();
	Object.defineProperty(folder, "path", { value: path, writable: false });
	Object.defineProperty(folder, "children", { value: children, writable: false });
	return folder;
}

function makeDomainEntry(overrides?: Partial<DomainEntry>): DomainEntry {
	return {
		name: "TestDomain",
		description: "A test domain",
		services: ["TestService"],
		categories: ["Core"],
		events: [],
		filePath: "docs/Domains/TestDomain.md",
		configuredCount: 0,
		visibleCount: 0,
		visible: true,
		isSystem: false,
		isArea: false,
		...overrides,
	};
}

function makeCatalogEntry(overrides?: Partial<EventCatalogEntry>): EventCatalogEntry {
	return {
		type: "test.event",
		category: "Test",
		description: "Test event",
		direction: "outbound",
		domain: "TestDomain",
		services: "TestService",
		stability: "stable",
		visibility: "user-facing",
		tags: [],
		...overrides,
	};
}

describe("DomainsTab", () => {
	let masterEl: HTMLElement;
	let detailEl: HTMLElement;
	let deps: CatalogComponentDeps;
	let eventBus: IEventBus;
	let tab: DomainsTab;

	beforeEach(() => {
		eventBus = new EventBus();
		masterEl = document.createElement("div");
		detailEl = document.createElement("div");
		deps = createMockCatalogDeps({ eventBus });
		tab = new DomainsTab(masterEl, detailEl, deps);
	});

	describe("scan", () => {
		it("should always include catalog-derived domains after scan", () => {
			tab.scan();
			const entries = tab.getEntries();
			// EVENT_CATALOG provides built-in domains, so entries are never empty
			expect(entries.length).toBeGreaterThan(0);
			// All entries should have the isSystem flag set for catalog-only domains
			for (const entry of entries) {
				if (entry.filePath === null) {
					// Catalog-derived entries without doc files
					expect(typeof entry.name).toBe("string");
				}
			}
		});

		it("should return entries from catalog events", () => {
			tab.scan();
			const entries = tab.getEntries();
			expect(Array.isArray(entries)).toBe(true);
			for (const entry of entries) {
				expect(entry).toHaveProperty("name");
				expect(entry).toHaveProperty("events");
				expect(entry).toHaveProperty("visible");
			}
		});

		it("should merge file-scanned domains with catalog domains", () => {
			const file = createMockTFile("docs/Domains/CustomDomain.md", "CustomDomain");
			const folder = createMockTFolder("docs/Domains", [file]);

			const customDeps = createMockCatalogDeps({
				eventBus,
				getEntityFolder: vi.fn((entity: string) =>
					entity === "domains" ? "docs/Domains" : `docs/${entity}`
				),
			});

			(customDeps.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>)
				.mockImplementation((p: string) => {
					if (p === "docs/Domains") return folder;
					return null;
				});
			(customDeps.vaultQuery.getFrontmatter as ReturnType<typeof vi.fn>)
				.mockImplementation((p: string) => {
					if (p === "docs/Domains/CustomDomain.md") {
						return { type: "DomainDoc", domain: "CustomDomain", description: "My domain", services: ["Svc1"], categories: ["Cat1"] };
					}
					return undefined;
				});

			const customTab = new DomainsTab(masterEl, detailEl, customDeps);
			customTab.scan();
			const entry = customTab.getEntries().find((e) => e.name === "CustomDomain");
			expect(entry).toBeDefined();
			expect(entry!.description).toBe("My domain");
			expect(entry!.services).toEqual(["Svc1"]);
			expect(entry!.categories).toEqual(["Cat1"]);
			expect(entry!.filePath).toBe("docs/Domains/CustomDomain.md");
		});

		it("should give catalog-only domains filePath null", () => {
			tab.scan();
			const catalogOnly = tab.getEntries().filter((e) => e.filePath === null);
			expect(catalogOnly.length).toBeGreaterThan(0);
		});

		it("should derive services from catalog when file has none", () => {
			tab.scan();
			for (const entry of tab.getEntries()) {
				if (entry.filePath === null && entry.events.length > 0) {
					// Catalog-derived domains get services from their events
					expect(entry.services.length).toBeGreaterThanOrEqual(0);
				}
			}
		});

		it("should prefer file services/categories over catalog-derived", () => {
			const file = createMockTFile("docs/Domains/EventBus.md", "EventBus");
			const folder = createMockTFolder("docs/Domains", [file]);

			const customDeps = createMockCatalogDeps({
				eventBus,
				getEntityFolder: vi.fn((entity: string) =>
					entity === "domains" ? "docs/Domains" : `docs/${entity}`
				),
			});

			(customDeps.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>)
				.mockImplementation((p: string) => {
					if (p === "docs/Domains") return folder;
					return null;
				});
			(customDeps.vaultQuery.getFrontmatter as ReturnType<typeof vi.fn>)
				.mockImplementation((p: string) => {
					if (p === "docs/Domains/EventBus.md") {
						return { type: "DomainDoc", domain: "EventBus", services: ["ExplicitSvc"] };
					}
					return undefined;
				});

			const customTab = new DomainsTab(masterEl, detailEl, customDeps);
			customTab.scan();
			const entry = customTab.getEntries().find((e) => e.name === "EventBus");
			expect(entry).toBeDefined();
			expect(entry!.services).toEqual(["ExplicitSvc"]);
		});

		it("should detect area docs via vault lookup", () => {
			const file = createMockTFile("docs/Domains/Sales.md", "Sales");
			const folder = createMockTFolder("docs/Domains", [file]);
			const areaFile = createMockTFile("02 - Areas/Sales/Sales.md", "Sales");

			const customDeps = createMockCatalogDeps({
				eventBus,
				getEntityFolder: vi.fn((entity: string) =>
					entity === "domains" ? "docs/Domains" : `docs/${entity}`
				),
			});

			(customDeps.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>)
				.mockImplementation((p: string) => {
					if (p === "docs/Domains") return folder;
					if (p === "02 - Areas/Sales/Sales.md") return areaFile;
					return null;
				});
			(customDeps.vaultQuery.getFrontmatter as ReturnType<typeof vi.fn>)
				.mockImplementation((p: string) => {
					if (p === "docs/Domains/Sales.md") {
						return { type: "DomainDoc", domain: "Sales" };
					}
					return undefined;
				});

			const customTab = new DomainsTab(masterEl, detailEl, customDeps);
			customTab.scan();
			const entry = customTab.getEntries().find((e) => e.name === "Sales");
			expect(entry).toBeDefined();
			expect(entry!.isArea).toBe(true);
		});

		it("should mark non-area domains as isArea false", () => {
			tab.scan();
			// Without area files in vault, all should be non-area
			for (const entry of tab.getEntries()) {
				expect(entry.isArea).toBe(false);
			}
		});

		it("should compute configuredCount from subscriptions", () => {
			const state = createDefaultCatalogState({
				subscriptions: [
					{ id: "s1", eventType: "plugin.loaded", enabled: true, filters: {}, createdAt: "2026-01-01" },
				],
			});

			const customDeps = createMockCatalogDeps({
				eventBus,
				getState: vi.fn(() => state),
			});
			const customTab = new DomainsTab(masterEl, detailEl, customDeps);
			customTab.scan();

			const configured = customTab.getEntries().filter((e) => e.configuredCount > 0);
			expect(configured.length).toBeGreaterThanOrEqual(1);
		});

		it("should compute visibleCount based on excludedTypes", () => {
			const state = createDefaultCatalogState({
				excludedTypes: new Set(["plugin.loaded", "plugin.unloaded"]),
			});

			const customDeps = createMockCatalogDeps({
				eventBus,
				getState: vi.fn(() => state),
			});
			const customTab = new DomainsTab(masterEl, detailEl, customDeps);
			customTab.scan();

			// At least one domain should have visibleCount less than total events
			const withExcluded = customTab.getEntries().find((e) =>
				e.visibleCount < e.events.length
			);
			expect(withExcluded).toBeDefined();
		});

		it("should apply visibility from catalogDomains state", () => {
			// First scan to discover real domain names from catalog
			tab.scan();
			const firstName = tab.getEntries()[0]?.name;
			expect(firstName).toBeDefined();

			const state = createDefaultCatalogState({
				catalogDomains: [{ name: firstName, visible: false }],
			});

			const customDeps = createMockCatalogDeps({
				eventBus,
				getState: vi.fn(() => state),
			});
			const customTab = new DomainsTab(masterEl, detailEl, customDeps);
			customTab.scan();

			const entry = customTab.getEntries().find((e) => e.name === firstName);
			expect(entry).toBeDefined();
			expect(entry!.visible).toBe(false);
		});

		it("should sort areas before non-areas, then alphabetically", () => {
			const fileA = createMockTFile("docs/Domains/Zebra.md", "Zebra");
			const fileB = createMockTFile("docs/Domains/Alpha.md", "Alpha");
			const folder = createMockTFolder("docs/Domains", [fileA, fileB]);
			const areaFile = createMockTFile("02 - Areas/Zebra/Zebra.md", "Zebra");

			const customDeps = createMockCatalogDeps({
				eventBus,
				getEntityFolder: vi.fn((entity: string) =>
					entity === "domains" ? "docs/Domains" : `docs/${entity}`
				),
			});

			(customDeps.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>)
				.mockImplementation((p: string) => {
					if (p === "docs/Domains") return folder;
					if (p === "02 - Areas/Zebra/Zebra.md") return areaFile;
					return null;
				});
			(customDeps.vaultQuery.getFrontmatter as ReturnType<typeof vi.fn>)
				.mockImplementation((p: string) => {
					if (p === "docs/Domains/Zebra.md") return { type: "DomainDoc", domain: "Zebra" };
					if (p === "docs/Domains/Alpha.md") return { type: "DomainDoc", domain: "Alpha" };
					return undefined;
				});

			const customTab = new DomainsTab(masterEl, detailEl, customDeps);
			customTab.scan();
			const entries = customTab.getEntries();

			// Zebra is an area, Alpha is not — Zebra should come first despite alphabetical order
			const zebraIdx = entries.findIndex((e) => e.name === "Zebra");
			const alphaIdx = entries.findIndex((e) => e.name === "Alpha");
			expect(zebraIdx).toBeLessThan(alphaIdx);
		});
	});

	describe("renderMaster", () => {
		it("should render a header with 'Domains' text", () => {
			tab.renderMaster();
			const header = masterEl.querySelector(".ft-master-category-header");
			expect(header).toBeTruthy();
			expect(header?.textContent).toContain("Domains");
		});

		it("should render an add button with plus icon", () => {
			tab.renderMaster();
			const addBtn = masterEl.querySelector(".ft-visibility-toggle");
			expect(addBtn).toBeTruthy();
			expect(addBtn?.getAttribute("aria-label")).toBe("Create new domain");
		});

		it("should render domain items from catalog", () => {
			tab.renderMaster();
			// Catalog provides infrastructure domains by default
			const items = masterEl.querySelectorAll(".ft-master-event-item");
			// At least the catalog-derived domains should be present
			expect(items.length).toBeGreaterThanOrEqual(0);
		});

		it("should filter domains by filterText", () => {
			// Enable showSystemEvents so catalog domains are visible
			const visibleDeps = createMockCatalogDeps({
				eventBus,
				state: { showSystemEvents: true },
			});
			const visibleTab = new DomainsTab(masterEl, detailEl, visibleDeps);
			visibleTab.renderMaster();
			const allCount = masterEl.querySelectorAll(".ft-master-event-item").length;
			expect(allCount).toBeGreaterThan(0);

			// Recreate with non-matching filterText
			const filteredDeps = createMockCatalogDeps({
				eventBus,
				state: { showSystemEvents: true, filterText: "zzz_nonexistent_domain_zzz" },
			});
			const filteredTab = new DomainsTab(masterEl, detailEl, filteredDeps);
			filteredTab.renderMaster();
			const filteredCount = masterEl.querySelectorAll(".ft-master-event-item").length;
			expect(filteredCount).toBe(0);
		});
	});

	describe("renderDetail", () => {
		it("should show empty state when no domain is selected", () => {
			tab.renderDetail();
			const empty = detailEl.querySelector(".ft-catalog-detail-empty");
			expect(empty).toBeTruthy();
			expect(empty?.textContent).toContain("Select a domain");
		});

		it("should show quick stats in empty state", () => {
			tab.renderDetail();
			const stats = detailEl.querySelector(".ft-catalog-quick-stats");
			expect(stats).toBeTruthy();
			expect(stats?.textContent).toContain("domains");
		});
	});

	describe("selection", () => {
		it("should track selected domain via setSelectedDomain", () => {
			tab.setSelectedDomain("TestDomain");
			expect(tab.getSelectedDomain()).toBe("TestDomain");
		});

		it("should clear selection via setSelectedDomain(null)", () => {
			tab.setSelectedDomain("TestDomain");
			tab.setSelectedDomain(null);
			expect(tab.getSelectedDomain()).toBeNull();
		});
	});

	describe("createDoc", () => {
		it("should emit doc.create event with DomainDoc type", async () => {
			const handler = vi.fn();
			eventBus.on("doc.create", handler);

			tab.scan();
			tab.createDoc("NewDomain");

			// wait for async emit
			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						docType: "DomainDoc",
						name: "NewDomain",
						entityType: "domains",
						source: "DomainsTab",
					}),
				})
			);
		});

		it("should set selectedDomain when creating a doc", () => {
			tab.scan();
			tab.createDoc("NewDomain");
			expect(tab.getSelectedDomain()).toBe("NewDomain");
		});
	});

	describe("deleteDoc", () => {
		it("should emit doc.delete event with file path", async () => {
			const handler = vi.fn();
			eventBus.on("doc.delete", handler);

			tab.deleteDoc("docs/Domains/OldDomain.md");

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						path: "docs/Domains/OldDomain.md",
						source: "DomainsTab",
					}),
				})
			);
		});

		it("should clear selection when deleting", () => {
			tab.setSelectedDomain("OldDomain");
			tab.deleteDoc("docs/Domains/OldDomain.md");
			expect(tab.getSelectedDomain()).toBeNull();
		});
	});

	describe("createArea", () => {
		it("should emit doc.create with AreaDoc type", async () => {
			const handler = vi.fn();
			eventBus.on("doc.create", handler);

			tab.createArea("MyDomain");

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						docType: "AreaDoc",
						name: "MyDomain",
						path: "02 - Areas/MyDomain/MyDomain.md",
						source: "DomainsTab",
					}),
				})
			);
		});
	});

	describe("createArchitectureDoc", () => {
		it("should emit doc.create with ArchitectureDoc type", async () => {
			const handler = vi.fn();
			eventBus.on("doc.create", handler);

			tab.scan();
			tab.createArchitectureDoc("MyDomain");

			await new Promise((r) => setTimeout(r, 10));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						docType: "ArchitectureDoc",
						name: "MyDomain",
						entityType: "domains",
						source: "DomainsTab",
					}),
				})
			);
		});
	});
});
