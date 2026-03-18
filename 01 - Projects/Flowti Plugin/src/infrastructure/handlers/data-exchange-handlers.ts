/**
 * Handler registration for DataExchangeHub tabs.
 *
 * Bridges DataExchangeService + SignalService + CanvasService → Lit components.
 * Each handler creates a Lit element, sets properties from service data,
 * and wires CustomEvent listeners to service/eventBus calls.
 */

import type { PluginHandlerRegistry, TabContext } from "./plugin-handler-registry";
import type { IEventBus } from "../events/types";
import type { FlowtiEventMap } from "../events/events";
import { setProps } from "./handler-utils";

// Side-effect imports: register Lit custom elements
import "../../components/dx/flowti-dx-dashboard.js";
import "../../components/dx/flowti-dx-imports.js";
import "../../components/dx/flowti-dx-exports.js";
import "../../components/dx/flowti-dx-pipelines.js";
import "../../components/dx/flowti-dx-types.js";
import "../../components/dx/flowti-dx-properties.js";
import "../../components/dx/flowti-dx-signals.js";
import "../../components/dx/flowti-dx-reports.js";
import "../../components/dx/flowti-dx-canvas.js";

interface ActiveOperation {
	operationId: string;
	type: string;
	name: string;
	completed?: boolean;
	success?: boolean;
	progress?: { current: number; total: number } | null;
	message?: string;
}

export interface DataExchangeHandlerDeps {
	dataExchangeService: {
		getSavedImportConfigs: () => readonly unknown[];
		getSavedExportConfigs: () => readonly unknown[];
		getSavedPipelines: () => readonly unknown[];
		buildDataDictionary: () => readonly unknown[];
		getPropertyDocPath: (name: string) => string;
		getTypesFolderPath: () => string;
		getReportsFolderPath: () => string;
	};
	signalService: {
		getSignals: () => readonly unknown[];
		syncAll: () => Promise<unknown>;
	} | null;
	canvasService: {
		getConfigs: () => readonly unknown[];
	} | null;
	operationTracker: {
		getActiveOperations: () => readonly ActiveOperation[];
	};
	eventBus: IEventBus;
}

