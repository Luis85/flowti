/**
 * domain-services-loader.ts — Orchestrates domain service loading
 * for the main plugin. Extracted from FlowtiBasePlugin.loadDomainServices().
 */

import type { App } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types.js";
import type { IUserService } from "../domain/user/types.js";
import type { IInstallerService } from "../domain/installer/types.js";
import type { EventFilterService } from "../domain/eventFilter/EventFilterService.js";
import type { EventNotificationService } from "../domain/eventNotify/EventNotificationService.js";
import type { DiscoveryService } from "../domain/discovery/DiscoveryService.js";
import type { InboxService } from "../domain/inbox/InboxService.js";
import type { IngestionService } from "../domain/ingestion/IngestionService.js";
import type { SessionService } from "../domain/session/SessionService.js";
import type { NudgeService } from "../domain/nudge/NudgeService.js";
import type { SignalService } from "../domain/signal/SignalService.js";
import type { CaptureService } from "../domain/capture/CaptureService.js";
import type { TrainService } from "../domain/train/TrainService.js";
import type { CanvasService } from "../domain/canvas/CanvasService.js";
import type { CanvasSessionService } from "../domain/canvas/session/CanvasSessionService.js";
import type { AnalyticsService } from "../domain/analytics/AnalyticsService.js";
import type { OnboardingService } from "../domain/onboarding/OnboardingService.js";
import type { TestManagementService } from "../domain/testManagement/TestManagementService.js";
import type { FeatureLifecycleService } from "../domain/featureLifecycle/FeatureLifecycleService.js";
import type { ProcessService } from "../domain/process/ProcessService.js";
import type { JourneyBuilderService } from "../domain/journeyBuilder/JourneyBuilderService.js";
import type { JourneyExecutorService } from "../domain/journeyExecutor/JourneyExecutorService.js";
import type { TrainCanvasSyncService } from "../domain/train/TrainCanvasSyncService.js";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService.js";
import type { TrainSetup } from "./trainSetup.js";
import type { SessionSetup } from "./sessionSetup.js";
import type { DomainLoaderDeps, TimingTracker } from "./domain-loader.js";
import {
	loadCoreServices, loadCatalogServices, loadInboxService,
	loadIngestionWave, loadSessionService, loadNudgeSignalWave,
	loadTrainDomain, loadAnalyticsOnboarding, wireAnalytics,
} from "./domain-loader.js";
import { registerLeafHandlers, loadQualityHubs, loadProcessAndJourney } from "./domain-loader-handlers.js";
import { VIEW_TYPE_SESSION_WORKSPACE } from "../ui/session/SessionWorkspaceView.js";

export interface DomainServicesResult {
	userService: IUserService;
	installerServiceRef: IInstallerService;
	eventFilterService: EventFilterService;
	eventNotifyService: EventNotificationService;
	discoveryService: DiscoveryService;
	inboxService: InboxService;
	ingestionService: IngestionService;
	dataExchangeService: DataExchangeService;
	sessionService: SessionService;
	nudgeService: NudgeService;
	signalService: SignalService;
	captureService: CaptureService;
	trainService: TrainService;
	canvasService: CanvasService;
	canvasSessionService: CanvasSessionService;
	analyticsService: AnalyticsService;
	onboardingService: OnboardingService;
	testManagementService: TestManagementService;
	featureLifecycleService: FeatureLifecycleService;
	processService: ProcessService;
	journeyBuilderService: JourneyBuilderService;
	journeyExecutorService: JourneyExecutorService;
	trainCanvasSync: TrainCanvasSyncService;
	trainSetup: TrainSetup;
	listeners: (() => void)[];
}

export interface DomainServicesHost {
	app: App;
	eventBus: IEventBus;
	sessionSetup?: SessionSetup;
}

