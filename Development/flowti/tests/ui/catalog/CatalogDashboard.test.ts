// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { CatalogDashboard } from "../../../src/ui/catalog/CatalogDashboard";
import type { CatalogComponentDeps, DomainEntry, ServiceEntry } from "../../../src/ui/catalog/types";
import { createMockCatalogDeps, createDefaultCatalogState } from "./testHelpers";

function makeDomainEntry(overrides?: Partial<DomainEntry>): DomainEntry {
	return {
		name: "TestDomain",
		description: "A test domain",
		services: ["Svc1"],
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

function makeServiceEntry(overrides?: Partial<ServiceEntry>): ServiceEntry {
	return {
		name: "TestService",
		description: "A test service",
		domains: ["TestDomain"],
		events: [],
		filePath: "docs/Services/TestService.md",
		configuredCount: 0,
		visible: true,
		isSystem: false,
		...overrides,
	};
}

describe("CatalogDashboard", () => {
	let container: HTMLElement;
	let deps: CatalogComponentDeps;
	let eventBus: IEventBus;
	let dashboard: CatalogDashboard;

	beforeEach(() => {
		eventBus = new EventBus();
		container = document.createElement("div");
		// Include at least one entity so the normal dashboard path renders (not the empty state)
		const state = createDefaultCatalogState({ domainEntries: [makeDomainEntry()] });
		deps = createMockCatalogDeps({ eventBus, getState: vi.fn(() => state) });
		dashboard = new CatalogDashboard(container, deps);
	});

	describe("render", () => {
		it("should create a heading element", () => {
			dashboard.render();
			const heading = container.querySelector("h2");
			expect(heading).toBeTruthy();
			expect(heading?.textContent).toContain("Event Catalog");
		});

		it("should show stats section with stat cards", () => {
			dashboard.render();
			const statGrid = container.querySelector(".ft-stat-grid");
			expect(statGrid).toBeTruthy();
			const statCards = container.querySelectorAll(".ft-stat-card");
			expect(statCards.length).toBeGreaterThan(0);
		});

		it("should create quick action buttons", () => {
			dashboard.render();
			const text = container.textContent ?? "";
			expect(text).toContain("Quick Actions");
			const navLinks = container.querySelectorAll(".ft-nav-link");
			expect(navLinks.length).toBeGreaterThan(0);
		});

		it("should show navigation links", () => {
			dashboard.render();
			const text = container.textContent ?? "";
			expect(text).toContain("Activity Log");
			expect(text).toContain("Watchers");
		});

		it("should render empty state when all entity counts are zero", () => {
			const emptyDeps = createMockCatalogDeps({ eventBus });
			const emptyDashboard = new CatalogDashboard(container, emptyDeps);
			emptyDashboard.render();

			// Should show the empty state wrapper
			expect(container.querySelector(".ft-empty-state")).toBeTruthy();
			expect(container.textContent).toContain("Welcome to the Event Catalog");
			expect(container.textContent).toContain("Events appear as you use Flowti");
			expect(container.textContent).toContain("How events populate");
		});

		it("should not show empty state when entities exist", () => {
			const state = createDefaultCatalogState({
				domainEntries: [makeDomainEntry({ name: "Alpha" })],
			});
			const customDeps = createMockCatalogDeps({
				eventBus,
				getState: vi.fn(() => state),
			});
			const customDashboard = new CatalogDashboard(container, customDeps);
			customDashboard.render();

			expect(container.querySelector(".ft-empty-state")).toBeNull();
			expect(container.querySelector("h2")).toBeTruthy();
		});

		it("should not show title bar or quick actions in empty state", () => {
			const emptyDeps = createMockCatalogDeps({ eventBus });
			const emptyDashboard = new CatalogDashboard(container, emptyDeps);
			emptyDashboard.render();

			expect(container.querySelector("h2")).toBeNull();
			expect(container.textContent).not.toContain("Quick Actions");
		});

		it("should show correct domain count from state", () => {
			const state = createDefaultCatalogState({
				domainEntries: [
					makeDomainEntry({ name: "Alpha" }),
					makeDomainEntry({ name: "Beta" }),
					makeDomainEntry({ name: "Gamma" }),
				],
			});
			const customDeps = createMockCatalogDeps({
				eventBus,
				getState: vi.fn(() => state),
			});
			const customDashboard = new CatalogDashboard(container, customDeps);
			customDashboard.render();
			// The stat card for Domains should show "3"
			const statValues = container.querySelectorAll(".ft-catalog-stat-value");
			const values = Array.from(statValues).map((el) => el.textContent);
			expect(values).toContain("3");
		});

		it("should show correct service count from state", () => {
			const state = createDefaultCatalogState({
				serviceEntries: [
					makeServiceEntry({ name: "SvcA" }),
					makeServiceEntry({ name: "SvcB" }),
				],
			});
			const customDeps = createMockCatalogDeps({
				eventBus,
				getState: vi.fn(() => state),
			});
			const customDashboard = new CatalogDashboard(container, customDeps);
			customDashboard.render();
			const statValues = container.querySelectorAll(".ft-catalog-stat-value");
			const values = Array.from(statValues).map((el) => el.textContent);
			expect(values).toContain("2");
		});

		it("should include entity creation buttons in quick actions", () => {
			dashboard.render();
			const navLinks = container.querySelectorAll(".ft-nav-link");
			const labels = Array.from(navLinks).map((el) => el.textContent?.trim());
			expect(labels).toEqual(
				expect.arrayContaining([
					expect.stringContaining("New Domain"),
					expect.stringContaining("New Service"),
					expect.stringContaining("New Event"),
				]),
			);
		});
	});
});
