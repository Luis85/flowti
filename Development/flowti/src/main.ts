import { Plugin } from "obsidian";
import { EventBus } from "./events/EventBus";
import type { IEventBus } from "./events/types";
import { LoggerService } from "./logger/LoggerService";
import type { ILogger } from "./logger/types";
import { FlowtiSettingTab } from "./settings/FlowtiSettingTab";
import {
  DEFAULT_SETTINGS,
  FlowtiSettings,
  FlowtiSettingsSchema,
} from "./settings/settings";
import type { IUserService } from "./user/types";
import { UserService } from "./user/UserService";
import { UserSetupModal } from "./user/UserSetupModal";

export default class FlowtiBasePlugin extends Plugin {
  settings: FlowtiSettings;
  eventBus: IEventBus;
  logger: ILogger;
  userService: IUserService;

  async onload() {
    await this.loadSettings();
    this.initializeEventBus();
    this.initializeLogger();
    this.setupEventListeners();
    await this.initializeUserService();

    this.addSettingTab(new FlowtiSettingTab(this.app, this));

    this.registerCommands();
    this.registerViews();
    this.registerServices();

    this.app.workspace.onLayoutReady(() => {
      UserSetupModal.showIfNeeded(this.app, this.userService);
    });

    this.logger.info("Plugin loaded");
  }

  async onunload() {
    this.eventBus.clear();
  }

  /**
   * Load settings from storage with validation
   */
  async loadSettings() {
    const data = await this.loadData();
    const result = FlowtiSettingsSchema.safeParse(data);
    this.settings = result.success ? result.data : DEFAULT_SETTINGS;
  }

  /**
   * Save settings to storage and emit settings.changed event
   */
  async saveSettings() {
    await this.saveData(this.settings);
    await this.eventBus.emit("settings.changed", { settings: this.settings });
  }

  /**
   * Register plugin commands
   */
  private registerCommands(): void {}

  /**
   * Register all necessary views
   */
  private registerViews(): void {}

  /**
   * Register and set all necessary services
   */
  private registerServices(): void {}

  /**
   * Initialize the event bus for decoupled communication
   */
  private initializeEventBus(): void {
    this.eventBus = new EventBus();
  }

  /**
   * Initialize the logger service
   */
  private initializeLogger(): void {
    this.logger = new LoggerService({
      eventBus: this.eventBus,
      debugMode: this.settings.debugMode,
    });
  }

  /**
   * Set up event listeners for cross-cutting concerns
   */
  private setupEventListeners(): void {
    // Update logger when debug mode changes
    this.eventBus.on("settings.changed", (event) => {
      this.logger.setDebugMode(event.payload.settings.debugMode);
    });
  }

  /**
   * Initialize the user service and load existing user data
   */
  private async initializeUserService(): Promise<void> {
    this.userService = new UserService({
      storage: {
        load: () => this.loadData(),
        save: (data) => this.saveData(data),
      },
      eventBus: this.eventBus,
    });
    await this.userService.load();
  }
}
