// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, vi } from "vitest";
import { HealthTab } from "../../../src/ui/catalog/HealthTab";
import { createMockCatalogDeps, createDefaultCatalogState } from "./testHelpers";
import type { FlowEntry } from "../../../src/ui/catalog/types";

function makeFlowEntry(name: string): FlowEntry {
	return {
		name,
		description: "",
		events: [],
		domains: [],
		services: [],
		filePath: `docs/Flows/${name}.md`,
		resolvedEvents: [],
	};
}

describe("HealthTab", () => {
	describe("scan caching (TD-76)", () => {
		it("should scan only once on repeated render with unchanged data", () => {
			const deps = createMockCatalogDeps();
			const tab = new HealthTab(document.createElement("div"), document.createElement("div"), deps);
			const scanSpy = vi.spyOn(tab, "scan");

			tab.render();
			tab.render();
			tab.render();

			expect(scanSpy).toHaveBeenCalledTimes(1);
		});

		it("should re-scan after invalidateCache()", () => {
			const deps = createMockCatalogDeps();
			const tab = new HealthTab(document.createElement("div"), document.createElement("div"), deps);
			const scanSpy = vi.spyOn(tab, "scan");

			tab.render();
			expect(scanSpy).toHaveBeenCalledTimes(1);

			tab.invalidateCache();
			tab.render();
			expect(scanSpy).toHaveBeenCalledTimes(2);
		});

		it("should re-scan when entity counts change between renders", () => {
			const state = createDefaultCatalogState();
			const deps = createMockCatalogDeps({ getState: vi.fn(() => state) });
			const tab = new HealthTab(document.createElement("div"), document.createElement("div"), deps);
			const scanSpy = vi.spyOn(tab, "scan");

			tab.render();
			expect(scanSpy).toHaveBeenCalledTimes(1);

			// Add a flow entry — changes entity count
			state.flowEntries = [makeFlowEntry("New Flow")];
			tab.render();
			expect(scanSpy).toHaveBeenCalledTimes(2);
		});
	});
});
