/**
 * Handler registration for DataExchangeHub tabs.
 *
 * Bridges DataExchangeService + SignalService + CanvasService → Lit components.
 * Each handler creates a Lit element, sets properties from service data,
 * and wires CustomEvent listeners to service/eventBus calls.
 */

import type { PluginHandlerRegistry, TabContext } from "./plugin-handler-registry";
import type { IEventBus } from "../events/types";
import { setProps } from "./handler-utils";

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
		syncAll: () => Promise<void>;
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

	registry.registerTabHandler("dx:dashboard", (container: HTMLElement) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-dx-dashboard");
		const activeOps = deps.operationTracker.getActiveOperations();
		setProps(el, { activeOps });
		el.addEventListener("open-pipelines", () => {
			void deps.eventBus.emit("ui.navigateTab" as never, { viewId: "data-exchange-hub", tabId: "pipelines" } as never);
		});
		container.appendChild(el);
	});

	// ── Imports handler ───────────────────────────────────

	registry.registerTabHandler("dx:imports", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-dx-imports");
		const imports = deps.dataExchangeService.getSavedImportConfigs();
		setProps(el, { imports });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });
		el.addEventListener("run-import", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.runImport" as never, e.detail as never);
		}) as EventListener);
		el.addEventListener("edit-import", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.editImport" as never, e.detail as never);
		}) as EventListener);
		el.addEventListener("delete-import", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.deleteImport" as never, e.detail as never);
		}) as EventListener);
		el.addEventListener("create-import", () => {
			void deps.eventBus.emit("ui.createImport" as never, {} as never);
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
		el.addEventListener("run-export", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.runExport" as never, e.detail as never);
		}) as EventListener);
		el.addEventListener("edit-export", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.editExport" as never, e.detail as never);
		}) as EventListener);
		el.addEventListener("delete-export", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.deleteExport" as never, e.detail as never);
		}) as EventListener);
		el.addEventListener("create-export", () => {
			void deps.eventBus.emit("ui.createExport" as never, {} as never);
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
			void deps.eventBus.emit("dataExchange.pipeline.execute" as never, e.detail as never);
		}) as EventListener);
		el.addEventListener("select-pipeline", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.selectPipeline" as never, e.detail as never);
		}) as EventListener);
		container.appendChild(el);
	});

	// ── Types handler ─────────────────────────────────────

	registry.registerTabHandler("dx:types", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-dx-types");
		// Types are passed in as empty by default — the handler can be enriched later
		// when the service provides type scanning
		setProps(el, { types: [] });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });
		el.addEventListener("open-type", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.openFile" as never, { filePath: (e.detail as { filePath: string }).filePath } as never);
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
		el.addEventListener("open-property-doc", ((e: CustomEvent) => {
			const propName = (e.detail as { propertyName: string }).propertyName;
			const docPath = deps.dataExchangeService.getPropertyDocPath(propName);
			void deps.eventBus.emit("ui.openFile" as never, { filePath: docPath } as never);
		}) as EventListener);
		el.addEventListener("create-property-doc", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.createPropertyDoc" as never, e.detail as never);
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
			void deps.eventBus.emit("ui.syncSignal" as never, e.detail as never);
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
		// Reports are populated from scanning — start empty, enriched by refresh
		setProps(el, { reports: [] });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });
		el.addEventListener("open-report", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.openFile" as never, { filePath: (e.detail as { reportPath: string }).reportPath } as never);
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
		el.addEventListener("run-canvas", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.runCanvasImport" as never, e.detail as never);
		}) as EventListener);
		el.addEventListener("open-canvas", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.openFile" as never, { filePath: (e.detail as { canvasPath: string }).canvasPath } as never);
		}) as EventListener);
		container.appendChild(el);
	});
}