export function registerDataExchangeHandlers(
	registry: PluginHandlerRegistry,
	deps: DataExchangeHandlerDeps,
): void {
	// ── Dashboard handler ─────────────────────────────────

	const dxDashboardHandler = (container: HTMLElement) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-dx-dashboard");
		const activeOps = deps.operationTracker.getActiveOperations();
		setProps(el, { activeOps });
		el.addEventListener("open-pipelines", () => {
			void deps.eventBus.emit("ui.navigateTab", { viewId: "data-exchange-hub", tabId: "pipelines" });
		});
		el.addEventListener("navigate-tab", ((e: CustomEvent<{ tabId: string }>) => {
			void deps.eventBus.emit("ui.navigateTab", { viewId: "data-exchange-hub", tabId: e.detail.tabId });
		}) as EventListener);
		container.appendChild(el);
	};
	registry.registerTabHandler("dx:dashboard", dxDashboardHandler);
	registry.registerTabHandler("data-exchange:dashboard", dxDashboardHandler);

	// ── Imports handler ───────────────────────────────────

	registry.registerTabHandler("dx:imports", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-dx-imports");
		const imports = deps.dataExchangeService.getSavedImportConfigs();
		setProps(el, { imports });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });
		el.addEventListener("select-import", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.selectImport", e.detail as FlowtiEventMap["ui.selectImport"]);
		}) as EventListener);
		el.addEventListener("run-import", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.runImport", e.detail as FlowtiEventMap["ui.runImport"]);
		}) as EventListener);
		el.addEventListener("edit-import", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.editImport", e.detail as FlowtiEventMap["ui.editImport"]);
		}) as EventListener);
		el.addEventListener("delete-import", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.deleteImport", e.detail as FlowtiEventMap["ui.deleteImport"]);
		}) as EventListener);
		el.addEventListener("create-import", () => {
			void deps.eventBus.emit("ui.createImport", {});
		});
		container.appendChild(el);
	});

	// ── Exports handler ───────────────────────────────────

	registry.registerTabHandler("dx:exports", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-dx-exports");
		const exports = deps.dataExchangeService.getSavedExportConfigs();
		setProps(el, { exports });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });
		el.addEventListener("select-export", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.selectExport", e.detail as FlowtiEventMap["ui.selectExport"]);
		}) as EventListener);
		el.addEventListener("run-export", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.runExport", e.detail as FlowtiEventMap["ui.runExport"]);
		}) as EventListener);
		el.addEventListener("edit-export", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.editExport", e.detail as FlowtiEventMap["ui.editExport"]);
		}) as EventListener);
		el.addEventListener("delete-export", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.deleteExport", e.detail as FlowtiEventMap["ui.deleteExport"]);
		}) as EventListener);
		el.addEventListener("create-export", () => {
			void deps.eventBus.emit("ui.createExport", {});
		});
		container.appendChild(el);
	});

	// ── Pipelines handler ────────────────────────────────

	registry.registerTabHandler("dx:pipelines", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-dx-pipelines");
		const pipelines = deps.dataExchangeService.getSavedPipelines() as Array<{ id: string; name: string; noteType?: string }>;
		const activeOps = deps.operationTracker.getActiveOperations();

		const operations = pipelines.map((p) => {
			const op = activeOps.find((o) => o.operationId === p.id);
			return {
				id: p.id,
				name: p.name,
				noteType: p.noteType,
				status: op ? (op.completed ? (op.success ? "completed" : "failed") : "running") : "idle",
				progress: op?.progress ? Math.round((op.progress.current / op.progress.total) * 100) : 0,
				message: op?.message ?? "",
			};
		});

		setProps(el, { operations });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });
		el.addEventListener("run-pipeline", ((e: CustomEvent) => {
			void deps.eventBus.emit("dataExchange.pipeline.execute", e.detail as FlowtiEventMap["dataExchange.pipeline.execute"]);
		}) as EventListener);
		el.addEventListener("select-pipeline", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.selectPipeline", e.detail as FlowtiEventMap["ui.selectPipeline"]);
		}) as EventListener);
		container.appendChild(el);
	});

	// ── Types handler ─────────────────────────────────────

	registry.registerTabHandler("dx:types", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-dx-types");
		// Derive types from saved import/export/pipeline configs' noteType fields
		const imports = deps.dataExchangeService.getSavedImportConfigs() as Array<{ noteType?: string; name: string }>;
		const exports = deps.dataExchangeService.getSavedExportConfigs() as Array<{ noteType?: string; name: string }>;
		const pipelines = deps.dataExchangeService.getSavedPipelines() as Array<{ noteType?: string; name: string }>;
		const typeMap = new Map<string, { name: string; pipelineCount: number; properties: string[] }>();
		for (const cfg of [...imports, ...exports, ...pipelines]) {
			if (cfg.noteType) {
				const existing = typeMap.get(cfg.noteType);
				if (existing) {
					existing.pipelineCount++;
				} else {
					typeMap.set(cfg.noteType, { name: cfg.noteType, pipelineCount: 1, properties: [] });
				}
			}
		}
		// Enrich with property data from the data dictionary
		const dictionary = deps.dataExchangeService.buildDataDictionary() as Array<{
			propertyName: string; noteTypes?: string[];
		}>;
		for (const entry of dictionary) {
			if (entry.noteTypes) {
				for (const nt of entry.noteTypes) {
					const t = typeMap.get(nt);
					if (t) t.properties.push(entry.propertyName);
				}
			}
		}
		const types = [...typeMap.values()].map((t) => ({
			name: t.name,
			description: `Used in ${t.pipelineCount} config${t.pipelineCount !== 1 ? "s" : ""}`,
			properties: t.properties,
			filePath: deps.dataExchangeService.getTypesFolderPath() + "/" + t.name + ".md",
			pipelineCount: t.pipelineCount,
		}));
		setProps(el, { types });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });
		el.addEventListener("select-type", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.selectType", e.detail as FlowtiEventMap["ui.selectType"]);
		}) as EventListener);
		el.addEventListener("open-type", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.openFile", { filePath: (e.detail as { filePath: string }).filePath });
		}) as EventListener);
		container.appendChild(el);
	});

	// ── Properties handler ────────────────────────────────

	registry.registerTabHandler("dx:properties", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-dx-properties");
		const dictionary = deps.dataExchangeService.buildDataDictionary() as Array<{
			propertyName: string; noteCount: number; uniqueValues: number;
		}>;
		const properties = dictionary.map((d) => ({
			propertyName: d.propertyName,
			noteCount: d.noteCount,
			uniqueValues: d.uniqueValues,
			hasDoc: false, // Enriched at runtime if app vault access is available
		}));
		setProps(el, { properties });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });
		el.addEventListener("select-property", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.selectProperty", e.detail as FlowtiEventMap["ui.selectProperty"]);
		}) as EventListener);
		el.addEventListener("open-property-doc", ((e: CustomEvent) => {
			const propName = (e.detail as { propertyName: string }).propertyName;
			const docPath = deps.dataExchangeService.getPropertyDocPath(propName);
			void deps.eventBus.emit("ui.openFile", { filePath: docPath });
		}) as EventListener);
		el.addEventListener("create-property-doc", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.createPropertyDoc", e.detail as FlowtiEventMap["ui.createPropertyDoc"]);
		}) as EventListener);
		container.appendChild(el);
	});

	// ── Signals handler ───────────────────────────────────

	registry.registerTabHandler("dx:signals", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-dx-signals");
		const signals = deps.signalService?.getSignals() ?? [];
		setProps(el, { signals });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });
		el.addEventListener("sync-signal", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.syncSignal", e.detail as FlowtiEventMap["ui.syncSignal"]);
		}) as EventListener);
		el.addEventListener("sync-all", () => {
			void deps.signalService?.syncAll();
		});
		container.appendChild(el);
	});

	// ── Reports handler ───────────────────────────────────

	registry.registerTabHandler("dx:reports", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-dx-reports");
		// Reports require vault-level file scanning (not yet available via handler deps).
		// The full Data Exchange Hub view provides scanning; this handler shows guidance.
		setProps(el, { reports: [], emptyHint: "Reports are available in the full Data Exchange Hub view, which scans CSV files from your vault." });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });
		el.addEventListener("select-report", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.selectReport", e.detail as FlowtiEventMap["ui.selectReport"]);
		}) as EventListener);
		el.addEventListener("open-report", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.openFile", { filePath: (e.detail as { reportPath: string }).reportPath });
		}) as EventListener);
		container.appendChild(el);
	});

	// ── Canvas handler ────────────────────────────────────

	registry.registerTabHandler("dx:canvas", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-dx-canvas");
		const canvases = deps.canvasService?.getConfigs() ?? [];
		setProps(el, { canvases });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });
		el.addEventListener("select-canvas", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.selectCanvas", e.detail as FlowtiEventMap["ui.selectCanvas"]);
		}) as EventListener);
		el.addEventListener("run-canvas", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.runCanvasImport", e.detail as FlowtiEventMap["ui.runCanvasImport"]);
		}) as EventListener);
		el.addEventListener("open-canvas", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.openFile", { filePath: (e.detail as { canvasPath: string }).canvasPath });
		}) as EventListener);
		container.appendChild(el);
	});
}
