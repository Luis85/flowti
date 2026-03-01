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

import type { CommandDefinition, CommandMeta, ICommandRegistry } from "./types";

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
			description: "Open the UI component showcase for development reference",
			domain: "developer",
			category: "view",
			icon: "palette",
			handler: async (ctx) => {
				ctx.logger.debug("Opening component showcase view");
				void ctx.eventBus.emit("ui.openComponentShowcase", {});
			},
		},
		{
			id: "flowti:open-event-catalog",
			name: "Open event catalog",
			description: "Browse all events in the system with filtering and search",
			domain: "developer",
			category: "view",
			icon: "list",
			handler: async (ctx) => {
				ctx.logger.debug("Opening event catalog view");
				void ctx.eventBus.emit("ui.openEventCatalog", {});
			},
		},
		{
			id: "flowti:open-event-log",
			name: "Open event log",
			description: "View the live event log showing all system activity",
			domain: "developer",
			category: "view",
			icon: "activity",
			handler: async (ctx) => {
				ctx.logger.debug("Opening event log view");
				void ctx.eventBus.emit("ui.openEventLog", {});
			},
		},
		{
			id: "flowti:open-user-hub",
			name: "Open user hub",
			description: "Open your personal dashboard with sessions, inbox, and preferences",
			domain: "hub",
			category: "view",
			icon: "home",
			handler: async (ctx) => {
				ctx.logger.debug("Opening user hub view");
				void ctx.eventBus.emit("ui.openUserHub", {});
			},
		},
		{
			id: "flowti:manage-subscriptions",
			name: "Manage watchers",
			description: "View and manage your file and folder watchers",
			domain: "subscription",
			category: "view",
			icon: "bell",
			handler: async (ctx) => {
				ctx.logger.debug("Opening watcher manager");
				void ctx.eventBus.emit("ui.openSubscriptionManager", {});
			},
		},
		{
			id: "flowti:quick-capture",
			name: "Quick capture",
			description: "Open the quick capture modal to capture any type of item",
			domain: "capture",
			category: "capture",
			icon: "pencil",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal");
				void ctx.eventBus.emit("ui.openQuickCapture", {});
			},
		},
		{
			id: "flowti:add-idea",
			name: "Add idea",
			description: "Capture a new idea directly into the inbox",
			domain: "capture",
			category: "capture",
			icon: "lightbulb",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for idea");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "idea" });
			},
		},
		{
			id: "flowti:add-feedback",
			name: "Add feedback",
			description: "Capture feedback about a process, tool, or workflow",
			domain: "capture",
			category: "capture",
			icon: "message-circle",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for feedback");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "feedback" });
			},
		},
		{
			id: "flowti:add-note",
			name: "Add note",
			description: "Capture a quick note into the inbox",
			domain: "capture",
			category: "capture",
			icon: "file-text",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for note");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "note" });
			},
		},
		{
			id: "flowti:add-task",
			name: "Add task",
			description: "Capture a new task into the inbox",
			domain: "capture",
			category: "capture",
			icon: "check-square",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for task");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "task" });
			},
		},
		{
			id: "flowti:add-question",
			name: "Add question",
			description: "Capture a question that needs an answer",
			domain: "capture",
			category: "capture",
			icon: "help-circle",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for question");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "question" });
			},
		},
		{
			id: "flowti:add-bug",
			name: "Add bug",
			description: "Report a bug or issue for tracking",
			domain: "capture",
			category: "capture",
			icon: "bug",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for bug");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "bug" });
			},
		},
		{
			id: "flowti:add-risk",
			name: "Add risk",
			description: "Capture a risk that may affect your project",
			domain: "capture",
			category: "capture",
			icon: "alert-triangle",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for risk");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "risk" });
			},
		},
		{
			id: "flowti:add-assumption",
			name: "Add assumption",
			description: "Record an assumption that should be validated",
			domain: "capture",
			category: "capture",
			icon: "compass",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for assumption");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "assumption" });
			},
		},
		{
			id: "flowti:add-issue",
			name: "Add issue",
			description: "Capture an issue that needs resolution",
			domain: "capture",
			category: "capture",
			icon: "alert-circle",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for issue");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "issue" });
			},
		},
		{
			id: "flowti:add-decision",
			name: "Add decision",
			description: "Record a decision and its rationale",
			domain: "capture",
			category: "capture",
			icon: "scale",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for decision");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "decision" });
			},
		},
		{
			id: "flowti:add-learning",
			name: "Add learning",
			description: "Capture a learning or insight for future reference",
			domain: "capture",
			category: "capture",
			icon: "graduation-cap",
			handler: async (ctx) => {
				ctx.logger.debug("Opening quick capture modal for learning");
				void ctx.eventBus.emit("ui.openQuickCapture", { type: "learning" });
			},
		},
		{
			id: "flowti:open-train-hub",
			name: "Open train hub",
			description: "Open the Train of Thoughts management hub",
			domain: "train",
			category: "view",
			icon: "train-front",
			handler: async (ctx) => {
				ctx.logger.debug("Opening train hub view");
				void ctx.eventBus.emit("ui.openTrainHub", {});
			},
		},
		{
			id: "flowti:open-analytics-hub",
			name: "Open analytics hub",
			description: "Open the analytics hub with queries and dashboards",
			domain: "analytics",
			category: "view",
			icon: "bar-chart-2",
			handler: async (ctx) => {
				ctx.logger.debug("Opening analytics hub view");
				void ctx.eventBus.emit("ui.openAnalyticsHub", {});
			},
		},
		{
			id: "flowti:start-train",
			name: "Start train of thoughts",
			description: "Begin a new train of thoughts session",
			domain: "train",
			category: "action",
			icon: "brain",
			handler: async (ctx) => {
				ctx.logger.debug("Starting train of thoughts");
				void ctx.eventBus.emit("ui.startTrain", {});
			},
		},
		{
			id: "flowti:resume-train",
			name: "Resume paused train",
			description: "Resume a previously paused train of thoughts",
			domain: "train",
			category: "action",
			icon: "play",
			handler: async (ctx) => {
				ctx.logger.debug("Resuming paused train");
				void ctx.eventBus.emit("ui.resumeTrain", {});
			},
		},
		{
			id: "flowti:complete-train",
			name: "Complete current train",
			description: "Mark the current train of thoughts as completed",
			domain: "train",
			category: "action",
			icon: "check-circle",
			handler: async (ctx) => {
				ctx.logger.debug("Completing current train");
				void ctx.eventBus.emit("ui.completeTrain", {});
			},
		},
		{
			id: "flowti:open-train-canvas",
			name: "Open train canvas",
			description: "Open the visual canvas for the current train of thoughts",
			domain: "train",
			category: "view",
			icon: "layout-dashboard",
			handler: async (ctx) => {
				ctx.logger.debug("Opening train canvas");
				void ctx.eventBus.emit("ui.openTrainCanvas", {});
			},
		},
		{
			id: "flowti:open-train-timeline",
			name: "Open train timeline sidebar",
			description: "Open the train timeline in the sidebar panel",
			domain: "train",
			category: "view",
			icon: "git-branch",
			handler: async (ctx) => {
				ctx.logger.debug("Opening train timeline sidebar");
				void ctx.eventBus.emit("ui.openTrainTimeline", {});
			},
		},
		{
			id: "flowti:view-train",
			name: "View train of thoughts",
			description: "View the currently active train of thoughts",
			domain: "train",
			category: "view",
			icon: "train-front",
			handler: async (ctx) => {
				ctx.logger.debug("Viewing train of thoughts");
				void ctx.eventBus.emit("ui.openTrainView", {});
			},
		},
		{
			id: "flowti:start-canvas-session",
			name: "Start canvas session",
			description: "Start a guided canvas session from a template",
			domain: "canvas",
			category: "action",
			icon: "layout-template",
			handler: async (ctx) => {
				ctx.logger.debug("Starting canvas session");
				void ctx.eventBus.emit("ui.startCanvasSession", {});
			},
		},
	];
}

