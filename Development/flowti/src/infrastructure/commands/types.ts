/**
 * Command system types and interfaces for Flowti.
 *
 * Provides a type-safe command registry pattern for registering
 * and executing plugin commands with middleware support.
 */

import type { App } from "obsidian";
import type { IEventBus } from "../events/types";
import type { ILogger } from "../logger/types";

/**
 * Domain grouping for commands.
 */
export type CommandDomain =
	| "hub"
	| "capture"
	| "train"
	| "data-exchange"
	| "session"
	| "subscription"
	| "analytics"
	| "canvas"
	| "installer"
	| "developer"
	| "test-management"
	| "journey-executor";

/**
 * Functional category for commands.
 */
export type CommandCategory = "view" | "action" | "capture";

/**
 * Context passed to command handlers.
 */
export interface CommandContext {
	/** Obsidian App instance */
	app: App;
	/** Event bus for emitting events */
	eventBus: IEventBus;
	/** Logger instance */
	logger: ILogger;
}

/**
 * Command handler function type.
 */
export type CommandHandler = (ctx: CommandContext) => void | Promise<void>;

/**
 * Command definition with metadata.
 */
export interface CommandDefinition {
	/** Unique command ID (e.g., "flowti:open-dashboard") */
	id: string;
	/** Display name shown in command palette */
	name: string;
	/** Human-readable description of what the command does */
	description?: string;
	/** Domain this command belongs to */
	domain?: CommandDomain;
	/** Functional category */
	category?: CommandCategory;
	/** Optional keyboard shortcut */
	hotkeys?: Array<{
		modifiers: Array<"Mod" | "Ctrl" | "Meta" | "Shift" | "Alt">;
		key: string;
	}>;
	/** Optional icon ID for the command */
	icon?: string;
	/** Whether this command should be shown in mobile */
	mobileOnly?: boolean;
	/** Command handler function */
	handler: CommandHandler;
}

/**
 * Read-only metadata projection for the Command Catalog UI.
 * Contains all discoverable information about a command without the handler.
 */
export interface CommandMeta {
	id: string;
	label: string;
	description: string;
	domain: CommandDomain;
	category: CommandCategory;
	icon?: string;
	shortcut?: string;
}

/**
 * Middleware function for command execution.
 * Can modify context, log, or prevent execution.
 */
export type CommandMiddleware = (
	command: CommandDefinition,
	ctx: CommandContext,
	next: () => Promise<void>
) => Promise<void>;

/**
 * Interface for the command registry.
 */
export interface ICommandRegistry {
	/**
	 * Registers a command.
	 */
	register(command: CommandDefinition): void;

	/**
	 * Registers multiple commands.
	 */
	registerMany(commands: CommandDefinition[]): void;

	/**
	 * Registers metadata for a command that is registered elsewhere
	 * (e.g., setup classes that bypass the registry).
	 */
	registerMeta(meta: CommandMeta): void;

	/**
	 * Adds middleware to the command execution pipeline.
	 */
	use(middleware: CommandMiddleware): void;

	/**
	 * Gets all registered commands.
	 */
	getCommands(): CommandDefinition[];

	/**
	 * Gets a command by ID.
	 */
	getCommand(id: string): CommandDefinition | undefined;

	/**
	 * Gets metadata for all registered commands (including meta-only entries).
	 */
	getCommandsMeta(): CommandMeta[];

	/**
	 * Gets commands grouped by domain.
	 */
	getCommandsByDomain(): Map<CommandDomain, CommandMeta[]>;

	/**
	 * Executes a command by ID.
	 */
	execute(id: string, ctx: CommandContext): Promise<void>;

	/**
	 * Clears all registered commands.
	 */
	clear(): void;
}

/**
 * Configuration options for the CommandRegistry.
 */
export interface CommandRegistryOptions {
	/** Logger for command execution logging */
	logger?: ILogger;
	/** Event bus for emitting command events */
	eventBus?: IEventBus;
}
