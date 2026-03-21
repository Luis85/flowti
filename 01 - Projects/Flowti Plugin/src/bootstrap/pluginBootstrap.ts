/**
 * Infrastructure creation and cross-cutting listener setup.
 *
 * Extracted from main.ts (Phase 7) to reduce its LOC.
 * All functions are pure factories — they create and return infrastructure
 * components without modifying any shared state.
 */

import type { App, EventRef } from "obsidian";
import {
	CommandRegistry,
	createErrorMiddleware,
	createLoggingMiddleware,
} from "../infrastructure/commands/CommandRegistry";
import type { ICommandRegistry } from "../infrastructure/commands/types";
import { ErrorService } from "../infrastructure/errors/ErrorService";
import type { IErrorService } from "../infrastructure/errors/types";
import { EventBridge } from "../infrastructure/events/EventBridge";
import { EventBus } from "../infrastructure/events/EventBus";
import type { IEventBridge, IEventBus } from "../infrastructure/events/types";
import { LoggerService } from "../infrastructure/logger/LoggerService";
import type { ILogger } from "../infrastructure/logger/types";
import { ServiceContainer } from "../infrastructure/services/ServiceContainer";
import type { IServiceContainer } from "../infrastructure/services/types";
import type { IViewRegistry } from "../infrastructure/views/types";
import { ViewRegistry } from "../infrastructure/views/ViewRegistry";
import type { FlowtiSettings } from "../domain/settings/settings";

export interface InfrastructureSet {
	eventBus: IEventBus;
	logger: ILogger;
	errorService: IErrorService;
	eventBridge: IEventBridge;
	services: IServiceContainer;
	commands: ICommandRegistry;
	views: IViewRegistry;
}

/** Creates all infrastructure components in dependency order. */
export function createInfrastructure(deps: {
	app: App;
	settings: FlowtiSettings;
	registerEvent: (ref: EventRef) => void;
}): InfrastructureSet {
	const eventBus: IEventBus = new EventBus({
		onError: (error, eventType) => {
			// Uses logger via closure — safe because logger is assigned before any event fires.
			logger.error(`[EventBus] Handler error in "${eventType}"`, error);
		},
		/* Await so perf listeners run before emit() resolves — avoids races with perf windows. */
		onMeasure: (eventType, handlerCount, durationMs) =>
			eventBus.emit("perf.event.dispatched", { eventType, handlerCount, durationMs }),
	});

	const logger: ILogger = new LoggerService({
		eventBus,
		debugMode: deps.settings.debugMode,
	});

	const errorService: IErrorService = new ErrorService({
		eventBus,
		logger,
	});

	const eventBridge: IEventBridge = new EventBridge({
		app: deps.app,
		eventBus,
		logger,
		registerEvent: deps.registerEvent,
	});
	eventBridge.register();

	const services: IServiceContainer = new ServiceContainer({
		eventBus,
		logger,
	});

	const commands: ICommandRegistry = new CommandRegistry({
		eventBus,
		logger,
	});
	commands.use(createLoggingMiddleware());
	commands.use(
		createErrorMiddleware((error, command) => {
			errorService.handle(error, `Command:${command.id}`);
		})
	);

	const views: IViewRegistry = new ViewRegistry({
		eventBus,
		logger,
	});

	return { eventBus, logger, errorService, eventBridge, services, commands, views };
}

/** Registers cross-cutting event listeners that span multiple domains. */
export function setupCrossCuttingListeners(deps: {
	eventBus: IEventBus;
	logger: ILogger;
	onSettingsChanged: (settings: FlowtiSettings) => void;
}): (() => void)[] {
	const { eventBus, logger, onSettingsChanged } = deps;
	const listeners: (() => void)[] = [];

	listeners.push(
		eventBus.on("settings.changed", (event) => {
			onSettingsChanged(event.payload.settings);
			logger.setDebugMode(event.payload.settings.debugMode);
			logger.debug("Settings changed", event.payload.settings);
		})
	);

	listeners.push(
		eventBus.on("error.occurred", (event) => {
			logger.error("Error event received", event.payload);
		})
	);

	listeners.push(
		eventBus.on("user.created", (event) => {
			logger.debug("User created", { userName: event.payload.user.name });
		})
	);

	listeners.push(
		eventBus.on("user.updated", (event) => {
			logger.debug("User updated", { userName: event.payload.user.name });
		})
	);

	listeners.push(
		eventBus.on("user.loaded", (event) => {
			logger.debug("User loaded", { userName: event.payload.user.name });
		})
	);

	listeners.push(
		eventBus.on("plugin.ready", (event) => {
			logger.debug("Plugin ready", { timestamp: event.payload.timestamp });
		})
	);

	listeners.push(
		eventBus.on("installer.started", (event) => {
			logger.info("Installation started", { stepCount: event.payload.stepCount });
		})
	);

	listeners.push(
		eventBus.on("installer.completed", () => {
			logger.info("Installation completed");
		})
	);

	listeners.push(
		eventBus.on("installer.failed", (event) => {
			logger.error("Installation failed", {
				step: event.payload.failedStepId,
				error: event.payload.error,
			});
		})
	);

	listeners.push(
		eventBus.on("eventNotify.fired", (event) => {
			void eventBus.emit("notice.throttled", {
				key: `notify:${event.payload.eventType}`,
				message: `Event: ${event.payload.eventType}`,
			});
		})
	);

	listeners.push(
		eventBus.on("subscription.matched", (event) => {
			const label = event.payload.subscriptionLabel ?? event.payload.eventType;
			void eventBus.emit("notice.throttled", {
				key: `sub:${label}`,
				message: `Subscription matched: ${label}`,
			});
		})
	);

	return listeners;
}
