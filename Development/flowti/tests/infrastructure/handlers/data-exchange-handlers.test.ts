// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerDataExchangeHandlers } from "../../../src/infrastructure/handlers/data-exchange-handlers";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../../src/infrastructure/events/types";

// Import components to register custom elements
import "../../../src/components/dx/flowti-dx-dashboard";
import "../../../src/components/dx/flowti-dx-imports";
import "../../../src/components/dx/flowti-dx-exports";
import "../../../src/components/dx/flowti-dx-pipelines";
import "../../../src/components/dx/flowti-dx-types";
import "../../../src/components/dx/flowti-dx-properties";
import "../../../src/components/dx/flowti-dx-signals";
import "../../../src/components/dx/flowti-dx-reports";
import "../../../src/components/dx/flowti-dx-canvas";

function createMockDataExchangeService() {
	return {
		getSavedImportConfigs: vi.fn(() => []),
		getSavedExportConfigs: vi.fn(() => []),
		getSavedPipelines: vi.fn(() => []),
		buildDataDictionary: vi.fn(() => []),
		getPropertyDocPath: vi.fn((name: string) => `Properties/${name}.md`),
		getTypesFolderPath: vi.fn(() => "Types"),
		getReportsFolderPath: vi.fn(() => "Reports"),
	};
}

function createMockSignalService() {
	return {
		getSignals: vi.fn(() => []),
		syncAll: vi.fn().mockResolvedValue(undefined),
	};
}

function createMockCanvasService() {
	return {
		getConfigs: vi.fn(() => []),
	};
}

