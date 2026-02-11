/**
 * Command registry for Flowti.
 *
 * Central location for defining all plugin commands.
 * Commands are registered with the command registry and
 * automatically bound to Obsidian's command system.
 */

import { VIEW_TYPE_COMPONENT_SHOWCASE } from "../../ui/ComponentShowcaseView";
import { VIEW_TYPE_EVENT_CATALOG } from "../../ui/EventCatalogView";
import { VIEW_TYPE_EVENT_LOG } from "../../ui/EventLogView";
import { SubscriptionManagerModal } from "../../ui/SubscriptionManagerModal";
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
				const { workspace } = ctx.app;

				// Check if view is already open
				const existing = workspace.getLeavesOfType(VIEW_TYPE_COMPONENT_SHOWCASE);
				if (existing.length > 0) {
					workspace.revealLeaf(existing[0]);
					return;
				}

				// Open in right sidebar
				const leaf = workspace.getRightLeaf(false);
				if (leaf) {
					await leaf.setViewState({
						type: VIEW_TYPE_COMPONENT_SHOWCASE,
						active: true,
					});
					workspace.revealLeaf(leaf);
				}
			},
		},
		{
			id: "flowti:open-event-catalog",
			name: "Open Event Catalog",
			icon: "list",
			handler: async (ctx) => {
				ctx.logger.debug("Opening event catalog view");
				const { workspace } = ctx.app;

				const existing = workspace.getLeavesOfType(VIEW_TYPE_EVENT_CATALOG);
				if (existing.length > 0) {
					workspace.revealLeaf(existing[0]);
					return;
				}

				const leaf = workspace.getLeaf(true);
				await leaf.setViewState({
					type: VIEW_TYPE_EVENT_CATALOG,
					active: true,
				});
				workspace.revealLeaf(leaf);
			},
		},
		{
			id: "flowti:open-event-log",
			name: "Open Event Log",
			icon: "activity",
			handler: async (ctx) => {
				ctx.logger.debug("Opening event log view");
				const { workspace } = ctx.app;

				const existing = workspace.getLeavesOfType(VIEW_TYPE_EVENT_LOG);
				if (existing.length > 0) {
					workspace.revealLeaf(existing[0]);
					return;
				}

				const leaf = workspace.getRightLeaf(false);
				if (leaf) {
					await leaf.setViewState({
						type: VIEW_TYPE_EVENT_LOG,
						active: true,
					});
					workspace.revealLeaf(leaf);
				}
			},
		},
		{
			id: "flowti:manage-subscriptions",
			name: "Manage Watchers",
			icon: "bell",
			handler: async (ctx) => {
				ctx.logger.debug("Opening watcher manager");
				new SubscriptionManagerModal(ctx.app, ctx.eventBus).open();
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
