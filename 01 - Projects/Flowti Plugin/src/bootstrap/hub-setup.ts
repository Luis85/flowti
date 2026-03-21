/**
 * HubRegistry setup and scanner entity builder.
 *
 * Extracted from main.ts to reduce its LOC.
 */

import type { App, ViewCreator, Command } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types.js";
import type { IErrorService } from "../infrastructure/errors/types.js";
import type { IUserService } from "../domain/user/types.js";
import { HubRegistry } from "../domain/hub/HubRegistry.js";
import { EventCatalogProvider } from "../domain/hub/EventCatalogProvider.js";
import { DataExchangeProvider } from "../domain/hub/DataExchangeProvider.js";
import { AnalyticsHubProvider } from "../domain/hub/AnalyticsHubProvider.js";
import { UserHubProvider } from "../domain/hub/UserHubProvider.js";
import { TrainHubProvider } from "../domain/hub/TrainHubProvider.js";
import { TestManagementHubProvider } from "../domain/hub/TestManagementHubProvider.js";
import { FeatureLifecycleProvider } from "../domain/hub/FeatureLifecycleProvider.js";
import { SessionSetup } from "./sessionSetup.js";
import { EVENT_CATALOG, type EventCatalogEntry } from "../infrastructure/events/catalog.js";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService.js";
import type { AnalyticsService } from "../domain/analytics/AnalyticsService.js";
import type { TrainService } from "../domain/train/TrainService.js";
import type { TestManagementService } from "../domain/testManagement/TestManagementService.js";
import type { FeatureLifecycleService } from "../domain/featureLifecycle/FeatureLifecycleService.js";
import type { InboxService } from "../domain/inbox/InboxService.js";
import type { SessionService } from "../domain/session/SessionService.js";
import type { FlowtiSettings } from "../domain/settings/settings.js";
import type { EventFilterService } from "../domain/eventFilter/EventFilterService.js";
import type { EventNotificationService } from "../domain/eventNotify/EventNotificationService.js";
import type { DiscoveryService } from "../domain/discovery/DiscoveryService.js";

export interface HubSetupDeps {
	app: App;
	eventBus: IEventBus;
	errorService: IErrorService;
	settings: FlowtiSettings;
	collapsedCategories: Set<string>;
	userService: IUserService;
	inboxService: InboxService;
	sessionService: SessionService;
	dataExchangeService: DataExchangeService;
	analyticsService: AnalyticsService;
	trainService: TrainService;
	testManagementService: TestManagementService;
	featureLifecycleService?: FeatureLifecycleService;
	eventFilterService?: EventFilterService;
	eventNotifyService?: EventNotificationService;
	discoveryService?: DiscoveryService;
	safeRegisterView: (type: string, factory: ViewCreator) => void;
	registerEvent: (ref: import("obsidian").EventRef) => void;
	addCommand: (cmd: Command) => Command;
}

export interface HubSetupResult {
	hubRegistry: HubRegistry;
	sessionSetup: SessionSetup;
}

/**
 * Creates the HubRegistry with all hub providers and
 * registers the session views/commands.
 */
export function setupHubRegistry(deps: HubSetupDeps): HubSetupResult {
	const hubRegistry = new HubRegistry({
		openView: async (viewType: string) => {
			let leaf = deps.app.workspace.getLeavesOfType(viewType)[0];
			if (!leaf) {
				leaf = deps.app.workspace.getLeaf("tab");
				await leaf.setViewState({ type: viewType, active: true });
			}
			void deps.app.workspace.revealLeaf(leaf);
		},
	}, deps.eventBus);

	hubRegistry.register(new EventCatalogProvider({
		getSettings: () => deps.settings,
		getExcludedTypes: () => deps.eventFilterService?.getExcludedTypes() ?? [],
		getNotifiedTypes: () => deps.eventNotifyService?.getNotifiedTypes() ?? [],
		getDiscoveredEvents: () => deps.discoveryService?.getDiscoveredEvents() ?? [],
		collapsedCategories: deps.collapsedCategories,
	}));
	hubRegistry.register(new DataExchangeProvider(deps.dataExchangeService));
	hubRegistry.register(new AnalyticsHubProvider(deps.analyticsService));
	hubRegistry.register(new TrainHubProvider(deps.trainService));
	hubRegistry.register(new TestManagementHubProvider(deps.testManagementService));
	if (deps.featureLifecycleService) {
		hubRegistry.register(new FeatureLifecycleProvider(deps.featureLifecycleService));
	}
	hubRegistry.register(new UserHubProvider(deps.userService, deps.inboxService));

	const sessionSetup = new SessionSetup({
		app: deps.app,
		eventBus: deps.eventBus,
		errorService: deps.errorService,
		sessionService: deps.sessionService,
		trainService: deps.trainService,
		registerView: (type, factory) => deps.safeRegisterView(type, factory),
		registerEvent: (ref) => deps.registerEvent(ref),
		addCommand: (cmd) => deps.addCommand(cmd),
	});
	sessionSetup.registerViews();
	sessionSetup.registerCommands();
	sessionSetup.registerFileMenuItems();

	return { hubRegistry, sessionSetup };
}

/**
 * Builds ScannerEntity entries for Lit entity-scanner components by
 * extracting unique values from EVENT_CATALOG + discovered events.
 */
export function buildScannerEntities(
	field: "domain" | "services",
	discoveryService?: { getDiscoveredEvents: () => Array<{ eventName: string; category?: string; triggerCount: number }> },
): readonly { id: string; name: string; description: string; count: number }[] {
	const discovered = discoveryService?.getDiscoveredEvents() ?? [];
	const discoveredEntries: EventCatalogEntry[] = discovered.map((d) => ({
		type: d.eventName,
		category: d.category ?? "Uncategorized",
		description: `Custom event (triggered ${d.triggerCount}x)`,
		direction: "User \u2192 EventBus",
		domain: "custom",
		services: "Discovery",
		stability: "experimental" as const,
		visibility: "user-facing" as const,
		tags: [],
	}));
	const allEntries = [...EVENT_CATALOG, ...discoveredEntries];

	const grouped = new Map<string, number>();
	for (const entry of allEntries) {
		const key = entry[field] as string;
		if (key) grouped.set(key, (grouped.get(key) ?? 0) + 1);
	}

	return Array.from(grouped.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([name, count]) => ({
			id: name,
			name,
			description: `${count} event${count === 1 ? "" : "s"} in this ${field === "services" ? "service" : field}`,
			count,
		}));
}
