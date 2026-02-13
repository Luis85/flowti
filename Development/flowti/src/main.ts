import { Notice, Plugin, TFile, TFolder } from "obsidian";
import {
	CommandRegistry,
	createErrorMiddleware,
	createLoggingMiddleware,
} from "./infrastructure/commands/CommandRegistry";
import { registerCommands } from "./infrastructure/commands/registry";
import type { CommandContext, ICommandRegistry } from "./infrastructure/commands/types";
import { ErrorService } from "./infrastructure/errors/ErrorService";
import { LifecycleError } from "./infrastructure/errors/FlowtiError";
import type { IErrorService } from "./infrastructure/errors/types";
import { EventBridge } from "./infrastructure/events/EventBridge";
import { EventBus } from "./infrastructure/events/EventBus";
import type { IEventBridge, IEventBus } from "./infrastructure/events/types";
import { LoggerService } from "./infrastructure/logger/LoggerService";
import type { ILogger } from "./infrastructure/logger/types";
import { registerServices } from "./infrastructure/services/registry";
import { ServiceContainer } from "./infrastructure/services/ServiceContainer";
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
import type { IngestionService } from "./domain/ingestion/IngestionService";
import { registerViews } from "./infrastructure/views/registry";
import type { IViewRegistry } from "./infrastructure/views/types";
import { ViewRegistry } from "./infrastructure/views/ViewRegistry";
import { IngestionStatusBar } from "./ui/IngestionStatusBar";
import { VIEW_TYPE_EVENT_CATALOG } from "./ui/EventCatalogView";
import { DataExchangeService } from "./domain/dataExchange/DataExchangeService";
import type { ExportFormat, VaultFileInfo } from "./domain/dataExchange/types";
import { InputModal } from "./ui/modals";
import { CsvActionView, VIEW_TYPE_CSV } from "./ui/CsvActionView";
import { ExportView, VIEW_TYPE_EXPORT, type ExportViewConfig } from "./ui/ExportView";
import { DataExchangeHubView, VIEW_TYPE_DATA_EXCHANGE_HUB } from "./ui/DataExchangeHubView";
import type { SavedImportConfig, SavedExportConfig } from "./domain/dataExchange/types";


/**  
 * Main plugin class for Flowti - Integrated Business Development Environment.
 *
 * Acts as the orchestrator for the plugin lifecycle. All domain logic lives in
 * dedicated services that communicate through the {@link EventBus}. The plugin
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
 * - The {@link EventBridge} owns all Obsidian API ↔ EventBus translation
 *   (file operations, frontmatter, vault change notifications).
 *   This keeps services decoupled from Obsidian and fully testable.
 * - Cross-cutting event listeners (logging, debug mode sync) stay here
 *   in `setupEventListeners` because they span multiple domains.
 * - Shutdown order is the reverse of startup: EventBridge → Services →
 *   Commands → Views → EventBus.
 *
 * @see {@link EventBridge} for Obsidian API bridging
 * @see {@link ServiceContainer} for dependency injection
 * @see {@link CommandRegistry} for command middleware pipeline
 */
export default class FlowtiBasePlugin extends Plugin {
	settings: FlowtiSettings;
	eventBus: IEventBus;
	eventBridge: IEventBridge;
	logger: ILogger;
	errorService: IErrorService;
	services: IServiceContainer;
	commands: ICommandRegistry;
	views: IViewRegistry;

	// Service references (populated in onLayoutReady)
	userService: IUserService;
	private eventFilterService?: EventFilterService;
	private eventNotifyService?: EventNotificationService;
	private discoveryService?: DiscoveryService;
	private subscriptionService?: SubscriptionService;
	private ingestionService?: IngestionService;
	private eventDefinitionService?: EventDefinitionService;
	private dataExchangeService?: DataExchangeService;
	private ingestionStatusBar?: IngestionStatusBar;
	private collapsedCategories = new Set<string>();
	private pendingExportConfig: ExportViewConfig | null = null;
	private pendingImportAutoStart = false;
	private pendingSavedImportConfig: SavedImportConfig | null = null;
	private pendingSavedExportConfig: SavedExportConfig | null = null;
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
			// ── Phase 1: Core infrastructure ──────────────────────────
			// Order matters: each component depends on the ones above it.
			await this.loadSettings();
			this.initializeEventBus();

