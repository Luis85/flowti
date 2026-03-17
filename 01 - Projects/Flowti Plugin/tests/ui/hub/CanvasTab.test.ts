// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import { CanvasTab } from "../../../src/ui/hub/CanvasTab";
import { createMockHubDeps } from "./testHelpers";
import type { HubComponentDeps } from "../../../src/ui/hub/types";
import type { CanvasImportConfig } from "../../../src/domain/canvas/types";

function makeCanvasConfig(overrides: Partial<CanvasImportConfig> = {}): CanvasImportConfig {
	return {
		id: "canvas-1",
		name: "My Canvas Config",
		canvasPath: "Canvases/project.canvas",
		targetFolder: "Imports",
		colorMap: {},
		shapeMap: {},
		conflictStrategy: "skip",
		hierarchyMode: "flat",
		subfolderName: "",
		createCanvas: true,
		createBase: true,
		excludedTypes: [],
		createdAt: "2025-01-01T00:00:00Z",
		lastUsed: null,
		...overrides,
	};
}

function createCanvasService(configs: CanvasImportConfig[] = []) {
	return {
		getConfigs: vi.fn(() => configs),
		getConfig: vi.fn((id: string) => configs.find((c) => c.id === id)),
		removeConfig: vi.fn().mockResolvedValue(undefined),
		updateConfig: vi.fn().mockResolvedValue(undefined),
	} as unknown as HubComponentDeps["canvasService"];
}

describe("CanvasTab", () => {
	let masterEl: HTMLElement;
	let detailEl: HTMLElement;
	let deps: HubComponentDeps;

	beforeEach(() => {
		masterEl = document.createElement("div");
		detailEl = document.createElement("div");
		({ deps } = createMockHubDeps());
	});

	// ── renderMaster ──────────────────────────────────────────

	describe("renderMaster", () => {
		it("should show header with Canvas Configs text", () => {
			const tab = new CanvasTab(masterEl, detailEl, deps);
			tab.renderMaster();
			const header = masterEl.querySelector(".ft-master-category-header");
			expect(header).not.toBeNull();
			expect(header!.textContent).toContain("Canvas Configs");
		});

		it("should show empty state when no canvas configs exist", () => {
			const tab = new CanvasTab(masterEl, detailEl, deps);
			tab.renderMaster();
			expect(masterEl.textContent).toContain("No canvas configs saved");
		});

		it("should show config count badge", () => {
			const configs = [makeCanvasConfig(), makeCanvasConfig({ id: "canvas-2", name: "Second Config" })];
			const { deps: cfgDeps } = createMockHubDeps({ state: { canvasConfigs: configs } });
			const tab = new CanvasTab(masterEl, detailEl, cfgDeps);
			tab.renderMaster();

			const countBadge = masterEl.querySelector(".ft-master-category-count");
			expect(countBadge).not.toBeNull();
			expect(countBadge!.textContent).toBe("2");
		});

		it("should show config items with names when configs exist", () => {
			const configs = [
				makeCanvasConfig({ id: "c1", name: "Alpha Canvas" }),
				makeCanvasConfig({ id: "c2", name: "Beta Canvas" }),
			];
			const { deps: cfgDeps } = createMockHubDeps({ state: { canvasConfigs: configs } });
			const tab = new CanvasTab(masterEl, detailEl, cfgDeps);
			tab.renderMaster();

			const items = masterEl.querySelectorAll(".ft-master-event-item");
			expect(items.length).toBe(2);
			expect(masterEl.textContent).toContain("Alpha Canvas");
			expect(masterEl.textContent).toContain("Beta Canvas");
		});
	});

	// ── renderDetail ──────────────────────────────────────────

	describe("renderDetail", () => {
		it("should show empty state when no canvas is selected", () => {
			const canvasService = createCanvasService();
			const { deps: svcDeps } = createMockHubDeps({ state: { currentPage: "canvas" } });
			svcDeps.canvasService = canvasService;
			const tab = new CanvasTab(masterEl, detailEl, svcDeps);
			tab.renderDetail();

			expect(detailEl.textContent).toContain("Select a canvas config");
		});

		it("should show detail when selectedCanvasId is set", () => {
			const config = makeCanvasConfig({ id: "c-detail", name: "Detail Canvas" });
			const canvasService = createCanvasService([config]);
			const { deps: svcDeps } = createMockHubDeps({
				state: {
					currentPage: "canvas",
					selectedCanvasId: "c-detail",
					canvasConfigs: [config],
				},
			});
			svcDeps.canvasService = canvasService;
			const tab = new CanvasTab(masterEl, detailEl, svcDeps);
			tab.renderDetail();

			expect(detailEl.textContent).toContain("Detail Canvas");
			expect(detailEl.querySelector(".ft-detail-header")).not.toBeNull();
		});

		it("should return early without rendering when canvasService is undefined", () => {
			const { deps: noDeps } = createMockHubDeps({
				state: { selectedCanvasId: "c-1" },
			});
			// canvasService is already undefined by default
			const tab = new CanvasTab(masterEl, detailEl, noDeps);
			tab.renderDetail();

			expect(detailEl.children.length).toBe(0);
		});
	});

	// ── cleanupLiveListeners ──────────────────────────────────

	describe("cleanupLiveListeners", () => {
		it("should not throw when called without active listeners", () => {
			const tab = new CanvasTab(masterEl, detailEl, deps);
			expect(() => tab.cleanupLiveListeners()).not.toThrow();
		});

		it("should not throw after rendering detail with selected config", () => {
			const config = makeCanvasConfig();
			const canvasService = createCanvasService([config]);
			const { deps: svcDeps } = createMockHubDeps({
				state: { selectedCanvasId: config.id, canvasConfigs: [config] },
				eventBus: new EventBus(),
			});
			svcDeps.canvasService = canvasService;
			const tab = new CanvasTab(masterEl, detailEl, svcDeps);
			tab.renderDetail();
			expect(() => tab.cleanupLiveListeners()).not.toThrow();
		});
	});
});
