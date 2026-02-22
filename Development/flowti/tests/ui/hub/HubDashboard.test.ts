// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import { HubDashboard } from "../../../src/ui/hub/HubDashboard";
import { makeDefaultHubState, createMockHubDeps } from "./testHelpers";
import type { HubComponentDeps, ActiveOperation } from "../../../src/ui/hub/types";

describe("HubDashboard", () => {
	let container: HTMLElement;
	let deps: HubComponentDeps;

	beforeEach(() => {
		container = document.createElement("div");
		({ deps } = createMockHubDeps());
	});

	// ── render creates dashboard content ──────────────────────

	describe("render", () => {
		it("should create dashboard content in the container", () => {
			const dashboard = new HubDashboard(container, deps);
			dashboard.render();
			expect(container.children.length).toBeGreaterThan(0);
		});

		it("should show heading with Data Exchange Hub", () => {
			const dashboard = new HubDashboard(container, deps);
			dashboard.render();
			const heading = container.querySelector("h2");
			expect(heading).not.toBeNull();
			expect(heading!.textContent).toContain("Data Exchange");
		});

		it("should render with empty state (no imports, exports, operations)", () => {
			const { deps: emptyDeps } = createMockHubDeps({
				state: {
					importConfigs: [],
					exportConfigs: [],
					pipelineConfigs: [],
					dictionaryEntries: [],
					reportEntries: [],
					typeEntries: [],
					csvFileEntries: [],
					canvasConfigs: [],
					activeOperations: [],
				},
			});
			const dashboard = new HubDashboard(container, emptyDeps);
			dashboard.render();

			// Should still render the title bar at minimum
			const heading = container.querySelector("h2");
			expect(heading).not.toBeNull();
			expect(heading!.textContent).toContain("Data Exchange Hub");
		});

		it("should show section headers when data is present", () => {
			const { deps: populatedDeps } = createMockHubDeps({
				state: {
					dictionaryEntries: [
						{ property: "title", sources: [], types: [] } as never,
					],
					csvFileEntries: [
						{ path: "data.csv", name: "data.csv", displayName: "data.csv", importConfigs: [], exportConfigs: [], hasDoc: true, baseViews: [] },
					],
					typeEntries: [
						{ name: "Event", path: "Types/Event.md", properties: [] } as never,
					],
				},
			});
			const dashboard = new HubDashboard(container, populatedDeps);
			dashboard.render();

			// Data Dictionary section header should appear
			const headers = container.querySelectorAll(".ft-heading-sm");
			const headerTexts = Array.from(headers).map((h) => h.textContent);
			expect(headerTexts.some((t) => t?.includes("Data Dictionary"))).toBe(true);
		});

		it("should show operation cards when activeOperations is non-empty", () => {
			const activeOp: ActiveOperation = {
				operationId: "op-1",
				type: "import",
				name: "Test Import",
				startedAt: Date.now(),
				progress: { current: 3, total: 10 },
			};
			const { deps: opDeps } = createMockHubDeps({
				state: { activeOperations: [activeOp] },
				eventBus: new EventBus(),
			});
			const dashboard = new HubDashboard(container, opDeps);
			dashboard.render();

			// Active Operations section should appear
			const headers = container.querySelectorAll(".ft-heading-sm");
			const headerTexts = Array.from(headers).map((h) => h.textContent);
			expect(headerTexts.some((t) => t?.includes("Active Operations"))).toBe(true);

			// Should render an operation card
			const cards = container.querySelectorAll(".ft-card");
			expect(cards.length).toBeGreaterThan(0);
		});
	});

	// ── cleanupLiveListeners ──────────────────────────────────

	describe("cleanupLiveListeners", () => {
		it("should not throw when called without active listeners", () => {
			const dashboard = new HubDashboard(container, deps);
			expect(() => dashboard.cleanupLiveListeners()).not.toThrow();
		});

		it("should not throw after render with active operations", () => {
			const activeOp: ActiveOperation = {
				operationId: "op-2",
				type: "export",
				name: "Test Export",
				startedAt: Date.now(),
				progress: null,
			};
			const { deps: opDeps } = createMockHubDeps({
				state: { activeOperations: [activeOp] },
				eventBus: new EventBus(),
			});
			const dashboard = new HubDashboard(container, opDeps);
			dashboard.render();
			expect(() => dashboard.cleanupLiveListeners()).not.toThrow();
		});
	});
});
