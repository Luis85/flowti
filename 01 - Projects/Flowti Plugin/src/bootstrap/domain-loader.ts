/**
 * Domain service loading — extracted from main.ts onLayoutReady().
 *
 * Loads all domain services in dependency order with performance tracking.
 * Each service wave is loaded in parallel where possible.
 */

import { TFile, TFolder } from "obsidian";
import type { App, Command } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types.js";
import type { IServiceContainer } from "../infrastructure/services/types.js";
import type { ILogger } from "../infrastructure/logger/types.js";
import type { ISettingsService } from "../domain/settings/types.js";
import type { IInstallerService } from "../domain/installer/types.js";
import type { IUserService } from "../domain/user/types.js";
import type { EventFilterService } from "../domain/eventFilter/EventFilterService.js";
import type { EventNotificationService } from "../domain/eventNotify/EventNotificationService.js";
import type { DiscoveryService } from "../domain/discovery/DiscoveryService.js";
import type { SubscriptionService } from "../domain/subscription/SubscriptionService.js";
import type { InboxService } from "../domain/inbox/InboxService.js";
import type { IngestionService } from "../domain/ingestion/IngestionService.js";
import type { EventDefinitionService } from "../domain/eventDefinition/EventDefinitionService.js";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService.js";
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
import type { ToolHost } from "../domain/journeyExecutor/types.js";
import type { FlowtiSettings } from "../domain/settings/settings.js";
import type { NoticeService } from "../infrastructure/ui/NoticeService.js";
import type { ModalService } from "../infrastructure/ui/ModalService.js";
import type { PluginHandlerRegistry } from "../infrastructure/handlers/plugin-handler-registry.js";
import type { ICommandRegistry } from "../infrastructure/commands/types.js";
import { InstallerWizardModal } from "../ui/installer/InstallerWizardModal.js";
import { FileSystemClient } from "../infrastructure/filesystem/FileSystemClient.js";
import { TrainSetup } from "./trainSetup.js";
import { showNudgeNotification } from "../ui/shared/NudgeNotification.js";
export { wireSettingsListener } from "./domain-loader-wiring.js";
export { registerLeafHandlers, loadQualityHubs, loadProcessAndJourney } from "./domain-loader-handlers.js";

export interface DomainLoaderDeps {
	app: App;
	eventBus: IEventBus;
	services: IServiceContainer;
	logger: ILogger;
	noticeService: NoticeService;
	modalService: ModalService;
	handlerRegistry: PluginHandlerRegistry;
	commands: ICommandRegistry;
	settings: FlowtiSettings;
	addCommand: (cmd: Command) => Command;
	registerExtensions: (exts: string[], type: string) => void;
	toolHost: ToolHost;
	getFilesInFolder: (folderPath: string, predicate?: (file: TFile) => boolean) => TFile[];
	hasMergeConflictMarkers: (content: string) => boolean;
}

/** Timing tracker for service loading. */
export interface TimingTracker {
	timedServiceLoad: (name: string, loadFn: () => Promise<void>) => Promise<void>;
	timedServiceLoadsParallel: (entries: readonly { name: string; fn: () => Promise<void> }[]) => Promise<void>;
	trackSeg: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
}

/** All resolved domain services. */
export interface DomainLoadResult {
	settingsService: ISettingsService;
	userService: IUserService;
	installerService: IInstallerService;
	eventFilterService: EventFilterService;
	eventNotifyService: EventNotificationService;
	discoveryService: DiscoveryService;
	subscriptionService: SubscriptionService;
	inboxService: InboxService;
	ingestionService: IngestionService;
	eventDefinitionService: EventDefinitionService;
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
	crossCuttingListeners: (() => void)[];
}

/**
 * Loads core settings, user, and installer services.
 */
export async function loadCoreServices(
	deps: DomainLoaderDeps,
	timing: TimingTracker,
): Promise<{ settingsService: ISettingsService; userService: IUserService; installerService: IInstallerService; listeners: (() => void)[] }> {
	const listeners: (() => void)[] = [];

	const settingsService = await deps.services.get<ISettingsService>("settingsService");
	await timing.trackSeg("01.core.settings-user-installer", async () => {
		await timing.timedServiceLoad("settingsService", () => settingsService.load());

		const userService = await deps.services.get<IUserService>("userService");
		const installerService = await deps.services.get<IInstallerService>("installerService");
		await timing.timedServiceLoadsParallel([
			{ name: "userService", fn: () => userService.load() },
			{ name: "installerService", fn: () => installerService.load() },
		]);

		InstallerWizardModal.showIfNeeded(deps.app, installerService, deps.eventBus);

		deps.addCommand({
			id: "flowti:open-installer",
			name: "Open installer",
			icon: "download",
			checkCallback: (checking) => {
				if (installerService.isInstalled()) return false;
				if (!checking) {
					InstallerWizardModal.showIfNeeded(deps.app, installerService, deps.eventBus);
				}
				return true;
			},
		});

		return { settingsService, userService, installerService };
	});

	const userService = await deps.services.get<IUserService>("userService");
	const installerService = await deps.services.get<IInstallerService>("installerService");
	return { settingsService, userService, installerService, listeners };
}

