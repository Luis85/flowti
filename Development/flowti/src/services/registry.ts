/**
 * Service registry for Flowti.
 *
 * Central location for registering all application services
 * with the service container.
 */

import type { App } from "obsidian";
import { FeatureService } from "../features/FeatureService";
import { IdeaService } from "../ideas/IdeaService";
import { JTBDService } from "../jtbd/JTBDService";
import { RequirementService } from "../requirements/RequirementService";
import type { FlowtiSettings } from "../settings/settings";
import { SettingsService } from "../settings/SettingsService";
import { SolutionService } from "../solutions/SolutionService";
import type { ISolutionService } from "../solutions/types";
import type { IStorageProvider } from "../utils/types";
import { UserService } from "../user/UserService";
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
 * Plugin context for service registration.
 * Provides access to Obsidian app and plugin settings.
 */
export interface PluginContext {
	app: App;
	getSettings: () => FlowtiSettings;
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
 * @param pluginContext - Plugin context with app and settings access
 * @returns Array of service registrations
 */
export function createServiceRegistrations(
	pluginStorage: PluginStorage,
	pluginContext?: PluginContext
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

		// Solution Service - manages solution files in the vault
		...(pluginContext
			? [
					{
						id: "solutionService",
						factory: (container: IServiceContainer) =>
							new SolutionService({
								app: pluginContext.app,
								eventBus: container.getEventBus(),
								solutionsFolder: pluginContext.getSettings().solutionsFolder,
							}),
					},
				]
			: []),

		// Idea Service - manages idea files in solution subfolders
		...(pluginContext
			? [
					{
						id: "ideaService",
						factory: async (container: IServiceContainer) => {
							const solutionService =
								await container.get<ISolutionService>("solutionService");
							const ideaService = new IdeaService({
								app: pluginContext.app,
								eventBus: container.getEventBus(),
								solutionsFolder: pluginContext.getSettings().solutionsFolder,
							});
							ideaService.setSolutionService(solutionService);
							return ideaService;
						},
					},
				]
			: []),

		// Requirement Service - manages requirement files in solution subfolders
		...(pluginContext
			? [
					{
						id: "requirementService",
						factory: async (container: IServiceContainer) => {
							const solutionService =
								await container.get<ISolutionService>("solutionService");
							const requirementService = new RequirementService({
								app: pluginContext.app,
								eventBus: container.getEventBus(),
								solutionsFolder: pluginContext.getSettings().solutionsFolder,
							});
							requirementService.setSolutionService(solutionService);
							return requirementService;
						},
					},
				]
			: []),

		// JTBD Service - manages Jobs to be Done files in solution subfolders
		...(pluginContext
			? [
					{
						id: "jtbdService",
						factory: async (container: IServiceContainer) => {
							const solutionService =
								await container.get<ISolutionService>("solutionService");
							const jtbdService = new JTBDService({
								app: pluginContext.app,
								eventBus: container.getEventBus(),
								solutionsFolder: pluginContext.getSettings().solutionsFolder,
							});
							jtbdService.setSolutionService(solutionService);
							return jtbdService;
						},
					},
				]
			: []),

		// Feature Service - manages feature files in solution subfolders
		...(pluginContext
			? [
					{
						id: "featureService",
						factory: async (container: IServiceContainer) => {
							const solutionService =
								await container.get<ISolutionService>("solutionService");
							const featureService = new FeatureService({
								app: pluginContext.app,
								eventBus: container.getEventBus(),
								solutionsFolder: pluginContext.getSettings().solutionsFolder,
							});
							featureService.setSolutionService(solutionService);
							return featureService;
						},
					},
				]
			: []),
	];
}

/**
 * Registers all services with the container.
 *
 * @param container - The service container
 * @param pluginStorage - Plugin's loadData/saveData methods
 * @param pluginContext - Optional plugin context for services that need app access
 */
export function registerServices(
	container: IServiceContainer,
	pluginStorage: PluginStorage,
	pluginContext?: PluginContext
): void {
	const registrations = createServiceRegistrations(pluginStorage, pluginContext);

	for (const registration of registrations) {
		container.register(registration);
	}
}
