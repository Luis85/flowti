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
import type { IUserService } from "../../domain/user/types";
import type { IStorageProvider } from "../../utils/types";
import { TypedStorage } from "../../utils/TypedStorage";
import { UserService } from "../../domain/user/UserService";
import { DataExchangeService } from "../../domain/dataExchange/DataExchangeService";
import { InboxService } from "../../domain/inbox/InboxService";
import { SessionService } from "../../domain/session/SessionService";
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
					storage: new TypedStorage(storage, "user"),
					eventBus: container.getEventBus(),
				}),
		},

		// Event Filter Service - manages event visibility in the Event Log
		{
			id: "eventFilterService",
			factory: (container: IServiceContainer) =>
				new EventFilterService({
					storage: new TypedStorage(storage, "eventFilter"),
					eventBus: container.getEventBus(),
				}),
		},

		// Event Notification Service - manages event notification popups
		{
			id: "eventNotifyService",
			factory: (container: IServiceContainer) =>
				new EventNotificationService({
					storage: new TypedStorage(storage, "eventNotify"),
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
					storage: new TypedStorage(storage, "discovery"),
					eventBus: container.getEventBus(),
				}),
		},

		// Subscription Service - manages event subscriptions with filters
		{
			id: "subscriptionService",
			factory: (container: IServiceContainer) =>
				new SubscriptionService({
					storage: new TypedStorage(storage, "subscription"),
					eventBus: container.getEventBus(),
				}),
		},

		// Inbox Service - aggregates actionable items from domain events
		{
			id: "inboxService",
			factory: (container: IServiceContainer) =>
				new InboxService({
					storage: new TypedStorage(storage, "inbox"),
					eventBus: container.getEventBus(),
				}),
		},

		// Ingestion Service - queued event processing pipeline
		{
			id: "ingestionService",
			factory: (container: IServiceContainer) =>
				new IngestionService({
					storage: new TypedStorage(storage, "ingestion"),
					eventBus: container.getEventBus(),
				}),
		},

		// Event Definition Service - maps file events to domain events
		{
			id: "eventDefinitionService",
			factory: (container: IServiceContainer) =>
				new EventDefinitionService({
					storage: new TypedStorage(storage, "eventDefinition"),
					eventBus: container.getEventBus(),
				}),
		},

		// Session Service - time-boxed documentation sessions
		{
			id: "sessionService",
			factory: (container: IServiceContainer) => {
				const eventBus = container.getEventBus();
				return new SessionService({
					storage: new TypedStorage(storage, "sessions"),
					eventBus,
					fileSystem: new FileSystemClient({ eventBus }),
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
					storage: new TypedStorage(storage, "dataExchange"),
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
					storage: new TypedStorage(storage, "installer"),
					eventBus,
					fileSystem,
					userService,
				});
				service.registerStep(new UserCreationStep());
				service.registerStep(new FolderScaffoldStep());
				return service;
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