			void this.eventBus.emit("plugin.loading", {
				timestamp: new Date().toISOString(),
			});

			this.initializeLogger();
			this.initializeErrorService();
			this.initializeEventBridge();
			this.setupEventListeners();

			void this.eventBus.emit("settings.loaded", { settings: this.settings });

			// ── Phase 2: Containers ───────────────────────────────────
			this.initializeServiceContainer();
			this.initializeCommandRegistry();
			this.initializeViewRegistry();

			// ── Phase 3: Registration ─────────────────────────────────
			this.registerAllServices();
			this.registerAllCommands();
			this.registerAllViews();

			// ── Phase 4: Service initialization ───────────────────────
			// Resolves dependency graph and initializes in topological order.
			await this.services.initializeAll();

			// ── Phase 5: UI binding ───────────────────────────────────
			this.addSettingTab(new FlowtiSettingTab(this.app, this));
			this.bindViews();
			this.bindCommands();

			// Ribbon icon — opens Event Catalog
			this.addRibbonIcon("list", "Open Event Catalog", () => {
				const { workspace } = this.app;
				const existing = workspace.getLeavesOfType(VIEW_TYPE_EVENT_CATALOG);
				if (existing.length > 0) {
					workspace.revealLeaf(existing[0]);
					return;
				}
				const leaf = workspace.getLeaf(true);
				void leaf.setViewState({ type: VIEW_TYPE_EVENT_CATALOG, active: true });
				workspace.revealLeaf(leaf);
			});