export async function loadAllDomainServices(
	deps: DomainLoaderDeps,
	timing: TimingTracker,
	host: DomainServicesHost,
): Promise<DomainServicesResult> {
	const listeners: (() => void)[] = [];

	const core = await loadCoreServices(deps, timing);
	const catalog = await loadCatalogServices(deps, timing);
	const inboxService = await loadInboxService(deps, timing, core.settingsService);
	const ingestion = await loadIngestionWave(deps, timing);
	const sessionService = await loadSessionService(deps, timing, core.settingsService);

	listeners.push(
		host.eventBus.on("session.completed", (event) => { void host.sessionSetup?.writeSessionSummary(event.payload.session); }),
		host.eventBus.on("session.created", (event) => { host.sessionSetup?.openSessionWorkspaceInSidebar(event.payload.session.id); }),
		host.eventBus.on("session.closure.started", (event) => {
			const sid = event.payload.sessionId;
			const alreadyVisible = host.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE)
				.some((l) => (l.view.getState() as { sessionId?: string } | undefined)?.sessionId === sid);
			if (!alreadyVisible) host.sessionSetup?.openSessionWorkspaceInSidebar(sid);
		}),
	);

	const nudgeSignal = await loadNudgeSignalWave(deps, timing, sessionService, inboxService);
	listeners.push(...nudgeSignal.listeners);

	const train = await loadTrainDomain(deps, timing, core.settingsService, sessionService);
	listeners.push(...train.listeners);
	ingestion.dataExchangeService.setCanvasService(train.canvasService);

	const ao = await loadAnalyticsOnboarding(deps, timing);
	await wireAnalytics(deps, timing, ao.analyticsService, ingestion.dataExchangeService, core.settingsService);
	await registerLeafHandlers(deps, timing, core.settingsService, train.trainService, train.canvasService, ingestion.dataExchangeService, sessionService);

	const quality = await loadQualityHubs(deps, timing, core.settingsService, ao.onboardingService);

	const pj = await loadProcessAndJourney(deps, timing, core.settingsService, sessionService, train.trainService, train.trainSetup, ao.analyticsService, ao.onboardingService, quality.testManagementService);
	listeners.push(...pj.listeners);

	// Rewire settings listener
	listeners.push(
		host.eventBus.on("settings.changed", (event) => {
			inboxService.setEnabledSources(event.payload.settings.inboxEnabledSources);
			inboxService.setWatchedFolders(event.payload.settings.inboxWatchedFolders ?? []);
			inboxService.setTriageTargetFolder(event.payload.settings.inboxTriageTargetFolder ?? "");
			sessionService.globalActivityFilter = event.payload.settings.sessionActivityFilterGlobal ?? [];
			ao.analyticsService.setAnalyticsFolder(event.payload.settings.analyticsFolder);
			const templates = event.payload.settings.customOutputTemplates ?? [];
			for (const leaf of host.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE)) {
				(leaf.view as import("../ui/session/SessionWorkspaceView").SessionWorkspaceView).customOutputTemplates = templates;
			}
		}),
	);

	return {
		userService: core.userService,
		installerServiceRef: core.installerService,
		eventFilterService: catalog.eventFilterService,
		eventNotifyService: catalog.eventNotifyService,
		discoveryService: catalog.discoveryService,
		inboxService,
		ingestionService: ingestion.ingestionService,
		dataExchangeService: ingestion.dataExchangeService,
		sessionService,
		nudgeService: nudgeSignal.nudgeService,
		signalService: nudgeSignal.signalService,
		captureService: train.captureService,
		trainService: train.trainService,
		canvasService: train.canvasService,
		canvasSessionService: train.canvasSessionService,
		trainCanvasSync: train.trainCanvasSync,
		trainSetup: train.trainSetup,
		analyticsService: ao.analyticsService,
		onboardingService: ao.onboardingService,
		testManagementService: quality.testManagementService,
		featureLifecycleService: quality.featureLifecycleService,
		processService: pj.processService,
		journeyBuilderService: pj.journeyBuilderService,
		journeyExecutorService: pj.journeyExecutorService,
		listeners,
	};
}
