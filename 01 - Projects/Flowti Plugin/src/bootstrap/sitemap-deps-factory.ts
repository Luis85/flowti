/**
 * sitemap-deps-factory.ts — Builds the dependency configuration for
 * the sitemap handler registry, extracted from main.ts.
 */

import type { IEventBus } from "../infrastructure/events/types.js";
import type { EventFilterService } from "../domain/eventFilter/EventFilterService.js";
import type { EventNotificationService } from "../domain/eventNotify/EventNotificationService.js";
import type { DiscoveryService } from "../domain/discovery/DiscoveryService.js";
import type { InboxService } from "../domain/inbox/InboxService.js";
import type { NudgeService } from "../domain/nudge/NudgeService.js";
import type { SessionService } from "../domain/session/SessionService.js";
import type { SignalService } from "../domain/signal/SignalService.js";
import type { TrainService } from "../domain/train/TrainService.js";
import type { CanvasService } from "../domain/canvas/CanvasService.js";
import type { AnalyticsService } from "../domain/analytics/AnalyticsService.js";
import type { OnboardingService } from "../domain/onboarding/OnboardingService.js";
import type { IInstallerService } from "../domain/installer/types.js";
import type { IUserService } from "../domain/user/types.js";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService.js";
import type { TestManagementService } from "../domain/testManagement/TestManagementService.js";
import type { FlowtiSettings } from "../domain/settings/settings.js";
import type { HubRegistry } from "../domain/hub/HubRegistry.js";
import type { ICommandRegistry } from "../infrastructure/commands/types.js";
import type { TrainSetup } from "./trainSetup.js";
import { buildScannerEntities } from "./sitemap-handler-setup.js";

export interface SitemapDepsSource {
	eventBus: IEventBus;
	settings: FlowtiSettings;
	userService?: IUserService;
	eventFilterService?: EventFilterService;
	eventNotifyService?: EventNotificationService;
	discoveryService?: DiscoveryService;
	inboxService?: InboxService;
	nudgeService?: NudgeService;
	sessionService?: SessionService;
	signalService?: SignalService;
	trainService?: TrainService;
	canvasService?: CanvasService;
	analyticsService?: AnalyticsService;
	onboardingService?: OnboardingService;
	installerServiceRef?: IInstallerService;
	dataExchangeService?: DataExchangeService;
	testManagementService?: TestManagementService;
	hubRegistry?: HubRegistry;
	commands?: ICommandRegistry;
	trainSetup?: TrainSetup;
}

