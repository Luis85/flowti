/**
 * Service container types and interfaces for Flowti.
 *
 * Provides a lightweight dependency injection container for managing
 * service lifecycles and dependencies.
 */

import type { IEventBus } from "../events/types";
import type { ILogger } from "../logger/types";

/**
 * Service lifecycle types.
 */
export type ServiceLifecycle =
	/** Single instance shared across the application */
	| "singleton"
	/** New instance created each time the service is requested */
	| "transient";

/**
 * Service factory function type.
 */
export type ServiceFactory<T> = (container: IServiceContainer) => T | Promise<T>;

/**
 * Service registration options.
 */
export interface ServiceRegistration<T = unknown> {
	/** Unique service identifier */
	id: string;
	/** Factory function to create the service */
	factory: ServiceFactory<T>;
	/** Service lifecycle (default: singleton) */
	lifecycle?: ServiceLifecycle;
	/** Services that must be initialized before this one */
	dependencies?: string[];
}

/**
 * Registered service entry.
 */
export interface ServiceEntry<T = unknown> {
	registration: ServiceRegistration<T>;
	instance?: T;
	initialized: boolean;
}

/**
 * Interface for the service container.
 */
export interface IServiceContainer {
	/**
	 * Registers a service.
	 */
	register<T>(registration: ServiceRegistration<T>): void;

	/**
	 * Gets a service by ID.
	 * @throws ServiceError if service is not registered
	 */
	get<T>(id: string): Promise<T>;

	/**
	 * Checks if a service is registered.
	 */
	has(id: string): boolean;

	/**
	 * Gets the event bus (always available).
	 */
	getEventBus(): IEventBus;

	/**
	 * Gets the logger (always available).
	 */
	getLogger(): ILogger;

	/**
	 * Initializes all registered services in dependency order.
	 */
	initializeAll(): Promise<void>;

	/**
	 * Disposes all services (calls dispose method if available).
	 * Returns the IDs of services that failed to dispose.
	 */
	disposeAll(): Promise<string[]>;
}

/**
 * Configuration options for the ServiceContainer.
 */
export interface ServiceContainerOptions {
	/** Event bus instance */
	eventBus: IEventBus;
	/** Logger instance */
	logger: ILogger;
}

/**
 * Interface for services that need cleanup on disposal.
 */
export interface IDisposable {
	dispose(): void | Promise<void>;
}

/**
 * Type guard to check if an object is disposable.
 */
export function isDisposable(obj: unknown): obj is IDisposable {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"dispose" in obj &&
		typeof (obj as IDisposable).dispose === "function"
	);
}
