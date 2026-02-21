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
