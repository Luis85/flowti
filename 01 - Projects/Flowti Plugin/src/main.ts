import { Plugin, TFile, TFolder, type ViewCreator } from "obsidian";
import { registerCommands } from "./infrastructure/commands/registry";
import type { CommandContext, ICommandRegistry } from "./infrastructure/commands/types";
import { LifecycleError } from "./infrastructure/errors/FlowtiError";
import type { IErrorService } from "./infrastructure/errors/types";
import type { IEventBridge, IEventBus } from "./infrastructure/events/types";
import type { ILogger } from "./infrastructure/logger/types";
import { registerServices } from "./infrastructure/services/registry";
import type { IServiceContainer } from "./infrastructure/services/types";
import { FlowtiSettingTab } from "./ui/settings/FlowtiSettingTab";
import {
	DEFAULT_SETTINGS,
	FlowtiSettings,
	FlowtiSettingsSchema,
} from "./domain/settings/settings";
import type { IInstallerService } from "./domain/installer/types";
import { InstallerWizardModal } from "./ui/installer/InstallerWizardModal";
import type { ISettingsService } from "./domain/settings/types";
import type { IUserService } from "./domain/user/types";
import type { EventNotificationService } from "./domain/eventNotify/EventNotificationService";
import type { EventFilterService } from "./domain/eventFilter/EventFilterService";
import type { DiscoveryService } from "./domain/discovery/DiscoveryService";
import type { SubscriptionService } from "./domain/subscription/SubscriptionService";
import type { EventDefinitionService } from "./domain/eventDefinition/EventDefinitionService";
import type { InboxService } from "./domain/inbox/InboxService";
import { FileSystemClient } from "./infrastructure/filesystem/FileSystemClient";
import type { NudgeService } from "./domain/nudge/NudgeService";
import type { SessionService } from "./domain/session/SessionService";
import type { SignalService } from "./domain/signal/SignalService";
import type { IngestionService } from "./domain/ingestion/IngestionService";
import type { CaptureService } from "./domain/capture/CaptureService";
import type { TrainService } from "./domain/train/TrainService";
import type { CanvasService } from "./domain/canvas/CanvasService";
import type { AnalyticsService } from "./domain/analytics/AnalyticsService";
import type { OnboardingService } from "./domain/onboarding/OnboardingService";
import { PerfAggregator } from "./infrastructure/services/PerfAggregator";
import { TypedStorage } from "./utils/TypedStorage";
import type { PerfState } from "./infrastructure/services/perfTypes";
import { seedSupplierDashboard } from "./domain/installer/seedDashboard";
import { registerViews } from "./infrastructure/views/registry";
import type { IViewRegistry } from "./infrastructure/views/types";
import { IngestionStatusBar } from "./ui/shared/IngestionStatusBar";
import { DataExchangeService } from "./domain/dataExchange/DataExchangeService";
import { DataExchangeSetup } from "./bootstrap/dataExchangeSetup";
import { SessionSetup } from "./bootstrap/sessionSetup";
import { TrainSetup } from "./bootstrap/trainSetup";
import { UiCommandService } from "./infrastructure/ui/UiCommandService";
import { createInfrastructure, setupCrossCuttingListeners } from "./bootstrap/pluginBootstrap";
import { createSecretStore } from "./utils/SecretStore";
import { HubRegistry } from "./domain/hub/HubRegistry";
import { EventCatalogProvider } from "./domain/hub/EventCatalogProvider";
import { DataExchangeProvider } from "./domain/hub/DataExchangeProvider";
import { AnalyticsHubProvider } from "./domain/hub/AnalyticsHubProvider";
import { UserHubProvider } from "./domain/hub/UserHubProvider";
import { TrainHubProvider } from "./domain/hub/TrainHubProvider";
import { registerUserHandlers } from "./infrastructure/handlers/user-handlers";
import { SessionWorkspaceView, VIEW_TYPE_SESSION_WORKSPACE } from "./ui/session/SessionWorkspaceView";
import type { CanvasSessionService } from "./domain/canvas/session/CanvasSessionService";
import type { JourneyBuilderService } from "./domain/journeyBuilder/JourneyBuilderService";
import type { TestManagementService } from "./domain/testManagement/TestManagementService";
import type { FeatureLifecycleService } from "./domain/featureLifecycle/FeatureLifecycleService";
import type { ProcessService } from "./domain/process/ProcessService";
import type { JourneyExecutorService } from "./domain/journeyExecutor/JourneyExecutorService";
import type { ToolHost } from "./domain/journeyExecutor/types";
import { setupJourneyDomain } from "./bootstrap/journeySetup";
import { BaseHubView, type IViewStateStore } from "./ui/BaseHubView";
import { TestManagementHubProvider } from "./domain/hub/TestManagementHubProvider";
import { FeatureLifecycleProvider } from "./domain/hub/FeatureLifecycleProvider";
import { showNudgeNotification } from "./ui/shared/NudgeNotification";
import { openStartPage } from "./infrastructure/StartpageHandler";
import { NoticeService } from "./infrastructure/ui/NoticeService";
import { ModalService } from "./infrastructure/ui/ModalService";
import { SitemapBootstrap } from "./infrastructure/sitemap/sitemap-bootstrap";
import { PluginHandlerRegistry } from "./infrastructure/handlers/plugin-handler-registry";
import { ConditionEvaluator } from "./infrastructure/handlers/condition-evaluator";
import { registerConditionHandlers } from "./infrastructure/handlers/condition-handlers";
import { registerActionHandlers } from "./infrastructure/handlers/action-handlers";
import { registerTestManagementHandlers, type TestManagementHandlerDeps } from "./infrastructure/handlers/test-management-handlers";
import { registerTrainHandlers } from "./infrastructure/handlers/train-handlers";
import { registerCatalogHandlers } from "./infrastructure/handlers/catalog-handlers";
import { EVENT_CATALOG, type EventCatalogEntry } from "./infrastructure/events/catalog";
import { registerDataExchangeHandlers } from "./infrastructure/handlers/data-exchange-handlers";
import { registerAnalyticsHandlers } from "./infrastructure/handlers/analytics-handlers";
import { registerTrainTimelineHandler } from "./infrastructure/handlers/leaf-handlers/train-timeline-handler";
import { registerTrainMainHandler } from "./infrastructure/handlers/leaf-handlers/train-main-handler";
import { registerCanvasImportHandler } from "./infrastructure/handlers/leaf-handlers/canvas-import-handler";
import { registerExportHandler } from "./infrastructure/handlers/leaf-handlers/export-handler";
import { registerSessionWorkspaceHandler } from "./infrastructure/handlers/leaf-handlers/session-workspace-handler";
import type { PluginSitemap } from "./domain/sitemap/plugin-sitemap-types";
import pluginSitemap from "../configs/sitemap.json";
import type { TrainCanvasSyncService } from "./domain/train/TrainCanvasSyncService";
import { setupAgentDomain, type AgentSetupResult } from "./bootstrap/agent-setup";
import { VIEW_TYPE_AGENT_SIDEBAR, VIEW_TYPE_AGENT_WORLD } from "./ui/agents/types";
import { setupProjectDomain, type ProjectSetupResult } from "./bootstrap/project-setup";
import { VIEW_TYPE_PROJECT_DETAIL } from "./ui/projects/types";


/**  
 * Main plugin class for Flowti - Integrated Business Development Environment.
 *
 * Acts as the orchestrator for the plugin lifecycle. All domain logic lives in
 * dedicated services that communicate through the {@link IEventBus}. The plugin
 * itself only wires things together and manages the startup/shutdown sequence.
 *
 * **Initialization phases** (see {@link onload}):
 *
 * | Phase | What happens |
 * |-------|-------------|
 * | 1 - Core | Settings, EventBus, Logger, ErrorService, EventBridge (request handlers only) |
 * | 2 - Containers | ServiceContainer, CommandRegistry, ViewRegistry |
 * | 3 - Registration | Services, commands, and views are registered |
 * | 4 - Init | All services are initialized in dependency order |
 * | 5 - UI | Settings tab, views, and commands are bound to Obsidian |
 * | 6 - Post-load | Vault listeners registered, user data loaded, plugin.ready emitted |
 *
 * **Key architectural decisions:**
 * - The {@link IEventBridge} owns all Obsidian API ↔ EventBus translation
 *   (file operations, frontmatter, vault change notifications).
 *   This keeps services decoupled from Obsidian and fully testable.
 * - Cross-cutting event listeners (logging, debug mode sync) live in
 *   {@link setupCrossCuttingListeners} because they span multiple domains.
 * - Shutdown order is the reverse of startup: EventBridge → Services →
 *   Commands → Views → EventBus.
 *
 * @see {@link IEventBridge} for Obsidian API bridging
 * @see {@link IServiceContainer} for dependency injection
 * @see {@link ICommandRegistry} for command middleware pipeline
 */
