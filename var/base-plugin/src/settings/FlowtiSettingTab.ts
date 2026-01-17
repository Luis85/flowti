import { App, PluginSettingTab, Setting } from "obsidian";
import FlowtiBasePlugin from "src/main";

export class FlowtiSettingTab extends PluginSettingTab {

	private plugin: FlowtiBasePlugin

	constructor(app: App, plugin: FlowtiBasePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("flowti-settings");

		new Setting(containerEl)
			.setName("Debug mode")
			.setDesc(
				"Log detailed information to the developer console (Ctrl+Shift+I)"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
