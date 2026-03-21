/**
 * plugin-teardown.ts — Plugin unload/disposal logic extracted from main.ts.
 */

import { VIEW_TYPE_AGENT_SIDEBAR, VIEW_TYPE_AGENT_WORLD } from "../ui/agents/types.js";
import { VIEW_TYPE_PROJECT_DETAIL } from "../ui/projects/types.js";
import type { App } from "obsidian";

/** All view types to detach on unload. */
export const PLUGIN_VIEW_TYPES = [
	"flowti-event-catalog", "flowti-data-exchange-hub", "flowti-user-hub",
	"flowti-train-main", "flowti-train-timeline", "flowti-train-hub",
	"flowti-analytics-hub", "flowti-session-workspace",
	"flowti-csv", "flowti-export", "flowti-canvas-import",
	"flowti-journey-builder",
	VIEW_TYPE_AGENT_SIDEBAR, VIEW_TYPE_AGENT_WORLD, VIEW_TYPE_PROJECT_DETAIL,
];

/** Safely execute a disposal function, logging errors. */
export function safeDispose(name: string, fn: () => unknown): void {
	try { fn(); } catch (err) { console.error(`[Flowti] Failed to dispose ${name}:`, err); }
}

export interface TeardownRefs {
	app: App;
	eventBus?: { emit(event: string, payload: unknown): void | Promise<void>; clear(): void };
	agentSetup?: { cliExecutor: { dispose(): void }; contextProvider: { dispose(): void }; worldContext: { dispose(): void } };
	trainCanvasSync?: { destroy(): void };
	canvasSessionService?: { dispose(): void };
	journeyBuilderService?: { stop(): void };
	canvasService?: { dispose(): void };
	signalService?: { dispose(): void };
	nudgeService?: { dispose(): void };
	modalService?: { dispose(): void };
	noticeService?: { dispose(): void };
	uiCommandService?: { dispose(): void };
	ingestionStatusBar?: { dispose(): void };
	eventBridge?: { dispose(): void };
	services?: { disposeAll(): unknown };
	hubRegistry?: { clear(): void };
	commands?: { clear(): void };
	views?: { clear(): void };
	logger?: { info(msg: string): void };
}

/**
 * Performs all teardown operations for the plugin.
 */
export function teardownPlugin(refs: TeardownRefs, crossCuttingListeners: (() => void)[]): void {
	safeDispose("plugin.unloading", () => void refs.eventBus?.emit("plugin.unloading", { timestamp: new Date().toISOString() }));

	for (const type of PLUGIN_VIEW_TYPES) { safeDispose(`detach:${type}`, () => refs.app.workspace.detachLeavesOfType(type)); }
	safeDispose("cliExecutor", () => refs.agentSetup?.cliExecutor.dispose());
	safeDispose("agentContext", () => refs.agentSetup?.contextProvider.dispose());
	safeDispose("worldContext", () => refs.agentSetup?.worldContext.dispose());
	safeDispose("trainCanvasSync", () => refs.trainCanvasSync?.destroy());
	safeDispose("canvasSessionService", () => refs.canvasSessionService?.dispose());
	safeDispose("journeyBuilderService", () => refs.journeyBuilderService?.stop());
	safeDispose("canvasService", () => refs.canvasService?.dispose());
	safeDispose("signalService", () => refs.signalService?.dispose());
	safeDispose("nudgeService", () => refs.nudgeService?.dispose());
	safeDispose("modalService", () => refs.modalService?.dispose());
	safeDispose("noticeService", () => refs.noticeService?.dispose());
	safeDispose("uiCommandService", () => refs.uiCommandService?.dispose());
	safeDispose("ingestionStatusBar", () => refs.ingestionStatusBar?.dispose());
	safeDispose("eventBridge", () => refs.eventBridge?.dispose());
	safeDispose("services", () => void refs.services?.disposeAll());
	safeDispose("hubRegistry", () => refs.hubRegistry?.clear());
	safeDispose("commands", () => refs.commands?.clear());
	safeDispose("views", () => refs.views?.clear());

	for (const unsub of crossCuttingListeners) { safeDispose("crossCuttingListener", unsub); }
	refs.logger?.info("Plugin unloaded");
	safeDispose("plugin.unloaded", () => void refs.eventBus?.emit("plugin.unloaded", { timestamp: new Date().toISOString() }));
	safeDispose("eventBus", () => refs.eventBus?.clear());
}