/**
 * Loads catalog-related services (event filter, notify, discovery, subscription).
 */
export async function loadCatalogServices(
	deps: DomainLoaderDeps,
	timing: TimingTracker,
): Promise<{
	eventFilterService: EventFilterService;
	eventNotifyService: EventNotificationService;
	discoveryService: DiscoveryService;
	subscriptionService: SubscriptionService;
}> {
	return timing.trackSeg("02.wave.catalog-services", async () => {
		const [eventFilterService, eventNotifyService, discoveryService, subscriptionService] = await Promise.all([
			deps.services.get<EventFilterService>("eventFilterService"),
			deps.services.get<EventNotificationService>("eventNotifyService"),
			deps.services.get<DiscoveryService>("discoveryService"),
			deps.services.get<SubscriptionService>("subscriptionService"),
		]);
		await timing.timedServiceLoadsParallel([
			{ name: "eventFilterService", fn: () => eventFilterService.load() },
			{ name: "eventNotifyService", fn: () => eventNotifyService.load() },
			{ name: "discoveryService", fn: () => discoveryService.load() },
			{ name: "subscriptionService", fn: () => subscriptionService.load() },
		]);
		return { eventFilterService, eventNotifyService, discoveryService, subscriptionService };
	});
}

/**
 * Loads inbox service with filesystem adapters.
 */
export async function loadInboxService(
	deps: DomainLoaderDeps,
	timing: TimingTracker,
	settingsService: ISettingsService,
): Promise<InboxService> {
	return timing.trackSeg("03.inbox", async () => {
		const inboxService = await deps.services.get<InboxService>("inboxService");
		inboxService.setEnabledSources(settingsService.getSettings().inboxEnabledSources);
		inboxService.setWatchedFolders(settingsService.getSettings().inboxWatchedFolders ?? []);
		inboxService.getFrontmatter = (path: string) => {
			const file = deps.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) return undefined;
			return deps.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
		};
		const inboxFileSystem = new FileSystemClient({ eventBus: deps.eventBus });
		inboxService.updateFileFrontmatter = async (path: string, data: Record<string, unknown>) => {
			await inboxFileSystem.updateFrontmatter(path, data);
		};
		inboxService.moveFile = async (path: string, newPath: string) => {
			return inboxFileSystem.moveFile(path, newPath);
		};
		inboxService.setTriageTargetFolder(settingsService.getSettings().inboxTriageTargetFolder ?? "");
		await timing.timedServiceLoad("inboxService", () => inboxService.load());
		return inboxService;
	});
}

/**
 * Loads ingestion, event definition, and data exchange services.
 */
export async function loadIngestionWave(
	deps: DomainLoaderDeps,
	timing: TimingTracker,
): Promise<{
	ingestionService: IngestionService;
	eventDefinitionService: EventDefinitionService;
	dataExchangeService: DataExchangeService;
}> {
	return timing.trackSeg("04.wave.ingestion-eventdef-dataexchange", async () => {
		const [ingestionService, eventDefinitionService, dataExchangeService] = await Promise.all([
			deps.services.get<IngestionService>("ingestionService"),
			deps.services.get<EventDefinitionService>("eventDefinitionService"),
			deps.services.get<DataExchangeService>("dataExchangeService"),
		]);
		await timing.timedServiceLoadsParallel([
			{ name: "ingestionService", fn: () => ingestionService.load() },
			{ name: "eventDefinitionService", fn: () => eventDefinitionService.load() },
			{ name: "dataExchangeService", fn: () => dataExchangeService.load() },
		]);
		return { ingestionService, eventDefinitionService, dataExchangeService };
	});
}

/**
 * Loads session service.
 */
export async function loadSessionService(
	deps: DomainLoaderDeps,
	timing: TimingTracker,
	settingsService: ISettingsService,
): Promise<SessionService> {
	return timing.trackSeg("05.session", async () => {
		const sessionService = await deps.services.get<SessionService>("sessionService");
		sessionService.globalActivityFilter = settingsService.getSettings().sessionActivityFilterGlobal ?? [];
		await timing.timedServiceLoad("sessionService", () => sessionService.load());
		return sessionService;
	});
}

/**
 * Loads nudge and signal services.
 */
