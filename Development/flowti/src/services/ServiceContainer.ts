import { FlowtiError, ServiceError } from "../errors/FlowtiError";
import type { IEventBus } from "../events/types";
import type { ILogger } from "../logger/types";
import {
	isDisposable,
	type IServiceContainer,
	type ServiceContainerOptions,
	type ServiceEntry,
	type ServiceRegistration,
} from "./types";

/**
 * Lightweight dependency injection container for managing services.
 *
 * Features:
 * - Singleton and transient lifecycles
 * - Lazy initialization
 * - Dependency resolution
 * - Automatic disposal of disposable services
 *
 * @example Basic usage
 * ```typescript
 * const container = new ServiceContainer({ eventBus, logger });
 *
 * // Register a service
 * container.register({
 *   id: "taskService",
 *   factory: (c) => new TaskService({
 *     storage: { load: () => loadData(), save: (d) => saveData(d) },
 *     eventBus: c.getEventBus(),
 *   }),
 * });
 *
 * // Get the service (creates instance on first access)
 * const taskService = await container.get<TaskService>("taskService");
 * ```
 *
 * @example With dependencies
 * ```typescript
 * container.register({
 *   id: "reportService",
 *   dependencies: ["taskService", "userService"],
 *   factory: async (c) => new ReportService({
 *     taskService: await c.get("taskService"),
 *     userService: await c.get("userService"),
 *   }),
 * });
 * ```
 *
 * @example Transient lifecycle
 * ```typescript
 * container.register({
 *   id: "tempCalculator",
 *   lifecycle: "transient",
 *   factory: () => new TempCalculator(),
 * });
 *
 * // Each call creates a new instance
 * const calc1 = await container.get("tempCalculator");
 * const calc2 = await container.get("tempCalculator");
 * console.log(calc1 !== calc2); // true
 * ```
 */
export class ServiceContainer implements IServiceContainer {
	private services: Map<string, ServiceEntry> = new Map();
	private eventBus: IEventBus;
	private logger: ILogger;
	private initializing: Set<string> = new Set();

	constructor(options: ServiceContainerOptions) {
		this.eventBus = options.eventBus;
		this.logger = options.logger;
	}

	/**
	 * Registers a service.
	 * @throws ServiceError if service ID is already registered
	 */
	register<T>(registration: ServiceRegistration<T>): void {
		if (this.services.has(registration.id)) {
			throw new ServiceError({
				code: "SERVICE_ALREADY_REGISTERED",
				message: `Service with ID "${registration.id}" is already registered`,
				severity: "medium",
				context: "ServiceContainer",
			});
		}

		this.services.set(registration.id, {
			registration: registration as ServiceRegistration<unknown>,
			initialized: false,
		});

		this.logger.debug(`Registered service: ${registration.id}`);

		// Emit service.registered event
		void this.eventBus.emit("service.registered", {
			serviceId: registration.id,
		});
	}

	/**
	 * Gets a service by ID.
	 * Creates the instance if not already initialized (singleton) or always (transient).
	 * @throws ServiceError if service is not registered or circular dependency detected
	 */
	async get<T>(id: string): Promise<T> {
		const entry = this.services.get(id);

		if (!entry) {
			throw new ServiceError({
				code: "SERVICE_NOT_FOUND",
				message: `Service with ID "${id}" is not registered`,
				severity: "high",
				context: "ServiceContainer",
			});
		}

		const lifecycle = entry.registration.lifecycle ?? "singleton";

		// For transient, always create new instance
		if (lifecycle === "transient") {
			return this.createInstance<T>(entry);
		}

		// For singleton, return existing or create
		if (entry.initialized && entry.instance !== undefined) {
			return entry.instance as T;
		}

		// Check for circular dependencies
		if (this.initializing.has(id)) {
			throw new ServiceError({
				code: "CIRCULAR_DEPENDENCY",
				message: `Circular dependency detected for service "${id}"`,
				severity: "critical",
				context: "ServiceContainer",
				details: { initializingServices: Array.from(this.initializing) },
			});
		}

		// Initialize the service
		this.initializing.add(id);
		try {
			const instance = await this.createInstance<T>(entry);
			entry.instance = instance;
			entry.initialized = true;
			this.logger.debug(`Initialized service: ${id}`);

			// Emit service.initialized event
			void this.eventBus.emit("service.initialized", { serviceId: id });

			return instance;
		} catch (error) {
			// Emit service.error event
			const errorInfo =
				error instanceof FlowtiError
					? error.toInfo()
					: {
							code: "SERVICE_INIT_FAILED",
							message:
								error instanceof Error
									? error.message
									: String(error),
							category: "service" as const,
							severity: "high" as const,
							timestamp: new Date().toISOString(),
						};

			void this.eventBus.emit("service.error", {
				serviceId: id,
				error: errorInfo,
			});

			throw error;
		} finally {
			this.initializing.delete(id);
		}
	}

	/**
	 * Checks if a service is registered.
	 */
	has(id: string): boolean {
		return this.services.has(id);
	}

	/**
	 * Gets the event bus.
	 */
	getEventBus(): IEventBus {
		return this.eventBus;
	}

	/**
	 * Gets the logger.
	 */
	getLogger(): ILogger {
		return this.logger;
	}

	/**
	 * Initializes all registered singleton services in dependency order.
	 */
	async initializeAll(): Promise<void> {
		const sorted = this.topologicalSort();

		for (const id of sorted) {
			const entry = this.services.get(id);
			if (entry && entry.registration.lifecycle !== "transient") {
				await this.get(id);
			}
		}

		this.logger.info(
			`Initialized ${sorted.length} services`,
			sorted
		);
	}

	/**
	 * Disposes all services that implement IDisposable.
	 */
	async disposeAll(): Promise<void> {
		// Dispose in reverse initialization order
		const sorted = this.topologicalSort().reverse();

		for (const id of sorted) {
			const entry = this.services.get(id);
			if (entry?.instance && isDisposable(entry.instance)) {
				try {
					await entry.instance.dispose();
					this.logger.debug(`Disposed service: ${id}`);

					// Emit service.disposed event
					void this.eventBus.emit("service.disposed", { serviceId: id });
				} catch (error) {
					this.logger.error(
						`Failed to dispose service: ${id}`,
						error instanceof Error ? error.message : error
					);
				}
			}
		}

		// Clear all instances
		for (const entry of this.services.values()) {
			entry.instance = undefined;
			entry.initialized = false;
		}
	}

	/**
	 * Creates a service instance using its factory.
	 */
	private async createInstance<T>(entry: ServiceEntry): Promise<T> {
		// First resolve dependencies
		if (entry.registration.dependencies) {
			for (const depId of entry.registration.dependencies) {
				await this.get(depId);
			}
		}

		// Then create the instance
		return entry.registration.factory(this) as Promise<T>;
	}

	/**
	 * Performs topological sort of services based on dependencies.
	 */
	private topologicalSort(): string[] {
		const visited = new Set<string>();
		const result: string[] = [];

		const visit = (id: string) => {
			if (visited.has(id)) return;
			visited.add(id);

			const entry = this.services.get(id);
			if (entry?.registration.dependencies) {
				for (const depId of entry.registration.dependencies) {
					visit(depId);
				}
			}

			result.push(id);
		};

		for (const id of this.services.keys()) {
			visit(id);
		}

		return result;
	}
}
