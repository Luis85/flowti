import { Notice, Plugin, TFile, TFolder } from "obsidian";
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
import type { SessionService } from "./domain/session/SessionService";
import type { IngestionService } from "./domain/ingestion/IngestionService";
import { registerViews } from "./infrastructure/views/registry";
import type { IViewRegistry } from "./infrastructure/views/types";
import { IngestionStatusBar } from "./ui/IngestionStatusBar";
import { DataExchangeService } from "./domain/dataExchange/DataExchangeService";
import { DataExchangeSetup } from "./dataExchangeSetup";
import { UiCommandService } from "./infrastructure/ui/UiCommandService";
import { InputModal, NewSessionModal } from "./ui/modals";
import { SESSION_TYPES, type SessionType } from "./domain/session/types";
import { generateSessionSummary, mergeSessionNotes } from "./domain/session/helpers";
import { createInfrastructure, setupCrossCuttingListeners } from "./pluginBootstrap";
import { HubRegistry } from "./domain/hub/HubRegistry";
import { EventCatalogProvider } from "./domain/hub/EventCatalogProvider";
import { DataExchangeProvider } from "./domain/hub/DataExchangeProvider";
import { UserHubProvider } from "./domain/hub/UserHubProvider";
import { UserHubView, VIEW_TYPE_USER_HUB } from "./ui/UserHubView";
import { SessionWorkspaceView, VIEW_TYPE_SESSION_WORKSPACE } from "./ui/SessionWorkspaceView";


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
	private ingestionStatusBar?: IngestionStatusBar;
	private collapsedCategories = new Set<string>();
	private uiCommandService?: UiCommandService;
	private hubRegistry?: HubRegistry;
	private crossCuttingListeners: (() => void)[] = [];

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

			// Status bar
			const statusBarEl = this.addStatusBarItem();
			this.ingestionStatusBar = new IngestionStatusBar(statusBarEl, this.eventBus);
			this.ingestionStatusBar.register();

			// ── Phase 6: Post-load ────────────────────────────────────
			// Deferred until Obsidian's workspace layout is ready.
			this.app.workspace.onLayoutReady(() => {
				this.onLayoutReady();
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
		try {
			void this.eventBus?.emit("plugin.unloading", {
				timestamp: new Date().toISOString(),
			});

			// Auto-stop daily session if running
			if (this.sessionService?.getDailySession()) {
				void this.eventBus?.emit("session.daily.stop", {});
			}

			this.uiCommandService?.dispose();
			this.ingestionStatusBar?.dispose();
			this.eventBridge?.dispose();
			await this.services?.disposeAll();
			this.commands?.clear();
			this.views?.clear();

			// Unsubscribe cross-cutting listeners before clearing EventBus
			for (const unsub of this.crossCuttingListeners) {
				unsub();
			}
			this.crossCuttingListeners = [];

			this.logger?.info("Plugin unloaded");

			void this.eventBus?.emit("plugin.unloaded", {
				timestamp: new Date().toISOString(),
			});

			// EventBus is cleared last so that unloaded listeners still fire.
			this.eventBus?.clear();
		} catch (error) {
			console.error("[Flowti] Plugin unload error:", error);
		}
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
			this.logger?.warn("Invalid settings, using defaults", {
				errors: result.error.issues,
			});
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
			this.wireDataExchange(settingsService);
			this.setupHubRegistry();
			this.registerSessionFileMenu();
			await this.runIngestionCatchUp();

			this.eventBridge.registerVaultListeners();
			void this.eventBus.emit("plugin.ready", {
				timestamp: new Date().toISOString(),
			});

			// Auto-start daily session if enabled (idempotent — skips if already running)
			if (this.settings.enableDailySession) {
				setTimeout(() => {
					void this.eventBus.emit("session.daily.start", { dailyNotePath: this.settings.dailyNotePath });
				}, 500);
			}
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
		await this.inboxService.load();

		this.eventBus.on("settings.changed", (event) => {
			this.inboxService?.setEnabledSources(event.payload.settings.inboxEnabledSources);
			if (this.sessionService) {
				this.sessionService.globalActivityFilter = event.payload.settings.sessionActivityFilterGlobal ?? [];
			}
			// Sync custom output templates to all open workspace views
			const templates = event.payload.settings.customOutputTemplates ?? [];
			for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE)) {
				(leaf.view as SessionWorkspaceView).customOutputTemplates = templates;
			}

			// Runtime toggle: start/stop daily session when setting changes
			if (event.payload.settings.enableDailySession && !this.sessionService?.getDailySession()) {
				void this.eventBus.emit("session.daily.start", { dailyNotePath: event.payload.settings.dailyNotePath });
			} else if (!event.payload.settings.enableDailySession && this.sessionService?.getDailySession()) {
				void this.eventBus.emit("session.daily.stop", {});
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
				void this.writeSessionSummary(event.payload.session);
			}),
		);

		// Write daily session summary when daily tracking stops
		this.crossCuttingListeners.push(
			this.eventBus.on("session.daily.stopped", (event) => {
				void this.writeSessionSummary(event.payload.session);
			}),
		);

		// Auto-open workspace and focus file when a session starts
		// Skip if a workspace already exists (e.g. started from sidebar)
		this.crossCuttingListeners.push(
			this.eventBus.on("session.started", (event) => {
				const { session } = event.payload;
				this.sessionService!.workspaceSessionId = session.id;

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
	 * Wires Data Exchange UI: views, commands, file-menu items,
	 * and UiCommandService callbacks.
	 */
	private wireDataExchange(settingsService: ISettingsService): void {
		const dxSetup = new DataExchangeSetup({
			app: this.app,
			eventBus: this.eventBus,
			dataExchangeService: this.dataExchangeService!,
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
	 * registers the User Hub view.
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

		this.registerView(VIEW_TYPE_USER_HUB, (leaf) =>
			new UserHubView(leaf, this.eventBus, this.userService, this.hubRegistry!, this.inboxService!, this.sessionService!, this.settings.inboxEnabledSources, this.settings),
		);
		this.hubRegistry.register(new UserHubProvider(this.userService, this.inboxService!, this.sessionService));

		// Session Workspace — dedicated focused leaf for active sessions
		this.registerView(VIEW_TYPE_SESSION_WORKSPACE, (leaf) =>
			new SessionWorkspaceView(leaf, this.eventBus, this.sessionService!),
		);
		this.addCommand({
			id: "flowti:open-session-workspace",
			name: "Open Session Workspace",
			icon: "timer",
			callback: () => {
				void this.app.workspace.getLeaf("tab").setViewState({
					type: VIEW_TYPE_SESSION_WORKSPACE,
					active: true,
				});
			},
		});
		this.addCommand({
			id: "flowti:open-session-workspace-sidebar",
			name: "Open Session Workspace in Sidebar",
			icon: "panel-right",
			callback: () => {
				this.openSessionWorkspaceInSidebar();
			},
		});
	}

	/**
	 * Opens the Session Workspace in the right sidebar.
	 * Reuses an existing sidebar leaf if one exists; otherwise creates one.
	 * Always reveals the leaf so the sidebar opens if collapsed.
	 */
	private openSessionWorkspaceInSidebar(sessionId?: string): void {
		if (sessionId) {
			this.sessionService!.workspaceSessionId = sessionId;
		}
		setTimeout(() => {
			const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE)
				.find((l) => l.getRoot() === this.app.workspace.rightSplit);
			const leaf = existing ?? this.app.workspace.getRightLeaf(false);
			if (leaf) {
				void leaf.setViewState({
					type: VIEW_TYPE_SESSION_WORKSPACE,
					active: true,
				});
				this.app.workspace.revealLeaf(leaf);
			}
		}, 0);
	}

	/**
	 * Registers file-menu items so users can right-click any file
	 * in the navigator and either add it to the current session
	 * or create a new session with that file as the focus.
	 */
	private registerSessionFileMenu(): void {
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				const isFile = file instanceof TFile;
				const isFolder = file instanceof TFolder;
				if (!isFile && !isFolder) return;

				menu.addSeparator();

				// "Add to {session title}" — when any session is current
				const current = this.sessionService?.getCurrentSession();
				if (current) {
					const bindType = isFolder ? "folder" as const : "file" as const;
					const bindPath = isFolder ? file.path + "/" : file.path;
					const label = isFolder ? file.name : (file as TFile).basename;
					menu.addItem((item) => {
						item.setTitle(`Add to "${current.title}"`)
							.setIcon("link")
							.onClick(() => {
								void this.eventBus.emit("session.context.bind", {
									sessionId: current.id,
									path: bindPath,
									type: bindType,
								});
								new Notice(`Added "${label}" to "${current.title}"`);
							});
					});
				}

				if (isFile) {
					menu.addItem((item) => {
						item.setTitle("Create New Session")
							.setIcon("timer")
							.onClick(() => {
								new NewSessionModal(this.app, {
									sessionTypes: SESSION_TYPES,
									templates: this.sessionService?.getSavedTemplates() ?? [],
									prefill: { title: "", type: SESSION_TYPES[0].type, durationMinutes: 25, focusFile: file.path },
									onSubmit: (title, type, durationMinutes, focusFile, goals) => {
										void this.eventBus.emit("session.create", {
											type: type as SessionType,
											title,
											durationMinutes,
											focusFile: focusFile ?? undefined,
											goals: goals.length > 0 ? goals : undefined,
										});
									},
								}).open();
							});
					});
				}

				menu.addSeparator();
			}),
		);
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
	 * Writes a Markdown summary to the session's notes file.
	 * Creates the folder and file if they don't exist yet.
	 */
	private async writeSessionSummary(session: import("./domain/session/types").Session): Promise<void> {
		if (!session.notesFile) return;

		try {
			// Ensure folder exists
			const folder = session.notesFile.substring(0, session.notesFile.lastIndexOf("/"));
			if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
				await this.app.vault.createFolder(folder);
			}

			const existing = this.app.vault.getAbstractFileByPath(session.notesFile);
			if (existing instanceof TFile) {
				// Merge: preserve user content, update frontmatter, append/replace summary
				const existingContent = await this.app.vault.read(existing);
				const merged = mergeSessionNotes(existingContent, session);
				await this.app.vault.modify(existing, merged);
			} else {
				// New file: generate full document
				const markdown = generateSessionSummary(session);
				await this.app.vault.create(session.notesFile, markdown);
			}
		} catch (error) {
			this.errorService?.handle(
				error instanceof Error ? error : new Error(String(error)),
				"writeSessionSummary",
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
