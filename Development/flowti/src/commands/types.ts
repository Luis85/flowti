/**
 * Command system types and interfaces for Flowti.
 *
 * Provides a type-safe command registry pattern for registering
 * and executing plugin commands with middleware support.
 */

import type { App } from "obsidian";
import type { IEventBus } from "../events/types";
import type { ILogger } from "../logger/types";
import type { IServiceContainer } from "../services/types";

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
	/** Service container for accessing services */
	services: IServiceContainer;
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
