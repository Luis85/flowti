/**
 * Journey domain wiring — JourneyBuilderService, JourneyExecutorService,
 * handler registrations, and file extension binding.
 *
 * Extracted from main.ts to reduce its LOC.
 */

import { TFile } from "obsidian";
import type { App } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { ISettingsService } from "../domain/settings/types";
import type { ICommandRegistry } from "../infrastructure/commands/types";
import type { PluginHandlerRegistry } from "../infrastructure/handlers/plugin-handler-registry";
import { FileSystemClient } from "../infrastructure/filesystem/FileSystemClient";
import { JourneyBuilderService } from "../domain/journeyBuilder/JourneyBuilderService";
import { JourneyExecutorService } from "../domain/journeyExecutor/JourneyExecutorService";
import type { ToolHost, ExecutableJourney } from "../domain/journeyExecutor/types";
import type { TestManagementService } from "../domain/testManagement/TestManagementService";
import { ExecutionProgressModal } from "../ui/journeyExecutor/ExecutionProgressModal";
import { registerJourneyBuilderHandler } from "../infrastructure/handlers/leaf-handlers/journey-builder-handler";
import { EVENT_CATALOG } from "../infrastructure/events/catalog";
import { VIEW_TYPE_JOURNEY_FILE } from "../ui/journeyBuilder/JourneyFileView";

/** Built once — journey builder reads catalog often; avoid re-mapping 500+ entries per call. */
const JOURNEY_EVENT_CATALOG_LITE = EVENT_CATALOG.map((e) => ({
	type: e.type,
	category: e.category,
	description: e.description,
}));

export interface JourneySetupDeps {
	app: App;
	eventBus: IEventBus;
	settingsService: ISettingsService;
	commands: ICommandRegistry;
	handlerRegistry: PluginHandlerRegistry;
	testManagementService: TestManagementService;
	toolHost: ToolHost;
	registerExtensions: (extensions: string[], viewType: string) => void;
}

export interface JourneySetupResult {
	journeyBuilderService: JourneyBuilderService;
	journeyExecutorService: JourneyExecutorService;
	unsubscribes: (() => void)[];
}

export function setupJourneyDomain(deps: JourneySetupDeps): JourneySetupResult {
	const unsubscribes: (() => void)[] = [];

	// Journey Builder Service — writes exported journey JSON via adapter
	const journeyBuilderFs = new FileSystemClient({ eventBus: deps.eventBus });
	const journeyBuilderService = new JourneyBuilderService({
		fileSystem: journeyBuilderFs,
		eventBus: deps.eventBus,
		getSettings: () => ({ journeyFolder: deps.settingsService.getSettings().journeyFolder }),
	});
	journeyBuilderService.start();

	// Journey Executor — in-app journey runner
	const journeyExecutorService = new JourneyExecutorService({
		eventBus: deps.eventBus,
		host: deps.toolHost,
		testManagementService: deps.testManagementService,
	});

	// Run Journey — listen for ui.runJourney → load JSON → open ExecutionProgressModal
	unsubscribes.push(
		deps.eventBus.on("ui.runJourney", (event) => {
			const { journeyName, jsonPath, canvasPath } = event.payload;
			void (async () => {
				try {
					const file = deps.app.vault.getAbstractFileByPath(jsonPath);
					if (!file || !(file instanceof TFile)) {
						void deps.eventBus.emit("notice.show", { message: `Journey file not found: ${jsonPath}` });
						return;
					}
					const raw = await deps.app.vault.read(file);
					const parsed = JSON.parse(raw) as ExecutableJourney;
					if (!parsed.journey) parsed.journey = journeyName;
					const modal = new ExecutionProgressModal({
						app: deps.app,
						eventBus: deps.eventBus,
						executorService: journeyExecutorService,
						journey: parsed,
						canvasPath,
						writeFile: async (path, content) => {
							const folder = path.substring(0, path.lastIndexOf("/"));
							if (folder && !deps.app.vault.getAbstractFileByPath(folder)) {
								await deps.app.vault.createFolder(folder);
							}
							await deps.app.vault.create(path, content);
						},
					});
					modal.open();
				} catch (err) {
					void deps.eventBus.emit("notice.show", {
						message: `Failed to load journey: ${err instanceof Error ? err.message : String(err)}`,
					});
				}
			})();
		}),
	);

	// Journey Builder — sitemap-driven via SitemapLeafView + handler
	registerJourneyBuilderHandler(deps.handlerRegistry, {
		eventBus: deps.eventBus,
		app: deps.app,
		getEventCatalog: () => JOURNEY_EVENT_CATALOG_LITE,
		getCommands: () => deps.commands.getCommandsMeta().map((c) => ({ id: c.id, label: c.label, domain: c.domain })),
		getJourneyFolder: () => deps.settingsService.getSettings().journeyFolder,
	});

	// Journey File View — .journey file extension binding
	try {
		deps.registerExtensions(["journey"], VIEW_TYPE_JOURNEY_FILE);
	} catch {
		// Extension may already be registered
	}

	return { journeyBuilderService, journeyExecutorService, unsubscribes };
}
