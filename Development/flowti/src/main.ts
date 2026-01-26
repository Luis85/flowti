import { Plugin } from "obsidian";
import {
	CommandRegistry,
	createErrorMiddleware,
	createLoggingMiddleware,
} from "./commands/CommandRegistry";
import { registerCommands } from "./commands/registry";
import type { CommandContext, ICommandRegistry } from "./commands/types";
import { ErrorService } from "./errors/ErrorService";
import { LifecycleError } from "./errors/FlowtiError";
import type { IErrorService } from "./errors/types";
import { EventBus } from "./events/EventBus";
import type { IEventBus } from "./events/types";
import { LoggerService } from "./logger/LoggerService";
import type { ILogger } from "./logger/types";
import { registerServices } from "./services/registry";
import { ServiceContainer } from "./services/ServiceContainer";
import type { IServiceContainer } from "./services/types";
import { FlowtiSettingTab } from "./settings/FlowtiSettingTab";
import {
	DEFAULT_SETTINGS,
	FlowtiSettings,
	FlowtiSettingsSchema,
} from "./settings/settings";
import type { IUserService } from "./user/types";
import { UserSetupModal } from "./user/UserSetupModal";
import { registerViews } from "./views/registry";
import type { IViewRegistry } from "./views/types";
import { ViewRegistry } from "./views/ViewRegistry";
import { VIEW_TYPE_SOLUTION_DASHBOARD } from "./views/SolutionDashboardView";
import { VIEW_TYPE_LIFECYCLE } from "./views/LifecycleView";
import { VIEW_TYPE_TRACEABILITY_MATRIX } from "./views/TraceabilityMatrixView";

/**
 * Main plugin class for Flowti.
 *
 * Initializes core infrastructure in this order:
 * 1. Settings (from storage)
 * 2. EventBus (for decoupled communication)
 * 3. Logger (with EventBus integration)
 * 4. ErrorService (for centralized error handling)
 * 5. ServiceContainer (for dependency injection)
 * 6. CommandRegistry (for plugin commands)
 * 7. Services (UserService, etc.)
 */
export default class FlowtiBasePlugin extends Plugin {
  settings: FlowtiSettings;
  eventBus: IEventBus;
  logger: ILogger;
  errorService: IErrorService;
  services: IServiceContainer;
  commands: ICommandRegistry;
  views: IViewRegistry;

  // Convenience properties for commonly used services
  userService: IUserService;

