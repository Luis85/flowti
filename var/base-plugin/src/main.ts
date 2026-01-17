import { Plugin } from "obsidian";
import { FlowtiSettingTab } from "./settings/FlowtiSettingTab";
import { DEFAULT_SETTINGS, FlowtiSettings } from "./settings/settings";

export default class FlowtiBasePlugin extends Plugin {
  settings: FlowtiSettings;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new FlowtiSettingTab(this.app, this));

    this.registerCommands();
    this.registerViews();
    this.registerServices();

    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(this.app.vault.on("create", this.startPlugin, this));
    });
  }

  async onunload() {}

  /**
   * Load settings from storage
   */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * Save settings to storage and propagate changes
   */
  async saveSettings() {
    await this.saveData(this.settings);
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
   * Start the plugin after all the setup is done
   */
  private startPlugin() {}
}