function createMockOperationTracker() {
	return {
		getActiveOperations: vi.fn(() => []),
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

describe("registerDataExchangeHandlers", () => {
	let registry: PluginHandlerRegistry;
	let dataExchangeService: ReturnType<typeof createMockDataExchangeService>;
	let signalService: ReturnType<typeof createMockSignalService>;
	let canvasService: ReturnType<typeof createMockCanvasService>;
	let operationTracker: ReturnType<typeof createMockOperationTracker>;
	let eventBus: IEventBus;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
		dataExchangeService = createMockDataExchangeService();
		signalService = createMockSignalService();
		canvasService = createMockCanvasService();
		operationTracker = createMockOperationTracker();
		eventBus = createMockEventBus();
		registerDataExchangeHandlers(registry, {
			dataExchangeService,
			signalService,
			canvasService,
			operationTracker,
			eventBus,
		});
	});

	it("registers all 9 tab handlers", () => {
		expect(registry.getTabHandler("dx:dashboard")).toBeDefined();
		expect(registry.getTabHandler("dx:imports")).toBeDefined();
		expect(registry.getTabHandler("dx:exports")).toBeDefined();
		expect(registry.getTabHandler("dx:pipelines")).toBeDefined();
		expect(registry.getTabHandler("dx:types")).toBeDefined();
		expect(registry.getTabHandler("dx:properties")).toBeDefined();
		expect(registry.getTabHandler("dx:signals")).toBeDefined();
		expect(registry.getTabHandler("dx:reports")).toBeDefined();
		expect(registry.getTabHandler("dx:canvas")).toBeDefined();
	});

	describe("dashboard handler", () => {
		it("creates flowti-dx-dashboard element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:dashboard")!(container, { tabId: "dashboard", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-dashboard");
			expect(el).not.toBeNull();
		});

		it("sets activeOps from operation tracker", () => {
			const ops = [{ operationId: "op1", type: "import", name: "Test", completed: false }];
			operationTracker.getActiveOperations.mockReturnValue(ops);
			const container = document.createElement("div");
			registry.getTabHandler("dx:dashboard")!(container, { tabId: "dashboard", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-dashboard") as unknown as { activeOps: unknown[] };
			expect(el.activeOps).toEqual(ops);
		});

		it("wires open-pipelines event to eventBus.emit", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:dashboard")!(container, { tabId: "dashboard", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-dashboard")!;
			el.dispatchEvent(new CustomEvent("open-pipelines", { bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.navigateTab", { viewId: "data-exchange-hub", tabId: "pipelines" });
		});
	});

	describe("imports handler", () => {
		it("creates flowti-dx-imports element with configs", () => {
			const imports = [{ id: "i1", name: "Test", sourcePath: "data.csv", targetFolder: "Notes" }];
			dataExchangeService.getSavedImportConfigs.mockReturnValue(imports);
			const container = document.createElement("div");
			registry.getTabHandler("dx:imports")!(container, { tabId: "imports", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-imports") as unknown as { imports: unknown[] };
			expect(el.imports).toEqual(imports);
		});

		it("passes searchText from context", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:imports")!(container, { tabId: "imports", viewId: "test", eventBus, searchText: "csv" });
			const el = container.querySelector("flowti-dx-imports") as unknown as { searchText: string };
			expect(el.searchText).toBe("csv");
		});

		it("wires run-import to eventBus", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:imports")!(container, { tabId: "imports", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-imports")!;
			el.dispatchEvent(new CustomEvent("run-import", { detail: { importId: "i1" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.runImport", { importId: "i1" });
		});

		it("wires create-import to eventBus", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:imports")!(container, { tabId: "imports", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-imports")!;
			el.dispatchEvent(new CustomEvent("create-import", { bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.createImport", {});
		});
	});

	describe("exports handler", () => {
		it("creates flowti-dx-exports element with configs", () => {
			const exports = [{ id: "e1", name: "Test Export", outputPath: "out.csv" }];
			dataExchangeService.getSavedExportConfigs.mockReturnValue(exports);
			const container = document.createElement("div");
			registry.getTabHandler("dx:exports")!(container, { tabId: "exports", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-exports") as unknown as { exports: unknown[] };
			expect(el.exports).toEqual(exports);
		});

		it("wires run-export to eventBus", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:exports")!(container, { tabId: "exports", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-exports")!;
			el.dispatchEvent(new CustomEvent("run-export", { detail: { exportId: "e1" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.runExport", { exportId: "e1" });
		});
	});

	describe("pipelines handler", () => {
		it("creates flowti-dx-pipelines element with merged operation status", () => {
			const pipelines = [{ id: "p1", name: "Pipeline A", noteType: "Article" }];
			dataExchangeService.getSavedPipelines.mockReturnValue(pipelines);
			operationTracker.getActiveOperations.mockReturnValue([
				{ operationId: "p1", type: "pipeline", name: "Pipeline A", completed: false, progress: { current: 3, total: 10 } },
			]);
			const container = document.createElement("div");
			registry.getTabHandler("dx:pipelines")!(container, { tabId: "pipelines", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-pipelines") as unknown as { operations: Array<{ status: string; progress: number }> };
			expect(el.operations).toHaveLength(1);
			expect(el.operations[0].status).toBe("running");
			expect(el.operations[0].progress).toBe(30);
		});

		it("marks idle pipelines when no active operation", () => {
			const pipelines = [{ id: "p1", name: "Pipeline A" }];
			dataExchangeService.getSavedPipelines.mockReturnValue(pipelines);
			operationTracker.getActiveOperations.mockReturnValue([]);
			const container = document.createElement("div");
			registry.getTabHandler("dx:pipelines")!(container, { tabId: "pipelines", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-pipelines") as unknown as { operations: Array<{ status: string }> };
			expect(el.operations[0].status).toBe("idle");
		});

		it("wires run-pipeline to eventBus", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:pipelines")!(container, { tabId: "pipelines", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-pipelines")!;
			el.dispatchEvent(new CustomEvent("run-pipeline", { detail: { pipelineId: "p1" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("dataExchange.pipeline.execute", { pipelineId: "p1" });
		});
	});

	describe("types handler", () => {
		it("creates flowti-dx-types element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:types")!(container, { tabId: "types", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-types");
			expect(el).not.toBeNull();
		});

		it("wires open-type to eventBus", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:types")!(container, { tabId: "types", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-types")!;
			el.dispatchEvent(new CustomEvent("open-type", { detail: { typeName: "Article", filePath: "Types/Article.md" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.openFile", { filePath: "Types/Article.md" });
		});
	});

	describe("properties handler", () => {
		it("creates flowti-dx-properties element with dictionary data", () => {
			const dict = [{ propertyName: "title", noteCount: 42, uniqueValues: 38 }];
			dataExchangeService.buildDataDictionary.mockReturnValue(dict);
			const container = document.createElement("div");
			registry.getTabHandler("dx:properties")!(container, { tabId: "properties", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-properties") as unknown as { properties: Array<{ propertyName: string }> };
			expect(el.properties).toHaveLength(1);
			expect(el.properties[0].propertyName).toBe("title");
		});

		it("wires open-property-doc to eventBus with resolved path", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:properties")!(container, { tabId: "properties", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-properties")!;
			el.dispatchEvent(new CustomEvent("open-property-doc", { detail: { propertyName: "title" }, bubbles: true }));
			expect(dataExchangeService.getPropertyDocPath).toHaveBeenCalledWith("title");
			expect(eventBus.emit).toHaveBeenCalledWith("ui.openFile", { filePath: "Properties/title.md" });
		});
	});

	describe("signals handler", () => {
		it("creates flowti-dx-signals element with signal data", () => {
			const signals = [{ id: "s1", name: "Signal A" }];
			signalService.getSignals.mockReturnValue(signals);
			const container = document.createElement("div");
			registry.getTabHandler("dx:signals")!(container, { tabId: "signals", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-signals") as unknown as { signals: unknown[] };
			expect(el.signals).toEqual(signals);
		});

		it("wires sync-signal to eventBus", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:signals")!(container, { tabId: "signals", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-signals")!;
			el.dispatchEvent(new CustomEvent("sync-signal", { detail: { signalId: "s1" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.syncSignal", { signalId: "s1" });
		});

		it("wires sync-all to signalService.syncAll", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:signals")!(container, { tabId: "signals", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-signals")!;
			el.dispatchEvent(new CustomEvent("sync-all", { bubbles: true }));
			expect(signalService.syncAll).toHaveBeenCalled();
		});
	});

	describe("reports handler", () => {
		it("creates flowti-dx-reports element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:reports")!(container, { tabId: "reports", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-reports");
			expect(el).not.toBeNull();
		});

		it("wires open-report to eventBus", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:reports")!(container, { tabId: "reports", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-reports")!;
			el.dispatchEvent(new CustomEvent("open-report", { detail: { reportPath: "Reports/CSV - Test.md" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.openFile", { filePath: "Reports/CSV - Test.md" });
		});
	});

	describe("canvas handler", () => {
		it("creates flowti-dx-canvas element with canvas configs", () => {
			const configs = [{ id: "c1", name: "Config A" }];
			canvasService.getConfigs.mockReturnValue(configs);
			const container = document.createElement("div");
			registry.getTabHandler("dx:canvas")!(container, { tabId: "canvas", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-canvas") as unknown as { canvases: unknown[] };
			expect(el.canvases).toEqual(configs);
		});

		it("wires run-canvas to eventBus", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:canvas")!(container, { tabId: "canvas", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-canvas")!;
			el.dispatchEvent(new CustomEvent("run-canvas", { detail: { canvasId: "c1" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.runCanvasImport", { canvasId: "c1" });
		});

		it("wires open-canvas to eventBus", () => {
			const container = document.createElement("div");
			registry.getTabHandler("dx:canvas")!(container, { tabId: "canvas", viewId: "test", eventBus });
			const el = container.querySelector("flowti-dx-canvas")!;
			el.dispatchEvent(new CustomEvent("open-canvas", { detail: { canvasPath: "Canvases/a.canvas" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.openFile", { filePath: "Canvases/a.canvas" });
		});
	});
});
