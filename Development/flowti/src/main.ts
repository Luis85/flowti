import { Notice, Plugin } from "obsidian";
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
import type { IUserService } from "./domain/user/types";
import type { EventNotificationService } from "./domain/eventNotify/EventNotificationService";
import type { EventFilterService } from "./domain/eventFilter/EventFilterService";
import type { DiscoveryService } from "./domain/discovery/DiscoveryService";
import { registerViews } from "./infrastructure/views/registry";
import type { IViewRegistry } from "./infrastructure/views/types";
import { ViewRegistry } from "./infrastructure/views/ViewRegistry";


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
 * | 1 - Core | Settings, EventBus, Logger, ErrorService, EventBridge |
 * | 2 - Containers | ServiceContainer, CommandRegistry, ViewRegistry |
 * | 3 - Registration | Services, commands, and views are registered |
 * | 4 - Init | All services are initialized in dependency order |
 * | 5 - UI | Settings tab, views, and commands are bound to Obsidian |
 * | 6 - Post-load | User data loaded after layout is ready, plugin.ready emitted |
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
	private collapsedCategories = new Set<string>();

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

			this.eventBridge?.dispose();
			await this.services?.disposeAll();
			this.commands?.clear();
			this.views?.clear();

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
		this.eventBus.on("settings.changed", (event) => {
			this.logger.setDebugMode(event.payload.settings.debugMode);
			this.logger.debug("Settings changed", event.payload.settings);
		});

		this.eventBus.on("settings.updateCatalogCategories", async (event) => {
			this.settings.catalogCategories = event.payload.categories;
			await this.saveSettings();
		});

		this.eventBus.on("settings.updateCollapsedCategories", async (event) => {
			this.collapsedCategories = new Set(event.payload.collapsed);
			this.settings.collapsedCategories = event.payload.collapsed;
			await this.saveSettings();
		});

		this.eventBus.on("error.occurred", (event) => {
			this.logger.debug("Error event received", event.payload);
		});

		this.eventBus.on("user.created", (event) => {
			this.logger.debug("User created", { userName: event.payload.user.name });
		});

		this.eventBus.on("user.updated", (event) => {
			this.logger.debug("User updated", { userName: event.payload.user.name });
		});

		this.eventBus.on("user.loaded", (event) => {
			this.logger.debug("User loaded", { userName: event.payload.user.name });
		});

		this.eventBus.on("plugin.ready", (event) => {
			this.logger.debug("Plugin ready", { timestamp: event.payload.timestamp });
		});

		this.eventBus.on("installer.started", (event) => {
			this.logger.info("Installation started", { stepCount: event.payload.stepCount });
		});

		this.eventBus.on("installer.completed", () => {
			this.logger.info("Installation completed");
		});

		this.eventBus.on("installer.failed", (event) => {
			this.logger.error("Installation failed", {
				step: event.payload.failedStepId,
				error: event.payload.error,
			});
		});

		this.eventBus.on("eventNotify.fired", (event) => {
			new Notice(`Event: ${event.payload.eventType}`);
		});
	}

	/**
	 * Creates the {@link EventBridge} that translates between Obsidian's
	 * vault/fileManager/metadataCache APIs and the internal EventBus.
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
	 * Loads user data and installer state, shows the installer wizard
	 * on first run, and emits `plugin.ready` to signal that the plugin
	 * is fully operational.
	 */
	private async onLayoutReady(): Promise<void> {
		try {
			// Re-emit settings first so views receive persisted state immediately
			await this.eventBus.emit("settings.loaded", { settings: this.settings });

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