export default class FlowtiBasePlugin extends Plugin {
	settings!: FlowtiSettings;
	eventBus!: IEventBus;
	eventBridge!: IEventBridge;
	logger!: ILogger;
	errorService!: IErrorService;
	services!: IServiceContainer;
	commands!: ICommandRegistry;
	views!: IViewRegistry;

	// Service references (populated in onLayoutReady)
	userService!: IUserService;
	private eventFilterService?: EventFilterService;
	private eventNotifyService?: EventNotificationService;
	private discoveryService?: DiscoveryService;
	private subscriptionService?: SubscriptionService;
	private inboxService?: InboxService;
	private ingestionService?: IngestionService;
	private eventDefinitionService?: EventDefinitionService;
	private dataExchangeService?: DataExchangeService;
	private sessionService?: SessionService;
	private nudgeService?: NudgeService;
	private signalService?: SignalService;
	private captureService?: CaptureService;
	private trainService?: TrainService;
	private canvasService?: CanvasService;
	private canvasSessionService?: CanvasSessionService;
	private journeyBuilderService?: JourneyBuilderService;
	private analyticsService?: AnalyticsService;
	private testManagementService?: TestManagementService;
	private featureLifecycleService?: FeatureLifecycleService;
	private processService?: ProcessService;
	private journeyExecutorService?: JourneyExecutorService;
	private onboardingService?: OnboardingService;
	private viewStateMap = new Map<string, string>();
	private perfAggregator?: PerfAggregator;
	private ingestionStatusBar?: IngestionStatusBar;
	private collapsedCategories = new Set<string>();
	private uiCommandService?: UiCommandService;
	private hubRegistry?: HubRegistry;
	private sessionSetup?: SessionSetup;
	private trainSetup?: TrainSetup;
	private trainCanvasSync?: TrainCanvasSyncService;
	private crossCuttingListeners: (() => void)[] = [];
	private pendingSettingsWarning?: unknown[];
	private noticeService?: NoticeService;
	private modalService?: ModalService;
	private handlerRegistry?: PluginHandlerRegistry;
	private installerServiceRef?: IInstallerService;
	private agentSetup?: AgentSetupResult;
	private projectSetup?: ProjectSetupResult;

