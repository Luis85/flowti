import type { PluginHandlerRegistry, ActionContext } from "./plugin-handler-registry";

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
		void ctx.eventBus.emit("ui.openEventCatalog" as never, {} as never);
	});
	registry.registerAction("view:open-subscription-manager", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openSubscriptionManager" as never, {} as never);
	});
	registry.registerAction("view:open-journey-builder", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openJourneyBuilder" as never, {} as never);
	});

	// ── Hub-open actions ───────────────────────────────────
	registry.registerAction("hub:open-user", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openUserHub" as never, {} as never);
	});
	registry.registerAction("hub:open-train", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openTrainHub" as never, {} as never);
	});
	registry.registerAction("hub:open-analytics", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openAnalyticsHub" as never, {} as never);
	});
	registry.registerAction("hub:open-test-management", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openTestManagementHub" as never, {} as never);
	});
	registry.registerAction("hub:open-data-exchange", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openDataExchangeHub" as never, {} as never);
	});

	// ── Capture actions ────────────────────────────────────
	const captureTypes = [
		"open", "idea", "feedback", "note", "task",
		"question", "bug", "risk", "assumption", "issue",
		"decision", "learning",
	] as const;
	for (const type of captureTypes) {
		const actionId = type === "open" ? "capture:open" : `capture:${type}`;
		const payload = type === "open" ? {} : { type };
		registry.registerAction(actionId, (ctx: ActionContext) => {
			void ctx.eventBus.emit("ui.openQuickCapture" as never, payload as never);
		});
	}

	// ── Train actions ──────────────────────────────────────
	registry.registerAction("train:start", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.startTrain" as never, {} as never);
	});
	registry.registerAction("train:resume", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.resumeTrain" as never, {} as never);
	});
	registry.registerAction("train:complete", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.completeTrain" as never, {} as never);
	});
	registry.registerAction("train:open-canvas", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openTrainCanvas" as never, {} as never);
	});
	registry.registerAction("train:open-timeline", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openTrainTimeline" as never, {} as never);
	});
	registry.registerAction("train:open-view", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openTrainView" as never, {} as never);
	});
	// Ribbon toggle: open active train view if exists, else start new train
	registry.registerAction("train:toggle-or-start", (ctx: ActionContext) => {
		const activeTrain = deps.trainService.getActiveTrain();
		if (activeTrain) {
			void ctx.eventBus.emit("ui.openTrainView" as never, { trainId: activeTrain.id } as never);
			return;
		}
		void ctx.eventBus.emit("ui.startTrain" as never, {} as never);
	});

	// ── Session actions ────────────────────────────────────
	registry.registerAction("session:open-workspace", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openSessionWorkspace" as never, {} as never);
	});
	registry.registerAction("session:open-workspace-sidebar", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openSessionWorkspaceSidebar" as never, {} as never);
	});
	registry.registerAction("session:create", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.createSession" as never, {} as never);
	});
	registry.registerAction("session:resume", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.resumeSession" as never, {} as never);
	});

	// ── Journey actions ────────────────────────────────────
	registry.registerAction("journey:run", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.runJourney" as never, {} as never);
	});

	// ── Canvas actions ─────────────────────────────────────
	registry.registerAction("canvas:start-session", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.startCanvasSession" as never, {} as never);
	});

	// ── Installer actions ──────────────────────────────────
	registry.registerAction("installer:open", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openInstaller" as never, {} as never);
	});

	// ── Data Exchange actions ──────────────────────────────
	registry.registerAction("data-exchange:import-csv", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.importCsv" as never, {} as never);
	});
	registry.registerAction("data-exchange:export-csv", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.exportCsv" as never, {} as never);
	});
	registry.registerAction("data-exchange:export-tab", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.exportTab" as never, {} as never);
	});
	registry.registerAction("data-exchange:signal-sync", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.signalSync" as never, {} as never);
	});
	registry.registerAction("data-exchange:import-canvas", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.importCanvas" as never, {} as never);
	});
}
