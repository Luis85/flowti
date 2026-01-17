import { CommandError, FlowtiError } from "../errors/FlowtiError";
import type { IEventBus } from "../events/types";
import type { ILogger } from "../logger/types";
import type {
	CommandContext,
	CommandDefinition,
	CommandMiddleware,
	CommandRegistryOptions,
	ICommandRegistry,
} from "./types";

/**
 * Registry for managing plugin commands.
 *
 * Provides a centralized way to register, manage, and execute commands
 * with middleware support for cross-cutting concerns like logging and
 * error handling.
 *
 * @example Basic usage
 * ```typescript
 * const registry = new CommandRegistry({ logger, eventBus });
 *
 * registry.register({
 *   id: "flowti:open-dashboard",
 *   name: "Open Dashboard",
 *   handler: (ctx) => {
 *     ctx.logger.info("Opening dashboard");
 *     // Open the dashboard view
 *   },
 * });
 * ```
 *
 * @example With middleware
 * ```typescript
 * // Add logging middleware
 * registry.use(async (command, ctx, next) => {
 *   ctx.logger.debug(`Executing command: ${command.id}`);
 *   const start = Date.now();
 *   await next();
 *   ctx.logger.debug(`Command completed in ${Date.now() - start}ms`);
 * });
 * ```
 *
 * @example Registering with Obsidian Plugin
 * ```typescript
 * // In main.ts
 * for (const command of this.commandRegistry.getCommands()) {
 *   this.addCommand({
 *     id: command.id,
 *     name: command.name,
 *     hotkeys: command.hotkeys,
 *     callback: () => this.commandRegistry.execute(command.id, ctx),
 *   });
 * }
 * ```
 */
export class CommandRegistry implements ICommandRegistry {
	private commands: Map<string, CommandDefinition> = new Map();
	private middlewares: CommandMiddleware[] = [];
	private logger?: ILogger;
	private eventBus?: IEventBus;

	constructor(options: CommandRegistryOptions = {}) {
		this.logger = options.logger;
		this.eventBus = options.eventBus;
	}

	/**
	 * Registers a command.
	 * @throws CommandError if command ID is already registered
	 */
	register(command: CommandDefinition): void {
		if (this.commands.has(command.id)) {
			throw new CommandError({
				code: "COMMAND_ALREADY_REGISTERED",
				message: `Command with ID "${command.id}" is already registered`,
				severity: "medium",
				context: "CommandRegistry",
			});
		}

		this.commands.set(command.id, command);
		this.logger?.debug(`Registered command: ${command.id}`);

		// Emit command.registered event
		void this.eventBus?.emit("command.registered", {
			commandId: command.id,
			commandName: command.name,
		});
	}

	/**
	 * Registers multiple commands.
	 */
	registerMany(commands: CommandDefinition[]): void {
		for (const command of commands) {
			this.register(command);
		}
	}

	/**
	 * Adds middleware to the command execution pipeline.
	 * Middlewares are executed in the order they are added.
	 */
	use(middleware: CommandMiddleware): void {
		this.middlewares.push(middleware);
	}

	/**
	 * Gets all registered commands.
	 */
	getCommands(): CommandDefinition[] {
		return Array.from(this.commands.values());
	}

	/**
	 * Gets a command by ID.
	 */
	getCommand(id: string): CommandDefinition | undefined {
		return this.commands.get(id);
	}

	/**
	 * Executes a command by ID.
	 * @throws CommandError if command is not found
	 */
	async execute(id: string, ctx: CommandContext): Promise<void> {
		const command = this.commands.get(id);

		if (!command) {
			throw new CommandError({
				code: "COMMAND_NOT_FOUND",
				message: `Command with ID "${id}" not found`,
				severity: "medium",
				context: "CommandRegistry",
			});
		}

		// Emit command.executing event
		void this.eventBus?.emit("command.executing", { commandId: id });

		const startTime = Date.now();

		// Build middleware chain
		const executeHandler = async (): Promise<void> => {
			await command.handler(ctx);
		};

		// Execute middlewares in order, then the handler
		let chain: () => Promise<void> = executeHandler;
		for (let i = this.middlewares.length - 1; i >= 0; i--) {
			const middleware = this.middlewares[i];
			const next = chain;
			chain = async () => middleware(command, ctx, next);
		}

		try {
			await chain();

			// Emit command.executed event on success
			void this.eventBus?.emit("command.executed", {
				commandId: id,
				durationMs: Date.now() - startTime,
			});
		} catch (error) {
			// Emit command.failed event on error
			const errorInfo =
				error instanceof FlowtiError
					? error.toInfo()
					: {
							code: "COMMAND_EXECUTION_FAILED",
							message:
								error instanceof Error
									? error.message
									: String(error),
							category: "command" as const,
							severity: "high" as const,
							timestamp: new Date().toISOString(),
						};

			void this.eventBus?.emit("command.failed", {
				commandId: id,
				error: errorInfo,
			});

			throw error;
		}
	}

	/**
	 * Clears all registered commands.
	 */
	clear(): void {
		this.commands.clear();
		this.logger?.debug("Cleared all commands");
	}
}

/**
 * Creates a logging middleware for command execution.
 */
export function createLoggingMiddleware(): CommandMiddleware {
	return async (command, ctx, next) => {
		ctx.logger.debug(`Executing command: ${command.name} (${command.id})`);
		const start = Date.now();

		try {
			await next();
			ctx.logger.debug(
				`Command completed: ${command.id} (${Date.now() - start}ms)`
			);
		} catch (error) {
			ctx.logger.error(
				`Command failed: ${command.id}`,
				error instanceof Error ? error.message : error
			);
			throw error;
		}
	};
}

/**
 * Creates an error handling middleware for command execution.
 */
export function createErrorMiddleware(
	onError?: (error: Error, command: CommandDefinition) => void
): CommandMiddleware {
	return async (command, ctx, next) => {
		try {
			await next();
		} catch (error) {
			const commandError =
				error instanceof CommandError
					? error
					: new CommandError({
							code: "COMMAND_EXECUTION_FAILED",
							message: `Command "${command.id}" failed: ${error instanceof Error ? error.message : "Unknown error"}`,
							severity: "high",
							context: "CommandRegistry",
							cause: error instanceof Error ? error : undefined,
						});

			onError?.(commandError, command);
			throw commandError;
		}
	};
}