export async function loadNudgeSignalWave(
	deps: DomainLoaderDeps,
	timing: TimingTracker,
	sessionService: SessionService,
	inboxService: InboxService,
): Promise<{ nudgeService: NudgeService; signalService: SignalService; listeners: (() => void)[] }> {
	const listeners: (() => void)[] = [];

	const result = await timing.trackSeg("06.wave.nudge-signal", async () => {
		const [nudgeService, signalService] = await Promise.all([
			deps.services.get<NudgeService>("nudgeService"),
			deps.services.get<SignalService>("signalService"),
		]);
		nudgeService.isSessionTypeActive = (type) =>
			sessionService.getActiveSession()?.type === type;
		nudgeService.getInboxCount = () =>
			inboxService.getItems().length ?? 0;
		await timing.timedServiceLoadsParallel([
			{ name: "nudgeService", fn: () => nudgeService.load() },
			{ name: "signalService", fn: () => signalService.load() },
		]);
		nudgeService.start();
		return { nudgeService, signalService };
	});

	listeners.push(
		deps.eventBus.on("nudge.triggered", (event) => {
			showNudgeNotification(event.payload.config, deps.eventBus, deps.noticeService, event.payload.inboxItemCount);
		}),
	);

	return { ...result, listeners };
}

/**
 * Sets up the train domain: service, canvas sync, event subscriptions.
 */
export async function loadTrainDomain(
	deps: DomainLoaderDeps,
	timing: TimingTracker,
	settingsService: ISettingsService,
	sessionService: SessionService,
): Promise<{
	trainService: TrainService;
	captureService: CaptureService;
	canvasService: CanvasService;
	canvasSessionService: CanvasSessionService;
	trainCanvasSync: TrainCanvasSyncService;
	trainSetup: TrainSetup;
	listeners: (() => void)[];
}> {
	return timing.trackSeg("07.trainSetup", async () => {
		const trainSetup = new TrainSetup({
			app: deps.app,
			eventBus: deps.eventBus,
			services: deps.services,
			settingsService,
			sessionService,
			noticeService: deps.noticeService,
			modalService: deps.modalService,
		});
		const trainResult = await trainSetup.setup(
			(name, loadFn) => timing.timedServiceLoad(name, loadFn),
		);
		return {
			trainService: trainResult.trainService,
			captureService: trainResult.captureService,
			canvasService: trainResult.canvasService,
			canvasSessionService: trainResult.canvasSessionService,
			trainCanvasSync: trainResult.trainCanvasSync,
			trainSetup,
			listeners: trainResult.unsubscribes,
		};
	});
}

/**
 * Loads analytics and onboarding services.
 */
export async function loadAnalyticsOnboarding(
	deps: DomainLoaderDeps,
	timing: TimingTracker,
): Promise<{ analyticsService: AnalyticsService; onboardingService: OnboardingService }> {
	return timing.trackSeg("08.wave.analytics-onboarding", async () => {
		const [analyticsService, onboardingService] = await Promise.all([
			deps.services.get<AnalyticsService>("analyticsService"),
			deps.services.get<OnboardingService>("onboardingService"),
		]);
		await timing.timedServiceLoadsParallel([
			{ name: "analyticsService", fn: () => analyticsService.load() },
			{ name: "onboardingService", fn: () => onboardingService.load() },
		]);
		return { analyticsService, onboardingService };
	});
}

/**
 * Wires analytics service with CSV reader and folder listing.
 */
export async function wireAnalytics(
	deps: DomainLoaderDeps,
	timing: TimingTracker,
	analyticsService: AnalyticsService,
	dataExchangeService: DataExchangeService,
	settingsService: ISettingsService,
): Promise<void> {
	await timing.trackSeg("09.analytics-wiring", async () => {
		analyticsService.setReadCsv(async (csvPath: string) => {
			const file = deps.app.vault.getAbstractFileByPath(csvPath);
			if (!file || !(file instanceof TFile)) return null;
			const content = await deps.app.vault.read(file);
			const { CsvParser } = await import("../domain/dataExchange/CsvParser.js");
			return new CsvParser().parse(content);
		});
		analyticsService.setAnalyticsFolder(settingsService.getSettings().analyticsFolder);

		const { BaseAnalyticsAdapter } = await import("../domain/analytics/BaseAnalyticsAdapter.js");
		const exportSvc = dataExchangeService.getExportService();
		analyticsService.setBaseAdapter(new BaseAnalyticsAdapter({
			scanColumns: (path, viewIndex) => exportSvc.scanResolvedColumns(path, viewIndex),
			resolveFiles: (path, sourceType, viewIndex) => exportSvc.resolveExportFiles(path, sourceType, viewIndex),
		}));

		analyticsService.setListFolder(async (folderPath: string) => {
			const folder = deps.app.vault.getAbstractFileByPath(folderPath);
			if (!folder || !(folder instanceof TFolder)) return [];
			return folder.children
				.filter((f): f is TFile => f instanceof TFile)
				.map((f) => f.path);
		});
	});
}


