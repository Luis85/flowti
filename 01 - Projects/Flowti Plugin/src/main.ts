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
import type { IUserService } from "./domain/user/types";
import type { EventNotificationService } from "./domain/eventNotify/EventNotificationService";
import type { EventFilterService } from "./domain/eventFilter/EventFilterService";
import type { DiscoveryService } from "./domain/discovery/DiscoveryService";
import type { InboxService } from "./domain/inbox/InboxService";
import type { NudgeService } from "./domain/nudge/NudgeService";
import type { SessionService } from "./domain/session/SessionService";
import type { SignalService } from "./domain/signal/SignalService";
import type { IngestionService } from "./domain/ingestion/IngestionService";
import type { TrainService } from "./domain/train/TrainService";
import type { CanvasService } from "./domain/canvas/CanvasService";
import type { AnalyticsService } from "./domain/analytics/AnalyticsService";
import type { OnboardingService } from "./domain/onboarding/OnboardingService";
import { PerfAggregator } from "./infrastructure/services/PerfAggregator";
import { TypedStorage } from "./utils/TypedStorage";
import type { PerfState, IAgentWorldPerfDashboard } from "./infrastructure/services/perfTypes";
import { registerViews } from "./infrastructure/views/registry";
import type { IViewRegistry } from "./infrastructure/views/types";
import { IngestionStatusBar } from "./ui/shared/IngestionStatusBar";
import { DataExchangeService } from "./domain/dataExchange/DataExchangeService";
import { TrainSetup } from "./bootstrap/trainSetup";
import { UiCommandService } from "./infrastructure/ui/UiCommandService";
import { createInfrastructure, setupCrossCuttingListeners } from "./bootstrap/pluginBootstrap";
import { createSecretStore } from "./utils/SecretStore";
import type { HubRegistry } from "./domain/hub/HubRegistry";
import type { CanvasSessionService } from "./domain/canvas/session/CanvasSessionService";
import type { JourneyBuilderService } from "./domain/journeyBuilder/JourneyBuilderService";
import type { TestManagementService } from "./domain/testManagement/TestManagementService";
import type { FeatureLifecycleService } from "./domain/featureLifecycle/FeatureLifecycleService";
import type { ProcessService } from "./domain/process/ProcessService";
import type { JourneyExecutorService } from "./domain/journeyExecutor/JourneyExecutorService";
import { BaseHubView, type IViewStateStore } from "./ui/BaseHubView";
import { openStartPage } from "./infrastructure/StartpageHandler";
import { NoticeService } from "./infrastructure/ui/NoticeService";
import { ModalService } from "./infrastructure/ui/ModalService";
import type { PluginSitemap } from "./domain/sitemap/plugin-sitemap-types";
import pluginSitemap from "../configs/sitemap.json";
import type { PluginHandlerRegistry } from "./infrastructure/handlers/plugin-handler-registry";
import { createSitemapHandlerRegistry } from "./bootstrap/sitemap-handler-setup";
import { buildSitemapDeps } from "./bootstrap/sitemap-deps-factory";
import type { TrainCanvasSyncService } from "./domain/train/TrainCanvasSyncService";
import { setupAgentDomain, type AgentSetupResult } from "./bootstrap/agent-setup";
import { VIEW_TYPE_AGENT_SIDEBAR, VIEW_TYPE_AGENT_WORLD } from "./ui/agents/types";
import { setupProjectDomain, type ProjectSetupResult } from "./bootstrap/project-setup";
import { VIEW_TYPE_PROJECT_DETAIL } from "./ui/projects/types";
import { teardownPlugin } from "./bootstrap/plugin-teardown";
import { createToolHost } from "./bootstrap/tool-host-factory";
import { setupHubRegistry } from "./bootstrap/hub-setup";
import { type DomainLoaderDeps } from "./bootstrap/domain-loader";
import { loadAllDomainServices } from "./bootstrap/domain-services-loader";
import { createTimingTracker, type TimingState } from "./bootstrap/timing-factory";
import type { CaptureService } from "./domain/capture/CaptureService";
import type { SessionSetup } from "./bootstrap/sessionSetup";
import { emitStartupMetrics } from "./bootstrap/startup-metrics";
import { wireDataExchange } from "./bootstrap/data-exchange-wiring";


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
	private inboxService?: InboxService;
	private ingestionService?: IngestionService;
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
			await this.loadSettings();
			const infra = createInfrastructure({
				app: this.app,
				settings: this.settings,
				registerEvent: (ref) => this.registerEvent(ref),
			});
			this.eventBus = infra.eventBus;
			this.logger = infra.logger;
			this.errorService = infra.errorService;

			if (this.pendingSettingsWarning) {
				this.logger.warn("Invalid settings, using defaults", { errors: this.pendingSettingsWarning });
				this.pendingSettingsWarning = undefined;
			}
			this.eventBridge = infra.eventBridge;
			this.services = infra.services;
			this.commands = infra.commands;
			this.views = infra.views;

			void this.eventBus.emit("plugin.loading", { timestamp: new Date().toISOString() });

			this.noticeService = new NoticeService({ eventBus: this.eventBus });
			this.modalService = new ModalService({ app: this.app, eventBus: this.eventBus, noticeService: this.noticeService, getSettings: () => this.settings });
			this.crossCuttingListeners = setupCrossCuttingListeners({
				eventBus: this.eventBus, logger: this.logger,
				onSettingsChanged: (s) => { this.settings = s; this.collapsedCategories = new Set(s.collapsedCategories); },
			});

			void this.eventBus.emit("settings.loaded", { settings: this.settings });

			this.registerAllServices();
			this.registerAllCommands();
			this.registerAllViews();
			await this.services.initializeAll();

			this.addSettingTab(new FlowtiSettingTab(this.app, this, {
				eventBus: this.eventBus,
				getSettings: () => this.settings,
				saveSettings: () => this.saveSettings(),
				getInstallerService: () => this.services.get<IInstallerService>("installerService"),
				getAnalyticsService: () => this.analyticsService,
				getOnboardingService: () => this.onboardingService,
			}));
			BaseHubView.setViewStateStore(this.getViewStateStore());

			// ── SitemapBootstrap ──
			this.handlerRegistry = this.registerSitemapHandlers();

			// ── Agent domain ──
			this.agentSetup = setupAgentDomain({ plugin: this, app: this.app, eventBus: this.eventBus });
			this.addRibbonIcon("bot", "Open agent panel", () => { this.activateAgentPanel(); });

			// ── Project domain ──
			this.projectSetup = setupProjectDomain({ plugin: this, app: this.app, eventBus: this.eventBus });
			this.addRibbonIcon("folder-open", "Open project hub", () => { this.activateProjectHub(); });
			this.addRibbonIcon("globe", "Open agent world", () => {
				const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENT_WORLD);
				if (existing.length > 0) { void this.app.workspace.revealLeaf(existing[0]); }
				else { const leaf = this.app.workspace.getLeaf(true); void leaf.setViewState({ type: VIEW_TYPE_AGENT_WORLD, active: true }); }
			});

			// Command catalog execute requests
			{
				const ctx = this.createCommandContext();
				this.crossCuttingListeners.push(
					this.eventBus.on("command.execute.request", (event) => { void this.commands.execute(event.payload.commandId, ctx); }),
				);
			}

			this.uiCommandService = new UiCommandService({ app: this.app, eventBus: this.eventBus });
			this.uiCommandService.setModalService(this.modalService!);

			const statusBarEl = this.addStatusBarItem();
			this.ingestionStatusBar = new IngestionStatusBar(statusBarEl, this.eventBus);
			this.ingestionStatusBar.register();

			this.app.workspace.onLayoutReady(() => { void this.onLayoutReady(); });

			void this.eventBus.emit("plugin.loaded", { timestamp: new Date().toISOString() });
			this.logger.info("Plugin loaded successfully");
		} catch (error) {
			const lifecycleError = new LifecycleError({
				code: "PLUGIN_LOAD_FAILED",
				message: "Failed to load Flowti plugin",
				severity: "critical",
				context: "FlowtiBasePlugin",
				cause: error instanceof Error ? error : undefined,
			});
			if (this.logger) {
				this.logger.error("Plugin load failed", error);
			} else {
				console.error("[Flowti] Plugin load failed:", error);
			}
			this.errorService?.handle(lifecycleError);
			throw lifecycleError;
		}
	}

	async onunload() {
		teardownPlugin({
			app: this.app, eventBus: this.eventBus, agentSetup: this.agentSetup, trainCanvasSync: this.trainCanvasSync,
			canvasSessionService: this.canvasSessionService, journeyBuilderService: this.journeyBuilderService, canvasService: this.canvasService,
			signalService: this.signalService, nudgeService: this.nudgeService, modalService: this.modalService, noticeService: this.noticeService,
			uiCommandService: this.uiCommandService, ingestionStatusBar: this.ingestionStatusBar, eventBridge: this.eventBridge,
			services: this.services, hubRegistry: this.hubRegistry, commands: this.commands, views: this.views, logger: this.logger,
		}, this.crossCuttingListeners);
		this.crossCuttingListeners = [];
	}

	async loadSettings(): Promise<void> {
		const data = await this.loadData();
		const result = FlowtiSettingsSchema.safeParse(data);
		if (!result.success) {
			this.pendingSettingsWarning = result.error.issues;
		}
		this.settings = result.success ? result.data : DEFAULT_SETTINGS;
		this.collapsedCategories = new Set(this.settings.collapsedCategories);
	}

	async saveSettings(): Promise<void> {
		const existingData = ((await this.loadData()) as object) || {};
		await this.saveData({ ...existingData, ...this.settings });
		await this.eventBus.emit("settings.changed", { settings: this.settings });
	}

	private registerAllServices(): void {
		registerServices(this.services, {
			loadData: () => this.loadData(),
			saveData: (data) => this.saveData(data),
		}, createSecretStore(this.app));
	}

	private registerAllCommands(): void { registerCommands(this.commands); }

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

	private createCommandContext(): CommandContext {
		return { app: this.app, eventBus: this.eventBus, logger: this.logger };
	}

	private getViewStateStore(): IViewStateStore {
		return {
			get: (key) => this.viewStateMap.get(key),
			set: (key, value) => { this.viewStateMap.set(key, value); },
		};
	}

	private activateAgentPanel(): void {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENT_SIDEBAR);
		if (existing.length > 0) { void this.app.workspace.revealLeaf(existing[0]); return; }
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) void leaf.setViewState({ type: VIEW_TYPE_AGENT_SIDEBAR, active: true });
	}

	private activateProjectHub(): void {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_PROJECT_DETAIL);
		if (existing.length > 0) { void this.app.workspace.revealLeaf(existing[0]); return; }
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) void leaf.setViewState({ type: VIEW_TYPE_PROJECT_DETAIL, active: true });
	}

	private safeRegisterView(type: string, factory: ViewCreator): void {
		try { this.registerView(type, factory); }
		catch (err) {
			if (err instanceof Error && err.message.includes("existing view type")) { this.logger?.debug(`View "${type}" already registered (hot-reload)`); }
			else { throw err; }
		}
	}

	/** Delegates to extracted sitemap-handler-setup module. */
	private registerSitemapHandlers(): PluginHandlerRegistry {
		return createSitemapHandlerRegistry(this, this.eventBus, this.logger, pluginSitemap as PluginSitemap, buildSitemapDeps({
			eventBus: this.eventBus, settings: this.settings, userService: this.userService, eventFilterService: this.eventFilterService,
			eventNotifyService: this.eventNotifyService, discoveryService: this.discoveryService, inboxService: this.inboxService,
			nudgeService: this.nudgeService, sessionService: this.sessionService, signalService: this.signalService,
			trainService: this.trainService, canvasService: this.canvasService, analyticsService: this.analyticsService,
			onboardingService: this.onboardingService, installerServiceRef: this.installerServiceRef, dataExchangeService: this.dataExchangeService,
			testManagementService: this.testManagementService, hubRegistry: this.hubRegistry, commands: this.commands, trainSetup: this.trainSetup,
		}));
	}

	private timingState: TimingState = { startupServiceCount: 0, startupServiceTimings: [], startupDomainSegments: [] };

	private createDomainLoaderDeps(): DomainLoaderDeps {
		return {
			app: this.app,
			eventBus: this.eventBus,
			services: this.services,
			logger: this.logger,
			noticeService: this.noticeService!,
			modalService: this.modalService!,
			handlerRegistry: this.handlerRegistry!,
			commands: this.commands,
			settings: this.settings,
			addCommand: (cmd) => this.addCommand(cmd),
			registerExtensions: (exts, type) => { try { this.registerExtensions(exts, type); } catch { /* may already be registered */ } },
			toolHost: createToolHost(this.app, this.eventBus),
			getFilesInFolder: (folderPath, predicate) => this.getFilesInFolder(folderPath, predicate),
			hasMergeConflictMarkers: (content) => content.includes("<<<<<<< ") || content.includes("\n=======\n") || content.includes(">>>>>>> "),
		};
	}

	/**
	 * Exposed for the Agent World view / Ask Bob perf monitor.
	 * `PerfAggregator` is created in {@link onLayoutReady}, so this may be
	 * undefined until layout has finished initializing.
	 */
	getPerfDashboard(): IAgentWorldPerfDashboard | undefined {
		return this.perfAggregator;
	}

	private async onLayoutReady(): Promise<void> {
		const perfStorage = new TypedStorage<PerfState>(
			{ load: () => this.loadData(), save: (d) => this.saveData(d) }, "perfAggregator",
		);
		this.perfAggregator = new PerfAggregator(this.eventBus, perfStorage);
		this.perfAggregator.setup();
		await this.perfAggregator.load();
		this.register(() => this.perfAggregator?.destroy());

		const startupStart = performance.now();
		this.timingState = { startupServiceCount: 0, startupServiceTimings: [], startupDomainSegments: [] };
		const startupPhases: Array<{ name: string; durationMs: number }> = [];
		const trackPhase = async (name: string, fn: () => Promise<void> | void): Promise<void> => {
			const start = performance.now();
			await fn();
			startupPhases.push({ name, durationMs: performance.now() - start });
			void this.eventBus.emit("perf.startup.phase", { phase: name, durationMs: performance.now() - start });
		};

		try {
			await trackPhase("domain.services.load", () => this.loadDomainServices());
			await trackPhase("hub.registry.setup", () => { this.wireHubRegistry(); });
			await trackPhase("data.exchange.wire", () => { this.doWireDataExchange(); });
			await trackPhase("vault.listeners.register", () => { this.eventBridge.registerVaultListeners(); });
			await trackPhase("startpage.open", () => { openStartPage(this.app.workspace, this.settings.startPage); });

			this.doEmitStartupMetrics(startupStart, startupPhases);

			void this.eventBus.emit("plugin.ready", { timestamp: new Date().toISOString() });
			void this.runIngestionCatchUp();
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.errorService.handle(err, "onLayoutReady");
			this.noticeService?.error(`Flowti startup error: ${err.message}`);
		}
	}

	/** Delegates to extracted startup-metrics module. */
	private doEmitStartupMetrics(startupStart: number, startupPhases: Array<{ name: string; durationMs: number }>): void {
		emitStartupMetrics(this.eventBus, this.logger, {
			startupStart,
			startupPhases,
			serviceCount: this.timingState.startupServiceCount,
			serviceTimings: this.timingState.startupServiceTimings,
			domainSegments: this.timingState.startupDomainSegments,
		});
	}

	private async loadDomainServices(): Promise<void> {
		const r = await loadAllDomainServices(this.createDomainLoaderDeps(), createTimingTracker(this.eventBus, this.logger, this.timingState), { app: this.app, eventBus: this.eventBus, sessionSetup: this.sessionSetup });
		this.userService = r.userService; this.installerServiceRef = r.installerServiceRef;
		this.eventFilterService = r.eventFilterService; this.eventNotifyService = r.eventNotifyService; this.discoveryService = r.discoveryService;
		this.inboxService = r.inboxService; this.ingestionService = r.ingestionService; this.dataExchangeService = r.dataExchangeService;
		this.sessionService = r.sessionService; this.nudgeService = r.nudgeService; this.signalService = r.signalService;
		this.captureService = r.captureService; this.trainService = r.trainService; this.canvasService = r.canvasService;
		this.canvasSessionService = r.canvasSessionService; this.trainCanvasSync = r.trainCanvasSync; this.trainSetup = r.trainSetup;
		this.analyticsService = r.analyticsService; this.onboardingService = r.onboardingService;
		this.testManagementService = r.testManagementService; this.featureLifecycleService = r.featureLifecycleService;
		this.processService = r.processService; this.journeyBuilderService = r.journeyBuilderService; this.journeyExecutorService = r.journeyExecutorService;
		this.crossCuttingListeners.push(...r.listeners);
		this.register(() => this.journeyExecutorService?.dispose());
	}

	private wireHubRegistry(): void {
		const result = setupHubRegistry({
			app: this.app, eventBus: this.eventBus, errorService: this.errorService, settings: this.settings, collapsedCategories: this.collapsedCategories,
			userService: this.userService, inboxService: this.inboxService!, sessionService: this.sessionService!, dataExchangeService: this.dataExchangeService!,
			analyticsService: this.analyticsService!, trainService: this.trainService!, testManagementService: this.testManagementService!,
			featureLifecycleService: this.featureLifecycleService, eventFilterService: this.eventFilterService, eventNotifyService: this.eventNotifyService, discoveryService: this.discoveryService,
			safeRegisterView: (type, factory) => this.safeRegisterView(type, factory), registerEvent: (ref) => this.registerEvent(ref), addCommand: (cmd) => this.addCommand(cmd),
		});
		this.hubRegistry = result.hubRegistry; this.sessionSetup = result.sessionSetup;
	}

	private doWireDataExchange(): void {
		wireDataExchange({
			app: this.app, eventBus: this.eventBus, logger: this.logger, dataExchangeService: this.dataExchangeService!, signalService: this.signalService,
			canvasService: this.canvasService, analyticsService: this.analyticsService, onboardingService: this.onboardingService!, hubRegistry: this.hubRegistry,
			docsRootPath: this.settings.docsRootPath, uiCommandService: this.uiCommandService, safeRegisterView: (type, factory) => this.safeRegisterView(type, factory),
			registerExtensions: (exts, type) => { try { this.registerExtensions(exts, type); } catch { /* may already be registered */ } },
			registerEvent: (ref) => this.registerEvent(ref), addCommand: (cmd) => this.addCommand(cmd),
		});
	}

	private async runIngestionCatchUp(): Promise<void> {
		if (this.settings.watchFolders.length === 0 || !this.ingestionService) return;
		try {
			await this.ingestionService.runCatchUp(this.settings.watchFolders, async (folder) => {
				return this.getFilesInFolder(folder).map((f) => f.path);
			});
		} catch (error) {
			this.errorService.handle(error instanceof Error ? error : new Error(String(error)), "ingestion.catchUp");
		}
	}

	private getFilesInFolder(folderPath: string, predicate?: (file: TFile) => boolean): TFile[] {
		const root = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(root instanceof TFolder)) return [];
		const files: TFile[] = [];
		const stack: TFolder[] = [root];
		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) continue;
			for (const child of current.children) {
				if (child instanceof TFolder) { stack.push(child); continue; }
				if (child instanceof TFile && (!predicate || predicate(child))) { files.push(child); }
			}
		}
		return files;
	}

	async getService<T>(id: string): Promise<T> {
		return this.services.get<T>(id);
	}
}