export function buildSitemapDeps(src: SitemapDepsSource) {
	return {
		actionDeps: { trainService: { getActiveTrain: () => src.trainService?.getActiveTrain() ?? null } },
		conditionDeps: {
			trainService: { getActiveTrain: () => src.trainService?.getActiveTrain() ?? null },
			sessionService: { getActiveSession: () => src.sessionService?.getActiveSession() ?? null },
			installerService: { isInstalled: () => src.installerServiceRef?.isInstalled() ?? false },
		},
		trainDeps: {
			trainService: { getAllTrains: () => src.trainService?.getAllTrains() ?? [], getActiveTrain: () => src.trainService?.getActiveTrain() },
			onboardingService: { shouldShowCallout: (id: string) => !(src.onboardingService?.isCalloutDismissed(id) ?? false) },
			eventBus: src.eventBus,
			openTrainView: (trainId: string) => src.trainSetup?.revealOrCreateTrainView(trainId),
		},
		catalogDeps: {
			viewState: {
				getDiscoveredEvents: () => src.discoveryService?.getDiscoveredEvents() ?? [],
				getExcludedTypes: () => src.eventFilterService?.getExcludedTypes() ?? [],
				getNotifiedTypes: () => src.eventNotifyService?.getNotifiedTypes() ?? [],
				getDomainEntries: () => buildScannerEntities("domain", src.discoveryService),
				getServiceEntries: () => buildScannerEntities("services", src.discoveryService),
				getFlowEntries: () => [], getSystemEntries: () => [], getActorEntries: () => [],
				getCategories: () => src.settings.catalogCategories,
			},
			eventBus: src.eventBus,
		},
		dataExchangeDeps: {
			dataExchangeService: {
				getSavedImportConfigs: () => src.dataExchangeService?.getSavedImportConfigs() ?? [],
				getSavedExportConfigs: () => src.dataExchangeService?.getSavedExportConfigs() ?? [],
				getSavedPipelines: () => src.dataExchangeService?.getSavedPipelines() ?? [],
				buildDataDictionary: () => src.dataExchangeService?.buildDataDictionary() ?? [],
				getPropertyDocPath: (name: string) => src.dataExchangeService?.getPropertyDocPath(name) ?? "",
				getTypesFolderPath: () => src.dataExchangeService?.getTypesFolderPath() ?? "",
				getReportsFolderPath: () => src.dataExchangeService?.getReportsFolderPath() ?? "",
			},
			signalService: src.signalService ? { getSignals: () => src.signalService!.getSignals(), syncAll: () => src.signalService!.syncAll() } : null,
			canvasService: src.canvasService ? { getConfigs: () => src.canvasService!.getConfigs() } : null,
			operationTracker: { getActiveOperations: () => [] },
			eventBus: src.eventBus,
		},
		analyticsDeps: {
			analyticsService: {
				listQueries: () => src.analyticsService?.listQueries() ?? [],
				listDashboards: () => src.analyticsService?.listDashboards() ?? [],
				listMeasurements: () => src.analyticsService?.listMeasurements() ?? [],
				getQuery: (id: string) => src.analyticsService?.getQuery(id) ?? null,
				getDashboardQueryMap: (id: string) => src.analyticsService?.getDashboardQueryMap(id) ?? new Map(),
				getDefaultDashboard: () => src.analyticsService?.getDefaultDashboard() ?? null,
				runSavedQuery: (id: string) => src.analyticsService?.runSavedQuery(id),
			},
			tileResultCache: { tryRun: () => ({ result: null, error: null }), getTimestamp: () => undefined, clear: () => {}, clearByQueryId: () => {} },
			onboardingService: {
				isCalloutDismissed: (id: string) => src.onboardingService?.isCalloutDismissed(id) ?? false,
				dismissCallout: (id: string) => void src.onboardingService?.markCalloutDismissed(id),
				shouldShowCallout: (id: string) => !(src.onboardingService?.isCalloutDismissed(id) ?? false),
			},
			eventBus: src.eventBus,
		},
		userDeps: {
			userService: { getUser: () => src.userService?.getUser() ?? null },
			hubRegistry: { getAll: () => src.hubRegistry?.getAll() ?? [], openHub: (hubId: string, tabId?: string, detail?: string) => void src.hubRegistry?.openHub(hubId, tabId, detail) },
			inboxService: { getItems: () => src.inboxService?.getItems() ?? [], getUnreadCount: () => src.inboxService?.getUnreadCount() ?? 0, markRead: (id: string) => void src.inboxService?.markRead(id), dismiss: (id: string) => void src.inboxService?.dismiss(id) },
			sessionService: { getSessions: () => src.sessionService?.getSessions() ?? [], getActiveSession: () => src.sessionService?.getActiveSession() ?? null },
			nudgeService: { getConfigs: () => src.nudgeService?.getConfigs() ?? [], isDismissedToday: (id: string) => src.nudgeService?.isDismissedToday(id) ?? false },
			onboardingService: { shouldShowCallout: (id: string) => !(src.onboardingService?.isCalloutDismissed(id) ?? false) },
			trainService: { getAllTrains: () => src.trainService?.getAllTrains() ?? [], getActiveTrain: () => src.trainService?.getActiveTrain() },
			commandRegistry: { getCommandsMeta: () => src.commands?.getCommandsMeta() ?? [] },
			settingsProvider: { getSettings: () => src.settings },
			eventBus: src.eventBus,
		},
	};
}
