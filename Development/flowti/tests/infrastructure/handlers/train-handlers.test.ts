// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTrainHandlers } from "../../../src/infrastructure/handlers/train-handlers";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../../src/infrastructure/events/types";

// Import components to register custom elements
import "../../../src/components/train/flowti-train-dashboard";
import "../../../src/components/train/flowti-train-active";
import "../../../src/components/train/flowti-train-history";

function createMockTrainService() {
	return {
		getAllTrains: vi.fn(() => []),
		getActiveTrain: vi.fn(() => undefined),
	};
}

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn().mockResolvedValue(undefined),
		emitCustom: vi.fn().mockResolvedValue(undefined),
		on: vi.fn(() => vi.fn()),
		once: vi.fn(),
		off: vi.fn(),
		clear: vi.fn(),
	} as unknown as IEventBus;
}

describe("registerTrainHandlers", () => {
	let registry: PluginHandlerRegistry;
	let trainService: ReturnType<typeof createMockTrainService>;
	let eventBus: IEventBus;
	let openTrainView: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
		trainService = createMockTrainService();
		eventBus = createMockEventBus();
		openTrainView = vi.fn();
		registerTrainHandlers(registry, {
			trainService: trainService as never,
			onboardingService: { shouldShowCallout: vi.fn(() => false) },
			eventBus,
			openTrainView,
		});
	});

	it("registers all 3 tab handlers", () => {
		expect(registry.getTabHandler("train:dashboard")).toBeDefined();
		expect(registry.getTabHandler("train:active")).toBeDefined();
		expect(registry.getTabHandler("train:history")).toBeDefined();
	});

	describe("dashboard handler", () => {
		it("creates flowti-train-dashboard element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("train:dashboard")!(container, { tabId: "dashboard", viewId: "test", eventBus });
			const el = container.querySelector("flowti-train-dashboard");
			expect(el).not.toBeNull();
		});

		it("sets trains property from service", () => {
			const trains = [{ id: "t1", status: "running", thoughts: [] }];
			trainService.getAllTrains.mockReturnValue(trains as never);
			const container = document.createElement("div");
			registry.getTabHandler("train:dashboard")!(container, { tabId: "dashboard", viewId: "test", eventBus });
			const el = container.querySelector("flowti-train-dashboard") as unknown as { trains: unknown[] };
			expect(el.trains).toEqual(trains);
		});

		it("sets activeTrain from service.getActiveTrain() when running", () => {
			const active = { id: "t1", status: "running", thoughts: [] };
			trainService.getAllTrains.mockReturnValue([active] as never);
			trainService.getActiveTrain.mockReturnValue(active as never);
			const container = document.createElement("div");
			registry.getTabHandler("train:dashboard")!(container, { tabId: "dashboard", viewId: "test", eventBus });
			const el = container.querySelector("flowti-train-dashboard") as unknown as { activeTrain: unknown };
			expect(el.activeTrain).toEqual(active);
		});

		it("wires start-train event to eventBus.emit", () => {
			const container = document.createElement("div");
			registry.getTabHandler("train:dashboard")!(container, { tabId: "dashboard", viewId: "test", eventBus });
			const el = container.querySelector("flowti-train-dashboard")!;
			el.dispatchEvent(new CustomEvent("start-train", { bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.startTrain", {});
		});
	});

	describe("active handler", () => {
		it("creates flowti-train-active element with filtered active trains", () => {
			const trains = [
				{ id: "t1", status: "running", thoughts: [] },
				{ id: "t2", status: "paused", thoughts: [] },
				{ id: "t3", status: "completed", thoughts: [] },
			];
			trainService.getAllTrains.mockReturnValue(trains as never);
			const container = document.createElement("div");
			registry.getTabHandler("train:active")!(container, { tabId: "active", viewId: "test", eventBus });
			const el = container.querySelector("flowti-train-active") as unknown as { trains: { status: string }[] };
			expect(el.trains).toHaveLength(2);
			expect(el.trains.every((t) => t.status === "running" || t.status === "paused")).toBe(true);
		});

		it("passes searchText from context", () => {
			const container = document.createElement("div");
			registry.getTabHandler("train:active")!(container, { tabId: "active", viewId: "test", eventBus, searchText: "brainstorm" });
			const el = container.querySelector("flowti-train-active") as unknown as { searchText: string };
			expect(el.searchText).toBe("brainstorm");
		});

		it("wires open-train to openTrainView callback", () => {
			const container = document.createElement("div");
			registry.getTabHandler("train:active")!(container, { tabId: "active", viewId: "test", eventBus });
			const el = container.querySelector("flowti-train-active")!;
			el.dispatchEvent(new CustomEvent("open-train", { detail: { trainId: "t1" }, bubbles: true }));
			expect(openTrainView).toHaveBeenCalledWith("t1");
		});

		it("wires resume-train to eventBus", () => {
			const container = document.createElement("div");
			registry.getTabHandler("train:active")!(container, { tabId: "active", viewId: "test", eventBus });
			const el = container.querySelector("flowti-train-active")!;
			el.dispatchEvent(new CustomEvent("resume-train", { detail: { trainId: "t1" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.resumeTrain", { trainId: "t1" });
		});

		it("wires pause-train to eventBus", () => {
			const container = document.createElement("div");
			registry.getTabHandler("train:active")!(container, { tabId: "active", viewId: "test", eventBus });
			const el = container.querySelector("flowti-train-active")!;
			el.dispatchEvent(new CustomEvent("pause-train", { detail: { trainId: "t1" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.pauseTrain", { trainId: "t1" });
		});

		it("wires delete-train to eventBus", () => {
			const container = document.createElement("div");
			registry.getTabHandler("train:active")!(container, { tabId: "active", viewId: "test", eventBus });
			const el = container.querySelector("flowti-train-active")!;
			el.dispatchEvent(new CustomEvent("delete-train", { detail: { trainId: "t1" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.deleteTrain", { trainId: "t1" });
		});
	});

	describe("history handler", () => {
		it("creates flowti-train-history element with only completed trains", () => {
			const trains = [
				{ id: "t1", status: "running", thoughts: [] },
				{ id: "t2", status: "completed", thoughts: [] },
				{ id: "t3", status: "completed", thoughts: [] },
			];
			trainService.getAllTrains.mockReturnValue(trains as never);
			const container = document.createElement("div");
			registry.getTabHandler("train:history")!(container, { tabId: "history", viewId: "test", eventBus });
			const el = container.querySelector("flowti-train-history") as unknown as { trains: { status: string }[] };
			expect(el.trains).toHaveLength(2);
			expect(el.trains.every((t) => t.status === "completed")).toBe(true);
		});

		it("passes searchText from context", () => {
			const container = document.createElement("div");
			registry.getTabHandler("train:history")!(container, { tabId: "history", viewId: "test", eventBus, searchText: "research" });
			const el = container.querySelector("flowti-train-history") as unknown as { searchText: string };
			expect(el.searchText).toBe("research");
		});

		it("wires open-train to openTrainView callback", () => {
			const container = document.createElement("div");
			registry.getTabHandler("train:history")!(container, { tabId: "history", viewId: "test", eventBus });
			const el = container.querySelector("flowti-train-history")!;
			el.dispatchEvent(new CustomEvent("open-train", { detail: { trainId: "t2" }, bubbles: true }));
			expect(openTrainView).toHaveBeenCalledWith("t2");
		});

		it("wires delete-train to eventBus", () => {
			const container = document.createElement("div");
			registry.getTabHandler("train:history")!(container, { tabId: "history", viewId: "test", eventBus });
			const el = container.querySelector("flowti-train-history")!;
			el.dispatchEvent(new CustomEvent("delete-train", { detail: { trainId: "t2" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.deleteTrain", { trainId: "t2" });
		});
	});
});
