/**
 * Service registry for Flowti.
 *
 * Central location for registering all application services
 * with the service container.
 */

import { DiscoveryService } from "../../domain/discovery/DiscoveryService";
import { EventFilterService } from "../../domain/eventFilter/EventFilterService";
import { EventNotificationService } from "../../domain/eventNotify/EventNotificationService";
import { EventDefinitionService } from "../../domain/eventDefinition/EventDefinitionService";
import { IngestionService } from "../../domain/ingestion/IngestionService";
import { SubscriptionService } from "../../domain/subscription/SubscriptionService";
import { SettingsService } from "../../domain/settings/SettingsService";
import { InstallerService } from "../../domain/installer/InstallerService";
import { UserCreationStep } from "../../domain/installer/steps/UserCreationStep";
import { FolderScaffoldStep } from "../../domain/installer/steps/FolderScaffoldStep";
import { SeedContentStep } from "../../domain/installer/steps/SeedContentStep";
import type { IUserService } from "../../domain/user/types";
import type { IStorageProvider } from "../../utils/types";
import { TypedStorage } from "../../utils/TypedStorage";
import { UserService } from "../../domain/user/UserService";
import { DataExchangeService } from "../../domain/dataExchange/DataExchangeService";
import { InboxService } from "../../domain/inbox/InboxService";
import { NudgeService } from "../../domain/nudge/NudgeService";
import { SessionService } from "../../domain/session/SessionService";
import { SignalService } from "../../domain/signal/SignalService";
import { AzureDevOpsAdapter } from "../../domain/signal/adapters/AzureDevOpsAdapter";
import { CaptureService } from "../../domain/capture/CaptureService";
import { TrainService } from "../../domain/train/TrainService";
import { CanvasService } from "../../domain/canvas/CanvasService";
import { AnalyticsService } from "../../domain/analytics/AnalyticsService";
import { DocService } from "../../domain/docs/DocService";
import { FileSystemClient } from "../filesystem/FileSystemClient";
import type { IServiceContainer, ServiceRegistration } from "./types";

/**
 * Storage adapter for plugin data.
 * Bridges Obsidian's loadData/saveData with our storage interface.
 */
export interface PluginStorage {
	loadData: () => Promise<unknown>;
	saveData: (data: unknown) => Promise<void>;
}

/**
 * Creates a storage provider from plugin storage methods.
 */
function createStorageProvider(pluginStorage: PluginStorage): IStorageProvider {
	return {
		load: () => pluginStorage.loadData(),
		save: (data) => pluginStorage.saveData(data),
	};
}

/**
 * Creates a TypedStorage with a fallback callback wired to the EventBus.
 * When safeLoad() falls back to defaults, emits a log.entry warn event.
 */
function createTypedStorage<T>(
	storage: IStorageProvider,
	key: string,
	container: IServiceContainer,
): TypedStorage<T> {
	return new TypedStorage<T>(storage, key, {
		onFallback: (k, err) => {
			void container.getEventBus().emit("log.entry", {
				level: "warn",
				message: `Storage fallback for key "${k}" — using defaults due to load failure`,
				context: "TypedStorage",
				data: { error: err instanceof Error ? err.message : String(err) },
				timestamp: new Date().toISOString(),
			});
		},
	});
}

/**
 * Creates all service registrations for the application.
 *
 * @param pluginStorage - Plugin's loadData/saveData methods
 * @returns Array of service registrations
 */
