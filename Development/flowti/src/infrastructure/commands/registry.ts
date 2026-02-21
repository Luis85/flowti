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
			name: "Open Component Showcase",
			icon: "palette",
			handler: async (ctx) => {
				ctx.logger.debug("Opening component showcase view");
				void ctx.eventBus.emit("ui.openComponentShowcase", {});
			},
		},
		{
			id: "flowti:open-event-catalog",
			name: "Open Event Catalog",
			icon: "list",
			handler: async (ctx) => {
				ctx.logger.debug("Opening event catalog view");
				void ctx.eventBus.emit("ui.openEventCatalog", {});
			},
		},
		{
			id: "flowti:open-event-log",
			name: "Open Event Log",
			icon: "activity",
			handler: async (ctx) => {
				ctx.logger.debug("Opening event log view");
				void ctx.eventBus.emit("ui.openEventLog", {});
			},
		},
		{
			id: "flowti:open-user-hub",
			name: "Open User Hub",
			icon: "home",
			handler: async (ctx) => {
				ctx.logger.debug("Opening user hub view");
				void ctx.eventBus.emit("ui.openUserHub", {});
			},
		},
		{
			id: "flowti:manage-subscriptions",
			name: "Manage Watchers",
			icon: "bell",
			handler: async (ctx) => {
				ctx.logger.debug("Opening watcher manager");
				void ctx.eventBus.emit("ui.openSubscriptionManager", {});
			},
		},
		{
			id: "flowti:quick-capture",
			name: "Quick Capture",
			icon: "pencil",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal");
				void ctx.eventBus.emit("ui.openQuickCapture", {});
			},
		},
		{
			id: "flowti:add-idea",
			name: "Add Idea",
			icon: "lightbulb",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for idea");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "idea" });
			},
		},
		{
			id: "flowti:add-feedback",
			name: "Add Feedback",
			icon: "message-circle",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for feedback");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "feedback" });
			},
		},
		{
			id: "flowti:add-note",
			name: "Add Note",
			icon: "file-text",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for note");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "note" });
			},
		},
		{
			id: "flowti:add-task",
			name: "Add Task",
			icon: "check-square",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for task");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "task" });
			},
		},
		{
			id: "flowti:add-question",
			name: "Add Question",
			icon: "help-circle",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for question");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "question" });
			},
		},
		{
			id: "flowti:add-bug",
			name: "Add Bug",
			icon: "bug",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for bug");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "bug" });
			},
		},
		{
			id: "flowti:add-risk",
			name: "Add Risk",
			icon: "alert-triangle",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for risk");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "risk" });
			},
		},
		{
			id: "flowti:add-assumption",
			name: "Add Assumption",
			icon: "compass",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for assumption");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "assumption" });
			},
		},
		{
			id: "flowti:add-issue",
			name: "Add Issue",
			icon: "alert-circle",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for issue");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "issue" });
			},
		},
		{
			id: "flowti:add-decision",
			name: "Add Decision",
			icon: "scale",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for decision");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "decision" });
			},
		},
		{
			id: "flowti:add-learning",
			name: "Add Learning",
			icon: "graduation-cap",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for learning");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "learning" });
			},
		},
		{
			id: "flowti:start-train",
			name: "Start Train of Thoughts",
			icon: "brain",
			handler: async (ctx) => {
				ctx.logger.debug("Starting train of thoughts");
				void ctx.eventBus.emit("ui.startTrain", {});
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
