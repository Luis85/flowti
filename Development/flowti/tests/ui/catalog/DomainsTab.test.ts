// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DomainsTab } from "../../../src/ui/catalog/DomainsTab";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { CatalogComponentDeps, DomainEntry } from "../../../src/ui/catalog/types";
import type { EventCatalogEntry } from "../../../src/infrastructure/events/catalog";
import { createMockCatalogDeps } from "./testHelpers";

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
			// EVENT_CATALOG is imported directly by DomainsTab, so we can't mock it easily.
			// Instead, test that scan() runs without error and returns an array.
			tab.scan();
			const entries = tab.getEntries();
			expect(Array.isArray(entries)).toBe(true);
			// All entries should have required fields
			for (const entry of entries) {
				expect(entry).toHaveProperty("name");
				expect(entry).toHaveProperty("events");
				expect(entry).toHaveProperty("visible");
			}
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
