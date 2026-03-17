import type { PluginHandlerRegistry, ActionContext } from "./plugin-handler-registry";
import type { CaptureType } from "../../domain/capture/types";

export interface ActionHandlerDeps {
	trainService: {
		getActiveTrain: () => { id: string; status: string } | null;
	};
}

/**
 * Registers all command action handlers referenced by plugin-sitemap.json.
 * Each handler emits the same EventBus event as the current manual
 * command/ribbon registration in main.ts.
 *
 * Note: ribbon entries with "view:" prefix (e.g., "view:flowti-user-hub") are
 * handled directly by SitemapBootstrap.registerRibbon() which opens the view
 * without going through action handlers. Only non-view ribbon actions (like
 * "train:toggle-or-start", "canvas:start-session", "capture:*") need handlers.
 */
export function registerActionHandlers(registry: PluginHandlerRegistry, deps: ActionHandlerDeps): void {
	// ── View-open actions ──────────────────────────────────
	registry.registerAction("view:open-event-catalog", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openEventCatalog", {});
	});
	registry.registerAction("view:open-subscription-manager", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openSubscriptionManager", {});
	});
	registry.registerAction("view:open-journey-builder", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openJourneyBuilder", {});
	});

	// ── Hub-open actions ───────────────────────────────────
	registry.registerAction("hub:open-user", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openUserHub", {});
	});
	registry.registerAction("hub:open-train", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openTrainHub", {});
	});
	registry.registerAction("hub:open-analytics", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openAnalyticsHub", {});
	});
	registry.registerAction("hub:open-test-management", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openTestManagementHub", {});
	});
	registry.registerAction("hub:open-data-exchange", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openDataExchangeHub", {});
	});

	// ── Capture actions ────────────────────────────────────
	const captureTypes = [
		"open", "idea", "feedback", "note", "task",
		"question", "bug", "risk", "assumption", "issue",
		"decision", "learning",
	] as const;
	for (const type of captureTypes) {
		const actionId = type === "open" ? "capture:open" : `capture:${type}`;
		const payload = type === "open" ? {} : { type: type as CaptureType };
		registry.registerAction(actionId, (ctx: ActionContext) => {
			void ctx.eventBus.emit("ui.openQuickCapture", payload);
		});
	}

	// ── Train actions ──────────────────────────────────────
	registry.registerAction("train:start", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.startTrain", {});
	});
	registry.registerAction("train:resume", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.resumeTrain", {});
	});
	registry.registerAction("train:complete", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.completeTrain", {});
	});
	registry.registerAction("train:open-canvas", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openTrainCanvas", {});
	});
	registry.registerAction("train:open-timeline", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openTrainTimeline", {});
	});
	registry.registerAction("train:open-view", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openTrainView", {});
	});
	// Ribbon toggle: open active train view if exists, else start new train
	registry.registerAction("train:toggle-or-start", (ctx: ActionContext) => {
		const activeTrain = deps.trainService.getActiveTrain();
		if (activeTrain) {
			void ctx.eventBus.emit("ui.openTrainView", { trainId: activeTrain.id });
			return;
		}
		void ctx.eventBus.emit("ui.startTrain", {});
	});

	// ── Session actions ────────────────────────────────────
	registry.registerAction("session:open-workspace", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openSessionWorkspace", {});
	});
	registry.registerAction("session:open-workspace-sidebar", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openSessionWorkspaceSidebar", {});
	});
	registry.registerAction("session:create", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.createSession", {});
	});
	registry.registerAction("session:resume", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.resumeSession", {});
	});

	// ── Journey actions ────────────────────────────────────
	registry.registerAction("journey:run", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.runJourney", { journeyName: "", jsonPath: "" });
	});

	// ── Canvas actions ─────────────────────────────────────
	registry.registerAction("canvas:start-session", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.startCanvasSession", {});
	});

	// ── Installer actions ──────────────────────────────────
	registry.registerAction("installer:open", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openInstaller", {});
	});

	// ── Data Exchange actions ──────────────────────────────
	registry.registerAction("data-exchange:import-csv", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.importCsv", {});
	});
	registry.registerAction("data-exchange:export-csv", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.exportCsv", {});
	});
	registry.registerAction("data-exchange:export-tab", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.exportTab", {});
	});
	registry.registerAction("data-exchange:signal-sync", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.signalSync", {});
	});
	registry.registerAction("data-exchange:import-canvas", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.importCanvas", {});
	});
}