  async onload() {
    try {
      // Phase 1: Core infrastructure
      await this.loadSettings();
      this.initializeEventBus();

      // Emit loading event as early as possible
      void this.eventBus.emit("plugin.loading", {
        timestamp: new Date().toISOString(),
      });

      this.initializeLogger();
      this.initializeErrorService();
      this.setupEventListeners();

      // Emit settings.loaded after settings are available
      void this.eventBus.emit("settings.loaded", { settings: this.settings });

      // Phase 2: Containers
      this.initializeServiceContainer();
      this.initializeCommandRegistry();
      this.initializeViewRegistry();

      // Phase 3: Register services, commands, and views
      this.registerAllServices();
      this.registerAllCommands();
      this.registerAllViews();

      // Phase 4: Initialize all services
      await this.services.initializeAll();

      // Phase 5: UI setup
      this.addSettingTab(new FlowtiSettingTab(this.app, this));
      this.bindViews();
      this.bindCommands();
      this.bindRibbons();

      // Phase 6: Post-load tasks
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

  async onunload() {
    try {
      // Emit unloading event
      void this.eventBus?.emit("plugin.unloading", {
        timestamp: new Date().toISOString(),
      });

      // Dispose services in reverse order
      await this.services?.disposeAll();
      this.commands?.clear();
      this.views?.clear();

      this.logger?.info("Plugin unloaded");

      // Emit unloaded event before clearing event bus
      void this.eventBus?.emit("plugin.unloaded", {
        timestamp: new Date().toISOString(),
      });

      this.eventBus?.clear();
    } catch (error) {
      console.error("[Flowti] Plugin unload error:", error);
    }
  }

  /**
   * Load settings from storage with validation.
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
  }

  /**
   * Save settings to storage and emit settings.changed event.
   * Preserves other data in storage (like user data).
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
   * Set up event listeners for cross-cutting concerns.
   */
  private setupEventListeners(): void {
    // Update logger when debug mode changes
    this.eventBus.on("settings.changed", (event) => {
      this.logger.setDebugMode(event.payload.settings.debugMode);
      this.logger.debug("Settings changed", event.payload.settings);
    });

    // Log all errors (useful for debugging)
    this.eventBus.on("error.occurred", (event) => {
      this.logger.debug("Error event received", event.payload);
    });

    // Log user events
    this.eventBus.on("user.created", (event) => {
      this.logger.debug("User created", { userName: event.payload.user.name });
    });

    this.eventBus.on("user.updated", (event) => {
      this.logger.debug("User updated", { userName: event.payload.user.name });
    });

    this.eventBus.on("user.loaded", (event) => {
      this.logger.debug("User loaded", { userName: event.payload.user.name });
    });

    // Log lifecycle events
    this.eventBus.on("plugin.ready", (event) => {
      this.logger.debug("Plugin ready", { timestamp: event.payload.timestamp });
    });
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
   * Initialize the command registry with middleware.
   */
  private initializeCommandRegistry(): void {
    this.commands = new CommandRegistry({
      eventBus: this.eventBus,
      logger: this.logger,
    });

    // Add logging middleware
    this.commands.use(createLoggingMiddleware());

    // Add error handling middleware
    this.commands.use(
      createErrorMiddleware((error, command) => {
        this.errorService.handle(error, `Command:${command.id}`);
      }),
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
   * Register all services with the container.
   */
  private registerAllServices(): void {
    registerServices(
      this.services,
      {
        loadData: () => this.loadData(),
        saveData: (data) => this.saveData(data),
      },
      {
        app: this.app,
        getSettings: () => this.settings,
      },
    );
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
    registerViews(this.views);
  }

  /**
   * Bind registered commands to Obsidian.
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
      services: this.services,
    };
  }

  /**
   * Bind registered views to Obsidian.
   * Supports both simple factories and enhanced factories with service access.
   */
  private bindViews(): void {
    for (const view of this.views.getViews()) {
      // Use enhanced factory if available, otherwise use simple factory
      if (view.enhancedFactory) {
        const enhancedFactory = view.enhancedFactory;
        this.registerView(view.type, (leaf) =>
          enhancedFactory(leaf, this.services, this.eventBus),
        );
      } else if (view.factory) {
        this.registerView(view.type, view.factory);
      }
    }
  }

  /**
   * Bind Ribbons to the Sidebar
   */
  private bindRibbons(): void {
    this.addRibbonIcon("store", "Solution Dashboard", () => {
      this.activateView(VIEW_TYPE_SOLUTION_DASHBOARD);
    });
    this.addRibbonIcon("git-branch", "Lifecycle", () => {
      this.activateView(VIEW_TYPE_LIFECYCLE);
    });
    this.addRibbonIcon("table-2", "Traceability Matrix", () => {
      this.activateView(VIEW_TYPE_TRACEABILITY_MATRIX);
    });
  }

  /**
   * Called when Obsidian layout is ready.
   */
  private async onLayoutReady(): Promise<void> {
    try {
      // Get user service from container and store as convenience property
      this.userService = await this.services.get<IUserService>("userService");
      await this.userService.load();

      // Show setup modal if needed
      UserSetupModal.showIfNeeded(this.app, this.userService);

      // Emit plugin.ready event - everything is initialized
      void this.eventBus.emit("plugin.ready", {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.errorService.handle(
        error instanceof Error ? error : new Error(String(error)),
        "onLayoutReady",
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

  // @TODO: Refactor to target specific windows (e.g. Sidebar) when activating
  // maybe its also possible to use obsidians workspace feature and target specific splits
  async activateView(
    viewType: string,
    target: "sb-left" | "main" | "sb-right" = "main",
  ) {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(viewType)[0];

    if (!leaf) {
      const newLeaf = workspace.getLeaf("tab");
      if (newLeaf) {
        await newLeaf.setViewState({ type: viewType, active: true });
        leaf = newLeaf;
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
}
