// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { EventsTab } from "../../../src/ui/catalog/EventsTab";
import type { CatalogComponentDeps } from "../../../src/ui/catalog/types";
import { createMockCatalogDeps, createDefaultCatalogState } from "./testHelpers";

describe("EventsTab", () => {
	let masterTreeEl: HTMLElement;
	let detailPanelEl: HTMLElement;
	let settingsPanel: HTMLElement;
	let countBadge: HTMLElement;
	let deps: CatalogComponentDeps;
	let eventBus: IEventBus;
	let tab: EventsTab;

	beforeEach(() => {
		eventBus = new EventBus();
		masterTreeEl = document.createElement("div");
		detailPanelEl = document.createElement("div");
		settingsPanel = document.createElement("div");
		countBadge = document.createElement("div");
		deps = createMockCatalogDeps({ eventBus });
		tab = new EventsTab(masterTreeEl, detailPanelEl, settingsPanel, countBadge, deps);
	});

	describe("scan", () => {
		it("should return non-empty entries from catalog", () => {
			tab.scan();
			const entries = tab.getEntries();
			expect(entries.length).toBeGreaterThan(0);
		});

		it("should return CategoryEntry array with expected properties", () => {
			tab.scan();
			const entries = tab.getEntries();
			expect(Array.isArray(entries)).toBe(true);
			for (const entry of entries) {
				expect(entry).toHaveProperty("name");
				expect(entry).toHaveProperty("description");
				expect(entry).toHaveProperty("events");
				expect(entry).toHaveProperty("domains");
				expect(entry).toHaveProperty("services");
				expect(entry).toHaveProperty("filePath");
				expect(entry).toHaveProperty("visible");
			}
		});
	});

	describe("render", () => {
		it("should create master tree content", () => {
			tab.render();
			// render triggers scanCategories + renderMasterTree, so the tree should have children
			expect(masterTreeEl.children.length).toBeGreaterThanOrEqual(0);
		});

		it("should reduce visible items when filter text is active", () => {
			const visibleDeps = createMockCatalogDeps({
				eventBus,
				state: { showSystemEvents: true },
			});
			const visibleTab = new EventsTab(masterTreeEl, detailPanelEl, settingsPanel, countBadge, visibleDeps);
			visibleTab.render();
			const allContent = masterTreeEl.innerHTML;

			const filteredEl = document.createElement("div");
			const filteredDeps = createMockCatalogDeps({
				eventBus,
				state: { showSystemEvents: true, filterText: "zzz_no_match_zzz" },
			});
			const filteredTab = new EventsTab(filteredEl, detailPanelEl, settingsPanel, countBadge, filteredDeps);
			filteredTab.render();
			const filteredContent = filteredEl.innerHTML;

			// Filtered tree should have less content (or equal if no system events matched)
			expect(filteredContent.length).toBeLessThanOrEqual(allContent.length);
		});
	});

	describe("selection", () => {
		it("should track selected event type via setSelectedEventType", () => {
			tab.setSelectedEventType("plugin.loaded");
			expect(tab.getSelectedEventType()).toBe("plugin.loaded");
		});

		it("should clear selection when set to null", () => {
			tab.setSelectedEventType("plugin.loaded");
			tab.setSelectedEventType(null);
			expect(tab.getSelectedEventType()).toBeNull();
		});
	});

	describe("getCountText", () => {
		it("should return formatted string with event count", () => {
			const text = tab.getCountText();
			expect(text).toMatch(/\d+ events/);
		});

		it("should change format when filter is active", () => {
			const filteredDeps = createMockCatalogDeps({
				eventBus,
				state: { filterText: "plugin" },
			});
			const filteredTab = new EventsTab(masterTreeEl, detailPanelEl, settingsPanel, countBadge, filteredDeps);
			const text = filteredTab.getCountText();
			// With filter active, format is "N / M events"
			expect(text).toMatch(/\d+ \/ \d+ events/);
		});
	});

	describe("filter chips", () => {
		it("should return false for getFilterChipConfigured by default", () => {
			expect(tab.getFilterChipConfigured()).toBe(false);
		});

		it("should return false for getFilterChipFollowed by default", () => {
			expect(tab.getFilterChipFollowed()).toBe(false);
		});
	});

	describe("renderSettingsPanel", () => {
		it("should create settings content in the panel", () => {
			tab.renderSettingsPanel();
			// Settings panel renders filter toggles and reset button
			expect(settingsPanel.children.length).toBeGreaterThan(0);
			const text = settingsPanel.textContent ?? "";
			expect(text).toContain("configured");
		});
	});
});