	async onload() {
		try {
			// ── Phase 1-2: Core infrastructure + Containers ─────────
			await this.loadSettings();

			const infra = createInfrastructure({
				app: this.app,
				settings: this.settings,
				registerEvent: (ref) => this.registerEvent(ref),
			});
			this.eventBus = infra.eventBus;
			this.logger = infra.logger;
			this.errorService = infra.errorService;

			// Re-emit any settings warning captured before logger existed (TD-114).
			if (this.pendingSettingsWarning) {
				this.logger.warn("Invalid settings, using defaults", {
					errors: this.pendingSettingsWarning,
				});
				this.pendingSettingsWarning = undefined;
			}
			this.eventBridge = infra.eventBridge;
			this.services = infra.services;
			this.commands = infra.commands;
			this.views = infra.views;

			void this.eventBus.emit("plugin.loading", {
				timestamp: new Date().toISOString(),
			});

			// NoticeService — centralizes all notice creation
			this.noticeService = new NoticeService({ eventBus: this.eventBus });

			// ModalService — centralizes all modal lifecycle
			this.modalService = new ModalService({
				app: this.app,
				eventBus: this.eventBus,
				noticeService: this.noticeService,
				getSettings: () => this.settings,
			});

			this.crossCuttingListeners = setupCrossCuttingListeners({
				eventBus: this.eventBus,
				logger: this.logger,
				onSettingsChanged: (s) => {
					this.settings = s;
					this.collapsedCategories = new Set(s.collapsedCategories);
				},
			});

			void this.eventBus.emit("settings.loaded", { settings: this.settings });

			// ── Phase 3: Registration ─────────────────────────────────
			this.registerAllServices();
			this.registerAllCommands();
			this.registerAllViews();

			// ── Phase 4: Service initialization ───────────────────────
			// Resolves dependency graph and initializes in topological order.
			await this.services.initializeAll();

			// ── Phase 5: UI binding ───────────────────────────────────
			this.addSettingTab(new FlowtiSettingTab(this.app, this, {
				eventBus: this.eventBus,
				getSettings: () => this.settings,
				saveSettings: () => this.saveSettings(),
				getInstallerService: () => this.services.get<IInstallerService>("installerService"),
				getAnalyticsService: () => this.analyticsService,
				getOnboardingService: () => this.onboardingService,
			}));
			BaseHubView.setViewStateStore(this.getViewStateStore());

			// ── SitemapBootstrap — single-path registration for views, commands, ribbon ──
			{
				// Create handler registry and register all handlers
				const handlerRegistry = new PluginHandlerRegistry();
				registerActionHandlers(handlerRegistry, {
					trainService: { getActiveTrain: () => this.trainService?.getActiveTrain() ?? null },
				});
				registerConditionHandlers(handlerRegistry, {
					trainService: { getActiveTrain: () => this.trainService?.getActiveTrain() ?? null },
					sessionService: { getActiveSession: () => this.sessionService?.getActiveSession() ?? null },
					installerService: { isInstalled: () => this.installerServiceRef?.isInstalled() ?? false },
				});
				registerTrainHandlers(handlerRegistry, {
					trainService: {
						getAllTrains: () => this.trainService?.getAllTrains() ?? [],
						getActiveTrain: () => this.trainService?.getActiveTrain(),
					},
					onboardingService: {
						shouldShowCallout: (id: string) => !(this.onboardingService?.isCalloutDismissed(id) ?? false),
					},
					eventBus: this.eventBus,
					openTrainView: (trainId: string) => this.trainSetup?.revealOrCreateTrainView(trainId),
				});
				registerCatalogHandlers(handlerRegistry, {
					viewState: {
						getDiscoveredEvents: () => this.discoveryService?.getDiscoveredEvents() ?? [],
						getExcludedTypes: () => this.eventFilterService?.getExcludedTypes() ?? [],
						getNotifiedTypes: () => this.eventNotifyService?.getNotifiedTypes() ?? [],
						getDomainEntries: () => this.buildScannerEntities("domain"),
						getServiceEntries: () => this.buildScannerEntities("services"),
						getFlowEntries: () => [],
						getSystemEntries: () => [],
						getActorEntries: () => [],
						getCategories: () => this.settings.catalogCategories,
					},
					eventBus: this.eventBus,
				});
				registerDataExchangeHandlers(handlerRegistry, {
					dataExchangeService: {
						getSavedImportConfigs: () => this.dataExchangeService?.getSavedImportConfigs() ?? [],
						getSavedExportConfigs: () => this.dataExchangeService?.getSavedExportConfigs() ?? [],
						getSavedPipelines: () => this.dataExchangeService?.getSavedPipelines() ?? [],
						buildDataDictionary: () => this.dataExchangeService?.buildDataDictionary() ?? [],
						getPropertyDocPath: (name: string) => this.dataExchangeService?.getPropertyDocPath(name) ?? "",
						getTypesFolderPath: () => this.dataExchangeService?.getTypesFolderPath() ?? "",
						getReportsFolderPath: () => this.dataExchangeService?.getReportsFolderPath() ?? "",
					},
					signalService: this.signalService ? {
						getSignals: () => this.signalService!.getSignals(),
						syncAll: () => this.signalService!.syncAll(),
					} : null,
					canvasService: this.canvasService ? {
						getConfigs: () => this.canvasService!.getConfigs(),
					} : null,
					operationTracker: {
						getActiveOperations: () => [],
					},
					eventBus: this.eventBus,
				});

				registerAnalyticsHandlers(handlerRegistry, {
					analyticsService: {
						listQueries: () => this.analyticsService?.listQueries() ?? [],
						listDashboards: () => this.analyticsService?.listDashboards() ?? [],
						listMeasurements: () => this.analyticsService?.listMeasurements() ?? [],
						getQuery: (id: string) => this.analyticsService?.getQuery(id) ?? null,
						getDashboardQueryMap: (id: string) => this.analyticsService?.getDashboardQueryMap(id) ?? new Map(),
						getDefaultDashboard: () => this.analyticsService?.getDefaultDashboard() ?? null,
						runSavedQuery: (id: string) => this.analyticsService?.runSavedQuery(id),
					},
					tileResultCache: {
						tryRun: () => ({ result: null, error: null }),
						getTimestamp: () => undefined,
						clear: () => {},
						clearByQueryId: () => {},
					},
					onboardingService: {
						isCalloutDismissed: (id: string) => this.onboardingService?.isCalloutDismissed(id) ?? false,
						dismissCallout: (id: string) => void this.onboardingService?.markCalloutDismissed(id),
						shouldShowCallout: (id: string) => !(this.onboardingService?.isCalloutDismissed(id) ?? false),
					},
					eventBus: this.eventBus,
				});

				registerUserHandlers(handlerRegistry, {
					userService: {
						getUser: () => this.userService?.getUser() ?? null,
					},
					hubRegistry: {
						getAll: () => this.hubRegistry?.getAll() ?? [],
						openHub: (hubId: string, tabId?: string, detail?: string) => void this.hubRegistry?.openHub(hubId, tabId, detail),
					},
					inboxService: {
						getItems: () => this.inboxService?.getItems() ?? [],
						getUnreadCount: () => this.inboxService?.getUnreadCount() ?? 0,
						markRead: (id: string) => void this.inboxService?.markRead(id),
						dismiss: (id: string) => void this.inboxService?.dismiss(id),
					},
					sessionService: {
						getSessions: () => this.sessionService?.getSessions() ?? [],
						getActiveSession: () => this.sessionService?.getActiveSession() ?? null,
					},
					nudgeService: {
						getConfigs: () => this.nudgeService?.getConfigs() ?? [],
						isDismissedToday: (id: string) => this.nudgeService?.isDismissedToday(id) ?? false,
					},
					onboardingService: {
						shouldShowCallout: (id: string) => !(this.onboardingService?.isCalloutDismissed(id) ?? false),
					},
					trainService: {
						getAllTrains: () => this.trainService?.getAllTrains() ?? [],
						getActiveTrain: () => this.trainService?.getActiveTrain(),
					},
					commandRegistry: {
						getCommandsMeta: () => this.commands?.getCommandsMeta() ?? [],
					},
					settingsProvider: {
						getSettings: () => this.settings,
					},
					eventBus: this.eventBus,
				});

				const conditionEvaluator = new ConditionEvaluator(handlerRegistry);

				// Store registry for later handler registration (test-management in onLayoutReady)
				this.handlerRegistry = handlerRegistry;

				const bootstrap = new SitemapBootstrap(pluginSitemap as PluginSitemap, {
					plugin: this,
					eventBus: this.eventBus,
					logger: this.logger,
					handlerRegistry,
					conditionEvaluator,
				});
				bootstrap.registerAll();
				bootstrap.validate();
			}

			// ── Agent domain — view, command, ribbon ──
			this.agentSetup = setupAgentDomain({
				plugin: this,
				app: this.app,
				eventBus: this.eventBus,
			});

			this.addRibbonIcon("bot", "Open agent panel", () => {
				this.activateAgentPanel();
			});

			// ── Project domain — view, command, ribbon ──
			this.projectSetup = setupProjectDomain({
				plugin: this,
				app: this.app,
				eventBus: this.eventBus,
			});

			this.addRibbonIcon("folder-open", "Open project hub", () => {
				this.activateProjectHub();
			});

			this.addRibbonIcon("globe", "Open agent world", () => {
				const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENT_WORLD);
				if (existing.length > 0) {
					void this.app.workspace.revealLeaf(existing[0]);
				} else {
					const leaf = this.app.workspace.getLeaf(true);
					void leaf.setViewState({ type: VIEW_TYPE_AGENT_WORLD, active: true });
				}
			});

			// Listen for execute requests from the Command Catalog UI
			{
				const ctx = this.createCommandContext();
				this.crossCuttingListeners.push(
					this.eventBus.on("command.execute.request", (event) => {
						void this.commands.execute(event.payload.commandId, ctx);
					}),
				);
			}

			// UI command service — central handler for all ui.* events
			this.uiCommandService = new UiCommandService({
				app: this.app,
				eventBus: this.eventBus,
			});
			this.uiCommandService.setModalService(this.modalService!);

			// Status bar
			const statusBarEl = this.addStatusBarItem();
			this.ingestionStatusBar = new IngestionStatusBar(statusBarEl, this.eventBus);
			this.ingestionStatusBar.register();

			// ── Phase 6: Post-load ────────────────────────────────────
			// Deferred until Obsidian's workspace layout is ready.
			this.app.workspace.onLayoutReady(() => {
				void this.onLayoutReady();
			});

			// Emit plugin.loaded event
			void this.eventBus.emit("plugin.loaded", {
				timestamp: new Date().toISOString(),
			});

			this.logger.info("Plugin loaded successfully");
		} catch (error) {
			const lifecycleError = new LifecycleError({
				code: "PLUGIN_LOAD_FAILED",
				message: "Failed to load Flowti plugin",
				severity: "critical",
				context: "FlowtiBasePlugin",
				cause: error instanceof Error ? error : undefined,
			});

			// Log to console since logger might not be initialized
			console.error("[Flowti] Plugin load failed:", error);

			// If error service is available, use it
			this.errorService?.handle(lifecycleError);

			throw lifecycleError;
		}
	}

	/**
	 * Teardown in reverse initialization order:
	 * EventBridge → Services → Commands → Views → EventBus.
	 *
	 * Each step uses optional chaining because a failure in {@link onload}
	 * may have left some properties uninitialized.
	 */
	async onunload() {
		const safeDispose = (name: string, fn: () => unknown): void => {
			try { fn(); } catch (err) {
				console.error(`[Flowti] Failed to dispose ${name}:`, err);
			}
		};

		safeDispose("plugin.unloading", () =>
			void this.eventBus?.emit("plugin.unloading", { timestamp: new Date().toISOString() }),
		);

		// Detach all Flowti view leaves to prevent stale views during hot-reload
		const viewTypes = [
			"flowti-event-catalog",
			"flowti-data-exchange-hub", "flowti-user-hub",
			"flowti-train-main", "flowti-train-timeline", "flowti-train-hub",
			"flowti-analytics-hub", "flowti-session-workspace",
			"flowti-csv", "flowti-export", "flowti-canvas-import",
			"flowti-journey-builder",
			VIEW_TYPE_AGENT_SIDEBAR,
			VIEW_TYPE_AGENT_WORLD,
			VIEW_TYPE_PROJECT_DETAIL,
		];
		for (const type of viewTypes) {
			safeDispose(`detach:${type}`, () => this.app.workspace.detachLeavesOfType(type));
		}
		safeDispose("cliExecutor", () => this.agentSetup?.cliExecutor.dispose());
		safeDispose("agentContext", () => this.agentSetup?.contextProvider.dispose());
		safeDispose("worldContext", () => this.agentSetup?.worldContext.dispose());
		safeDispose("trainCanvasSync", () => this.trainCanvasSync?.destroy());
		safeDispose("canvasSessionService", () => this.canvasSessionService?.dispose());
		safeDispose("journeyBuilderService", () => this.journeyBuilderService?.stop());
		safeDispose("canvasService", () => this.canvasService?.dispose());
		safeDispose("signalService", () => this.signalService?.dispose());
		safeDispose("nudgeService", () => this.nudgeService?.dispose());
		safeDispose("modalService", () => this.modalService?.dispose());
		safeDispose("noticeService", () => this.noticeService?.dispose());
		safeDispose("uiCommandService", () => this.uiCommandService?.dispose());
		safeDispose("ingestionStatusBar", () => this.ingestionStatusBar?.dispose());
		safeDispose("eventBridge", () => this.eventBridge?.dispose());
		safeDispose("services", () => void this.services?.disposeAll());
		safeDispose("hubRegistry", () => this.hubRegistry?.clear());
		safeDispose("commands", () => this.commands?.clear());
		safeDispose("views", () => this.views?.clear());

		// Unsubscribe cross-cutting listeners before clearing EventBus
		for (const unsub of this.crossCuttingListeners) {
			safeDispose("crossCuttingListener", unsub);
		}
		this.crossCuttingListeners = [];

		this.logger?.info("Plugin unloaded");

		safeDispose("plugin.unloaded", () =>
			void this.eventBus?.emit("plugin.unloaded", { timestamp: new Date().toISOString() }),
		);

		// EventBus is cleared last so that unloaded listeners still fire.
		safeDispose("eventBus", () => this.eventBus?.clear());
	}

	/**
	 * Loads settings from Obsidian's `loadData()` and validates them
	 * against {@link FlowtiSettingsSchema}. Falls back to
	 * {@link DEFAULT_SETTINGS} when validation fails (e.g. first run).
	 */
	async loadSettings(): Promise<void> {
		const data = await this.loadData();
		const result = FlowtiSettingsSchema.safeParse(data);

		if (!result.success) {
			// Console fallback — logger may not exist yet (TD-114).
			console.warn("[Flowti] Invalid settings, using defaults:", result.error.issues);
			this.pendingSettingsWarning = result.error.issues;
		}

		this.settings = result.success ? result.data : DEFAULT_SETTINGS;
		this.collapsedCategories = new Set(this.settings.collapsedCategories);
	}

	/**
	 * Persists settings via Obsidian's `saveData()` and emits
	 * `settings.changed` so that listeners (e.g. Logger debug mode)
	 * can react. Merges with existing stored data to preserve
	 * unrelated keys (e.g. user profile).
	 */
	async saveSettings(): Promise<void> {
		const existingData = ((await this.loadData()) as object) || {};
		await this.saveData({
			...existingData,
			...this.settings,
		});
		await this.eventBus.emit("settings.changed", { settings: this.settings });
	}

	/**
	 * Registers all services defined in {@link registerServices}.
	 *
	 * Bridges Obsidian's `loadData`/`saveData` into the storage abstraction
	 * so that services never depend on the Plugin class directly.
	 */
	private registerAllServices(): void {
		registerServices(this.services, {
			loadData: () => this.loadData(),
			saveData: (data) => this.saveData(data),
		}, createSecretStore(this.app));
	}

	/**
	 * Register plugin commands.
	 */
	private registerAllCommands(): void {
		registerCommands(this.commands);
	}

	/**
	 * Register plugin views.
	 */
	private registerAllViews(): void {
		registerViews(this.views, {
			eventBus: this.eventBus,
			state: {
				getSettings: () => this.settings,
				getExcludedTypes: () => this.eventFilterService?.getExcludedTypes() ?? [],
				getNotifiedTypes: () => this.eventNotifyService?.getNotifiedTypes() ?? [],
				getDiscoveredEvents: () => this.discoveryService?.getDiscoveredEvents() ?? [],
				collapsedCategories: this.collapsedCategories,
			},
			getOnboardingService: () => this.onboardingService!,
		});
	}

	/**
	 * Create command context with all dependencies.
	 */
	private createCommandContext(): CommandContext {
		return {
			app: this.app,
			eventBus: this.eventBus,
			logger: this.logger,
		};
	}

	/** Create a ToolHost implementation backed by the live Obsidian App. */
	private createToolHost(): ToolHost {
		const app = this.app;
		const eventBus = this.eventBus;
		return {
			executeCommand: (id) => (app as unknown as { commands: { executeCommandById: (id: string) => boolean } }).commands.executeCommandById(id),
			querySelector: (sel) => document.querySelector(sel),
			querySelectorAll: (sel) => document.querySelectorAll(sel),
			createFile: async (path, content) => { await app.vault.create(path, content); },
			deleteFile: async (path) => {
				const file = app.vault.getAbstractFileByPath(path);
				if (file) await app.fileManager.trashFile(file);
			},
			readFile: async (path) => {
				const file = app.vault.getAbstractFileByPath(path);
				if (!file) throw new Error(`File not found: ${path}`);
				return app.vault.read(file as import("obsidian").TFile);
			},
			moveFile: async (from, to) => {
				const file = app.vault.getAbstractFileByPath(from);
				if (file) await app.vault.rename(file, to);
			},
			copyFile: async (from, to) => {
				const file = app.vault.getAbstractFileByPath(from);
				if (file) await app.vault.copy(file as import("obsidian").TFile, to);
			},
			openFile: async (path) => { await app.workspace.openLinkText(path, "", false); },
			openUrl: (url) => { window.open(url); },
			showNotice: (msg, dur) => { void eventBus.emit("notice.show", { message: msg, duration: dur }); },
			setTheme: () => { /* theme switching deferred to Inc 8 */ },
			closeLeaves: (viewType) => { if (viewType) app.workspace.detachLeavesOfType(viewType); },
			closeModals: () => { document.querySelectorAll(".modal-container").forEach((el) => el.remove()); },
			clickRibbon: (label) => {
				const btn = document.querySelector(`[aria-label*="${label}"]`) as HTMLElement | null;
				btn?.click();
				return !!btn;
			},
			scrollTo: (sel, behavior, block) => {
				const el = document.querySelector(sel);
				if (!el) return false;
				el.scrollIntoView({ behavior: (behavior ?? "smooth") as ScrollBehavior, block: (block ?? "center") as ScrollLogicalPosition });
				return true;
			},
			getFrontmatter: (path) => {
				const file = app.vault.getAbstractFileByPath(path);
				if (!file) return undefined;
				return app.metadataCache.getFileCache(file as import("obsidian").TFile)?.frontmatter as Record<string, unknown> | undefined;
			},
			updateFrontmatter: async (path, data) => {
				void eventBus.emit("frontmatter.update.request", { requestId: `exec-${Date.now()}` as import("./infrastructure/events/events").RequestId, path, data });
			},
			getEventTrace: () => [],
			showSpinner: () => { /* wired in Inc 8 */ },
			hideSpinner: () => { /* wired in Inc 8 */ },
			writeRunLog: async (path, content) => {
				const existing = app.vault.getAbstractFileByPath(path);
				if (existing) {
					const prev = await app.vault.read(existing as import("obsidian").TFile);
					await app.vault.modify(existing as import("obsidian").TFile, prev + "\n" + content);
				} else {
					await app.vault.create(path, content);
				}
			},
			seed: async () => { /* seed logic deferred */ },
		};
	}

	/**
	 * Registers a view type, tolerating "already registered" errors
	 * that occur during dev hot-reload when Obsidian doesn't fully
	 * deregister view types from the previous load.
	 */
	private getViewStateStore(): IViewStateStore {
		return {
			get: (key) => this.viewStateMap.get(key),
			set: (key, value) => { this.viewStateMap.set(key, value); },
		};
	}

	/** Reveal existing agent panel leaf or create one in the right sidebar. */
	private activateAgentPanel(): void {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENT_SIDEBAR);
		if (existing.length > 0) {
			void this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) void leaf.setViewState({ type: VIEW_TYPE_AGENT_SIDEBAR, active: true });
	}

	/** Reveal existing project hub leaf or create one in the right sidebar. */
	private activateProjectHub(): void {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_PROJECT_DETAIL);
		if (existing.length > 0) {
			void this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) void leaf.setViewState({ type: VIEW_TYPE_PROJECT_DETAIL, active: true });
	}

	private safeRegisterView(type: string, factory: ViewCreator): void {
		try {
			this.registerView(type, factory);
		} catch (err) {
			if (err instanceof Error && err.message.includes("existing view type")) {
				this.logger?.debug(`View "${type}" already registered (hot-reload)`);
			} else {
				throw err;
			}
		}
	}

	/**
	 * Final initialization step, deferred until Obsidian's workspace
	 * layout is fully rendered.
	 *
	 * Loads all services first, then registers vault/workspace/metadata
	 * listeners via {@link EventBridge.registerVaultListeners} right
	 * before emitting `plugin.ready`. Registering vault listeners last
	 * avoids a flood of file/metadata events during Obsidian's initial
	 * cache resolution that would spam services before they're ready.
	 */
	private async onLayoutReady(): Promise<void> {
		// Set up performance aggregator before startup timing begins
		const perfStorage = new TypedStorage<PerfState>(
			{ load: () => this.loadData(), save: (d) => this.saveData(d) },
			"perfAggregator",
		);
		this.perfAggregator = new PerfAggregator(this.eventBus, perfStorage);
		this.perfAggregator.setup();
		await this.perfAggregator.load();
		this.register(() => this.perfAggregator?.destroy());

		const startupStart = performance.now();
		this.startupServiceCount = 0;
		this.startupServiceTimings = [];
		const startupPhases: Array<{ name: string; durationMs: number }> = [];
		const trackPhase = async (name: string, fn: () => Promise<void> | void): Promise<void> => {
			const start = performance.now();
			await fn();
			const durationMs = performance.now() - start;
			startupPhases.push({ name, durationMs });
			void this.eventBus.emit("perf.startup.phase", { phase: name, durationMs });
		};
		try {
			let settingsService: ISettingsService | undefined;
			await trackPhase("domain.services.load", async () => {
				settingsService = await this.loadDomainServices();
			});
			await trackPhase("hub.registry.setup", () => {
				this.setupHubRegistry();
			});
			await trackPhase("data.exchange.wire", () => {
				this.wireDataExchange(settingsService!);
			});

			await trackPhase("vault.listeners.register", () => {
				this.eventBridge.registerVaultListeners();
			});

			// Open configured startpage (if set)
			await trackPhase("startpage.open", () => {
				openStartPage(this.app.workspace, this.settings.startPage);
			});

			// Emit startup total timing + structured perf breakdown (for PerfAggregator, traces, UI)
			const totalDurationMs = performance.now() - startupStart;
			const topServices = [...this.startupServiceTimings]
				.sort((a, b) => b.durationMs - a.durationMs)
				.slice(0, 5);
			const topServiceSummary = topServices.length > 0
				? topServices
					.map((s) => `${s.name}=${Math.round(s.durationMs)}ms`)
					.join(", ")
				: "none";
			const dominantPhase = [...startupPhases].sort((a, b) => b.durationMs - a.durationMs)[0];
			const dominantPhasePct = dominantPhase
				? Math.round((dominantPhase.durationMs / totalDurationMs) * 100)
				: 0;
			const loadSeverity = totalDurationMs > 5000 ? "critical"
				: totalDurationMs > 2500 ? "high"
					: totalDurationMs > 1500 ? "medium"
						: "low";
			const phaseSummary = startupPhases
				.map((p) => `${p.name}=${Math.round(p.durationMs)}ms`)
				.join(", ");
			const segSorted = [...this.startupDomainSegments].sort((a, b) => b.durationMs - a.durationMs);
			const segSum = segSorted.reduce((s, x) => s + x.durationMs, 0);

			void this.eventBus.emit("perf.startup.total", {
				durationMs: totalDurationMs,
				serviceCount: this.startupServiceCount,
			});
			void this.eventBus.emit("perf.startup.breakdown", {
				totalMs: totalDurationMs,
				severity: loadSeverity,
				serviceCount: this.startupServiceCount,
				phases: startupPhases.map((p) => ({ phase: p.name, durationMs: p.durationMs })),
				segments: this.startupDomainSegments.map((s) => ({ segment: s.label, durationMs: s.durationMs })),
				segmentsWallClockSumMs: segSum,
				topServices: topServices.map((s) => ({ service: s.name, durationMs: s.durationMs })),
				dominantPhase: dominantPhase
					? { phase: dominantPhase.name, durationMs: dominantPhase.durationMs }
					: null,
			});

			void this.eventBus.emit("plugin.ready", {
				timestamp: new Date().toISOString(),
			});

			// Keep Obsidian startup responsive by running catch-up in background.
			void this.runIngestionCatchUp();
			const segTop = segSorted.slice(0, 8).map((x) => `${x.label}=${Math.round(x.durationMs)}ms`).join(", ");
			this.logger.info(`[StartupProfile] total=${Math.round(totalDurationMs)}ms severity=${loadSeverity} services=${this.startupServiceCount}${phaseSummary ? ` | phases: ${phaseSummary}` : ""}`);
			this.logger.info(`[StartupProfile] bottlenecks: dominant-phase: ${dominantPhase ? `${dominantPhase.name}=${Math.round(dominantPhase.durationMs)}ms (${dominantPhasePct}%)` : "n/a"} | longest-individual-service-loads (overlap when parallel — do not sum): ${topServiceSummary}`);
			this.logger.info(`[StartupProfile] domain.load.segments (wall-clock, sum=${Math.round(segSum)}ms): ${segTop || "none"}`);

			// Serverless mode — no server connection needed

		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.errorService.handle(err, "onLayoutReady");
			this.noticeService?.error(`Flowti startup error: ${err.message}`);
		}
	}

	/** Track service count for perf.startup.total */
	private startupServiceCount = 0;
	private startupServiceTimings: Array<{ name: string; durationMs: number }> = [];
	/** Wall-clock segments inside {@link loadDomainServices} (non-overlapping; sums to ~domain.services.load). */
	private startupDomainSegments: Array<{ label: string; durationMs: number }> = [];

	/** Load a service with performance timing. */
	private async timedServiceLoad(name: string, loadFn: () => Promise<void>): Promise<void> {
		const start = performance.now();
		await loadFn();
		this.startupServiceCount++;
		const durationMs = performance.now() - start;
		this.startupServiceTimings.push({ name, durationMs });
		void this.eventBus.emit("perf.startup.service", {
			service: name,
			durationMs,
		});
		this.logger.debug(`[StartupProfile] service ${name}=${Math.round(durationMs)}ms`);
	}

	/** Run multiple service loads in parallel (each still timed + counted). */
	private async timedServiceLoadsParallel(entries: readonly { name: string; fn: () => Promise<void> }[]): Promise<void> {
		await Promise.all(entries.map(({ name, fn }) => this.timedServiceLoad(name, fn)));
	}

	/**
	 * Loads all domain services in dependency order.
	 * SettingsService must load first so persisted state is restored
	 * before any event-driven updates arrive.
	 */
	private async loadDomainServices(): Promise<ISettingsService> {
		this.startupDomainSegments = [];
		const trackSeg = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
			const t0 = performance.now();
			try {
				return await fn();
			} finally {
				const durationMs = performance.now() - t0;
				this.startupDomainSegments.push({ label, durationMs });
				void this.eventBus.emit("perf.startup.segment", { segment: label, durationMs });
			}
		};

		const settingsService = await this.services.get<ISettingsService>("settingsService");
		await trackSeg("01.core.settings-user-installer", async () => {
			await this.timedServiceLoad("settingsService", () => settingsService.load());

			// User + installer only need persisted settings in memory; loads are independent TypedStorage reads — run in parallel.
			this.userService = await this.services.get<IUserService>("userService");
			const installerService = await this.services.get<IInstallerService>("installerService");
			await this.timedServiceLoadsParallel([
				{ name: "userService", fn: () => this.userService!.load() },
				{ name: "installerService", fn: () => installerService.load() },
			]);
			this.installerServiceRef = installerService;
			InstallerWizardModal.showIfNeeded(this.app, installerService, this.eventBus);

			// Register open-installer command — only available when not installed
			this.addCommand({
				id: "flowti:open-installer",
				name: "Open installer",
				icon: "download",
				checkCallback: (checking) => {
					if (installerService.isInstalled()) return false;
					if (!checking) {
						InstallerWizardModal.showIfNeeded(this.app, installerService, this.eventBus);
					}
					return true;
				},
			});
		});

		await trackSeg("02.wave.catalog-services", async () => {
		const [eventFilterService, eventNotifyService, discoveryService, subscriptionService] = await Promise.all([
			this.services.get<EventFilterService>("eventFilterService"),
			this.services.get<EventNotificationService>("eventNotifyService"),
			this.services.get<DiscoveryService>("discoveryService"),
			this.services.get<SubscriptionService>("subscriptionService"),
		]);
		this.eventFilterService = eventFilterService;
		this.eventNotifyService = eventNotifyService;
		this.discoveryService = discoveryService;
		this.subscriptionService = subscriptionService;
		await this.timedServiceLoadsParallel([
			{ name: "eventFilterService", fn: () => eventFilterService.load() },
			{ name: "eventNotifyService", fn: () => eventNotifyService.load() },
			{ name: "discoveryService", fn: () => discoveryService.load() },
			{ name: "subscriptionService", fn: () => subscriptionService.load() },
		]);
		});

		await trackSeg("03.inbox", async () => {
		this.inboxService = await this.services.get<InboxService>("inboxService");
		this.inboxService.setEnabledSources(settingsService.getSettings().inboxEnabledSources);
		this.inboxService.setWatchedFolders(settingsService.getSettings().inboxWatchedFolders ?? []);
		this.inboxService.getFrontmatter = (path: string) => {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) return undefined;
			return this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
		};
		const inboxFileSystem = new FileSystemClient({ eventBus: this.eventBus });
		this.inboxService.updateFileFrontmatter = async (path: string, data: Record<string, unknown>) => {
			await inboxFileSystem.updateFrontmatter(path, data);
		};
		this.inboxService.moveFile = async (path: string, newPath: string) => {
			return inboxFileSystem.moveFile(path, newPath);
		};
		this.inboxService.setTriageTargetFolder(settingsService.getSettings().inboxTriageTargetFolder ?? "");
		await this.timedServiceLoad("inboxService", () => this.inboxService!.load());
		});

		this.crossCuttingListeners.push(
			this.eventBus.on("settings.changed", (event) => {
				this.inboxService?.setEnabledSources(event.payload.settings.inboxEnabledSources);
				this.inboxService?.setWatchedFolders(event.payload.settings.inboxWatchedFolders ?? []);
				this.inboxService?.setTriageTargetFolder(event.payload.settings.inboxTriageTargetFolder ?? "");
				if (this.sessionService) {
					this.sessionService.globalActivityFilter = event.payload.settings.sessionActivityFilterGlobal ?? [];
				}
				this.analyticsService?.setAnalyticsFolder(event.payload.settings.analyticsFolder);
				// Sync custom output templates to all open workspace views
				const templates = event.payload.settings.customOutputTemplates ?? [];
				for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE)) {
					(leaf.view as SessionWorkspaceView).customOutputTemplates = templates;
				}
			}),
		);

		await trackSeg("04.wave.ingestion-eventdef-dataexchange", async () => {
		const [ingestionService, eventDefinitionService, dataExchangeService] = await Promise.all([
			this.services.get<IngestionService>("ingestionService"),
			this.services.get<EventDefinitionService>("eventDefinitionService"),
			this.services.get<DataExchangeService>("dataExchangeService"),
		]);
		this.ingestionService = ingestionService;
		this.eventDefinitionService = eventDefinitionService;
		this.dataExchangeService = dataExchangeService;
		await this.timedServiceLoadsParallel([
			{ name: "ingestionService", fn: () => ingestionService.load() },
			{ name: "eventDefinitionService", fn: () => eventDefinitionService.load() },
			{ name: "dataExchangeService", fn: () => dataExchangeService.load() },
		]);
		});

		await trackSeg("05.session", async () => {
		this.sessionService = await this.services.get<SessionService>("sessionService");
		this.sessionService.globalActivityFilter = settingsService.getSettings().sessionActivityFilterGlobal ?? [];
		await this.timedServiceLoad("sessionService", () => this.sessionService!.load());
		});

		// Write session summary to notes file on completion
		this.crossCuttingListeners.push(
			this.eventBus.on("session.completed", (event) => {
				void this.sessionSetup?.writeSessionSummary(event.payload.session);
			}),
		);

		// Auto-open session workspace when a new session is created
		this.crossCuttingListeners.push(
			this.eventBus.on("session.created", (event) => {
				this.sessionSetup?.openSessionWorkspaceInSidebar(event.payload.session.id);
			}),
		);

		// Auto-open session workspace when closure review starts (FR-14)
		// Only opens if no SessionWorkspaceView leaf is already displaying this session.
		this.crossCuttingListeners.push(
			this.eventBus.on("session.closure.started", (event) => {
				const sid = event.payload.sessionId;
				const alreadyVisible = this.app.workspace
					.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE)
					.some((l) => {
						const state = l.view.getState() as { sessionId?: string } | undefined;
						return state?.sessionId === sid;
					});
				if (!alreadyVisible) {
					this.sessionSetup?.openSessionWorkspaceInSidebar(sid);
				}
			}),
		);

		await trackSeg("06.wave.nudge-signal", async () => {
		// Nudge + Signal — independent persisted loads after session is ready
		const [nudgeService, signalService] = await Promise.all([
			this.services.get<NudgeService>("nudgeService"),
			this.services.get<SignalService>("signalService"),
		]);
		this.nudgeService = nudgeService;
		this.signalService = signalService;
		nudgeService.isSessionTypeActive = (type) =>
			this.sessionService?.getActiveSession()?.type === type;
		nudgeService.getInboxCount = () =>
			this.inboxService?.getItems().length ?? 0;
		await this.timedServiceLoadsParallel([
			{ name: "nudgeService", fn: () => nudgeService.load() },
			{ name: "signalService", fn: () => signalService.load() },
		]);
		nudgeService.start();
		});

		// Show notification when a nudge fires
		this.crossCuttingListeners.push(
			this.eventBus.on("nudge.triggered", (event) => {
				showNudgeNotification(event.payload.config, this.eventBus, this.noticeService!, event.payload.inboxItemCount);
			}),
		);

		await trackSeg("07.trainSetup", async () => {
		// Train domain — service instantiation, canvas sync, event subscriptions
		this.trainSetup = new TrainSetup({
			app: this.app,
			eventBus: this.eventBus,
			services: this.services,
			settingsService,
			sessionService: this.sessionService!,
			noticeService: this.noticeService!,
			modalService: this.modalService!,
		});
		const trainResult = await this.trainSetup.setup(
			(name, loadFn) => this.timedServiceLoad(name, loadFn),
		);
		this.trainService = trainResult.trainService;
		this.captureService = trainResult.captureService;
		this.canvasService = trainResult.canvasService;
		this.canvasSessionService = trainResult.canvasSessionService;
		this.trainCanvasSync = trainResult.trainCanvasSync;
		this.crossCuttingListeners.push(...trainResult.unsubscribes);
		this.dataExchangeService!.setCanvasService(this.canvasService);
		});

		await trackSeg("08.wave.analytics-onboarding", async () => {
		// Analytics + Onboarding — independent storage loads
		const [analyticsService, onboardingService] = await Promise.all([
			this.services.get<AnalyticsService>("analyticsService"),
			this.services.get<OnboardingService>("onboardingService"),
		]);
		this.analyticsService = analyticsService;
		this.onboardingService = onboardingService;
		await this.timedServiceLoadsParallel([
			{ name: "analyticsService", fn: () => analyticsService.load() },
			{ name: "onboardingService", fn: () => onboardingService.load() },
		]);
		});

		await trackSeg("09.analytics-wiring", async () => {
		this.analyticsService!.setReadCsv(async (csvPath: string) => {
			const file = this.app.vault.getAbstractFileByPath(csvPath);
			if (!file || !(file instanceof TFile)) return null;
			const content = await this.app.vault.read(file);
			const { CsvParser } = await import("./domain/dataExchange/CsvParser");
			return new CsvParser().parse(content);
		});
		this.analyticsService!.setAnalyticsFolder(settingsService.getSettings().analyticsFolder);

		// Wire .base file analytics adapter (delegates to ExportService)
		const { BaseAnalyticsAdapter } = await import("./domain/analytics/BaseAnalyticsAdapter");
		const exportSvc = this.dataExchangeService!.getExportService();
		this.analyticsService!.setBaseAdapter(new BaseAnalyticsAdapter({
			scanColumns: (path, viewIndex) => exportSvc.scanResolvedColumns(path, viewIndex),
			resolveFiles: (path, sourceType, viewIndex) => exportSvc.resolveExportFiles(path, sourceType, viewIndex),
		}));

		this.analyticsService!.setListFolder(async (folderPath: string) => {
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			if (!folder || !(folder instanceof TFolder)) return [];
			return folder.children
				.filter((f): f is TFile => f instanceof TFile)
				.map((f) => f.path);
		});
		});

		await trackSeg("10.leaf-handlers.train-export-session", async () => {
		// Train Main — now sitemap-driven via SitemapLeafView + handler
		registerTrainMainHandler(this.handlerRegistry!, {
			trainService: this.trainService!,
			eventBus: this.eventBus,
			app: this.app,
			getTrainSettings: () => ({
				trainFolder: settingsService.getSettings().trainFolder,
				trainCanvasEnabled: settingsService.getSettings().trainCanvasEnabled,
				trainCanvasAutoOpen: settingsService.getSettings().trainCanvasAutoOpen,
			}),
			closureDeps: {
				getSession: (sessionId) => this.sessionService?.getSessionById(sessionId) ?? null,
				completeClosure: (sessionId, response) => {
					void this.sessionService?.completeClosure(sessionId, response);
				},
				skipClosure: (sessionId) => {
					void this.sessionService?.skipClosure(sessionId);
				},
			},
		});

		// Train Timeline — now sitemap-driven via SitemapLeafView + handler
		registerTrainTimelineHandler(this.handlerRegistry!, {
			trainService: this.trainService!,
			eventBus: this.eventBus,
			app: { vault: { getAbstractFileByPath: (path: string) => this.app.vault.getAbstractFileByPath(path) } },
			getTrainSettings: () => ({
				trainFolder: settingsService.getSettings().trainFolder,
				trainCanvasEnabled: settingsService.getSettings().trainCanvasEnabled,
				trainCanvasAutoOpen: settingsService.getSettings().trainCanvasAutoOpen,
			}),
		});

		// Canvas Import — now sitemap-driven via SitemapLeafView + handler
		registerCanvasImportHandler(this.handlerRegistry!, {
			canvasService: this.canvasService!,
			eventBus: this.eventBus,
			app: this.app,
		});

		// Export — now sitemap-driven via SitemapLeafView + handler
		registerExportHandler(this.handlerRegistry!, {
			dataExchangeService: this.dataExchangeService!,
			eventBus: this.eventBus,
			app: this.app,
			getConfig: () => null, // Config passed via view state at open time
		});

		// Session Workspace — now sitemap-driven via SitemapLeafView + handler
		registerSessionWorkspaceHandler(this.handlerRegistry!, {
			sessionService: this.sessionService!,
			eventBus: this.eventBus,
			app: this.app,
			trainService: this.trainService,
		});
		});

		await trackSeg("11.quality-hubs.testMgmt-featureLifecycle", async () => {
		// Test Management + Feature Lifecycle — resolve in parallel; vault scans deferred inside load where applicable
		const [testManagementService, featureLifecycleService] = await Promise.all([
			this.services.get<TestManagementService>("testManagementService"),
			this.services.get<FeatureLifecycleService>("featureLifecycleService"),
		]);
		this.testManagementService = testManagementService;
		this.featureLifecycleService = featureLifecycleService;
		testManagementService.setScanner(async () => {
			const scanStart = performance.now();
			const folder = settingsService.getSettings().journeyFolder;
			const abstract = this.app.vault.getAbstractFileByPath(folder);
			if (!abstract) return [];
			const results: { json: Record<string, unknown>; path: string }[] = [];
			const files = this.getFilesInFolder(folder, (f) => f.extension === "json");
			for (const file of files) {
				try {
					const content = await this.app.vault.read(file);
					if (this.hasMergeConflictMarkers(content)) {
						this.logger.warn(`[Flowti] Skipping conflicted journey JSON: ${file.path}`);
						continue;
					}
					const json = JSON.parse(content) as Record<string, unknown>;
					if (typeof json.journey === "string") results.push({ json, path: file.path });
				} catch { /* skip invalid files */ }
			}
			this.logger.debug(`[StartupProfile] scan journeys files=${files.length} matched=${results.length} duration=${Math.round(performance.now() - scanStart)}ms`);
			return results;
		});
		testManagementService.setPrdScanner(async () => {
			const scanStart = performance.now();
			const featuresFolder = settingsService.getSettings().featuresFolder;
			const abstract = this.app.vault.getAbstractFileByPath(featuresFolder);
			if (!abstract) return [];
			const results: { name: string; stage: string; domain: string }[] = [];
			const files = this.getFilesInFolder(featuresFolder, (f) => f.extension === "md");
			for (const file of files) {
				const cache = this.app.metadataCache.getFileCache(file);
				const fm = cache?.frontmatter;
				if (!fm || fm.type !== "ProductRequirementsDocument") continue;
				results.push({
					name: file.basename.replace(/ PRD$/, ""),
					stage: String(fm.stage ?? "unknown"),
					domain: String(fm.domain ?? "unknown"),
				});
			}
			this.logger.debug(`[StartupProfile] scan test-mgmt-prds files=${files.length} matched=${results.length} duration=${Math.round(performance.now() - scanStart)}ms`);
			return results;
		});
		testManagementService.setTestReportReader(async () => {
			const reportPath = settingsService.getSettings().testReportPath;
			const file = this.app.vault.getAbstractFileByPath(reportPath);
			if (!file || !(file instanceof TFile)) return null;
			try {
				const content = await this.app.vault.read(file);
				if (this.hasMergeConflictMarkers(content)) {
					this.logger.warn(`[Flowti] Skipping conflicted test report JSON: ${reportPath}`);
					return null;
				}
				const report = JSON.parse(content) as { testResults?: { name?: string; status?: string }[] };
				const results = report.testResults ?? [];
				const flowSuites = results.filter((r) => r.name && r.name.includes("/flows/"));
				const unitSuites = results.filter((r) => r.name && !r.name.includes("/flows/") && !r.name.includes("/e2e/"));
				return {
					flowSuites: flowSuites.length,
					flowPassRate: flowSuites.length > 0 ? Math.round(flowSuites.filter((r) => r.status === "passed").length / flowSuites.length * 100) : 0,
					unitSuites: unitSuites.length,
					unitPassRate: unitSuites.length > 0 ? Math.round(unitSuites.filter((r) => r.status === "passed").length / unitSuites.length * 100) : 0,
				};
			} catch {
				return null;
			}
		});
		featureLifecycleService.setScanner(async () => {
			const scanStart = performance.now();
			const featuresFolder = settingsService.getSettings().featuresFolder;
			const abstract = this.app.vault.getAbstractFileByPath(featuresFolder);
			if (!abstract) return [];
			const results: { path: string; name: string; frontmatter: Record<string, unknown> }[] = [];
			const files = this.getFilesInFolder(featuresFolder, (f) => f.extension === "md");
			for (const file of files) {
				const cache = this.app.metadataCache.getFileCache(file);
				const fm = cache?.frontmatter;
				if (!fm || fm.type !== "ProductRequirementsDocument") continue;
				results.push({
					path: file.path,
					name: file.basename,
					frontmatter: { ...fm },
				});
			}
			this.logger.debug(`[StartupProfile] scan feature-lifecycle-prds files=${files.length} matched=${results.length} duration=${Math.round(performance.now() - scanStart)}ms`);
			return results;
		});
		await this.timedServiceLoadsParallel([
			{ name: "testManagementService", fn: () => this.testManagementService!.load() },
			{ name: "featureLifecycleService", fn: () => this.featureLifecycleService!.load() },
		]);
		// TestManagement hub is now driven by SitemapHubView + Lit components.
		// View registration is handled by SitemapBootstrap via plugin-sitemap.json.
		// Register tab handlers now that the service is available.
		if (this.handlerRegistry) {
			registerTestManagementHandlers(this.handlerRegistry, {
				service: this.testManagementService! as unknown as TestManagementHandlerDeps["service"],
				onboardingService: { shouldShowCallout: (id: string) => !(this.onboardingService?.isCalloutDismissed(id) ?? false) },
				getSettings: () => ({ docsRootPath: settingsService.getSettings().docsRootPath }),
				eventBus: this.eventBus,
			});
		}
		});

		await trackSeg("12.process-journey-sessionUi", async () => {
		// Process Management — process definition scanning and validation
		this.processService = await this.services.get<ProcessService>("processService");
		this.processService.setScanner(async () => {
			const scanStart = performance.now();
			const processesFolder = settingsService.getSettings().processesFolder;
			const abstract = this.app.vault.getAbstractFileByPath(processesFolder);
			if (!abstract) return [];
			const results: { name: string; filePath: string; content: string }[] = [];
			const files = this.getFilesInFolder(
				processesFolder,
				(f) => f.path.startsWith(processesFolder + "/") && f.extension === "canvas" && f.basename.endsWith(".process"),
			);
			for (const file of files) {
				try {
					const content = await this.app.vault.read(file);
					if (this.hasMergeConflictMarkers(content)) {
						this.logger.warn(`[Flowti] Skipping conflicted process canvas: ${file.path}`);
						continue;
					}
					results.push({ name: file.basename.replace(/\.process$/, ""), filePath: file.path, content });
				} catch { /* skip unreadable files */ }
			}
			this.logger.debug(`[StartupProfile] scan processes files=${files.length} matched=${results.length} duration=${Math.round(performance.now() - scanStart)}ms`);
			return results;
		});
		void this.processService.scanProcesses().then((processResults) => {
			if (processResults.length > 0) {
				void this.eventBus.emit("notice.show", { message: `Found ${processResults.length} process definition${processResults.length === 1 ? "" : "s"}` });
			}
		});
		this.addCommand({
			id: "flowti:scan-processes",
			name: "Scan process definitions",
			icon: "waypoints",
			callback: () => {
				void (async () => {
					const results = await this.processService!.scanProcesses();
					void this.eventBus.emit("notice.show", { message: `Scanned ${results.length} process definition${results.length === 1 ? "" : "s"}` });
				})();
			},
		});

		// Auto-rescan process definitions when *.process.canvas files change
		const processFolder = settingsService.getSettings().processesFolder;
		const isProcessFile = (path: string) =>
			path.startsWith(processFolder + "/") && path.endsWith(".process.canvas");
		const rescanProcesses = () => { void this.processService!.scanProcesses(); };
		this.crossCuttingListeners.push(
			this.eventBus.on("file.created", (e) => { if (isProcessFile(e.payload.path)) rescanProcesses(); }),
			this.eventBus.on("file.modified", (e) => { if (isProcessFile(e.payload.path)) rescanProcesses(); }),
			this.eventBus.on("file.deleted", (e) => { if (isProcessFile(e.payload.path)) rescanProcesses(); }),
			this.eventBus.on("file.renamed", (e) => {
				if (isProcessFile(e.payload.oldPath) || isProcessFile(e.payload.newPath)) rescanProcesses();
			}),
		);

		// Journey Builder + Executor domain
		const journeyResult = setupJourneyDomain({
			app: this.app,
			eventBus: this.eventBus,
			settingsService,
			commands: this.commands,
			handlerRegistry: this.handlerRegistry!,
			testManagementService: this.testManagementService!,
			toolHost: this.createToolHost(),
			registerExtensions: (exts, type) => { try { this.registerExtensions(exts, type); } catch { /* may already be registered */ } },
		});
		this.journeyBuilderService = journeyResult.journeyBuilderService;
		this.journeyExecutorService = journeyResult.journeyExecutorService;
		this.crossCuttingListeners.push(...journeyResult.unsubscribes);
		this.register(() => this.journeyExecutorService?.dispose());

		// Seed supplier dashboard and init onboarding after first-run install
		this.crossCuttingListeners.push(
			this.eventBus.on("installer.completed", (event) => {
				const analyticsSvc = this.analyticsService;
				const onboardingSvc = this.onboardingService;
				if (analyticsSvc && event.payload.includeSampleContent !== false) {
					void seedSupplierDashboard(analyticsSvc).then(() =>
						onboardingSvc?.initChecklist(),
					);
				} else {
					void onboardingSvc?.initChecklist();
				}
			}),
		);

		// Auto-open workspace and focus file when a session starts
		// Skip if a workspace already exists (e.g. started from sidebar)
		// Skip for train-of-thought sessions — they use TrainMainView instead
		this.crossCuttingListeners.push(
			this.eventBus.on("session.started", (event) => {
				const { session } = event.payload;
				this.sessionService!.workspaceSessionId = session.id;

				// Train sessions use the Train Main View, not Session Workspace.
				// Canvas sessions open the canvas file directly.
				if (session.type === "train-of-thought") return;
				if (session.type === "canvas-session") return;

				const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE);
				if (existingLeaves.length > 0) {
					// Workspace already open — just refresh it and open focus file
					if (session.focusFile) {
						void this.app.workspace.openLinkText(session.focusFile, "", "split");
					}
					return;
				}

				void this.app.workspace.getLeaf("tab").setViewState({
					type: VIEW_TYPE_SESSION_WORKSPACE,
					active: true,
				}).then(() => {
					if (session.focusFile) {
						void this.app.workspace.openLinkText(session.focusFile, "", "split");
					}
				});
			}),
		);

		// Auto-open canvas file when a canvas session is resumed
		this.crossCuttingListeners.push(
			this.eventBus.on("session.resumed", (event) => {
				const { session } = event.payload;
				if (session.type !== "canvas-session" || !session.canvasFile) return;
				void this.app.workspace.openLinkText(session.canvasFile, "", false);
			}),
		);
		});

		return settingsService;
	}

	/**
	 * Builds ScannerEntity entries for Lit entity-scanner components by
	 * extracting unique values from EVENT_CATALOG + discovered events.
	 *
	 * Supports "domain" and "services" fields (derived from catalog metadata).
	 * "flow", "system", and "actor" entities require vault folder scanning
	 * and return empty arrays here.
	 */
	private buildScannerEntities(field: "domain" | "services"): readonly { id: string; name: string; description: string; count: number }[] {

		const discovered = this.discoveryService?.getDiscoveredEvents() ?? [];
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

	/**
	 * Wires Data Exchange UI: views, commands, file-menu items,
	 * and UiCommandService callbacks.
	 */
	private wireDataExchange(settingsService: ISettingsService): void {
		const dxSetup = new DataExchangeSetup({
			app: this.app,
			eventBus: this.eventBus,
			dataExchangeService: this.dataExchangeService!,
			signalService: this.signalService,
			canvasService: this.canvasService,
			analyticsService: this.analyticsService,
			onboardingService: this.onboardingService!,
			hubRegistry: this.hubRegistry,
			docsRootPath: settingsService.getSettings().docsRootPath,
			registerView: (type, factory) => this.safeRegisterView(type, factory),
			registerExtensions: (exts, type) => { try { this.registerExtensions(exts, type); } catch { /* may already be registered */ } },
			registerEvent: (ref) => this.registerEvent(ref),
			addCommand: (cmd) => this.addCommand(cmd),
		});
		dxSetup.wireCallbacks();

		this.uiCommandService?.setOpenCsvImport(
			(filePath, savedConfig) => dxSetup.openCsvImportWithConfig(filePath, savedConfig),
		);
		this.uiCommandService?.setOpenExportView(
			(sourcePath, sourceType, format) => dxSetup.openExportView(sourcePath, sourceType, format),
		);
		this.uiCommandService?.setOpenExportWithSavedConfig(
			(savedConfig) => dxSetup.openExportWithSavedConfig(savedConfig),
		);

		// View factories, file-menu hooks, and DX commands are heavy on large vaults — defer to idle.
		const registerDxHeavyUi = (): void => {
			const t0 = performance.now();
			try {
				dxSetup.registerViews();
				dxSetup.registerFileMenuItems();
				dxSetup.registerCommands();
				this.logger.debug(`[StartupProfile] data exchange idle registration done in ${Math.round(performance.now() - t0)}ms`);
			} catch (err) {
				this.logger.error(
					`[Flowti] Data exchange UI registration failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		};
		this.logger.debug("[StartupProfile] data exchange: views/menus/commands scheduled on idle");
		if (typeof requestIdleCallback !== "undefined") {
			requestIdleCallback(() => {
				registerDxHeavyUi();
			}, { timeout: 2500 });
		} else {
			setTimeout(registerDxHeavyUi, 0);
		}
	}

	/**
	 * Configures the HubRegistry with all hub providers and
	 * registers the User Hub view + session views/commands.
	 */
	private setupHubRegistry(): void {
		this.hubRegistry = new HubRegistry({
			openView: async (viewType: string) => {
				let leaf = this.app.workspace.getLeavesOfType(viewType)[0];
				if (!leaf) {
					leaf = this.app.workspace.getLeaf("tab");
					await leaf.setViewState({ type: viewType, active: true });
				}
				void this.app.workspace.revealLeaf(leaf);
			},
		}, this.eventBus);
		this.hubRegistry.register(new EventCatalogProvider({
			getSettings: () => this.settings,
			getExcludedTypes: () => this.eventFilterService?.getExcludedTypes() ?? [],
			getNotifiedTypes: () => this.eventNotifyService?.getNotifiedTypes() ?? [],
			getDiscoveredEvents: () => this.discoveryService?.getDiscoveredEvents() ?? [],
			collapsedCategories: this.collapsedCategories,
		}));
		this.hubRegistry.register(new DataExchangeProvider(this.dataExchangeService!));
		this.hubRegistry.register(new AnalyticsHubProvider(this.analyticsService!));
		this.hubRegistry.register(new TrainHubProvider(this.trainService!));
		this.hubRegistry.register(new TestManagementHubProvider(this.testManagementService!));
		if (this.featureLifecycleService) {
			this.hubRegistry.register(new FeatureLifecycleProvider(this.featureLifecycleService));
		}

		// UserHubView factory removed — User Hub is now sitemap-driven via SitemapHubView + Lit components (see registerUserHandlers).
		this.hubRegistry.register(new UserHubProvider(this.userService, this.inboxService!));

		// Session views, commands, and file-menu items
		this.sessionSetup = new SessionSetup({
			app: this.app,
			eventBus: this.eventBus,
			errorService: this.errorService,
			sessionService: this.sessionService!,
			trainService: this.trainService,
			registerView: (type, factory) => this.safeRegisterView(type, factory),
			registerEvent: (ref) => this.registerEvent(ref),
			addCommand: (cmd) => this.addCommand(cmd),
		});
		this.sessionSetup.registerViews();
		this.sessionSetup.registerCommands();
		this.sessionSetup.registerFileMenuItems();
	}

	/**
	 * Runs ingestion catch-up for configured watch folders,
	 * processing any files that appeared while the plugin was not running.
	 */
	private async runIngestionCatchUp(): Promise<void> {
		if (this.settings.watchFolders.length === 0 || !this.ingestionService) return;

		try {
			await this.ingestionService.runCatchUp(this.settings.watchFolders, async (folder) => {
				return this.getFilesInFolder(folder).map((f) => f.path);
			});
		} catch (error) {
			this.errorService.handle(
				error instanceof Error ? error : new Error(String(error)),
				"ingestion.catchUp"
			);
		}
	}

	/**
	 * Returns files contained in a specific vault folder path without scanning
	 * the entire vault file list. This avoids repeated full-vault traversals
	 * during startup on large repositories.
	 */
	private getFilesInFolder(folderPath: string, predicate?: (file: TFile) => boolean): TFile[] {
		const root = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(root instanceof TFolder)) return [];
		const files: TFile[] = [];
		const stack: TFolder[] = [root];
		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) continue;
			for (const child of current.children) {
				if (child instanceof TFolder) {
					stack.push(child);
					continue;
				}
				if (child instanceof TFile && (!predicate || predicate(child))) {
					files.push(child);
				}
			}
		}
		return files;
	}

	private hasMergeConflictMarkers(content: string): boolean {
		return content.includes("<<<<<<< ") || content.includes("\n=======\n") || content.includes(">>>>>>> ");
	}

	/**
	 * Get a service from the container.
	 * Convenience method for external access.
	 */
	async getService<T>(id: string): Promise<T> {
		return this.services.get<T>(id);
	}
}