			// Ribbon icon — opens Data Exchange Hub
			this.addRibbonIcon("arrow-left-right", "Open Data Exchange Hub", () => {
				const { workspace } = this.app;
				const existing = workspace.getLeavesOfType(VIEW_TYPE_DATA_EXCHANGE_HUB);
				if (existing.length > 0) {
					workspace.revealLeaf(existing[0]);
					return;
				}
				const leaf = workspace.getLeaf(true);
				void leaf.setViewState({ type: VIEW_TYPE_DATA_EXCHANGE_HUB, active: true });
				workspace.revealLeaf(leaf);
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
	 * Initialize the event bus for decoupled communication.
	 */
	private initializeEventBus(): void {
		this.eventBus = new EventBus();
	}

	/**
	 * Initialize the logger service.
	 */
	private initializeLogger(): void {
		this.logger = new LoggerService({
			eventBus: this.eventBus,
			debugMode: this.settings.debugMode,
		});
	}

	/**
	 * Initialize the error service for centralized error handling.
	 */
	private initializeErrorService(): void {
		this.errorService = new ErrorService({
			eventBus: this.eventBus,
			logger: this.logger,
		});
	}

	/**
	 * Registers cross-cutting event listeners that span multiple domains.
	 *
	 * These are intentionally kept in the plugin class rather than in a
	 * dedicated service because they glue infrastructure together
	 * (e.g. syncing debug mode between settings and logger).
	 *
	 * Domain-specific event handling (file system, frontmatter, vault
	 * notifications) is delegated to {@link EventBridge}.
	 */
	private setupEventListeners(): void {
		this.crossCuttingListeners.push(
			this.eventBus.on("settings.changed", (event) => {
				this.settings = event.payload.settings;
				this.collapsedCategories = new Set(event.payload.settings.collapsedCategories);
				this.logger.setDebugMode(event.payload.settings.debugMode);
				this.logger.debug("Settings changed", event.payload.settings);
			})
		);

		this.crossCuttingListeners.push(
			this.eventBus.on("error.occurred", (event) => {
				this.logger.debug("Error event received", event.payload);
			})
		);

		this.crossCuttingListeners.push(
			this.eventBus.on("user.created", (event) => {
				this.logger.debug("User created", { userName: event.payload.user.name });
			})
		);

		this.crossCuttingListeners.push(
			this.eventBus.on("user.updated", (event) => {
				this.logger.debug("User updated", { userName: event.payload.user.name });
			})
		);

		this.crossCuttingListeners.push(
			this.eventBus.on("user.loaded", (event) => {
				this.logger.debug("User loaded", { userName: event.payload.user.name });
			})
		);

		this.crossCuttingListeners.push(
			this.eventBus.on("plugin.ready", (event) => {
				this.logger.debug("Plugin ready", { timestamp: event.payload.timestamp });
			})
		);

		this.crossCuttingListeners.push(
			this.eventBus.on("installer.started", (event) => {
				this.logger.info("Installation started", { stepCount: event.payload.stepCount });
			})
		);

		this.crossCuttingListeners.push(
			this.eventBus.on("installer.completed", () => {
				this.logger.info("Installation completed");
			})
		);

		this.crossCuttingListeners.push(
			this.eventBus.on("installer.failed", (event) => {
				this.logger.error("Installation failed", {
					step: event.payload.failedStepId,
					error: event.payload.error,
				});
			})
		);

		this.crossCuttingListeners.push(
			this.eventBus.on("eventNotify.fired", (event) => {
				this.throttledNotice(
					`notify:${event.payload.eventType}`,
					`Event: ${event.payload.eventType}`,
				);
			})
		);

		this.crossCuttingListeners.push(
			this.eventBus.on("subscription.matched", (event) => {
				const label = event.payload.subscriptionLabel ?? event.payload.eventType;
				this.throttledNotice(
					`sub:${label}`,
					`Subscription matched: ${label}`,
				);
			})
		);
	}

	/**
	 * Creates the {@link EventBridge} and registers EventBus request handlers
	 * (file system, frontmatter). Vault/workspace/metadata listeners are
	 * deferred to {@link onLayoutReady} to avoid reacting to Obsidian's
	 * vault initialization events.
	 *
	 * Passes `registerEvent` as a callback so the bridge can register
	 * Obsidian EventRefs that are automatically cleaned up on plugin unload.
	 * EventBus subscriptions are cleaned up separately via {@link EventBridge.dispose}.
	 */
	private initializeEventBridge(): void {
		this.eventBridge = new EventBridge({
			app: this.app,
			eventBus: this.eventBus,
			logger: this.logger,
			registerEvent: (ref) => this.registerEvent(ref),
		});
		this.eventBridge.register();
	}

	/**
	 * Initialize the service container.
	 */
	private initializeServiceContainer(): void {
		this.services = new ServiceContainer({
			eventBus: this.eventBus,
			logger: this.logger,
		});
	}

	/**
	 * Creates the {@link CommandRegistry} and installs middleware.
	 *
	 * Middleware executes in LIFO order (last added runs first):
	 * 1. Error middleware - catches exceptions and routes to {@link ErrorService}
	 * 2. Logging middleware - tracks command start/completion/duration
	 */
	private initializeCommandRegistry(): void {
		this.commands = new CommandRegistry({
			eventBus: this.eventBus,
			logger: this.logger,
		});

		this.commands.use(createLoggingMiddleware());
		this.commands.use(
			createErrorMiddleware((error, command) => {
				this.errorService.handle(error, `Command:${command.id}`);
			})
		);
	}

	/**
	 * Initialize the view registry.
	 */
	private initializeViewRegistry(): void {
		this.views = new ViewRegistry({
			eventBus: this.eventBus,
			logger: this.logger,
		});
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
	 * Opens the ExportView in a new leaf with the given config.
	 */
	private openExportView(
		sourcePath: string,
		sourceType: "folder" | "base",
		format: ExportFormat,
	): void {
		this.pendingExportConfig = { sourcePath, sourceType, format };
		const leaf = this.app.workspace.getLeaf(true);
		void leaf.setViewState({ type: VIEW_TYPE_EXPORT, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	/**
	 * Opens CsvActionView with an optional saved import config pre-applied.
	 */
	private openCsvImportWithConfig(csvPath: string, savedConfig?: SavedImportConfig): void {
		const csvFile = this.app.vault.getAbstractFileByPath(csvPath);
		if (!(csvFile instanceof TFile)) {
			new Notice(`File not found: ${csvPath}`);
			return;
		}
		this.pendingSavedImportConfig = savedConfig ?? null;
		this.pendingImportAutoStart = true;
		const leaf = this.app.workspace.getLeaf(true);
		void leaf.openFile(csvFile);
	}

	/** Alias for context menu — opens ExportView with a saved config pre-applied. */
	private openExportViewWithConfig(savedConfig: SavedExportConfig): void {
		this.openExportWithSavedConfig(savedConfig);
	}

	/**
	 * Opens ExportView with a saved export config pre-applied.
	 */
	private openExportWithSavedConfig(savedConfig: SavedExportConfig): void {
		this.pendingExportConfig = {
			sourcePath: savedConfig.sourcePath,
			sourceType: savedConfig.sourceType,
			format: savedConfig.format,
		};
		this.pendingSavedExportConfig = savedConfig;
		const leaf = this.app.workspace.getLeaf(true);
		void leaf.setViewState({ type: VIEW_TYPE_EXPORT, active: true });
		this.app.workspace.revealLeaf(leaf);
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
			// Load SettingsService FIRST so its internal state matches storage.
			// Without this, any event-driven update (e.g. collapsing a category)
			// would merge with DEFAULT_SETTINGS and overwrite persisted values.
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

			this.ingestionService = await this.services.get<IngestionService>("ingestionService");
			await this.ingestionService.load();

			this.eventDefinitionService = await this.services.get<EventDefinitionService>("eventDefinitionService");
			await this.eventDefinitionService.load();

			// ── Data Exchange: load service, inject vault callback, register menus ──
			this.dataExchangeService = await this.services.get<DataExchangeService>("dataExchangeService");
			await this.dataExchangeService.load();
			this.dataExchangeService.setDocsRootPath(settingsService.getSettings().docsRootPath);
			this.dataExchangeService.setListFiles((folderPath: string): VaultFileInfo[] => {
				const results: VaultFileInfo[] = [];
				for (const file of this.app.vault.getFiles()) {
					if (folderPath && !file.path.startsWith(folderPath + "/")) continue;
					const cache = this.app.metadataCache.getFileCache(file);
					const folder = file.path.substring(0, file.path.lastIndexOf("/")) || "";
					const tags: string[] = [];
					if (cache) {
						const inlineTags = (cache.tags ?? []).map((t) => t.tag.replace(/^#/, ""));
						const fmTags = cache.frontmatter?.tags;
						if (Array.isArray(fmTags)) {
							for (const t of fmTags) tags.push(String(t));
						}
						for (const t of inlineTags) {
							if (!tags.includes(t)) tags.push(t);
						}
					}
					results.push({
						path: file.path,
						basename: file.basename,
						extension: file.extension,
						folder,
						frontmatter: cache?.frontmatter as Record<string, unknown> | undefined,
						stat: file.stat ? { ctime: file.stat.ctime, mtime: file.stat.mtime, size: file.stat.size } : undefined,
						tags: tags.length > 0 ? tags : undefined,
					});
				}
				return results;
			});
			this.dataExchangeService.setWriteExternalFile(async (absolutePath: string, content: string) => {
				const fs = require("fs") as typeof import("fs"); // eslint-disable-line @typescript-eslint/no-require-imports
				const path = require("path") as typeof import("path"); // eslint-disable-line @typescript-eslint/no-require-imports
				const dir = path.dirname(absolutePath);
				fs.mkdirSync(dir, { recursive: true });
				fs.writeFileSync(absolutePath, content, "utf-8");
			});
			this.dataExchangeService.setReadExternalFile(async (absolutePath: string) => {
				const fs = require("fs") as typeof import("fs"); // eslint-disable-line @typescript-eslint/no-require-imports
				try {
					return fs.readFileSync(absolutePath, "utf-8");
				} catch {
					return null;
				}
			});

			// File-menu context items for import/export
			this.registerEvent(
				this.app.workspace.on("file-menu", (menu, file) => {
					if (file instanceof TFile && file.extension === "csv") {
						menu.addItem((item) => {
							item.setTitle("Import as Notes")
								.setIcon("file-input")
								.onClick(() => {
									this.pendingImportAutoStart = true;
									const leaf = this.app.workspace.getLeaf(true);
									void leaf.openFile(file);
								});
						});

						// Existing import configs for this CSV
						const importConfigs = this.dataExchangeService!.getImportConfigsForFile(file.path);
						if (importConfigs.length > 0) {
							menu.addSeparator();
							for (const cfg of importConfigs.slice(0, 5)) {
								menu.addItem((item) => {
									item.setTitle(`Import with: ${cfg.name}`)
										.setIcon("play")
										.onClick(() => {
											this.pendingSavedImportConfig = cfg;
											this.pendingImportAutoStart = true;
											const leaf = this.app.workspace.getLeaf(true);
											void leaf.openFile(file);
										});
								});
							}
						}
					}

					if (file instanceof TFile && file.extension === "base") {
						menu.addItem((item) => {
							item.setTitle("Export as CSV")
								.setIcon("file-output")
								.onClick(() => this.openExportView(file.path, "base", "csv"));
						});
						menu.addItem((item) => {
							item.setTitle("Export as Tab")
								.setIcon("file-output")
								.onClick(() => this.openExportView(file.path, "base", "tab"));
						});

						// Existing export configs for this .base file
						const exportConfigs = this.dataExchangeService!.getExportConfigsForSource(file.path);
						if (exportConfigs.length > 0) {
							menu.addSeparator();
							for (const cfg of exportConfigs.slice(0, 5)) {
								menu.addItem((item) => {
									item.setTitle(`Export with: ${cfg.name}`)
										.setIcon("play")
										.onClick(() => this.openExportViewWithConfig(cfg));
								});
							}
						}
					}

					if (file instanceof TFolder) {
						menu.addItem((item) => {
							item.setTitle("Export as CSV")
								.setIcon("file-output")
								.onClick(() => this.openExportView(file.path, "folder", "csv"));
						});
						menu.addItem((item) => {
							item.setTitle("Export as Tab")
								.setIcon("file-output")
								.onClick(() => this.openExportView(file.path, "folder", "tab"));
						});

						// Existing export configs for this folder
						const exportConfigs = this.dataExchangeService!.getExportConfigsForSource(file.path);
						if (exportConfigs.length > 0) {
							menu.addSeparator();
							for (const cfg of exportConfigs.slice(0, 5)) {
								menu.addItem((item) => {
									item.setTitle(`Export with: ${cfg.name}`)
										.setIcon("play")
										.onClick(() => this.openExportViewWithConfig(cfg));
								});
							}
						}
					}
				})
			);

			// CSV view — clicking a .csv opens the import action view
			this.registerView(VIEW_TYPE_CSV, (leaf) => {
				const auto = this.pendingImportAutoStart;
				this.pendingImportAutoStart = false;
				const savedConfig = this.pendingSavedImportConfig;
				this.pendingSavedImportConfig = null;
				const view = new CsvActionView(leaf, this.eventBus, this.dataExchangeService!, auto);
				if (savedConfig) view.setSavedConfig(savedConfig);
				return view;
			});
			try {
				this.registerExtensions(["csv"], VIEW_TYPE_CSV);
			} catch {
				// Extension may already be registered by another plugin
			}

			// Export view — opens from context menus and commands
			this.registerView(VIEW_TYPE_EXPORT, (leaf) => {
				const savedCfg = this.pendingSavedExportConfig;
				this.pendingSavedExportConfig = null;
				const view = new ExportView(leaf, this.eventBus, this.dataExchangeService!, () => {
					const cfg = this.pendingExportConfig;
					this.pendingExportConfig = null;
					return cfg;
				});
				if (savedCfg) view.setSavedConfig(savedCfg);
				return view;
			});

			// Data Exchange Hub — central management view
			this.registerView(VIEW_TYPE_DATA_EXCHANGE_HUB, (leaf) =>
				new DataExchangeHubView(
					leaf,
					this.eventBus,
					this.dataExchangeService!,
					(csvPath, savedConfig) => this.openCsvImportWithConfig(csvPath, savedConfig),
					(savedConfig) => this.openExportWithSavedConfig(savedConfig),
				),
			);

			// Commands for import/export (command palette)
			this.addCommand({
				id: "flowti:import-csv",
				name: "Import CSV as Notes",
				icon: "file-input",
				callback: () => {
					new InputModal(this.app, {
						title: "Import CSV",
						inputName: "CSV file path",
						inputDesc: "Enter the vault path to a .csv file",
						placeholder: "path/to/data.csv",
						submitLabel: "Import",
						onSubmit: (csvPath) => {
							const csvFile = this.app.vault.getAbstractFileByPath(csvPath);
							if (csvFile instanceof TFile) {
								this.pendingImportAutoStart = true;
								const leaf = this.app.workspace.getLeaf(true);
								void leaf.openFile(csvFile);
							} else {
								new Notice(`File not found: ${csvPath}`);
							}
						},
					}).open();
				},
			});

			this.addCommand({
				id: "flowti:export-csv",
				name: "Export as CSV",
				icon: "file-output",
				callback: () => {
					new InputModal(this.app, {
						title: "Export as CSV",
						inputName: "Source path",
						inputDesc: "Enter a folder path or .base file path",
						placeholder: "path/to/folder or path/to/file.base",
						submitLabel: "Export",
						onSubmit: (sourcePath) => {
							const sourceType = sourcePath.endsWith(".base") ? "base" as const : "folder" as const;
							this.openExportView(sourcePath, sourceType, "csv");
						},
					}).open();
				},
			});

			this.addCommand({
				id: "flowti:export-tab",
				name: "Export as Tab-delimited",
				icon: "file-output",
				callback: () => {
					new InputModal(this.app, {
						title: "Export as Tab",
						inputName: "Source path",
						inputDesc: "Enter a folder path or .base file path",
						placeholder: "path/to/folder or path/to/file.base",
						submitLabel: "Export",
						onSubmit: (sourcePath) => {
							const sourceType = sourcePath.endsWith(".base") ? "base" as const : "folder" as const;
							this.openExportView(sourcePath, sourceType, "tab");
						},
					}).open();
				},
			});

			this.addCommand({
				id: "flowti:open-data-exchange",
				name: "Open Data Exchange Hub",
				icon: "arrow-left-right",
				callback: () => {
					const { workspace } = this.app;
					const existing = workspace.getLeavesOfType(VIEW_TYPE_DATA_EXCHANGE_HUB);
					if (existing.length > 0) {
						workspace.revealLeaf(existing[0]);
						return;
					}
					const leaf = workspace.getLeaf(true);
					void leaf.setViewState({ type: VIEW_TYPE_DATA_EXCHANGE_HUB, active: true });
					workspace.revealLeaf(leaf);
				},
			});

			// Run catch-up if watch folders are configured
			if (this.settings.watchFolders.length > 0 && this.ingestionService) {
				const ingestion = this.ingestionService;
				try {
					await ingestion.runCatchUp(this.settings.watchFolders, async (folder) => {
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

			// Register vault/workspace/metadataCache listeners AFTER all services
			// have loaded. Doing this earlier causes a flood of file.created and
			// metadata.changed events during Obsidian's initial cache resolution,
			// spamming the catalog and other listeners before they're ready.
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
	 * Get a service from the container.
	 * Convenience method for external access.
	 */
	async getService<T>(id: string): Promise<T> {
		return this.services.get<T>(id);
	}
}