/**
 * Metadata for commands registered outside the CommandRegistry
 * (e.g., DataExchangeSetup, SessionSetup, main.ts).
 */
export function getExternalCommandMeta(): CommandMeta[] {
	return [
		// Data Exchange commands
		{
			id: "flowti:import-csv",
			label: "Import CSV as notes",
			description: "Import a CSV file and create vault notes from each row",
			domain: "data-exchange",
			category: "action",
			icon: "file-input",
		},
		{
			id: "flowti:export-csv",
			label: "Export as CSV",
			description: "Export vault notes or a database view as a CSV file",
			domain: "data-exchange",
			category: "action",
			icon: "file-output",
		},
		{
			id: "flowti:export-tab",
			label: "Export as tab-delimited",
			description: "Export vault notes or a database view as a tab-delimited file",
			domain: "data-exchange",
			category: "action",
			icon: "file-output",
		},
		{
			id: "flowti:open-data-exchange",
			label: "Open data exchange hub",
			description: "Open the data exchange hub for import/export management",
			domain: "data-exchange",
			category: "view",
			icon: "arrow-left-right",
		},
		{
			id: "flowti:signal-sync",
			label: "Sync all signals",
			description: "Synchronize all configured signal connections",
			domain: "data-exchange",
			category: "action",
			icon: "radio",
		},
		{
			id: "flowti:import-canvas",
			label: "Import canvas as notes",
			description: "Import an Obsidian canvas file and create notes from nodes",
			domain: "data-exchange",
			category: "action",
			icon: "layout-dashboard",
		},
		// Session commands
		{
			id: "flowti:open-session-workspace",
			label: "Open session workspace",
			description: "Open the session workspace in a new tab",
			domain: "session",
			category: "view",
			icon: "timer",
		},
		{
			id: "flowti:open-session-workspace-sidebar",
			label: "Open session workspace in sidebar",
			description: "Open the session workspace in the right sidebar panel",
			domain: "session",
			category: "view",
			icon: "panel-right",
		},
		{
			id: "flowti:create-session",
			label: "Create new session",
			description: "Create a new timed work session with goals and focus",
			domain: "session",
			category: "action",
			icon: "timer",
		},
		{
			id: "flowti:resume-session",
			label: "Resume paused session",
			description: "Resume a previously paused work session",
			domain: "session",
			category: "action",
			icon: "play",
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

	// Register metadata for commands defined outside the registry
	for (const meta of getExternalCommandMeta()) {
		registry.registerMeta(meta);
	}
}
