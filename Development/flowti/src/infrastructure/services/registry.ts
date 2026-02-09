/**
 * Service registry for Flowti.
 *
 * Central location for registering all application services
 * with the service container.
 */

import { SettingsService } from "../../domain/settings/SettingsService";
import { InstallerService } from "../../domain/installer/InstallerService";
import { UserCreationStep } from "../../domain/installer/steps/UserCreationStep";
import { FolderScaffoldStep } from "../../domain/installer/steps/FolderScaffoldStep";
import type { IUserService } from "../../domain/user/types";
import type { IStorageProvider } from "../../utils/types";
import { UserService } from "../../domain/user/UserService";
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
					storage,
					eventBus: container.getEventBus(),
				}),
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
					storage,
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
