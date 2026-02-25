import { Notice, Plugin, TFile } from "obsidian";
import { registerCommands } from "./infrastructure/commands/registry";
import type { CommandContext, ICommandRegistry } from "./infrastructure/commands/types";
import { LifecycleError } from "./infrastructure/errors/FlowtiError";
import type { IErrorService } from "./infrastructure/errors/types";
import type { IEventBridge, IEventBus } from "./infrastructure/events/types";
import type { ILogger } from "./infrastructure/logger/types";
import { registerServices } from "./infrastructure/services/registry";
import type { IServiceContainer } from "./infrastructure/services/types";
import { FlowtiSettingTab } from "./domain/settings/FlowtiSettingTab";
import {
	DEFAULT_SETTINGS,
	FlowtiSettings,
	FlowtiSettingsSchema,
} from "./domain/settings/settings";
import type { IInstallerService } from "./domain/installer/types";
import { InstallerWizardModal } from "./domain/installer/InstallerWizardModal";
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
import { TrainCanvasSyncService } from "./domain/train/TrainCanvasSyncService";
import { getCanvasPath } from "./domain/train/helpers";
import type { CanvasService } from "./domain/canvas/CanvasService";
import type { AnalyticsService } from "./domain/analytics/AnalyticsService";
import { QuickCaptureModal } from "./ui/capture/QuickCaptureModal";
import { TrainCaptureModal } from "./ui/train/TrainCaptureModal";
import { registerViews } from "./infrastructure/views/registry";
import type { IViewRegistry } from "./infrastructure/views/types";
import { IngestionStatusBar } from "./ui/IngestionStatusBar";
import { DataExchangeService } from "./domain/dataExchange/DataExchangeService";
import { DataExchangeSetup } from "./dataExchangeSetup";
import { SessionSetup } from "./sessionSetup";
import { UiCommandService } from "./infrastructure/ui/UiCommandService";
import { InputModal } from "./ui/modals";
import { createInfrastructure, setupCrossCuttingListeners } from "./pluginBootstrap";
import { HubRegistry } from "./domain/hub/HubRegistry";
import { EventCatalogProvider } from "./domain/hub/EventCatalogProvider";
import { DataExchangeProvider } from "./domain/hub/DataExchangeProvider";
import { AnalyticsHubProvider } from "./domain/hub/AnalyticsHubProvider";
import { UserHubProvider } from "./domain/hub/UserHubProvider";
import { UserHubView, VIEW_TYPE_USER_HUB } from "./ui/UserHubView";
import { SessionWorkspaceView, VIEW_TYPE_SESSION_WORKSPACE } from "./ui/SessionWorkspaceView";
import { TrainMainView, VIEW_TYPE_TRAIN_MAIN } from "./ui/train/TrainMainView";
import { TrainTimelineSidebar, VIEW_TYPE_TRAIN_TIMELINE } from "./ui/train/TrainTimelineSidebar";
import { TrainHubView, VIEW_TYPE_TRAIN_HUB } from "./ui/train/TrainHubView";
import { AnalyticsHubView, VIEW_TYPE_ANALYTICS_HUB } from "./ui/AnalyticsHubView";
import { TrainResumeModal } from "./ui/train/TrainResumeModal";
import { TrainTypePickerModal } from "./ui/train/TrainTypePickerModal";
import { showNudgeNotification } from "./ui/NudgeNotification";
import { computeRemainingMs } from "./domain/session/helpers";


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
	private analyticsService?: AnalyticsService;
	private ingestionStatusBar?: IngestionStatusBar;
	private collapsedCategories = new Set<string>();
	private uiCommandService?: UiCommandService;
	private hubRegistry?: HubRegistry;
	private sessionSetup?: SessionSetup;
	private crossCuttingListeners: (() => void)[] = [];
	private pendingSettingsWarning?: unknown[];

	// ── Notice throttle ──────────────────────────────────────
	// Batches rapid-fire notices (e.g. during bulk import) into a single
	// summary notice per key. Within the window, counts accumulate; when
	// the timer fires, a single Notice is shown with the total count.
	private static readonly NOTICE_WINDOW_MS = 2000;
	private noticeBatches = new Map<string, { count: number; timer: ReturnType<typeof setTimeout> }>();

	private throttledNotice(key: string, singleMsg: string): void {
		const existing = this.noticeBatches.get(key);
		if (existing) {
			existing.count++;
			return; // timer already running — it will flush
		}
		const batch = {
			count: 1,
			timer: setTimeout(() => {
				const b = this.noticeBatches.get(key);
				this.noticeBatches.delete(key);
				if (!b) return;
				if (b.count === 1) {
					new Notice(singleMsg);
				} else {
					new Notice(`${singleMsg} (+${b.count - 1} more)`);
				}
			}, FlowtiBasePlugin.NOTICE_WINDOW_MS),
		};
		this.noticeBatches.set(key, batch);
	}

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

			this.crossCuttingListeners = setupCrossCuttingListeners({
				eventBus: this.eventBus,
				logger: this.logger,
				onSettingsChanged: (s) => {
					this.settings = s;
					this.collapsedCategories = new Set(s.collapsedCategories);
				},
				throttledNotice: (key, msg) => this.throttledNotice(key, msg),
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
			}));
			this.bindViews();
			this.bindCommands();

			// Conditional command — only visible when a train is active/paused
			this.addCommand({
				id: "flowti:view-train",
				name: "View train of thoughts",
				icon: "train-front",
				checkCallback: (checking) => {
					const active = this.trainService?.getActiveTrain();
					if (!active) return false;
					if (!checking) {
						void this.eventBus.emit("ui.openTrainView", {});
					}
					return true;
				},
			});

			// UI command service — central handler for all ui.* events
			this.uiCommandService = new UiCommandService({
				app: this.app,
				eventBus: this.eventBus,
			});
			this.uiCommandService.setShowInputModal((config) => {
				new InputModal(this.app, config).open();
			});

			// Ribbon icons — emit UI command events
			this.addRibbonIcon("list", "Open Event Catalog", () => {
				void this.eventBus.emit("ui.openEventCatalog", {});
			});
			this.addRibbonIcon("arrow-left-right", "Open Data Exchange Hub", () => {
				void this.eventBus.emit("ui.openDataExchangeHub", {});
			});
			this.addRibbonIcon("home", "Open User Hub", () => {
				void this.eventBus.emit("ui.openUserHub", {});
			});
			this.addRibbonIcon("lightbulb", "Add Idea", () => {
				void this.eventBus.emit("ui.openQuickCapture", { type: "idea" });
			});
			this.addRibbonIcon("file-text", "Add Note", () => {
				void this.eventBus.emit("ui.openQuickCapture", { type: "note" });
			});
			this.addRibbonIcon("check-square", "Add Task", () => {
				void this.eventBus.emit("ui.openQuickCapture", { type: "task" });
			});
			this.addRibbonIcon("help-circle", "Add Question", () => {
				void this.eventBus.emit("ui.openQuickCapture", { type: "question" });
			});
			this.addRibbonIcon("message-circle", "Add Feedback", () => {
				void this.eventBus.emit("ui.openQuickCapture", { type: "feedback" });
			});
			this.addRibbonIcon("bug", "Add Bug", () => {
				void this.eventBus.emit("ui.openQuickCapture", { type: "bug" });
			});
			this.addRibbonIcon("graduation-cap", "Add Learning", () => {
				void this.eventBus.emit("ui.openQuickCapture", { type: "learning" });
			});
			this.addRibbonIcon("waypoints", "Open Train Hub", () => {
				void this.eventBus.emit("ui.openTrainHub", {});
			});
			this.addRibbonIcon("bar-chart-2", "Open Analytics Hub", () => {
				void this.eventBus.emit("ui.openAnalyticsHub", {});
			});
			this.addRibbonIcon("train-front", "Train of Thoughts", () => {
				const activeTrain = this.trainService?.getActiveTrain();
				if (activeTrain) {
					void this.eventBus.emit("ui.openTrainView", { trainId: activeTrain.id });
					return;
				}
				void this.eventBus.emit("ui.startTrain", {});
			});

			// Quick Capture modal listener
			this.eventBus.on("ui.openQuickCapture", (event) => {
				const type = event.payload.type;
				new QuickCaptureModal(this.app, {
					showTypeSelector: !type,
					defaultType: type,
					onSubmit: (input) => {
						if (this.captureService) {
							void this.captureService.capture(input).then((result) => {
								new Notice(`Captured: ${result.title}`);
							});
						}
					},
				}).open();
			});

			// Train of Thoughts serial capture listener
			// Nesting: if a train is running, prompt for a new title (startTrain auto-pauses)
			// If paused, resume it. If none, prompt for a new title.
			this.eventBus.on("ui.startTrain", (event) => {
				if (!this.trainService) return;

				// If paused, resume and open modal from the selected thought
				const activeTrain = this.trainService.getActiveTrain();
				if (activeTrain && activeTrain.status === "paused") {
					const fromThoughtId = event.payload.fromThoughtId;
					const mdFlag = event.payload.mergeDown;

					// Smart resume: check if active thought is NOT the head node
					const headNode = this.trainService.getHeadNode(activeTrain.id);
					const activeThoughtId = fromThoughtId ?? activeTrain.thoughts[activeTrain.thoughts.length - 1]?.id;
					const currentThought = activeThoughtId
						? activeTrain.thoughts.find((t) => t.id === activeThoughtId)
						: null;

					if (headNode && currentThought && headNode.id !== currentThought.id && !mdFlag && !fromThoughtId) {
						new TrainResumeModal(this.app, {
							trainTitle: activeTrain.title,
							currentThoughtTitle: currentThought.title,
							headThoughtTitle: headNode.title,
							onChoice: (choice) => {
								switch (choice) {
									case "jump-to-end":
										void this.trainService!.resume(activeTrain.id).then(() => {
											this.openTrainModal(activeTrain.id, activeTrain.title, undefined, headNode.id);
										});
										break;
									case "branch-from-here":
										void this.trainService!.resume(activeTrain.id).then(() => {
											this.openTrainModal(activeTrain.id, activeTrain.title, undefined, currentThought.id);
										});
										break;
									case "stay-here":
										// Don't resume — leave the train paused at current position
										break;
								}
							},
						}).open();
						return;
					}

					void this.trainService.resume(activeTrain.id).then(() => {
						this.openTrainModal(activeTrain.id, activeTrain.title, undefined, fromThoughtId, mdFlag);
					});
					return;
				}

				// Running train — open capture modal from the active thought
				if (activeTrain && activeTrain.status === "running") {
					this.openTrainModal(activeTrain.id, activeTrain.title, undefined, event.payload.fromThoughtId, event.payload.mergeDown);
					return;
				}

				// No train — type picker → title input → start
				const fromFilePath = event.payload.fromFilePath;
				new TrainTypePickerModal(this.app, {
					onSelect: (typeConfig) => {
						const duration = typeConfig.defaultDuration || (this.settings.defaultTrainDuration ?? 0);
						new InputModal(this.app, {
							title: `Start a ${typeConfig.label} Train`,
							inputName: "What are you thinking?",
							inputDesc: "",
							placeholder: "e.g. Exploring a new idea\u2026",
							submitLabel: "Start",
							onSubmit: (title) => {
								void this.trainService!.startTrain(title, duration, typeConfig.id).then(async (train) => {
									if (fromFilePath) {
										const basename = fromFilePath.replace(/^.*[\\/]/, "").replace(/\.md$/, "");
										await this.trainService!.addThought(train.id, basename, { path: fromFilePath });
									}
									this.openTrainModal(train.id, train.title);
								});
							},
						}).open();
					},
				}).open();
			});

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
		safeDispose("canvasService", () => this.canvasService?.dispose());
		safeDispose("signalService", () => this.signalService?.dispose());
		safeDispose("nudgeService", () => this.nudgeService?.dispose());
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
		});
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
		});
	}

	/**
	 * Binds all registered commands to Obsidian's command palette.
	 * Each command is wrapped to execute through the middleware pipeline.
	 */
	private bindCommands(): void {
		const ctx = this.createCommandContext();

		for (const command of this.commands.getCommands()) {
			this.addCommand({
				id: command.id,
				name: command.name,
				hotkeys: command.hotkeys,
				icon: command.icon,
				mobileOnly: command.mobileOnly,
				callback: () => {
					void this.commands.execute(command.id, ctx);
				},
			});
		}
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

	/**
	 * Bind registered views to Obsidian.
	 */
	private bindViews(): void {
		for (const view of this.views.getViews()) {
			this.registerView(view.type, view.factory);
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
		try {
			const settingsService = await this.loadDomainServices();
			this.setupHubRegistry();
			this.wireDataExchange(settingsService);
			await this.runIngestionCatchUp();

			this.eventBridge.registerVaultListeners();
			void this.eventBus.emit("plugin.ready", {
				timestamp: new Date().toISOString(),
			});

		} catch (error) {
			this.errorService.handle(
				error instanceof Error ? error : new Error(String(error)),
				"onLayoutReady"
			);
		}
	}

	/**
	 * Loads all domain services in dependency order.
	 * SettingsService must load first so persisted state is restored
	 * before any event-driven updates arrive.
	 */
	private async loadDomainServices(): Promise<ISettingsService> {
		const settingsService = await this.services.get<ISettingsService>("settingsService");
		await settingsService.load();

		this.userService = await this.services.get<IUserService>("userService");
		await this.userService.load();

		const installerService = await this.services.get<IInstallerService>("installerService");
		await installerService.load();
		InstallerWizardModal.showIfNeeded(this.app, installerService, this.eventBus);

		this.eventFilterService = await this.services.get<EventFilterService>("eventFilterService");
		await this.eventFilterService.load();

		this.eventNotifyService = await this.services.get<EventNotificationService>("eventNotifyService");
		await this.eventNotifyService.load();

		this.discoveryService = await this.services.get<DiscoveryService>("discoveryService");
		await this.discoveryService.load();

		this.subscriptionService = await this.services.get<SubscriptionService>("subscriptionService");
		await this.subscriptionService.load();

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
		await this.inboxService.load();

		this.eventBus.on("settings.changed", (event) => {
			this.inboxService?.setEnabledSources(event.payload.settings.inboxEnabledSources);
			this.inboxService?.setWatchedFolders(event.payload.settings.inboxWatchedFolders ?? []);
			this.inboxService?.setTriageTargetFolder(event.payload.settings.inboxTriageTargetFolder ?? "");
			if (this.sessionService) {
				this.sessionService.globalActivityFilter = event.payload.settings.sessionActivityFilterGlobal ?? [];
			}
			// Sync custom output templates to all open workspace views
			const templates = event.payload.settings.customOutputTemplates ?? [];
			for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE)) {
				(leaf.view as SessionWorkspaceView).customOutputTemplates = templates;
			}

		});

		this.ingestionService = await this.services.get<IngestionService>("ingestionService");
		await this.ingestionService.load();

		this.eventDefinitionService = await this.services.get<EventDefinitionService>("eventDefinitionService");
		await this.eventDefinitionService.load();

		this.dataExchangeService = await this.services.get<DataExchangeService>("dataExchangeService");
		await this.dataExchangeService.load();

		this.sessionService = await this.services.get<SessionService>("sessionService");
		this.sessionService.globalActivityFilter = settingsService.getSettings().sessionActivityFilterGlobal ?? [];
		await this.sessionService.load();

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

		// Nudge Service — time-based session start reminders
		this.nudgeService = await this.services.get<NudgeService>("nudgeService");
		this.nudgeService.isSessionTypeActive = (type) =>
			this.sessionService?.getActiveSession()?.type === type;
		await this.nudgeService.load();
		this.nudgeService.start();

		// Show notification when a nudge fires
		this.crossCuttingListeners.push(
			this.eventBus.on("nudge.triggered", (event) => {
				showNudgeNotification(event.payload.config, this.eventBus);
			}),
		);

		// Signal Service — external data source connections
		this.signalService = await this.services.get<SignalService>("signalService");
		await this.signalService.load();

		// Capture Service — quick note capture via ribbons and command palette
		this.captureService = await this.services.get<CaptureService>("captureService");
		this.captureService.getSettings = () => ({
			captureFolder: settingsService.getSettings().captureFolder,
		});

		// Train Service — serial thought capture sessions
		this.trainService = await this.services.get<TrainService>("trainService");
		this.trainService.getSettings = () => ({
			trainFolder: settingsService.getSettings().trainFolder,
			trainMaxThoughts: settingsService.getSettings().trainMaxThoughts,
		});
		await this.trainService.load();

		// Train Canvas Sync — auto-generate canvas from train graph
		const trainCanvasFileSystem = new FileSystemClient({ eventBus: this.eventBus });
		const trainCanvasSync = new TrainCanvasSyncService({
			eventBus: this.eventBus,
			fileSystem: trainCanvasFileSystem,
			getSettings: () => ({
				trainCanvasEnabled: settingsService.getSettings().trainCanvasEnabled,
			}),
			getTrain: (id) => this.trainService?.getTrain(id),
		});
		trainCanvasSync.setup();
		this.register(() => trainCanvasSync.destroy());

		// Canvas Service — canvas import configurations and orchestration
		this.canvasService = await this.services.get<CanvasService>("canvasService");
		await this.canvasService.load();
		this.dataExchangeService!.setCanvasService(this.canvasService);

		// Analytics Service — in-memory CSV analytics engine
		this.analyticsService = await this.services.get<AnalyticsService>("analyticsService");
		await this.analyticsService.load();
		this.analyticsService.setReadCsv(async (csvPath: string) => {
			const file = this.app.vault.getAbstractFileByPath(csvPath);
			if (!file || !(file instanceof TFile)) return null;
			const content = await this.app.vault.read(file);
			const { CsvParser } = await import("./domain/dataExchange/CsvParser");
			return new CsvParser().parse(content);
		});
		this.analyticsService.setQueryFolder(`${settingsService.getSettings().docsRootPath}/Queries`);

		// Wire .base file analytics adapter (delegates to ExportService)
		const { BaseAnalyticsAdapter } = await import("./domain/analytics/BaseAnalyticsAdapter");
		const exportSvc = this.dataExchangeService!.getExportService();
		this.analyticsService.setBaseAdapter(new BaseAnalyticsAdapter({
			scanColumns: (path, viewIndex) => exportSvc.scanResolvedColumns(path, viewIndex),
			resolveFiles: (path, sourceType, viewIndex) => exportSvc.resolveExportFiles(path, sourceType, viewIndex),
		}));

		// Train Main View — register view factory + auto-open on train start
		this.registerView(VIEW_TYPE_TRAIN_MAIN, (leaf) =>
			new TrainMainView(leaf, this.eventBus, this.trainService!, () => ({
				trainFolder: settingsService.getSettings().trainFolder,
				trainCanvasEnabled: settingsService.getSettings().trainCanvasEnabled,
				trainCanvasAutoOpen: settingsService.getSettings().trainCanvasAutoOpen,
			}), {
				getSession: (sessionId) => this.sessionService?.getSessionById(sessionId) ?? null,
				completeClosure: (sessionId, response) => {
					void this.sessionService?.completeClosure(sessionId, response);
				},
				skipClosure: (sessionId) => {
					void this.sessionService?.skipClosure(sessionId);
				},
			}),
		);

		// Train Timeline Sidebar — register view factory + auto-open in right sidebar
		this.registerView(VIEW_TYPE_TRAIN_TIMELINE, (leaf) =>
			new TrainTimelineSidebar(leaf, this.eventBus, this.trainService!, () => ({
				trainFolder: settingsService.getSettings().trainFolder,
				trainCanvasEnabled: settingsService.getSettings().trainCanvasEnabled,
				trainCanvasAutoOpen: settingsService.getSettings().trainCanvasAutoOpen,
			})),
		);

		// Train Hub — central management view for all trains
		this.registerView(VIEW_TYPE_TRAIN_HUB, (leaf) =>
			new TrainHubView(leaf, this.eventBus, this.trainService!, (trainId) => {
				this.revealOrCreateTrainView(trainId);
			}),
		);

		// Open Train Hub on command
		this.crossCuttingListeners.push(
			this.eventBus.on("ui.openTrainHub", () => {
				const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_TRAIN_HUB);
				if (existing.length > 0) {
					void this.app.workspace.revealLeaf(existing[0]);
					return;
				}
				void this.app.workspace.getLeaf("tab").setViewState({
					type: VIEW_TYPE_TRAIN_HUB,
					active: true,
				});
			}),
		);

		// Analytics Hub — dedicated analytics view
		this.registerView(VIEW_TYPE_ANALYTICS_HUB, (leaf) =>
			new AnalyticsHubView(leaf, this.eventBus, this.analyticsService!),
		);

		// Open Analytics Hub on command
		this.crossCuttingListeners.push(
			this.eventBus.on("ui.openAnalyticsHub", () => {
				const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_ANALYTICS_HUB);
				if (existing.length > 0) {
					void this.app.workspace.revealLeaf(existing[0]);
					return;
				}
				void this.app.workspace.getLeaf("tab").setViewState({
					type: VIEW_TYPE_ANALYTICS_HUB,
					active: true,
				});
			}),
		);

		this.crossCuttingListeners.push(
			this.eventBus.on("train.started", (event) => {
				this.revealOrCreateTrainView(event.payload.train.id);
				this.revealOrCreateTrainTimeline(event.payload.train.id);
			}),
		);

		// Auto-open canvas when created (if trainCanvasAutoOpen is enabled)
		this.crossCuttingListeners.push(
			this.eventBus.on("train.canvas.created", (event) => {
				if (settingsService.getSettings().trainCanvasAutoOpen) {
					void this.app.workspace.openLinkText(event.payload.canvasPath, "", false);
				}
			}),
		);

		// Resume train → reveal Train Main View (modal opened separately via ui.startTrain)
		this.crossCuttingListeners.push(
			this.eventBus.on("train.resumed", (event) => {
				const train = this.trainService?.getTrain(event.payload.trainId);
				if (train) {
					this.revealOrCreateTrainView(train.id);
				}
			}),
		);

		// Open/reveal Train Main View on command (accepts optional trainId)
		this.crossCuttingListeners.push(
			this.eventBus.on("ui.openTrainView", (event) => {
				const trainId = event.payload.trainId ?? this.trainService?.getActiveTrain()?.id ?? null;
				this.revealOrCreateTrainView(trainId);
			}),
		);

		// Toggle Train Timeline Sidebar — 3-state: open, reveal, or collapse
		this.crossCuttingListeners.push(
			this.eventBus.on("ui.toggleTrainTimeline", (event) => {
				const rightSplit = (this.app.workspace as unknown as {
					rightSplit?: { collapsed?: boolean; expand?: () => void; collapse?: () => void };
				}).rightSplit;
				const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TRAIN_TIMELINE);

				// Force close — always collapse (used after closure ritual)
				if (event.payload.forceClose) {
					rightSplit?.collapse?.();
					return;
				}

				// Case 1: Sidebar is collapsed → expand and show timeline
				if (rightSplit?.collapsed) {
					rightSplit.expand?.();
					if (existingLeaves.length > 0) {
						void this.app.workspace.revealLeaf(existingLeaves[0]);
					} else {
						this.revealOrCreateTrainTimeline(event.payload.trainId);
					}
					return;
				}

				// Sidebar is open
				if (existingLeaves.length > 0) {
					// Timeline leaf exists — check if it's visible
					const timelineLeaf = existingLeaves[0];
					const isVisible = timelineLeaf.view?.containerEl?.isShown?.() !== false;
					if (isVisible) {
						// Case 2: Timeline is visible → collapse sidebar
						rightSplit?.collapse?.();
					} else {
						// Case 3: Different tab is active → reveal timeline
						void this.app.workspace.revealLeaf(timelineLeaf);
					}
				} else {
					// No timeline leaf exists → create it
					this.revealOrCreateTrainTimeline(event.payload.trainId);
				}
			}),
		);

		// Resume paused train (command palette)
		this.crossCuttingListeners.push(
			this.eventBus.on("ui.resumeTrain", () => {
				const paused = this.trainService?.getAllTrains().find((t) => t.status === "paused");
				if (!paused) {
					new Notice("No paused train to resume");
					return;
				}
				void this.trainService!.resume(paused.id);
			}),
		);

		// Complete current train (command palette)
		this.crossCuttingListeners.push(
			this.eventBus.on("ui.completeTrain", () => {
				const active = this.trainService?.getActiveTrain();
				if (!active) {
					new Notice("No active train to complete");
					return;
				}
				void this.trainService!.completeTrain(active.id);
			}),
		);

		// Rename train folder when train is renamed
		this.crossCuttingListeners.push(
			this.eventBus.on("train.renamed", (event) => {
				const { oldFolder, newFolder } = event.payload;
				if (oldFolder && newFolder && oldFolder !== newFolder) {
					const folder = this.app.vault.getAbstractFileByPath(oldFolder);
					if (folder) {
						void this.app.vault.rename(folder, newFolder);
					}
				}
			}),
		);

		// Rename vault note when a thought is renamed
		this.crossCuttingListeners.push(
			this.eventBus.on("train.thought.renamed", (event) => {
				const { oldPath, newPath } = event.payload;
				if (oldPath !== newPath) {
					const file = this.app.vault.getAbstractFileByPath(oldPath);
					if (file) {
						void this.app.vault.rename(file, newPath);
					}
				}
			}),
		);

		// Open canvas for active train (command palette)
		this.crossCuttingListeners.push(
			this.eventBus.on("ui.openTrainCanvas", () => {
				const active = this.trainService?.getActiveTrain();
				if (!active) {
					new Notice("No active train");
					return;
				}
				const settings = settingsService.getSettings();
				if (!settings.trainCanvasEnabled || !active.folderPath) {
					new Notice("Train canvas is not enabled");
					return;
				}
				const canvasPath = getCanvasPath(active.title, active.folderPath);
				void this.app.workspace.openLinkText(canvasPath, "", false);
			}),
		);

		// Open train timeline sidebar for active train (command palette)
		this.crossCuttingListeners.push(
			this.eventBus.on("ui.openTrainTimeline", () => {
				const active = this.trainService?.getActiveTrain();
				if (!active) {
					new Notice("No active train");
					return;
				}
				this.revealOrCreateTrainTimeline(active.id);
			}),
		);

		// Auto-open Session Workspace for train closure ritual
		// Train sessions suppress workspace on start, but need it for closure
		this.crossCuttingListeners.push(
			this.eventBus.on("session.closure.started", (event) => {
				const session = this.sessionService?.getSessionById(event.payload.sessionId);
				if (!session || session.type !== "train-of-thought") return;

				const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE);
				if (existingLeaves.length > 0) {
					// Already open — just reveal it (it will re-render the closure overlay)
					void this.app.workspace.revealLeaf(existingLeaves[0]);
					return;
				}

				void this.app.workspace.getLeaf("tab").setViewState({
					type: VIEW_TYPE_SESSION_WORKSPACE,
					active: true,
				});
			}),
		);

		// Auto-open workspace and focus file when a session starts
		// Skip if a workspace already exists (e.g. started from sidebar)
		// Skip for train-of-thought sessions — they use TrainMainView instead
		this.crossCuttingListeners.push(
			this.eventBus.on("session.started", (event) => {
				const { session } = event.payload;
				this.sessionService!.workspaceSessionId = session.id;

				// Train sessions use the Train Main View, not Session Workspace
				if (session.type === "train-of-thought") return;

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

		return settingsService;
	}

	/**
	 * Opens the Train capture modal in a recursive loop.
	 * Each submit fires addThought in the background and opens the next modal
	 * immediately (optimistic) to keep the capture flow snappy.
	 * Cancel (escape/close) pauses the train. Complete ends it permanently.
	 */
	/**
	 * Opens the Train Main View for a specific train, or reveals an existing one.
	 * If no train ID is given (e.g. no active train), opens the view in empty state.
	 */
	private revealOrCreateTrainView(trainId: string | null): void {
		const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TRAIN_MAIN);
		if (existingLeaves.length > 0) {
			// Already open — refresh with the given train and reveal
			for (const leaf of existingLeaves) {
				void leaf.setViewState({
					type: VIEW_TYPE_TRAIN_MAIN,
					state: { trainId },
				});
			}
			void this.app.workspace.revealLeaf(existingLeaves[0]);
			return;
		}
		void this.app.workspace.getLeaf("tab").setViewState({
			type: VIEW_TYPE_TRAIN_MAIN,
			active: true,
			state: { trainId },
		});
	}

	/**
	 * Opens the Train Timeline Sidebar in the right split, or reveals an existing one.
	 */
	private revealOrCreateTrainTimeline(trainId: string | null): void {
		const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TRAIN_TIMELINE);
		if (existingLeaves.length > 0) {
			for (const leaf of existingLeaves) {
				void leaf.setViewState({
					type: VIEW_TYPE_TRAIN_TIMELINE,
					state: { trainId },
				});
			}
			void this.app.workspace.revealLeaf(existingLeaves[0]);
			return;
		}
		void this.app.workspace.getRightLeaf(false)?.setViewState({
			type: VIEW_TYPE_TRAIN_TIMELINE,
			active: true,
			state: { trainId },
		});
	}

	private openTrainModal(
		trainId: string,
		trainTitle: string,
		overrides?: { previousTitle: string; thoughtCount: number },
		fromThoughtId?: string,
		mergeDown?: boolean,
	): void {
		if (!this.trainService) return;

		// Sync the active thought across all views (main view + timeline sidebar)
		if (fromThoughtId) {
			void this.eventBus.emit("train.thought.activated", { trainId, thoughtId: fromThoughtId });
		}

		let previousThoughtTitle: string | null;
		let thoughtCount: number;

		if (overrides) {
			previousThoughtTitle = overrides.previousTitle;
			thoughtCount = overrides.thoughtCount;
		} else {
			const train = this.trainService.getTrain(trainId);
			if (!train) return;

			// Use the specified thought as context, otherwise fall back to last thought
			const contextThought = fromThoughtId
				? train.thoughts.find((t) => t.id === fromThoughtId) ?? null
				: train.thoughts[train.thoughts.length - 1] ?? null;
			previousThoughtTitle = contextThought?.title ?? null;
			thoughtCount = train.thoughts.length;
		}

		// Resolve timer info from TrainState
		const train = this.trainService.getTrain(trainId);
		const durationMinutes = train?.durationMinutes ?? 0;
		const sessionId = train?.sessionId;

		// Compute current remaining time to avoid timer reset flash when modal reopens
		let initialRemainingMs: number | undefined;
		if (durationMinutes > 0 && sessionId && this.sessionService) {
			const session = this.sessionService.getSessionById(sessionId);
			if (session) {
				initialRemainingMs = computeRemainingMs(session);
			}
		}

		// Auto-detect direction: if the source thought already has a "next" child, default to "branch"
		let defaultDirection: import("./domain/train/types").ThoughtDirection = "next";
		if (fromThoughtId && train) {
			const hasNextChild = train.relations.some(
				(r) => r.fromId === fromThoughtId && r.direction === "next",
			);
			if (hasNextChild) {
				defaultDirection = "branch";
			}
		}

		// Timer subscriptions — closures that filter by sessionId
		const subscribeTimerTick = (durationMinutes > 0 && sessionId)
			? (cb: (remainingMs: number) => void) => {
				return this.eventBus.on("session.timer.tick", (event) => {
					if (event.payload.sessionId === sessionId) {
						cb(event.payload.remainingMs);
					}
				});
			}
			: undefined;

		const subscribeTimerCompleted = (durationMinutes > 0 && sessionId)
			? (cb: () => void) => {
				return this.eventBus.on("session.timer.completed", (event) => {
					if (event.payload.sessionId === sessionId) {
						cb();
					}
				});
			}
			: undefined;

		// Navigation callbacks — mirrors the thought's link directions (prev/next/up)
		// Each emits train.thought.activated so main view + timeline sync to the new thought.
		let onBack: (() => void) | undefined;
		let onNext: (() => void) | undefined;
		let onUp: (() => void) | undefined;
		let onDown: (() => void) | undefined;
		if (fromThoughtId && train) {
			// prev: linear parent (any relation pointing TO this thought)
			const parentRelation = train.relations.find((r) => r.toId === fromThoughtId);
			if (parentRelation) {
				const parentId = parentRelation.fromId;
				onBack = () => this.openTrainModal(trainId, trainTitle, undefined, parentId);
			}
			// next: linear child (direction="next" from this thought)
			const nextRelation = train.relations.find(
				(r) => r.fromId === fromThoughtId && r.direction === "next",
			);
			if (nextRelation) {
				const nextId = nextRelation.toId;
				onNext = () => this.openTrainModal(trainId, trainTitle, undefined, nextId);
			}
			// up: first branch child (direction="branch" from this thought)
			const branchRelation = train.relations.find(
				(r) => r.fromId === fromThoughtId && r.direction === "branch",
			);
			if (branchRelation) {
				const branchId = branchRelation.toId;
				onUp = () => this.openTrainModal(trainId, trainTitle, undefined, branchId);
			}
			// down: branch parent (parent with direction="branch" pointing TO this thought)
			const branchParentRelation = train.relations.find(
				(r) => r.toId === fromThoughtId && r.direction === "branch",
			);
			if (branchParentRelation) {
				const branchParentId = branchParentRelation.fromId;
				onDown = () => this.openTrainModal(trainId, trainTitle, undefined, branchParentId);
			}
		}

		// Detect branch for merge-down option (available whenever thought is on a branch)
		const mergeDownInfo = (fromThoughtId && train)
			? this.trainService.findMergeDownTarget(trainId, fromThoughtId)
			: null;
		const isBranchEndpoint = mergeDownInfo !== null;

		// Check if source thought has been merged into another thought
		const isMerged = (fromThoughtId && train)
			? train.relations.some((r) => r.fromId === fromThoughtId && r.direction === "merge")
			: false;

		new TrainCaptureModal(this.app, {
			trainTitle,
			previousThoughtTitle,
			thoughtCount,
			durationMinutes,
			initialRemainingMs,
			defaultDirection,
			subscribeTimerTick,
			subscribeTimerCompleted,
			onBack,
			onNext,
			onUp,
			onDown,
			isBranchEndpoint,
			isMerged,
			defaultMergeDown: mergeDown,
			onRenameThought: fromThoughtId ? (newTitle) => {
				void this.trainService!.renameThought(trainId, fromThoughtId, newTitle);
			} : undefined,
			onMergeDown: isBranchEndpoint ? (title) => {
				if (mergeDownInfo.targetId) {
					// Add thought on branch, then merge it into main chain target
					void this.trainService!.addThought(trainId, title, {
						direction: "next",
						fromThoughtId: fromThoughtId!,
					}).then(async (newThought) => {
						if (newThought) {
							await this.trainService!.mergeBranch(trainId, newThought.id, mergeDownInfo.targetId!);
						}
						// Continue from the main chain target
						this.openTrainModal(trainId, trainTitle, {
							previousTitle: title,
							thoughtCount: thoughtCount + 1,
						}, mergeDownInfo.targetId!);
					});
				} else {
					// No next on main chain — add thought as "next" from origin, then merge branch into it
					void this.trainService!.addThought(trainId, title, { direction: "next", fromThoughtId: mergeDownInfo.originId }).then(async (newThought) => {
						if (newThought) {
							await this.trainService!.mergeBranch(trainId, fromThoughtId!, newThought.id);
						}
						this.openTrainModal(trainId, trainTitle, {
							previousTitle: title,
							thoughtCount: thoughtCount + 1,
						}, newThought?.id);
					});
				}
			} : undefined,
			onSubmit: (title, direction) => {
				// Await addThought so the next modal chains from the correct thought
				void this.trainService!.addThought(trainId, title, { direction, fromThoughtId }).then((newThought) => {
					this.openTrainModal(trainId, trainTitle, {
						previousTitle: title,
						thoughtCount: thoughtCount + 1,
					}, newThought?.id);
				});
			},
			onComplete: () => {
				void this.trainService!.completeTrain(trainId);
			},
			onCancel: () => {
				void this.trainService!.pause(trainId);
			},
		}).open();
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
			hubRegistry: this.hubRegistry,
			docsRootPath: settingsService.getSettings().docsRootPath,
			registerView: (type, factory) => this.registerView(type, factory),
			registerExtensions: (exts, type) => { try { this.registerExtensions(exts, type); } catch { /* may already be registered */ } },
			registerEvent: (ref) => this.registerEvent(ref),
			addCommand: (cmd) => this.addCommand(cmd),
		});
		dxSetup.wireCallbacks();
		dxSetup.registerViews();
		dxSetup.registerFileMenuItems();
		dxSetup.registerCommands();

		this.uiCommandService?.setOpenCsvImport(
			(filePath, savedConfig) => dxSetup.openCsvImportWithConfig(filePath, savedConfig),
		);
		this.uiCommandService?.setOpenExportView(
			(sourcePath, sourceType, format) => dxSetup.openExportView(sourcePath, sourceType, format),
		);
		this.uiCommandService?.setOpenExportWithSavedConfig(
			(savedConfig) => dxSetup.openExportWithSavedConfig(savedConfig),
		);
	}

	/**
	 * Configures the HubRegistry with all hub providers and
	 * registers the User Hub view + session views/commands.
	 */
	private setupHubRegistry(): void {
		this.hubRegistry = new HubRegistry(this.app, this.eventBus);
		this.hubRegistry.register(new EventCatalogProvider({
			getSettings: () => this.settings,
			getExcludedTypes: () => this.eventFilterService?.getExcludedTypes() ?? [],
			getNotifiedTypes: () => this.eventNotifyService?.getNotifiedTypes() ?? [],
			getDiscoveredEvents: () => this.discoveryService?.getDiscoveredEvents() ?? [],
			collapsedCategories: this.collapsedCategories,
		}));
		this.hubRegistry.register(new DataExchangeProvider(this.dataExchangeService!));
		this.hubRegistry.register(new AnalyticsHubProvider(this.analyticsService!));

		this.registerView(VIEW_TYPE_USER_HUB, (leaf) =>
			new UserHubView(leaf, this.eventBus, this.userService, this.hubRegistry!, this.inboxService!, this.sessionService!, this.nudgeService!, this.settings.inboxEnabledSources, this.settings, this.trainService),
		);
		this.hubRegistry.register(new UserHubProvider(this.userService, this.inboxService!));

		// Session views, commands, and file-menu items
		this.sessionSetup = new SessionSetup({
			app: this.app,
			eventBus: this.eventBus,
			errorService: this.errorService,
			sessionService: this.sessionService!,
			trainService: this.trainService,
			registerView: (type, factory) => this.registerView(type, factory),
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
				return this.app.vault.getFiles()
					.filter((f) => f.path.startsWith(folder + "/"))
					.map((f) => f.path);
			});
		} catch (error) {
			this.errorService.handle(
				error instanceof Error ? error : new Error(String(error)),
				"ingestion.catchUp"
			);
		}
	}

	/**
	 * Get a service from the container.
	 * Convenience method for external access.
	 */
	async getService<T>(id: string): Promise<T> {
		return this.services.get<T>(id);
	}
}