export function createServiceRegistrations(
	pluginStorage: PluginStorage
): ServiceRegistration[] {
	const storage = createStorageProvider(pluginStorage);

	return [
		// Settings Service - manages plugin settings
		{
			id: "settingsService",
			factory: (container: IServiceContainer) =>
				new SettingsService({
					storage,
					eventBus: container.getEventBus(),
				}),
		},

		// User Service - manages user profile and persistence
		{
			id: "userService",
			factory: (container: IServiceContainer) =>
				new UserService({
					storage: createTypedStorage(storage, "user", container),
					eventBus: container.getEventBus(),
				}),
		},

		// Event Filter Service - manages event visibility in the Event Log
		{
			id: "eventFilterService",
			factory: (container: IServiceContainer) =>
				new EventFilterService({
					storage: createTypedStorage(storage, "eventFilter", container),
					eventBus: container.getEventBus(),
				}),
		},

		// Event Notification Service - manages event notification popups
		{
			id: "eventNotifyService",
			factory: (container: IServiceContainer) =>
				new EventNotificationService({
					storage: createTypedStorage(storage, "eventNotify", container),
					eventBus: container.getEventBus(),
				}),
		},

		// Doc Service - centralized documentation file creation
		{
			id: "docService",
			factory: (container: IServiceContainer) => {
				const eventBus = container.getEventBus();
				return new DocService({
					eventBus,
					fileSystem: new FileSystemClient({ eventBus }),
				});
			},
		},

		// Discovery Service - discovers user-land events from vault files
		{
			id: "discoveryService",
			factory: (container: IServiceContainer) =>
				new DiscoveryService({
					storage: createTypedStorage(storage, "discovery", container),
					eventBus: container.getEventBus(),
				}),
		},

		// Subscription Service - manages event subscriptions with filters
		{
			id: "subscriptionService",
			factory: (container: IServiceContainer) =>
				new SubscriptionService({
					storage: createTypedStorage(storage, "subscription", container),
					eventBus: container.getEventBus(),
				}),
		},

		// Inbox Service - aggregates actionable items from domain events
		{
			id: "inboxService",
			factory: (container: IServiceContainer) =>
				new InboxService({
					storage: createTypedStorage(storage, "inbox", container),
					eventBus: container.getEventBus(),
				}),
		},

		// Ingestion Service - queued event processing pipeline
		{
			id: "ingestionService",
			factory: (container: IServiceContainer) =>
				new IngestionService({
					storage: createTypedStorage(storage, "ingestion", container),
					eventBus: container.getEventBus(),
				}),
		},

		// Event Definition Service - maps file events to domain events
		{
			id: "eventDefinitionService",
			factory: (container: IServiceContainer) =>
				new EventDefinitionService({
					storage: createTypedStorage(storage, "eventDefinition", container),
					eventBus: container.getEventBus(),
				}),
		},

		// Session Service - time-boxed documentation sessions
		{
			id: "sessionService",
			factory: (container: IServiceContainer) => {
				const eventBus = container.getEventBus();
				return new SessionService({
					storage: createTypedStorage(storage, "sessions", container),
					eventBus,
					fileSystem: new FileSystemClient({ eventBus }),
				});
			},
		},

		// Nudge Service - time-based session start reminders
		{
			id: "nudgeService",
			factory: (container: IServiceContainer) => {
				const eventBus = container.getEventBus();
				return new NudgeService({
					storage: createTypedStorage(storage, "nudges", container),
					eventBus,
				});
			},
		},

		// Data Exchange Service - CSV import and folder/base export
		{
			id: "dataExchangeService",
			factory: (container: IServiceContainer) => {
				const eventBus = container.getEventBus();
				const fileSystem = new FileSystemClient({ eventBus });
				return new DataExchangeService({
					storage: createTypedStorage(storage, "dataExchange", container),
					eventBus,
					fileSystem,
				});
			},
		},

		// Installer Service - first-run wizard and folder scaffolding
		{
			id: "installerService",
			dependencies: ["userService"],
			factory: async (container: IServiceContainer) => {
				const userService = await container.get<IUserService>("userService");
				const eventBus = container.getEventBus();
				const fileSystem = new FileSystemClient({ eventBus });
				const service = new InstallerService({
					storage: createTypedStorage(storage, "installer", container),
					eventBus,
					fileSystem,
					userService,
				});
				service.registerStep(new UserCreationStep());
				service.registerStep(new FolderScaffoldStep());
				service.registerStep(new SeedContentStep());
				return service;
			},
		},

		// Signal Service - external data source connections (Azure DevOps, etc.)
		{
			id: "signalService",
			factory: (container: IServiceContainer) => {
				const eventBus = container.getEventBus();
				return new SignalService({
					storage: createTypedStorage(storage, "signal", container),
					eventBus,
					adapter: new AzureDevOpsAdapter(),
					fileSystem: new FileSystemClient({ eventBus }),
				});
			},
		},

		// Capture Service - quick note capture via ribbons and command palette
		{
			id: "captureService",
			factory: (container: IServiceContainer) => {
				const eventBus = container.getEventBus();
				return new CaptureService({
					eventBus,
					fileSystem: new FileSystemClient({ eventBus }),
					getSettings: () => ({ captureFolder: "" }),
				});
			},
		},

		// Canvas Service - canvas import configurations and orchestration
		{
			id: "canvasService",
			factory: (container: IServiceContainer) => {
				const eventBus = container.getEventBus();
				return new CanvasService({
					storage: createTypedStorage(storage, "canvas", container),
					eventBus,
					fileSystem: new FileSystemClient({ eventBus }),
				});
			},
		},

		// Analytics Service - in-memory CSV analytics engine
		{
			id: "analyticsService",
			factory: (container: IServiceContainer) => {
				const eventBus = container.getEventBus();
				return new AnalyticsService({
					storage: createTypedStorage(storage, "analytics", container),
					eventBus,
					fileSystem: new FileSystemClient({ eventBus }),
				});
			},
		},

		// Train Service - serial thought capture sessions
		{
			id: "trainService",
			dependencies: ["captureService"],
			factory: async (container: IServiceContainer) => {
				const captureService = await container.get<CaptureService>("captureService");
				const eventBus = container.getEventBus();
				return new TrainService({
					storage: createTypedStorage(storage, "trains", container),
					eventBus,
					fileSystem: new FileSystemClient({ eventBus }),
					captureService,
				});
			},
		},
	];
}

/**
 * Registers all services with the container.
 *
 * @param container - The service container
 * @param pluginStorage - Plugin's loadData/saveData methods
 */
export function registerServices(
	container: IServiceContainer,
	pluginStorage: PluginStorage
): void {
	const registrations = createServiceRegistrations(pluginStorage);

	for (const registration of registrations) {
		container.register(registration);
	}
}
