/**
 * Domain loader handlers — leaf-handler registration, quality hub loading,
 * and process/journey setup extracted from domain-loader.ts.
 */

import type { DomainLoaderDeps, TimingTracker } from "./domain-loader.js";
import type { ISettingsService } from "../domain/settings/types.js";
import type { TrainService } from "../domain/train/TrainService.js";
import type { CanvasService } from "../domain/canvas/CanvasService.js";
import type { DataExchangeService } from "../domain/dataExchange/DataExchangeService.js";
import type { SessionService } from "../domain/session/SessionService.js";
import type { OnboardingService } from "../domain/onboarding/OnboardingService.js";
import type { TestManagementService } from "../domain/testManagement/TestManagementService.js";
import type { FeatureLifecycleService } from "../domain/featureLifecycle/FeatureLifecycleService.js";
import type { ProcessService } from "../domain/process/ProcessService.js";
import type { JourneyBuilderService } from "../domain/journeyBuilder/JourneyBuilderService.js";
import type { JourneyExecutorService } from "../domain/journeyExecutor/JourneyExecutorService.js";
import type { AnalyticsService } from "../domain/analytics/AnalyticsService.js";
import type { TrainSetup } from "./trainSetup.js";
import { registerTrainMainHandler } from "../infrastructure/handlers/leaf-handlers/train-main-handler.js";
import { registerTrainTimelineHandler } from "../infrastructure/handlers/leaf-handlers/train-timeline-handler.js";
import { registerCanvasImportHandler } from "../infrastructure/handlers/leaf-handlers/canvas-import-handler.js";
import { registerExportHandler } from "../infrastructure/handlers/leaf-handlers/export-handler.js";
import { registerSessionWorkspaceHandler } from "../infrastructure/handlers/leaf-handlers/session-workspace-handler.js";
import { registerTestManagementHandlers, type TestManagementHandlerDeps } from "../infrastructure/handlers/test-management-handlers.js";
import { seedSupplierDashboard } from "../domain/installer/seedDashboard.js";
import { setupJourneyDomain } from "./journeySetup.js";
import {
	wireTestManagementScanners, wireFeatureLifecycleScanner,
	wireProcessScanner, wireSessionAutoOpen,
} from "./domain-loader-wiring.js";

/**
 * Registers leaf handlers for train, export, session workspace views.
 */
export async function registerLeafHandlers(
	deps: DomainLoaderDeps,
	timing: TimingTracker,
	settingsService: ISettingsService,
	trainService: TrainService,
	canvasService: CanvasService,
	dataExchangeService: DataExchangeService,
	sessionService: SessionService,
): Promise<void> {
	await timing.trackSeg("10.leaf-handlers.train-export-session", async () => {
		registerTrainMainHandler(deps.handlerRegistry, {
			trainService,
			eventBus: deps.eventBus,
			app: deps.app,
			getTrainSettings: () => ({
				trainFolder: settingsService.getSettings().trainFolder,
				trainCanvasEnabled: settingsService.getSettings().trainCanvasEnabled,
				trainCanvasAutoOpen: settingsService.getSettings().trainCanvasAutoOpen,
			}),
			closureDeps: {
				getSession: (sessionId) => sessionService.getSessionById(sessionId) ?? null,
				completeClosure: (sessionId, response) => {
					void sessionService.completeClosure(sessionId, response);
				},
				skipClosure: (sessionId) => {
					void sessionService.skipClosure(sessionId);
				},
			},
		});

		registerTrainTimelineHandler(deps.handlerRegistry, {
			trainService,
			eventBus: deps.eventBus,
			app: { vault: { getAbstractFileByPath: (path: string) => deps.app.vault.getAbstractFileByPath(path) } },
			getTrainSettings: () => ({
				trainFolder: settingsService.getSettings().trainFolder,
				trainCanvasEnabled: settingsService.getSettings().trainCanvasEnabled,
				trainCanvasAutoOpen: settingsService.getSettings().trainCanvasAutoOpen,
			}),
		});

		registerCanvasImportHandler(deps.handlerRegistry, {
			canvasService,
			eventBus: deps.eventBus,
			app: deps.app,
		});

		registerExportHandler(deps.handlerRegistry, {
			dataExchangeService,
			eventBus: deps.eventBus,
			app: deps.app,
			getConfig: () => null,
		});

		registerSessionWorkspaceHandler(deps.handlerRegistry, {
			sessionService,
			eventBus: deps.eventBus,
			app: deps.app,
			trainService,
		});
	});
}

/**
 * Loads test management and feature lifecycle services.
 */
