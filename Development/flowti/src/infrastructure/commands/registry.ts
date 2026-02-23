/**
 * Command registry for Flowti.
 *
 * Central location for defining all plugin commands.
 * Commands are registered with the command registry and
 * automatically bound to Obsidian's command system.
 *
 * Each command handler emits a `ui.*` event on the EventBus.
 * The {@link UiCommandService} listens and performs the actual
 * view/modal opening.
 */

import type { CommandDefinition, ICommandRegistry } from "./types";

/**
 * Creates all command definitions for the application.
 *
 * @returns Array of command definitions
 */
export function createCommandDefinitions(): CommandDefinition[] {
	return [
		{
			id: "flowti:open-component-showcase",
			name: "Open component showcase",
			icon: "palette",
			handler: async (ctx) => {
				ctx.logger.debug("Opening component showcase view");
				void ctx.eventBus.emit("ui.openComponentShowcase", {});
			},
		},
		{
			id: "flowti:open-event-catalog",
			name: "Open event catalog",
			icon: "list",
			handler: async (ctx) => {
				ctx.logger.debug("Opening event catalog view");
				void ctx.eventBus.emit("ui.openEventCatalog", {});
			},
		},
		{
			id: "flowti:open-event-log",
			name: "Open event log",
			icon: "activity",
			handler: async (ctx) => {
				ctx.logger.debug("Opening event log view");
				void ctx.eventBus.emit("ui.openEventLog", {});
			},
		},
		{
			id: "flowti:open-user-hub",
			name: "Open user hub",
			icon: "home",
			handler: async (ctx) => {
				ctx.logger.debug("Opening user hub view");
				void ctx.eventBus.emit("ui.openUserHub", {});
			},
		},
		{
			id: "flowti:manage-subscriptions",
			name: "Manage watchers",
			icon: "bell",
			handler: async (ctx) => {
				ctx.logger.debug("Opening watcher manager");
				void ctx.eventBus.emit("ui.openSubscriptionManager", {});
			},
		},
		{
			id: "flowti:quick-capture",
			name: "Quick capture",
			icon: "pencil",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal");
				void ctx.eventBus.emit("ui.openQuickCapture", {});
			},
		},
		{
			id: "flowti:add-idea",
			name: "Add idea",
			icon: "lightbulb",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for idea");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "idea" });
			},
		},
		{
			id: "flowti:add-feedback",
			name: "Add feedback",
			icon: "message-circle",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for feedback");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "feedback" });
			},
		},
		{
			id: "flowti:add-note",
			name: "Add note",
			icon: "file-text",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for note");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "note" });
			},
		},
		{
			id: "flowti:add-task",
			name: "Add task",
			icon: "check-square",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for task");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "task" });
			},
		},
		{
			id: "flowti:add-question",
			name: "Add question",
			icon: "help-circle",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for question");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "question" });
			},
		},
		{
			id: "flowti:add-bug",
			name: "Add bug",
			icon: "bug",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for bug");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "bug" });
			},
		},
		{
			id: "flowti:add-risk",
			name: "Add risk",
			icon: "alert-triangle",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for risk");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "risk" });
			},
		},
		{
			id: "flowti:add-assumption",
			name: "Add assumption",
			icon: "compass",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for assumption");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "assumption" });
			},
		},
		{
			id: "flowti:add-issue",
			name: "Add issue",
			icon: "alert-circle",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for issue");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "issue" });
			},
		},
		{
			id: "flowti:add-decision",
			name: "Add decision",
			icon: "scale",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for decision");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "decision" });
			},
		},
		{
			id: "flowti:add-learning",
			name: "Add learning",
			icon: "graduation-cap",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for learning");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "learning" });
			},
		},
		{
			id: "flowti:open-train-hub",
			name: "Open train hub",
			icon: "train-front",
			handler: async (ctx) => {
				ctx.logger.debug("Opening train hub view");
				void ctx.eventBus.emit("ui.openTrainHub", {});
			},
		},
		{
			id: "flowti:start-train",
			name: "Start train of thoughts",
			icon: "brain",
			handler: async (ctx) => {
				ctx.logger.debug("Starting train of thoughts");
				void ctx.eventBus.emit("ui.startTrain", {});
			},
		},
		{
			id: "flowti:resume-train",
			name: "Resume paused train",
			icon: "play",
			handler: async (ctx) => {
				ctx.logger.debug("Resuming paused train");
				void ctx.eventBus.emit("ui.resumeTrain", {});
			},
		},
		{
			id: "flowti:complete-train",
			name: "Complete current train",
			icon: "check-circle",
			handler: async (ctx) => {
				ctx.logger.debug("Completing current train");
				void ctx.eventBus.emit("ui.completeTrain", {});
			},
		},
		{
			id: "flowti:open-train-canvas",
			name: "Open train canvas",
			icon: "layout-dashboard",
			handler: async (ctx) => {
				ctx.logger.debug("Opening train canvas");
				void ctx.eventBus.emit("ui.openTrainCanvas", {});
			},
		},
		{
			id: "flowti:open-train-timeline",
			name: "Open train timeline sidebar",
			icon: "git-branch",
			handler: async (ctx) => {
				ctx.logger.debug("Opening train timeline sidebar");
				void ctx.eventBus.emit("ui.openTrainTimeline", {});
			},
		},
	];
}

/**
 * Registers all commands with the registry.
 *
 * @param registry - The command registry
 */
export function registerCommands(registry: ICommandRegistry): void {
	const commands = createCommandDefinitions();
	registry.registerMany(commands);
}