export async function loadQualityHubs(
	deps: DomainLoaderDeps,
	timing: TimingTracker,
	settingsService: ISettingsService,
	onboardingService: OnboardingService,
): Promise<{ testManagementService: TestManagementService; featureLifecycleService: FeatureLifecycleService; listeners: (() => void)[] }> {
	const listeners: (() => void)[] = [];

	const result = await timing.trackSeg("11.quality-hubs.testMgmt-featureLifecycle", async () => {
		const [testManagementService, featureLifecycleService] = await Promise.all([
			deps.services.get<TestManagementService>("testManagementService"),
			deps.services.get<FeatureLifecycleService>("featureLifecycleService"),
		]);

		wireTestManagementScanners(deps, testManagementService, settingsService);
		wireFeatureLifecycleScanner(deps, featureLifecycleService, settingsService);

		await timing.timedServiceLoadsParallel([
			{ name: "testManagementService", fn: () => testManagementService.load() },
			{ name: "featureLifecycleService", fn: () => featureLifecycleService.load() },
		]);

		if (deps.handlerRegistry) {
			registerTestManagementHandlers(deps.handlerRegistry, {
				service: testManagementService as unknown as TestManagementHandlerDeps["service"],
				onboardingService: { shouldShowCallout: (id: string) => !(onboardingService.isCalloutDismissed(id)) },
				getSettings: () => ({ docsRootPath: settingsService.getSettings().docsRootPath }),
				eventBus: deps.eventBus,
			});
		}

		return { testManagementService, featureLifecycleService };
	});

	return { ...result, listeners };
}

/**
 * Loads process service and sets up journey domain.
 */
export async function loadProcessAndJourney(
	deps: DomainLoaderDeps,
	timing: TimingTracker,
	settingsService: ISettingsService,
	sessionService: SessionService,
	trainService: TrainService,
	trainSetup: TrainSetup,
	analyticsService: AnalyticsService,
	onboardingService: OnboardingService,
	testManagementService: TestManagementService,
): Promise<{
	processService: ProcessService;
	journeyBuilderService: JourneyBuilderService;
	journeyExecutorService: JourneyExecutorService;
	listeners: (() => void)[];
}> {
	return timing.trackSeg("12.process-journey-sessionUi", async () => {
		const processService = await deps.services.get<ProcessService>("processService");
		wireProcessScanner(deps, processService, settingsService);
		void processService.scanProcesses().then((processResults) => {
			if (processResults.length > 0) {
				void deps.eventBus.emit("notice.show", { message: `Found ${processResults.length} process definition${processResults.length === 1 ? "" : "s"}` });
			}
		});
		deps.addCommand({
			id: "flowti:scan-processes",
			name: "Scan process definitions",
			icon: "waypoints",
			callback: () => {
				void (async () => {
					const results = await processService.scanProcesses();
					void deps.eventBus.emit("notice.show", { message: `Scanned ${results.length} process definition${results.length === 1 ? "" : "s"}` });
				})();
			},
		});

		const processFolder = settingsService.getSettings().processesFolder;
		const isProcessFile = (path: string) =>
			path.startsWith(processFolder + "/") && path.endsWith(".process.canvas");
		const rescanProcesses = () => { void processService.scanProcesses(); };
		const listeners: (() => void)[] = [
			deps.eventBus.on("file.created", (e) => { if (isProcessFile(e.payload.path)) rescanProcesses(); }),
			deps.eventBus.on("file.modified", (e) => { if (isProcessFile(e.payload.path)) rescanProcesses(); }),
			deps.eventBus.on("file.deleted", (e) => { if (isProcessFile(e.payload.path)) rescanProcesses(); }),
			deps.eventBus.on("file.renamed", (e) => {
				if (isProcessFile(e.payload.oldPath) || isProcessFile(e.payload.newPath)) rescanProcesses();
			}),
		];

		const journeyResult = setupJourneyDomain({
			app: deps.app,
			eventBus: deps.eventBus,
			settingsService,
			commands: deps.commands,
			handlerRegistry: deps.handlerRegistry,
			testManagementService,
			toolHost: deps.toolHost,
			registerExtensions: (exts, type) => deps.registerExtensions(exts, type),
		});
		listeners.push(...journeyResult.unsubscribes);

		listeners.push(
			deps.eventBus.on("installer.completed", (event) => {
				if (analyticsService && event.payload.includeSampleContent !== false) {
					void seedSupplierDashboard(analyticsService).then(() =>
						onboardingService.initChecklist(),
					);
				} else {
					void onboardingService.initChecklist();
				}
			}),
		);

		wireSessionAutoOpen(deps, sessionService, trainSetup, listeners);

		return {
			processService,
			journeyBuilderService: journeyResult.journeyBuilderService,
			journeyExecutorService: journeyResult.journeyExecutorService,
			listeners,
		};
	});
}
